import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CalculatorForm } from './components/CalculatorForm';
import { CurrencyRatesView } from './components/CurrencyRatesView';
import { DashboardView } from './components/DashboardView';
import { CalculationResult, RatesResponse, UserProfile } from './types';
import { POPULAR_CURRENCIES } from './data/currencies';
import { translations, Language } from './data/translations';
import { LoginModal } from './components/LoginModal';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { exportSingleCalculationPDF, exportHistoricalSummaryPDF } from './utils/pdfExport';
import { calculateTradeAndFreight } from './utils/calculator';
import {
  subscribeToCalculations,
  saveCalculationToFirestore,
  deleteCalculationFromFirestore,
  clearAllCalculationsFromFirestore,
  seedDefaultDataToFirestore,
} from './lib/firebase';

const LOCAL_STORAGE_KEY = 'cargo_profit_fx_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'rates' | 'dashboard' | 'admin'>('calculator');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('cargo_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          (parsed.username?.toLowerCase() === 'admin' || parsed.userId === 'USR-ADMIN-001') &&
          parsed.role !== 'admin'
        ) {
          parsed.role = 'admin';
          parsed.status = 'active';
          localStorage.setItem('cargo_user_profile', JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {}
    return null;
  });

  // Auto-seed Firestore on initial app mount
  useEffect(() => {
    seedDefaultDataToFirestore();
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

  // History State - Start empty without default mock templates as requested
  const [history, setHistory] = useState<CalculationResult[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to parse saved history', err);
    }
    return [];
  });

  // Real-time Firestore sync with per-user data isolation
  useEffect(() => {
    if (!userProfile) return;
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

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.error('Failed to save history to localStorage', err);
    }
  }, [history]);

  // Fetch Exchange Rates from backend proxy with real-time direct client fallback
  const fetchExchangeRates = useCallback(async (forceRefresh = false) => {
    setIsLoadingRates(true);
    let success = false;

    try {
      const endpoint = forceRefresh ? '/api/exchange-rates/refresh' : '/api/exchange-rates';
      const method = forceRefresh ? 'POST' : 'GET';
      const res = await fetch(endpoint, { method });

      if (res.ok) {
        const data: RatesResponse = await res.json();
        if (data && data.rates && Object.keys(data.rates).length > 0) {
          setRates((prev) => ({ ...prev, ...data.rates }));
          setLastUpdated(data.lastUpdated || new Date().toISOString());
          setRateSource(data.source || 'Live Server API');
          success = true;
        }
      }
    } catch (err) {
      console.warn('Server rate endpoint failed, attempting direct live client fetch...', err);
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
        console.warn('Direct client exchange rate fetch failed', err);
      }
    }

    setIsLoadingRates(false);
  }, []);

  // Real-time polling every 60 seconds
  useEffect(() => {
    fetchExchangeRates();

    const interval = setInterval(() => {
      fetchExchangeRates();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchExchangeRates]);

  // Actions
  const handleSaveToHistory = async (result: CalculationResult) => {
    const resultWithUser: CalculationResult = {
      ...result,
      userId: userProfile?.userId || result.userId,
    };

    try {
      await saveCalculationToFirestore(resultWithUser);
    } catch (err: any) {
      console.info('Firestore notice (local storage active):', err?.message || err);
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
      await deleteCalculationFromFirestore(id);
    } catch (err: any) {
      console.info('Firestore notice (local storage active):', err?.message || err);
    }
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllHistory = async () => {
    if (window.confirm(lang === 'ar' ? 'هل أنت تأكد من رغبتك في مسح كافة السجلات التاريخية؟' : 'Are you sure you want to clear all historical calculation records?')) {
      try {
        const filterUserId = (userProfile?.role === 'admin' || userProfile?.username?.toLowerCase() === 'admin')
          ? null
          : userProfile?.userId;
        await clearAllCalculationsFromFirestore(filterUserId);
      } catch (err: any) {
        console.info('Firestore notice (local storage active):', err?.message || err);
      }
      setHistory([]);
    }
  };

  const handleLoadIntoCalculator = (result: CalculationResult) => {
    setActiveTab('calculator');
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
      <LoginScreen
        lang={lang}
        setLang={setLang}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onLoginSuccess={(profile) => {
          setUserProfile(profile);
          if (profile.role === 'admin' || profile.username?.toLowerCase() === 'admin') {
            setActiveTab('admin');
          }
        }}
      />
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
          onLogout={() => {
            localStorage.removeItem('cargo_user_profile');
            setUserProfile(null);
            setActiveTab('calculator');
          }}
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
          onLogout={() => {
            localStorage.removeItem('cargo_user_profile');
            setUserProfile(null);
          }}
        />

        {/* Content Container */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'calculator' && (
            <CalculatorForm
              rates={rates}
              onSaveToHistory={handleSaveToHistory}
              savedIds={savedIds}
              t={t}
              lang={lang}
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
              onClearAllHistory={handleClearAllHistory}
              onLoadIntoCalculator={handleLoadIntoCalculator}
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
            <span className="font-bold text-slate-200">CargoProfit FX</span> — {t.subTitle}
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
          setUserProfile(profile);
          setIsLoginModalOpen(false);
        }}
      />
    </div>
  );
}

