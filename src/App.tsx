import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CalculatorForm } from './components/CalculatorForm';
import { CurrencyRatesView } from './components/CurrencyRatesView';
import { DashboardView } from './components/DashboardView';
import { CalculationResult, RatesResponse } from './types';
import { POPULAR_CURRENCIES } from './data/currencies';
import { translations, Language } from './data/translations';
import {
  subscribeToCalculations,
  saveCalculationToFirestore,
  deleteCalculationFromFirestore,
  clearAllCalculationsFromFirestore,
} from './lib/firebase';

const LOCAL_STORAGE_KEY = 'cargo_profit_fx_history_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'rates' | 'dashboard'>('calculator');
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

  // Real-time Firestore sync
  useEffect(() => {
    const unsubscribe = subscribeToCalculations((firestoreData) => {
      if (Array.isArray(firestoreData)) {
        setHistory(firestoreData);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.error('Failed to save history to localStorage', err);
    }
  }, [history]);

  // Fetch Exchange Rates from backend proxy
  const fetchExchangeRates = useCallback(async (forceRefresh = false) => {
    setIsLoadingRates(true);
    try {
      const endpoint = forceRefresh ? '/api/exchange-rates/refresh' : '/api/exchange-rates';
      const method = forceRefresh ? 'POST' : 'GET';
      const res = await fetch(endpoint, { method });

      if (res.ok) {
        const data: RatesResponse = await res.json();
        if (data && data.rates) {
          setRates(data.rates);
          setLastUpdated(data.lastUpdated);
          setRateSource(data.source);
        }
      }
    } catch (err) {
      console.warn('Could not fetch server rates, using internal baseline...', err);
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    fetchExchangeRates();
  }, [fetchExchangeRates]);

  // Actions
  const handleSaveToHistory = async (result: CalculationResult) => {
    try {
      await saveCalculationToFirestore(result);
    } catch (err) {
      console.error('Firestore save failed, saving locally:', err);
    }

    setHistory((prev) => {
      const existsIndex = prev.findIndex((item) => item.id === result.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = result;
        return updated;
      }
      return [result, ...prev];
    });
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteCalculationFromFirestore(id);
    } catch (err) {
      console.error('Firestore delete failed:', err);
    }
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllHistory = async () => {
    if (window.confirm(lang === 'ar' ? 'هل أنت تأكد من رغبتك في مسح كافة السجلات التاريخية؟' : 'Are you sure you want to clear all historical calculation records?')) {
      try {
        await clearAllCalculationsFromFirestore();
      } catch (err) {
        console.error('Firestore clear all failed:', err);
      }
      setHistory([]);
    }
  };

  const handleLoadIntoCalculator = (result: CalculationResult) => {
    setActiveTab('calculator');
  };

  const savedIds = history.map((h) => h.id);

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
    </div>
  );
}

