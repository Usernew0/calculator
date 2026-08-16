import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { Header } from './components/Header';
import { CalculatorForm } from './components/CalculatorForm';
import { CurrencyRatesView } from './components/CurrencyRatesView';
import { DashboardView } from './components/DashboardView';
import { GalleryView } from './components/GalleryView';
import { CalculationResult, CalculationInput, RatesResponse, UserProfile } from './types';
import { POPULAR_CURRENCIES } from './data/currencies';
import { translations, Language } from './data/translations';
import { LoginModal } from './components/LoginModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { exportSingleCalculationPDF, exportHistoricalSummaryPDF } from './utils/pdfExport';
import { calculateTradeAndFreight } from './utils/calculator';
import {
  getStoredUserProfile,
  setStoredUserProfile,
  clearFullSession,
  saveFullSession,
  onSessionInvalidated,
  triggerSessionInvalidation,
  clearSessionInvalidationNotice,
  STORAGE_KEYS,
} from './lib/session';
import {
  subscribeToCalculations,
  saveCalculationToFirestore,
  deleteCalculationFromFirestore,
  clearAllCalculationsFromFirestore,
  seedDefaultDataToFirestore,
  getSiteFaviconFromFirestore,
  subscribeToSiteFavicon,
  subscribeToUserSessionStatus,
  getUserProfileFromFirestore,
} from './lib/firebase';
import {
  getCalculationsApi,
  saveCalculationApi,
  deleteCalculationApi,
  clearCalculationsApi,
  getSiteFaviconApi,
  fetchCurrentAuthUserApi,
} from './lib/api';
import {
  updateWebsiteFavicon,
  getSavedFavicon,
  setSavedFaviconLocally,
} from './utils/favicon';

const LOCAL_STORAGE_KEY = 'cargo_profit_fx_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'rates' | 'dashboard' | 'gallery' | 'admin'>('calculator');
  const [calculatorInitialInput, setCalculatorInitialInput] = useState<CalculationInput | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    return getStoredUserProfile();
  });

  // Auto-seed Firestore on initial app mount and initialize site Favicon
  useEffect(() => {
    seedDefaultDataToFirestore();

    // 1. Apply local saved favicon immediately
    const initialFavicon = getSavedFavicon();
    updateWebsiteFavicon(initialFavicon);

    // 2. Fetch global site favicon from Firestore
    getSiteFaviconFromFirestore().then((remoteFavicon) => {
      if (remoteFavicon) {
        setSavedFaviconLocally(remoteFavicon);
      }
    });

    // 3. Listen to realtime site favicon changes from Firestore
    const unsubscribeFavicon = subscribeToSiteFavicon((newFavicon) => {
      if (newFavicon) {
        setSavedFaviconLocally(newFavicon);
      }
    });

    // 4. Custom window event listener for instant local favicon updates
    const handleFaviconEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        updateWebsiteFavicon(customEvent.detail);
      }
    };
    window.addEventListener('cargo_favicon_changed', handleFaviconEvent);

    return () => {
      unsubscribeFavicon();
      window.removeEventListener('cargo_favicon_changed', handleFaviconEvent);
    };
  }, []);

  // Guard admin tab
  useEffect(() => {
    if (activeTab === 'admin' && userProfile?.role !== 'admin') {
      setActiveTab('calculator');
    }
  }, [activeTab, userProfile]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('cargo_profit_lang');
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {}
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem('cargo_profit_lang', lang);
    } catch {}
  }, [lang]);

  const t = translations[lang];

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cargo_profit_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('cargo_profit_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('cargo_profit_theme', 'light');
    }
  }, [isDarkMode]);

  // Rates State
  const [rates, setRates] = useState<Record<string, number>>(() => {
    const initialMap: Record<string, number> = {};
    POPULAR_CURRENCIES.forEach((c) => {
      initialMap[c.code] = c.rateToUSD;
    });
    return initialMap;
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState<string>('Live Exchange API');
  const [isLoadingRates, setIsLoadingRates] = useState<boolean>(false);

  // History State - Isolated per logged-in user
  const [history, setHistory] = useState<CalculationResult[]>([]);

  // Real-time Firestore sync with per-user data isolation & cache management
  useEffect(() => {
    // Clear legacy un-isolated storage key
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    if (!userProfile) {
      setHistory([]);
      setCalculatorInitialInput(null);
      return;
    }

    // Load isolated local cache for this specific user
    const userStorageKey = `cargo_profit_fx_history_${userProfile.userId.toLowerCase()}`;
    try {
      const saved = localStorage.getItem(userStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        } else {
          setHistory([]);
        }
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    }

    setCalculatorInitialInput(null);

    const filterUserId = (userProfile.role === 'admin' || userProfile.username?.toLowerCase() === 'admin')
      ? null
      : userProfile.userId;

    const unsubscribe = subscribeToCalculations(
      (firestoreData) => {
        if (Array.isArray(firestoreData)) {
          if (filterUserId) {
            const userOnly = firestoreData.filter(
              (item) => item.userId === filterUserId || item.userId?.toLowerCase() === filterUserId.toLowerCase()
            );
            setHistory(userOnly);
          } else {
            setHistory(firestoreData);
          }
        }
      },
      filterUserId
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userProfile]);

  // Save isolated history to localStorage per user
  useEffect(() => {
    if (!userProfile?.userId) return;
    try {
      const userStorageKey = `cargo_profit_fx_history_${userProfile.userId.toLowerCase()}`;
      localStorage.setItem(userStorageKey, JSON.stringify(history));
    } catch (err) {
      console.error('Failed to save history to localStorage', err);
    }
  }, [history, userProfile]);

  // Central Logout Handler - Resets state, inputs and clears user session
  const handleLogout = useCallback(() => {
    if (userProfile?.userId) {
      const userStorageKey = `cargo_profit_fx_history_${userProfile.userId.toLowerCase()}`;
      localStorage.removeItem(userStorageKey);
    }
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    clearFullSession();
    setUserProfile(null);
    setHistory([]);
    setCalculatorInitialInput(null);
    setActiveTab('calculator');
  }, [userProfile]);

  // Real-Time Session Credential Auto-Refresh & Database Sync Guard
  useEffect(() => {
    if (!userProfile) return;

    // 1. Listen for global session invalidation events (e.g. 401/403 intercepted from any API call)
    const unsubInvalidated = onSessionInvalidated(() => {
      handleLogout();
    });

    // 2. Periodic Auto-Refresh Heartbeat: check credentials against database every 5 seconds
    const interval = setInterval(async () => {
      try {
        const user = await fetchCurrentAuthUserApi();
        if (user) {
          if (user.status === 'suspended') {
            triggerSessionInvalidation({
              code: 'ACCOUNT_SUSPENDED',
              messageEn: 'Your account has been suspended by the administrator.',
              messageAr: 'تم تعليق هذا الحساب من قبل مدير النظام.',
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // Live role elevation / demotion sync
          if (user.role && user.role !== userProfile.role) {
            const updated = { ...userProfile, role: user.role };
            setUserProfile(updated);
            setStoredUserProfile(updated);
          }
        }

        // Direct database verification failsafe for password updates
        if (userProfile.username) {
          try {
            const dbUser = await getUserProfileFromFirestore(userProfile.username);
            if (dbUser) {
              if (dbUser.status === 'suspended') {
                triggerSessionInvalidation({
                  code: 'ACCOUNT_SUSPENDED',
                  messageEn: 'Your account has been suspended by the administrator.',
                  messageAr: 'تم تعليق هذا الحساب من قبل مدير النظام.',
                  timestamp: new Date().toISOString(),
                });
                return;
              }
              if (userProfile.password && dbUser.password && dbUser.password !== userProfile.password) {
                triggerSessionInvalidation({
                  code: 'CREDENTIALS_CHANGED',
                  messageEn: 'Your password was updated by the administrator. Please log in with your new password.',
                  messageAr: 'تم تحديث كلمة المرور من قبل مدير النظام. يرجى تسجيل الدخول بكلمة المرور الجديدة.',
                  timestamp: new Date().toISOString(),
                });
                return;
              }
            }
          } catch {}
        }
      } catch (err) {
        // Handled in apiFetch interceptor
      }
    }, 5000);

    // 3. Tab focus & visibility change immediate credential refresh
    const handleFocusRefresh = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const user = await fetchCurrentAuthUserApi();
          if (user && user.role && user.role !== userProfile.role) {
            const updated = { ...userProfile, role: user.role };
            setUserProfile(updated);
            setStoredUserProfile(updated);
          }
          if (userProfile.username) {
            const dbUser = await getUserProfileFromFirestore(userProfile.username);
            if (dbUser && userProfile.password && dbUser.password && dbUser.password !== userProfile.password) {
              triggerSessionInvalidation({
                code: 'CREDENTIALS_CHANGED',
                messageEn: 'Your password was updated by the administrator. Please log in with your new password.',
                messageAr: 'تم تحديث كلمة المرور من قبل مدير النظام. يرجى تسجيل الدخول بكلمة المرور الجديدة.',
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch {}
      }
    };
    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleFocusRefresh);

    // 4. Real-time Firestore account listener: catches instant admin deletions, suspensions, or edits (< 1s)
    const unsubFirestore = subscribeToUserSessionStatus(
      userProfile.username,
      userProfile.password,
      ({ status, user }) => {
        if (status === 'deleted') {
          triggerSessionInvalidation({
            code: 'ACCOUNT_DELETED',
            messageEn: 'Your account has been removed by the administrator.',
            messageAr: 'تم حذف حسابك من قبل مدير النظام.',
            timestamp: new Date().toISOString(),
          });
        } else if (status === 'suspended' || user?.status === 'suspended') {
          triggerSessionInvalidation({
            code: 'ACCOUNT_SUSPENDED',
            messageEn: 'Your account has been suspended by the administrator.',
            messageAr: 'تم تعليق هذا الحساب من قبل مدير النظام.',
            timestamp: new Date().toISOString(),
          });
        } else if (status === 'credentials_changed') {
          triggerSessionInvalidation({
            code: 'CREDENTIALS_CHANGED',
            messageEn: 'Your password was updated by the administrator. Please log in with your new password.',
            messageAr: 'تم تحديث كلمة المرور من قبل مدير النظام. يرجى تسجيل الدخول بكلمة المرور الجديدة.',
            timestamp: new Date().toISOString(),
          });
        } else if (user && user.role && user.role !== userProfile.role) {
          const updated = { ...userProfile, role: user.role };
          setUserProfile(updated);
          setStoredUserProfile(updated);
        }
      }
    );

    return () => {
      clearInterval(interval);
      unsubInvalidated();
      unsubFirestore();
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleFocusRefresh);
    };
  }, [userProfile, handleLogout]);

  // Inactivity Timeout Management
  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cargo_inactivity_timeout_minutes');
      return saved ? parseInt(saved, 10) || 15 : 15;
    } catch {
      return 15;
    }
  });

  const lastActivityRef = useRef<number>(Date.now());
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);

  // Sync timeout setting if updated from Admin Panel in real time
  useEffect(() => {
    const handleTimeoutUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (customEvent.detail) {
        setInactivityTimeoutMinutes(customEvent.detail);
      }
    };
    window.addEventListener('cargo_timeout_updated', handleTimeoutUpdate);
    return () => window.removeEventListener('cargo_timeout_updated', handleTimeoutUpdate);
  }, []);

  // Track activity & trigger auto logout upon inactivity timeout
  useEffect(() => {
    if (!userProfile) return;

    lastActivityRef.current = Date.now();

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 2000) {
        lastActivityRef.current = now;
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      const limitMs = inactivityTimeoutMinutes * 60 * 1000;

      if (idleMs >= limitMs) {
        handleLogout();
        setInactivityNotice(
          lang === 'ar'
            ? `تم تسجيل الخروج تلقائياً لعدم وجود نشاط لمدة ${inactivityTimeoutMinutes} دقيقة.`
            : `Logged out automatically due to inactivity (${inactivityTimeoutMinutes} mins).`
        );
      }
    }, 5000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      clearInterval(interval);
    };
  }, [userProfile, inactivityTimeoutMinutes, handleLogout, lang]);

  // Fetch Exchange Rates from backend proxy with real-time direct client fallback
  const fetchExchangeRates = useCallback(async (forceRefresh = false) => {
    setIsLoadingRates(true);
    let success = false;

    try {
      const timestamp = Date.now();
      const endpoint = forceRefresh
        ? `/api/exchange-rates/refresh?_t=${timestamp}`
        : `/api/exchange-rates?_t=${timestamp}`;
      const method = forceRefresh ? 'POST' : 'GET';
      const res = await fetch(endpoint, {
        method,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (res.ok) {
        const data: RatesResponse = await res.json();
        if (data && data.rates && Object.keys(data.rates).length > 0) {
          // Replace object reference to force dependent component re-calculations
          setRates({ ...data.rates });
          setLastUpdated(data.lastUpdated || new Date().toISOString());
          setRateSource(data.source || 'Live Server API');
          success = true;
        }
      }
    } catch (err) {
      // Server endpoint temporary offline, attempt client fallback quietly
    }

    // Direct client live fallback if server is unreachable
    if (!success) {
      try {
        const clientRes = await fetch('https://open.er-api.com/v6/latest/USD');
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          if (clientData && clientData.rates) {
            setRates((prev) => ({ ...prev, ...clientData.rates }));
            setLastUpdated(new Date().toISOString());
            setRateSource('Open Exchange Rates (Client Direct)');
            success = true;
          }
        }
      } catch (err) {
        // Direct fallback attempt quiet catch
      }
    }

    setIsLoadingRates(false);
  }, []);

  // Real-time polling every 30 seconds
  useEffect(() => {
    fetchExchangeRates();

    const interval = setInterval(() => {
      fetchExchangeRates();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchExchangeRates]);

  // Actions
  const handleSaveToHistory = async (result: CalculationResult) => {
    const resultWithUser: CalculationResult = {
      ...result,
      userId: userProfile?.userId || result.userId,
    };

    try {
      await saveCalculationApi(resultWithUser);
      await saveCalculationToFirestore(resultWithUser);
    } catch (err: any) {
      console.info('API save calculation notice:', err?.message || err);
    }

    setHistory((prev) => {
      const existsIndex = prev.findIndex((item) => item.id === resultWithUser.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = resultWithUser;
        return updated;
      }
      return [resultWithUser, ...prev];
    });
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteCalculationApi(id);
      await deleteCalculationFromFirestore(id);
    } catch (err: any) {
      console.info('API delete calculation notice:', err?.message || err);
    }
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBatchDeleteRecords = async (ids: string[]) => {
    for (const id of ids) {
      try {
        await deleteCalculationApi(id);
        await deleteCalculationFromFirestore(id);
      } catch (err: any) {
        console.info('API batch delete notice:', err?.message || err);
      }
    }
    setHistory((prev) => prev.filter((item) => !ids.includes(item.id)));
  };

  const handleClearAllHistory = async () => {
    if (window.confirm(lang === 'ar' ? 'هل أنت تأكد من رغبتك في مسح كافة السجلات التاريخية؟' : 'Are you sure you want to clear all historical calculation records?')) {
      try {
        const filterUserId = (userProfile?.role === 'admin' || userProfile?.username?.toLowerCase() === 'admin')
          ? undefined
          : userProfile?.userId;
        await clearCalculationsApi(filterUserId);
        await clearAllCalculationsFromFirestore(filterUserId);
      } catch (err: any) {
        console.info('API clear all calculations notice:', err?.message || err);
      }
      setHistory([]);
    }
  };

  const handleLoadIntoCalculator = (result: CalculationResult) => {
    setCalculatorInitialInput({
      ...result.input,
      extraFees: result.input.extraFees ? [...result.input.extraFees] : [],
    });
    setActiveTab('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHeaderExportPdf = async () => {
    if (history.length > 0) {
      // Export latest calculation
      await exportSingleCalculationPDF(history[0], lang);
    } else {
      // Generate standard template calculation to export
      const demoResult = calculateTradeAndFreight({
        title: lang === 'ar' ? 'شحنة استيراد بضائع' : 'Import Trade Cargo',
        skuSupplier: 'SKU-LOGISTICS-01',
        category: 'General Cargo',
        quantity: 100,
        originalPrice: 25,
        originalCurrency: 'USD',
        weight: 12,
        weightUnit: 'kg',
        useWeightOnly: true,
        freightMethod: 'air_express',
        freightCurrency: 'USD',
        freightRatePerUnit: 4.5,
        freightRateType: 'per_weight',
        freightRateBasis: 'per_kg',
        showCustomRates: true,
        originHandlingFee: 15,
        destinationHandlingFee: 20,
        customsClearanceFee: 30,
        dutyPercentage: 5,
        insurancePercentage: 1,
        inlandDeliveryFee: 25,
        extraFees: [],
        targetCurrency: 'EGP',
        pricingStrategy: 'margin',
        targetValue: 25,
      }, rates);
      await exportSingleCalculationPDF(demoResult, lang);
    }
  };

  const savedIds = history.map((h) => h.id);

  // If user is not logged in, render full-screen Login Screen gate
  if (!userProfile) {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {inactivityNotice && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-black text-center flex items-center justify-center gap-2 shadow-md relative z-50">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>{inactivityNotice}</span>
            <button
              onClick={() => setInactivityNotice(null)}
              className="ltr:ml-2 rtl:mr-2 px-2 py-0.5 rounded bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 font-black text-[11px] cursor-pointer transition-colors"
            >
              {lang === 'ar' ? 'إغلاق' : 'Dismiss'}
            </button>
          </div>
        )}
        <LoginScreen
          lang={lang}
          setLang={setLang}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onLoginSuccess={(profile) => {
            setInactivityNotice(null);
            setHistory([]);
            setCalculatorInitialInput(null);
            setUserProfile(profile);
            if (profile.role === 'admin' || profile.username?.toLowerCase() === 'admin') {
              setActiveTab('admin');
            } else {
              setActiveTab('calculator');
            }
          }}
        />
      </div>
    );
  }

  // Dedicated, Separated Admin Portal View (Admin opens ONLY the admin panel and cannot add data in trader website)
  if (userProfile?.role === 'admin' || userProfile?.username?.toLowerCase() === 'admin') {
    return (
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-900 text-slate-100 font-sans">
        <AdminPanel
          lang={lang}
          setLang={setLang}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          currentUser={userProfile}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950"
    >
      <div>
        {/* Navbar */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          rates={rates}
          lastUpdated={lastUpdated}
          isLoadingRates={isLoadingRates}
          onRefreshRates={() => fetchExchangeRates(true)}
          historyCount={history.length}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          lang={lang}
          setLang={setLang}
          t={t}
          onExportPdf={handleHeaderExportPdf}
          userProfile={userProfile}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Content Container */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'calculator' && (
            <CalculatorForm
              key={userProfile?.userId || 'guest'}
              rates={rates}
              onSaveToHistory={handleSaveToHistory}
              savedIds={savedIds}
              t={t}
              lang={lang}
              initialInput={calculatorInitialInput}
              history={history}
            />
          )}

          {activeTab === 'rates' && (
            <CurrencyRatesView
              rates={rates}
              lastUpdated={lastUpdated}
              isLoading={isLoadingRates}
              onRefresh={() => fetchExchangeRates(true)}
              source={rateSource}
              t={t}
              lang={lang}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              history={history}
              onDeleteRecord={handleDeleteRecord}
              onBatchDeleteRecords={handleBatchDeleteRecords}
              onClearAllHistory={handleClearAllHistory}
              onLoadIntoCalculator={handleLoadIntoCalculator}
              onSaveRecord={handleSaveToHistory}
              rates={rates}
              t={t}
              lang={lang}
              currentUserCompany={userProfile?.companyName || userProfile?.fullName || ''}
            />
          )}

          {activeTab === 'gallery' && (
            <GalleryView
              history={history}
              onLoadIntoCalculator={handleLoadIntoCalculator}
              onNavigateToCalculator={() => setActiveTab('calculator')}
              onSaveRecord={handleSaveToHistory}
              onDeleteRecord={handleDeleteRecord}
              rates={rates}
              t={t}
              lang={lang}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-slate-200">Elegant FX</span> — {t.subTitle}
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>{t.liveRatesTitle}</span>
            <span>PDF: Active</span>
            <span>{t.exportCsv}</span>
          </div>
        </div>
      </footer>
      {/* Login / User ID Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        lang={lang}
        currentUser={userProfile}
        onLoginSuccess={(profile) => {
          setHistory([]);
          setCalculatorInitialInput(null);
          setUserProfile(profile);
          setIsLoginModalOpen(false);
        }}
      />
    </div>
  );
}

