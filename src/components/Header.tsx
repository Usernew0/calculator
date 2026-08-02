import React from 'react';
import { Ship, RefreshCw, BarChart2, Calculator, DollarSign, Clock, ArrowUpRight, ArrowDownRight, Sun, Moon, Globe } from 'lucide-react';
import { POPULAR_CURRENCIES } from '../data/currencies';
import { translations, Language } from '../data/translations';

interface HeaderProps {
  activeTab: 'calculator' | 'rates' | 'dashboard';
  setActiveTab: (tab: 'calculator' | 'rates' | 'dashboard') => void;
  rates: Record<string, number>;
  lastUpdated: string | null;
  isLoadingRates: boolean;
  onRefreshRates: () => void;
  historyCount: number;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof translations['en'];
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  rates,
  lastUpdated,
  isLoadingRates,
  onRefreshRates,
  historyCount,
  isDarkMode,
  setIsDarkMode,
  lang,
  setLang,
  t,
}) => {
  const formatTime = (iso: string | null) => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Select top currencies for top live ticker
  const tickerCurrencies = ['EUR', 'GBP', 'JPY', 'CNY', 'AED', 'SAR', 'EGP', 'BRL'];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* Top Currency Rates Ticker Bar */}
      <div className="bg-slate-950/80 border-b border-slate-800/80 text-xs py-1.5 px-4 overflow-x-auto no-scrollbar flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0 text-slate-400 font-medium">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300">
            {lang === 'ar' ? 'أسعار العملات الحية (أساس USD)' : 'Live FX Rates (USD Base)'}
          </span>
        </div>

        <div className="flex items-center gap-6 shrink-0 font-mono text-xs">
          {tickerCurrencies.map((code) => {
            const curr = POPULAR_CURRENCIES.find((c) => c.code === code);
            const rate = rates[code] || curr?.rateToUSD || 1;
            const change = curr?.change24h || 0;
            const isUp = change >= 0;

            return (
              <div key={code} className="flex items-center gap-1.5">
                <span className="text-slate-400">{curr?.flag || ''} {code}:</span>
                <span className="font-semibold text-slate-100">{rate < 10 ? rate.toFixed(4) : rate.toFixed(2)}</span>
                <span className={`text-[10px] flex items-center ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(change).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-slate-400 text-[11px]">
          <Clock className="w-3 h-3" />
          <span>{t.lastUpdatedLabel} {formatTime(lastUpdated)}</span>
          <button
            onClick={onRefreshRates}
            disabled={isLoadingRates}
            title={t.refreshNow}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRates ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('calculator')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <Ship className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
              {t.appName}
            </div>
            <div className="text-[11px] text-slate-400 font-medium tracking-wide">
              {t.appSubtitle}
            </div>
          </div>
        </div>

        {/* Controls: Language, Theme & Navigation Tabs */}
        <div className="flex items-center gap-2.5">
          {/* Language Toggle */}
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title={lang === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.languageToggle}</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center cursor-pointer shadow-xs"
            title={isDarkMode ? t.switchToLight : t.switchToDark}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-300" />
            )}
          </button>

          <nav className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'calculator'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">{t.calculatorTab}</span>
            </button>

            <button
              onClick={() => setActiveTab('rates')}
              className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'rates'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">{t.ratesTab}</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-medium transition-all relative cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t.dashboardTab}</span>
              {historyCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'dashboard' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {historyCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

