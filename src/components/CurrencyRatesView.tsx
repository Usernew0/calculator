import React, { useState, useEffect } from 'react';
import { POPULAR_CURRENCIES, convertCurrency, getCurrencySymbol } from '../data/currencies';
import { RefreshCw, Search, ArrowRightLeft, Clock, ExternalLink } from 'lucide-react';
import { translations, Language } from '../data/translations';

interface CurrencyRatesViewProps {
  rates: Record<string, number>;
  lastUpdated: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  source: string;
  t: typeof translations['en'];
  lang: Language;
}

export const CurrencyRatesView: React.FC<CurrencyRatesViewProps> = ({
  rates,
  lastUpdated,
  isLoading,
  onRefresh,
  source,
  t,
  lang,
}) => {
  const [baseCurrency, setBaseCurrency] = useState('EGP');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // seconds
  const [timerProgress, setTimerProgress] = useState<number>(100);

  // Currency Converter Quick Widget state
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [calcFrom, setCalcFrom] = useState('USD');
  const [calcTo, setCalcTo] = useState('EGP');

  // Auto-refresh timer countdown effect
  const [showToast, setShowToast] = useState(false);

  const handleManualRefresh = () => {
    setTimerProgress(100);
    onRefresh();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const tickMs = 1000;
    const totalMs = autoRefreshInterval * 1000;
    let elapsedMs = 0;

    const interval = setInterval(() => {
      elapsedMs += tickMs;
      const remainingPct = Math.max(0, 100 - (elapsedMs / totalMs) * 100);
      setTimerProgress(remainingPct);

      if (elapsedMs >= totalMs) {
        onRefresh();
        elapsedMs = 0;
        setTimerProgress(100);
      }
    }, tickMs);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, onRefresh]);

  const filteredCurrencies = POPULAR_CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const conversion = convertCurrency(calcAmount, calcFrom, calcTo, rates);

  const handleSwap = () => {
    setCalcFrom(calcTo);
    setCalcTo(calcFrom);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Live Status */}
      <div className="bg-slate-900 dark:bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            {t.liveRatesTitle}
            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 font-extrabold text-[10px] ltr:ml-1 rtl:mr-1">
              XE.com
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">{t.fxRatesHeader}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {t.dataSource}: <strong className="text-slate-200">{source || 'XE Currency Converter (Live Mid-Market)'}</strong> | {t.lastUpdated}:{' '}
            <strong className="text-slate-200">
              {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : t.updating}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://www.xe.com/currencyconverter/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 rounded-xl font-bold text-xs border border-blue-500/40 transition-all cursor-pointer"
            title="Verify live exchange rates on XE Currency Converter"
          >
            <span>XE.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="bg-slate-800/90 rounded-xl p-2 px-3 border border-slate-700/80 flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-medium">{t.autoRefresh}:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => {
                setAutoRefreshInterval(parseInt(e.target.value));
                setTimerProgress(100);
              }}
              className="bg-slate-900 text-white border border-slate-700 rounded-lg text-xs px-2 py-1 font-semibold focus:outline-hidden"
            >
              <option value={30}>{t.every30s}</option>
              <option value={60}>{t.every1m}</option>
              <option value={300}>{t.every5m}</option>
              <option value={0}>{t.manualOnly}</option>
            </select>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? t.updatingRates : t.refreshNow}</span>
          </button>
        </div>
      </div>

      {showToast && (
        <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>
              {lang === 'ar'
                ? 'تم تحديث أسعار الصرف مباشرة من موقع XE Currency Converter ✨'
                : 'Exchange rates updated live directly from XE Currency Converter ✨'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-200">
            USD / EGP: {rates['EGP'] ? rates['EGP'].toFixed(2) : '49.72'} EGP
          </span>
        </div>
      )}

      {/* Auto-refresh visual progress bar */}
      {autoRefreshInterval > 0 && (
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            style={{ width: `${timerProgress}%` }}
            className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
          />
        </div>
      )}

      {/* Instant Currency Converter Calculator Widget */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <ArrowRightLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{t.quickConverterTitle}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {t.amountPlaceholder}
            </label>
            <input
              type="number"
              value={calcAmount}
              onChange={(e) => setCalcAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {t.fromCurrency}
            </label>
            <select
              value={calcFrom}
              onChange={(e) => setCalcFrom(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {POPULAR_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center md:col-span-1 pt-4 md:pt-0">
            <button
              onClick={handleSwap}
              className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 rounded-full border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-xs"
              title={t.swapCurrencies}
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {t.toCurrency}
            </label>
            <select
              value={calcTo}
              onChange={(e) => setCalcTo(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {POPULAR_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Conversion Result Output */}
        <div className="mt-5 p-4 bg-slate-900 dark:bg-slate-950 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800">
          <div>
            <div className="text-xs text-slate-400 font-medium">{t.convertedValue}:</div>
            <div className="text-2xl font-extrabold text-emerald-400">
              {getCurrencySymbol(calcTo)}
              {conversion.converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="text-sm text-slate-300 font-semibold">{calcTo}</span>
            </div>
          </div>

          <div className="text-right text-xs text-slate-300 font-mono">
            <div>
              1 {calcFrom} = {conversion.rate.toFixed(4)} {calcTo}
            </div>
            <div className="text-slate-400 text-[11px]">
              1 {calcTo} = {(1 / conversion.rate).toFixed(4)} {calcFrom}
            </div>
          </div>
        </div>
      </div>

      {/* Currency Rates Grid Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm space-y-4 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{t.matrixTitle}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.matrixSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Base Currency Select */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
              <span>{t.baseLabel}:</span>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
              >
                {POPULAR_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={t.searchCurrencyPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredCurrencies.map((curr) => {
            const { rate } = convertCurrency(1, baseCurrency, curr.code, rates);
            const isBase = curr.code === baseCurrency;

            return (
              <div
                key={curr.code}
                className={`p-4 rounded-xl border transition-all ${
                  isBase
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{curr.flag}</span>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{curr.code}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[110px]">{curr.name}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{curr.symbol}</span>
                </div>

                <div className="text-lg font-mono font-extrabold text-slate-900 dark:text-slate-100">
                  {rate < 10 ? rate.toFixed(4) : rate.toFixed(2)}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                  1 {baseCurrency} = {rate.toFixed(4)} {curr.code}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

