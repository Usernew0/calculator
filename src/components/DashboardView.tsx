import React, { useState, useMemo } from 'react';
import { CalculationResult } from '../types';
import { formatCurrency } from '../data/currencies';
import { exportSingleCalculationPDF, exportHistoricalSummaryPDF } from '../utils/pdfExport';
import { translations, Language } from '../data/translations';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Download,
  Trash2,
  Eye,
  FileSpreadsheet,
  Search,
  Package,
  TrendingUp,
  DollarSign,
  Sparkles,
  AlertCircle,
  X,
  Copy,
  FileText,
  CheckSquare,
  Square,
  Plane,
  Ship,
  Truck,
  ArrowUpDown,
  Filter,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { ClientQuoteModal } from './ClientQuoteModal';

interface DashboardViewProps {
  history: CalculationResult[];
  onDeleteRecord: (id: string) => void;
  onBatchDeleteRecords?: (ids: string[]) => void;
  onClearAllHistory: () => void;
  onLoadIntoCalculator: (result: CalculationResult) => void;
  t: typeof translations['en'];
  lang: Language;
  currentUserCompany?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  history,
  onDeleteRecord,
  onBatchDeleteRecords,
  onClearAllHistory,
  onLoadIntoCalculator,
  t,
  lang,
  currentUserCompany = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('all');
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState<string>('all');
  const [selectedCurrencyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'landed_desc' | 'profit_desc'>('date_desc');
  const [selectedDetailModal, setSelectedDetailModal] = useState<CalculationResult | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CalculationResult | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState<boolean>(false);
  const [selectedQuoteItems, setSelectedQuoteItems] = useState<CalculationResult[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Filtered & Sorted list
  const filteredHistory = useMemo(() => {
    const list = history.filter((item) => {
      const matchSearch =
        item.input.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.input.skuSupplier && item.input.skuSupplier.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.input.category && item.input.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchMethod = selectedMethodFilter === 'all' || item.input.freightMethod === selectedMethodFilter;
      const matchCurrency = selectedCurrencyFilter === 'all' || item.input.targetCurrency === selectedCurrencyFilter;
      const matchDirection =
        selectedDirectionFilter === 'all' || (item.input.tradeDirection || 'import') === selectedDirectionFilter;

      return matchSearch && matchMethod && matchCurrency && matchDirection;
    });

    return list.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'date_asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'landed_desc') return b.totalLandedCostTarget - a.totalLandedCostTarget;
      if (sortBy === 'profit_desc') return b.totalProfitTarget - a.totalProfitTarget;
      return 0;
    });
  }, [history, searchQuery, selectedMethodFilter, selectedDirectionFilter, selectedCurrencyFilter, sortBy]);

  // Multi-Select Helpers & Actions
  const isAllFilteredSelected =
    filteredHistory.length > 0 && filteredHistory.every((item) => selectedIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredHistory.map((item) => item.id));
    }
  };

  const handleExecuteBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (onBatchDeleteRecords) {
      onBatchDeleteRecords(selectedIds);
    } else {
      selectedIds.forEach((id) => onDeleteRecord(id));
    }
    setSelectedIds([]);
    setShowBatchDeleteConfirm(false);
  };

  const handleExportSelectedPDF = () => {
    const selectedItems = history.filter((item) => selectedIds.includes(item.id));
    if (selectedItems.length > 0) {
      exportHistoricalSummaryPDF(selectedItems, lang);
    }
  };

  // Trade Direction Helper Badge Component
  const renderTradeDirectionBadge = (dir?: string) => {
    const isExport = dir === 'export';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isExport
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
            : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
        }`}
      >
        {isExport ? (
          <>
            <ArrowUpRight className="w-3 h-3 text-amber-500" />
            <span>{t.exportBadge || (lang === 'ar' ? 'تصدير' : 'Export')}</span>
          </>
        ) : (
          <>
            <ArrowDownLeft className="w-3 h-3 text-blue-500" />
            <span>{t.importBadge || (lang === 'ar' ? 'استيراد' : 'Import')}</span>
          </>
        )}
      </span>
    );
  };

  // Freight Mode Helper Badge Component
  const renderFreightBadge = (method: string) => {
    switch (method) {
      case 'air_express':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Plane className="w-3 h-3 text-amber-500" />
            <span>{lang === 'ar' ? 'سريع جوي' : 'Air Express'}</span>
          </span>
        );
      case 'air_standard':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            <Plane className="w-3 h-3 text-sky-500" />
            <span>{lang === 'ar' ? 'شحن جوي' : 'Air Cargo'}</span>
          </span>
        );
      case 'sea_lcl':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30">
            <Ship className="w-3 h-3 text-teal-500" />
            <span>{lang === 'ar' ? 'بحري جزئي LCL' : 'Sea LCL'}</span>
          </span>
        );
      case 'sea_fcl':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <Ship className="w-3 h-3 text-blue-500" />
            <span>{lang === 'ar' ? 'بحري كلي FCL' : 'Sea FCL'}</span>
          </span>
        );
      case 'road_freight':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            <Truck className="w-3 h-3 text-purple-500" />
            <span>{lang === 'ar' ? 'شحن بري' : 'Road Freight'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            <Package className="w-3 h-3 text-slate-400" />
            <span>{method.toUpperCase()}</span>
          </span>
        );
    }
  };

  // Key KPI Aggregations
  const totalShipments = history.length;
  const totalLandedVolumeUSD = history.reduce((acc, curr) => acc + curr.totalLandedCostTarget, 0);
  const totalProfitUSD = history.reduce((acc, curr) => acc + curr.totalProfitTarget, 0);
  const avgProfitMargin =
    history.length > 0 ? history.reduce((acc, curr) => acc + curr.actualMarginPercentage, 0) / history.length : 0;

  // Chart 1: Profit & Landed Cost Trend Over Time
  const trendChartData = useMemo(() => {
    return [...history]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((item) => ({
        date: new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        title: item.input.title.slice(0, 15),
        LandedCost: Math.round(item.totalLandedCostTarget),
        NetProfit: Math.round(item.totalProfitTarget),
        Revenue: Math.round(item.totalRevenueTarget),
      }));
  }, [history]);

  // Chart 2: Cost Breakdown Distribution (Aggregated across items)
  const pieCostData = useMemo(() => {
    let totalProductCost = 0;
    let totalFreightCost = 0;
    let totalDutyCost = 0;
    let totalInsuranceCost = 0;
    let totalHandlingCost = 0;

    history.forEach((r) => {
      totalProductCost += r.totalOriginalPriceTarget;
      totalFreightCost += r.freightCostTarget;
      totalDutyCost += r.dutyCostTarget;
      totalInsuranceCost += r.insuranceCostTarget;
      totalHandlingCost +=
        r.originHandlingTarget +
        r.destinationHandlingTarget +
        r.customsClearanceTarget +
        r.inlandDeliveryTarget +
        r.extraFeesTotalTarget;
    });

    return [
      { name: 'Product Purchase', value: Math.round(totalProductCost), color: '#6366f1' },
      { name: 'Freight Shipping', value: Math.round(totalFreightCost), color: '#14b8a6' },
      { name: 'Customs Duty', value: Math.round(totalDutyCost), color: '#f59e0b' },
      { name: 'Insurance', value: Math.round(totalInsuranceCost), color: '#3b82f6' },
      { name: 'Handling & Local', value: Math.round(totalHandlingCost), color: '#8b5cf6' },
    ].filter((item) => item.value > 0);
  }, [history]);

  // Export to CSV
  const handleExportCSV = () => {
    if (history.length === 0) return;

    const headers = [
      'ID',
      'Date',
      'Title',
      'Category',
      'Quantity',
      'Original Currency',
      'Original Price',
      'Target Currency',
      'Freight Method',
      'Total Landed Cost',
      'Suggested Selling Price',
      'Total Revenue',
      'Total Profit',
      'Profit Margin %',
    ];

    const rows = history.map((r) => [
      r.id,
      new Date(r.createdAt).toISOString(),
      `"${r.input.title.replace(/"/g, '""')}"`,
      `"${r.input.category || ''}"`,
      r.input.quantity,
      r.input.originalCurrency,
      r.input.originalPrice,
      r.input.targetCurrency,
      r.input.freightMethod,
      r.totalLandedCostTarget.toFixed(2),
      r.suggestedSellingPricePerUnitTarget.toFixed(2),
      r.totalRevenueTarget.toFixed(2),
      r.totalProfitTarget.toFixed(2),
      r.actualMarginPercentage.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Freight_Calculation_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 dark:bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">
            <BarChart3 className="w-4 h-4" />
            {t.historyBannerTitle}
          </div>
          <h1 className="text-2xl font-extrabold text-white">{t.historyMainHeading}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {t.historySubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportHistoricalSummaryPDF(filteredHistory, lang)}
            disabled={filteredHistory.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportPdfReport}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
            <span>{t.exportCsv}</span>
          </button>

          <button
            onClick={() => setShowClearAllConfirm(true)}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
            title="Delete all calculation records"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'مسح الكل' : 'Clear All'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-colors duration-200">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.calculationsSaved}</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{totalShipments}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{t.recordsStored}</div>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-colors duration-200">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.totalLandedValue}</div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {formatCurrency(totalLandedVolumeUSD, 'EGP')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{t.combinedGoodsFreight}</div>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-colors duration-200">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.totalNetProfitCard}</div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCurrency(totalProfitUSD, 'EGP')}
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">{t.projectedRevenueMargin}</div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between transition-colors duration-200">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.avgProfitMargin}</div>
            <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">{avgProfitMargin.toFixed(1)}%</div>
            <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">{t.acrossShipments}</div>
          </div>
          <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Analytics Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Revenue vs Landed Cost Trend */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs transition-colors duration-200">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1">{t.chart1Title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.chart1Sub}</p>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="title" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString()} EGP`, '']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="LandedCost" fill="#6366f1" name={t.landedCostLabel} radius={[4, 4, 0, 0]} />
                <Bar dataKey="NetProfit" fill="#10b981" name={t.netProfitLabel} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cost Composition Pie Chart */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between transition-colors duration-200">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1">{t.chart2Title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t.chart2Sub}</p>
          </div>

          <div className="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieCostData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieCostData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} EGP`, 'Cost']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {pieCostData.map((item) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-slate-100">{item.value.toLocaleString()} EGP</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4 transition-colors duration-200">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{t.historicalRecordsTableTitle}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {filteredHistory.length} {lang === 'ar' ? 'حسبة' : 'records'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.historicalRecordsTableSub}</p>
          </div>

          {/* Filters, Search & Sort */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[160px] sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 rtl:left-auto rtl:right-3 pointer-events-none" />
              <input
                type="text"
                placeholder={t.searchHistoryPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 min-h-[40px] transition-all"
              />
            </div>

            {/* Freight Method Filter */}
            <div className="relative">
              <select
                value={selectedMethodFilter}
                onChange={(e) => setSelectedMethodFilter(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 cursor-pointer min-h-[40px] hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
              >
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.allFreightModes}</option>
                <option value="air_express" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.airExpress}</option>
                <option value="air_standard" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.airCargo}</option>
                <option value="sea_lcl" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.seaLcl}</option>
                <option value="sea_fcl" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.seaFcl}</option>
                <option value="road_freight" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.roadFreight}</option>
              </select>
            </div>

            {/* Trade Direction Filter (Import / Export) */}
            <div className="relative">
              <select
                value={selectedDirectionFilter}
                onChange={(e) => setSelectedDirectionFilter(e.target.value)}
                className="px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 cursor-pointer min-h-[40px] hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
              >
                <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.allTradeDirections || (lang === 'ar' ? 'جميع العمليات' : 'All Trade Types')}</option>
                <option value="import" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.importBadge || (lang === 'ar' ? 'استيراد' : 'Import')}</option>
                <option value="export" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t.exportBadge || (lang === 'ar' ? 'تصدير' : 'Export')}</option>
              </select>
            </div>

            {/* Sort Select Control (Dark & Light Mode High Contrast) */}
            <div className="flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500 hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="text-xs bg-transparent text-slate-900 dark:text-slate-100 font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="date_desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{lang === 'ar' ? 'الترتيب: الأحدث أولاً' : 'Sort: Newest First'}</option>
                <option value="date_asc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{lang === 'ar' ? 'الترتيب: الأقدم أولاً' : 'Sort: Oldest First'}</option>
                <option value="landed_desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{lang === 'ar' ? 'الترتيب: أعلى تكلفة وصول' : 'Sort: Highest Landed Cost'}</option>
                <option value="profit_desc" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{lang === 'ar' ? 'الترتيب: أعلى صافي ربح' : 'Sort: Highest Net Profit'}</option>
              </select>
            </div>

            {history.length > 0 && (
              <button
                onClick={() => setShowClearAllConfirm(true)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-bold px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer min-h-[40px] border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
              >
                {t.clearAll}
              </button>
            )}
          </div>
        </div>

        {/* Multi-Select Active Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl text-xs font-bold border border-blue-500/30 transition-all cursor-pointer min-h-[36px]"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span>
                  {isAllFilteredSelected
                    ? (lang === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                    : (lang === 'ar' ? 'تحديد الكل' : 'Select All')}
                </span>
              </button>

              <span className="text-xs font-black text-white bg-blue-500/20 px-3 py-1.5 rounded-xl border border-blue-500/30 min-h-[36px] flex items-center">
                {lang === 'ar'
                  ? `تم تحديد ${selectedIds.length} من أصل ${filteredHistory.length}`
                  : `Selected ${selectedIds.length} of ${filteredHistory.length}`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Export Selected PDF Report */}
              <button
                type="button"
                onClick={handleExportSelectedPDF}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-950/40 transition-all active:scale-95 min-h-[38px]"
                title={lang === 'ar' ? 'تصدير تقرير PDF مجمع للحسبات المحددة' : 'Export compiled PDF report for selected items'}
              >
                <Download className="w-4 h-4 text-slate-950 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? `تصدير PDF (${selectedIds.length})`
                    : `Export PDF (${selectedIds.length})`}
                </span>
              </button>

              {/* Create Multi-Item Client Offer */}
              <button
                type="button"
                onClick={() => {
                  const selectedItems = history.filter((item) => selectedIds.includes(item.id));
                  if (selectedItems.length > 0) {
                    setSelectedQuoteItems(selectedItems);
                  }
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-950/50 transition-all active:scale-95 min-h-[38px]"
                title={lang === 'ar' ? 'إنشاء عرض سعر عميل موحد' : 'Create compiled client offer'}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? `عرض سعر (${selectedIds.length})`
                    : `Client Offer (${selectedIds.length})`}
                </span>
              </button>

              {/* Delete Selected Records */}
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-950/50 transition-all active:scale-95 min-h-[38px]"
                title={lang === 'ar' ? 'حذف السجلات المحددة نهائياً' : 'Delete selected records permanently'}
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? `حذف المحدد (${selectedIds.length})`
                    : `Delete Selected (${selectedIds.length})`}
                </span>
              </button>

              {/* Clear Selection */}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors border border-slate-700 min-h-[38px] min-w-[38px] flex items-center justify-center"
                title={lang === 'ar' ? 'إلغاء التحديد' : 'Deselect All'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 1. Mobile Responsive Cards View (< 768px) */}
        <div className="md:hidden space-y-3">
          {filteredHistory.length > 0 && (
            <div className="flex items-center justify-between px-1 py-1">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-blue-500 transition-colors cursor-pointer min-h-[32px]"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {isAllFilteredSelected
                    ? (lang === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                    : (lang === 'ar' ? 'تحديد الكل' : 'Select All')}
                </span>
              </button>

              {selectedIds.length > 0 && (
                <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  {lang === 'ar' ? `تم تحديد ${selectedIds.length}` : `${selectedIds.length} Selected`}
                </span>
              )}
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div className="py-10 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              {history.length === 0 ? t.noRecordsSaved : t.noFilteredRecords}
            </div>
          ) : (
            filteredHistory.map((item) => {
              const curr = item.input.targetCurrency;
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-blue-500/10 dark:bg-blue-950/30 border-blue-500/50 shadow-sm'
                      : 'bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Top Bar: Checkbox + Title + Date */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds((prev) =>
                            prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                          );
                        }}
                        className="mt-0.5 text-slate-400 hover:text-blue-500 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      {item.input.invoiceImage && (
                        <div
                          onClick={() => setZoomedImage(item.input.invoiceImage!)}
                          className="w-11 h-11 shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
                          title={t.viewFullImage || 'View Image'}
                        >
                          <img
                            src={item.input.invoiceImage}
                            alt={item.input.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                          {item.input.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {item.input.skuSupplier || 'N/A'}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          {renderTradeDirectionBadge(item.input.tradeDirection)}
                          {renderFreightBadge(item.input.freightMethod)}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold whitespace-nowrap bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* 4-Metric Grid */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{t.thQty}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {item.input.quantity.toLocaleString()} {lang === 'ar' ? 'قطع' : 'pcs'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{t.thTotalLanded}</div>
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(item.totalLandedCostTarget, curr)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">{t.thSellingPrice}</div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(item.suggestedSellingPricePerUnitTarget, curr)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-teal-600 dark:text-teal-400 uppercase font-bold">{t.thNetProfit} ({item.actualMarginPercentage.toFixed(1)}%)</div>
                      <div className="font-bold text-teal-600 dark:text-teal-400">
                        {formatCurrency(item.totalProfitTarget, curr)}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <button
                      onClick={() => setSelectedQuoteItems([item])}
                      className="flex-1 py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px] transition-all active:scale-95"
                    >
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>{lang === 'ar' ? 'عرض سعر' : 'Offer'}</span>
                    </button>

                    <button
                      onClick={() => setSelectedDetailModal(item)}
                      className="p-2.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-500/10 dark:bg-indigo-950/30 border border-indigo-500/30 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-all active:scale-95"
                      title={t.inspectDetails}
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                    </button>

                    <button
                      onClick={() => onLoadIntoCalculator(item)}
                      className="flex-1 py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px] transition-all active:scale-95"
                    >
                      <Copy className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{t.duplicateBtn || (lang === 'ar' ? 'تكرار' : 'Duplicate')}</span>
                    </button>

                    <button
                      onClick={() => exportSingleCalculationPDF(item, lang)}
                      className="p-2.5 text-amber-600 dark:text-amber-400 hover:text-amber-700 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-all active:scale-95"
                      title={t.downloadPdf}
                    >
                      <Download className="w-4 h-4 shrink-0" />
                    </button>

                    <button
                      onClick={() => setRecordToDelete(item)}
                      className="p-2.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-all active:scale-95"
                      title={t.deleteRecord}
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop High-Density Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <table className="w-full text-left rtl:text-right text-xs">
            <thead className="bg-slate-900 dark:bg-slate-950 text-white uppercase text-[10px] font-bold tracking-wider sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-3 text-center w-10">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-slate-400 hover:text-white cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center mx-auto"
                    title={isAllFilteredSelected ? (lang === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All') : (lang === 'ar' ? 'تحديد الكل' : 'Select All')}
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>

                <th className="py-3.5 px-4 text-slate-300">
                  <button
                    type="button"
                    onClick={() => setSortBy(sortBy === 'date_desc' ? 'date_asc' : 'date_desc')}
                    className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <span>{t.thDate}</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortBy.startsWith('date') ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                  </button>
                </th>

                <th className="py-3.5 px-4 text-slate-300">{t.thShipment}</th>

                <th className="py-3.5 px-4 text-slate-300">{t.thFreightMode}</th>

                <th className="py-3.5 px-4 text-right rtl:text-left text-slate-300">{t.thQty}</th>

                <th className="py-3.5 px-4 text-right rtl:text-left text-slate-300">
                  <button
                    type="button"
                    onClick={() => setSortBy('landed_desc')}
                    className="flex items-center gap-1.5 justify-end rtl:justify-start hover:text-emerald-400 transition-colors cursor-pointer w-full"
                  >
                    <span>{t.thTotalLanded}</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortBy === 'landed_desc' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                  </button>
                </th>

                <th className="py-3.5 px-4 text-right rtl:text-left text-slate-300">{t.thSellingPrice}</th>

                <th className="py-3.5 px-4 text-right rtl:text-left text-slate-300">
                  <button
                    type="button"
                    onClick={() => setSortBy('profit_desc')}
                    className="flex items-center gap-1.5 justify-end rtl:justify-start hover:text-emerald-400 transition-colors cursor-pointer w-full"
                  >
                    <span>{t.thNetProfit}</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortBy === 'profit_desc' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`} />
                  </button>
                </th>

                <th className="py-3.5 px-4 text-right rtl:text-left text-slate-300">{t.thMargin}</th>

                <th className="py-3.5 px-4 text-center text-slate-300">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    {history.length === 0 ? t.noRecordsSaved : t.noFilteredRecords}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const curr = item.input.targetCurrency;
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-500/10 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIds((prev) =>
                              prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className="text-slate-400 hover:text-blue-500 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {item.input.invoiceImage ? (
                            <div
                              onClick={() => setZoomedImage(item.input.invoiceImage!)}
                              className="w-10 h-10 shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all group"
                              title={t.viewFullImage || 'View Image'}
                            >
                              <img
                                src={item.input.invoiceImage}
                                alt={item.input.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                          )}

                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.input.title}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.input.skuSupplier || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {renderTradeDirectionBadge(item.input.tradeDirection)}
                          {renderFreightBadge(item.input.freightMethod)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right rtl:text-left font-semibold text-slate-900 dark:text-slate-100">
                        {item.input.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right rtl:text-left font-extrabold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.totalLandedCostTarget, curr)}
                      </td>
                      <td className="py-3 px-4 text-right rtl:text-left font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(item.suggestedSellingPricePerUnitTarget, curr)}
                      </td>
                      <td className="py-3 px-4 text-right rtl:text-left font-bold text-teal-600 dark:text-teal-400">
                        {formatCurrency(item.totalProfitTarget, curr)}
                      </td>
                      <td className="py-3 px-4 text-right rtl:text-left font-bold text-blue-600 dark:text-blue-400">
                        {item.actualMarginPercentage.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedQuoteItems([item])}
                            title={lang === 'ar' ? 'إنشاء عرض سعر للعميل' : 'Create Client Offer'}
                            className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-lg font-bold cursor-pointer text-xs flex items-center gap-1.5 transition-all shadow-2xs hover:scale-105 active:scale-95"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{lang === 'ar' ? 'عرض سعر' : 'Offer'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedDetailModal(item)}
                            title={t.inspectDetails || (lang === 'ar' ? 'معاينة تفاصيل الحسبة' : 'Inspect Details')}
                            className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-lg font-bold cursor-pointer text-xs flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onLoadIntoCalculator(item)}
                            title={t.duplicateTooltip || (lang === 'ar' ? 'تكرار وتحميل في الحاسبة' : 'Duplicate record & load into calculator')}
                            className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg font-bold cursor-pointer text-xs flex items-center gap-1.5 transition-all shadow-2xs hover:scale-105 active:scale-95"
                          >
                            <Copy className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{t.duplicateBtn || (lang === 'ar' ? 'تكرار' : 'Duplicate')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => exportSingleCalculationPDF(item, lang)}
                            title={t.downloadPdf || (lang === 'ar' ? 'تحميل تقرير PDF' : 'Download PDF')}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg font-bold cursor-pointer text-xs flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95"
                          >
                            <Download className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setRecordToDelete(item)}
                            title={t.deleteRecord || (lang === 'ar' ? 'حذف الحسبة' : 'Delete Record')}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg font-bold cursor-pointer text-xs flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail View Modal (Executive Landed Cost Audit) */}
      {selectedDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 text-white rounded-t-3xl flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {selectedDetailModal.input.targetCurrency}
                  </span>
                  {renderFreightBadge(selectedDetailModal.input.freightMethod)}
                  <span className="text-[11px] text-slate-400 font-mono">
                    {selectedDetailModal.input.skuSupplier || 'N/A'}
                  </span>
                </div>
                <h3 className="font-extrabold text-xl sm:text-2xl text-white tracking-tight leading-snug">
                  {selectedDetailModal.input.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t.calculatedOn} {new Date(selectedDetailModal.createdAt).toLocaleString()}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailModal(null)}
                className="p-2 rounded-2xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer border border-slate-700 min-h-[40px] min-w-[40px] flex items-center justify-center"
                title={t.modalClose || 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6">
              {/* Executive 4-KPI Overview Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1">
                    {t.colTotalLandedCost}
                  </div>
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {formatCurrency(selectedDetailModal.totalLandedCostTarget, selectedDetailModal.input.targetCurrency)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatCurrency(selectedDetailModal.landedCostPerUnitTarget, selectedDetailModal.input.targetCurrency)} / {lang === 'ar' ? 'وحدة' : 'unit'}
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-wider mb-1">
                    {t.thSellingPrice}
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedDetailModal.suggestedSellingPricePerUnitTarget, selectedDetailModal.input.targetCurrency)}
                  </div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    {lang === 'ar' ? 'سعر الوحدة المقترح' : 'Per Unit Price'}
                  </div>
                </div>

                <div className="p-3.5 bg-teal-500/5 dark:bg-teal-950/20 rounded-2xl border border-teal-500/20">
                  <div className="text-[10px] text-teal-600 dark:text-teal-400 uppercase font-black tracking-wider mb-1">
                    {t.thNetProfit}
                  </div>
                  <div className="text-base sm:text-lg font-black text-teal-600 dark:text-teal-400">
                    {formatCurrency(selectedDetailModal.totalProfitTarget, selectedDetailModal.input.targetCurrency)}
                  </div>
                  <div className="text-[10px] text-teal-600/80 dark:text-teal-400/80 mt-0.5 font-bold">
                    {selectedDetailModal.actualMarginPercentage.toFixed(1)}% {t.colMargin}
                  </div>
                </div>

                <div className="p-3.5 bg-blue-500/5 dark:bg-blue-950/20 rounded-2xl border border-blue-500/20">
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-black tracking-wider mb-1">
                    {t.thQty}
                  </div>
                  <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
                    {selectedDetailModal.input.quantity.toLocaleString()} {lang === 'ar' ? 'قطع' : 'pcs'}
                  </div>
                  <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                    {selectedDetailModal.input.originalPrice} {selectedDetailModal.input.originalCurrency} / {lang === 'ar' ? 'قطعة' : 'pc'}
                  </div>
                </div>
              </div>

              {/* Section 1: Product & Shipment Logistics Specs */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-500" />
                  <span>{t.modalProductSpecs || (lang === 'ar' ? 'المواصفات اللوجستية والمنتج' : 'Product & Logistics Specs')}</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalQty}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedDetailModal.input.quantity.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalOrigPrice}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedDetailModal.input.originalPrice} {selectedDetailModal.input.originalCurrency}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalExchangeRate || 'Applied FX Rate'}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">1 {selectedDetailModal.input.originalCurrency} = {selectedDetailModal.input.exchangeRate} {selectedDetailModal.input.targetCurrency}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalChargeableWeight}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedDetailModal.chargeableWeightKg.toFixed(1)} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalVolumetricCbm}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{selectedDetailModal.volumeCBM.toFixed(3)} CBM</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalFreightMethod}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase">{selectedDetailModal.input.freightMethod.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.tradeDirectionLabel || (lang === 'ar' ? 'نوع العملية' : 'Trade Operation')}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {selectedDetailModal.input.tradeDirection === 'export' ? (lang === 'ar' ? 'تصدير (Export)' : 'Export Shipment') : (lang === 'ar' ? 'استيراد (Import)' : 'Import Shipment')}
                    </span>
                  </div>
                </div>

                {/* Cargo / Invoice Picture Attachment if present */}
                {selectedDetailModal.input.invoiceImage && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-4 mt-3">
                    <div
                      onClick={() => setZoomedImage(selectedDetailModal.input.invoiceImage!)}
                      className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-black/5 dark:bg-black/20 cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all group"
                    >
                      <img
                        src={selectedDetailModal.input.invoiceImage}
                        alt="Cargo attached document"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{t.imageFound || (lang === 'ar' ? 'صورة الشحنة / الفاتورة المرفقة' : 'Attached Cargo / Invoice Photo')}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {lang === 'ar' ? 'انقر على الصورة لمعاينتها بحجم كامل مكبر' : 'Click thumbnail to inspect image in full high resolution'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setZoomedImage(selectedDetailModal.input.invoiceImage!)}
                        className="mt-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                      >
                        {t.viewFullImage || (lang === 'ar' ? 'معاينة بالحجم الكامل' : 'Zoom Image')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Detailed Landed Cost Expenses Matrix */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span>{t.modalCostBreakdown || (lang === 'ar' ? 'تفاصيل هيكل المصاريف' : 'Detailed Expenses Breakdown')}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{t.modalFobCost || 'Product Purchase Value'}</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedDetailModal.productTotalCostTarget, selectedDetailModal.input.targetCurrency)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{t.modalFreightCost || 'Main Freight Shipping'}</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedDetailModal.freightCostTarget, selectedDetailModal.input.targetCurrency)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{t.modalInsuranceCost || 'Cargo Insurance'}</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedDetailModal.insuranceCostTarget, selectedDetailModal.input.targetCurrency)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{t.modalDutiesVal || 'Customs Duty & Taxes'} ({selectedDetailModal.input.dutyPercentage}%)</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedDetailModal.customsDutyTarget, selectedDetailModal.input.targetCurrency)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{t.modalPortHandling || 'Port Clearance & Local Handling'}</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedDetailModal.clearanceCostTarget, selectedDetailModal.input.targetCurrency)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{t.modalInlandCost || 'Internal Transport'}</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(selectedDetailModal.inlandCostTarget, selectedDetailModal.input.targetCurrency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions Toolbar */}
            <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-950/80 rounded-b-3xl flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedQuoteItems([selectedDetailModal]);
                  setSelectedDetailModal(null);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-blue-950/40 transition-all active:scale-95 min-h-[42px]"
              >
                <FileText className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إنشاء عرض سعر للعميل' : 'Create Client Offer'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onLoadIntoCalculator(selectedDetailModal);
                  setSelectedDetailModal(null);
                }}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-950/30 transition-all active:scale-95 min-h-[42px]"
              >
                <Copy className="w-4 h-4" />
                <span>{t.duplicateInCalc || (lang === 'ar' ? 'تكرار في الحاسبة' : 'Duplicate in Calculator')}</span>
              </button>

              <button
                type="button"
                onClick={() => exportSingleCalculationPDF(selectedDetailModal, lang)}
                className="px-4 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all border border-slate-700 min-h-[42px]"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>{t.exportPdfReport}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDetailModal(null)}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[42px]"
              >
                {t.modalClose || (lang === 'ar' ? 'إغلاق' : 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Record Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-rose-500/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-b border-rose-900/40 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-100">
                    {lang === 'ar' ? 'تأكيد حذف الحسبة' : 'Confirm Delete Record'}
                  </h3>
                  <p className="text-[11px] text-rose-300/80 font-medium">
                    {lang === 'ar' ? 'حذف السجل نهائياً من قاعدة البيانات' : 'Delete Record from Firestore'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>{lang === 'ar' ? 'عنوان العملية:' : 'Shipment Title:'}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{recordToDelete.input.title}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{lang === 'ar' ? 'التكلفة الكلية:' : 'Total Landed Cost:'}</span>
                  <span className="font-mono font-bold">{formatCurrency(recordToDelete.totalLandedCostTarget, recordToDelete.input.targetCurrency)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{lang === 'ar' ? 'التاريخ:' : 'Created Date:'}</span>
                  <span className="font-mono">{new Date(recordToDelete.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ar'
                    ? 'هل أنت أكتيد من رغبتك في حذف هذا السجل الحسابي؟ سيتم إزالته فوراً من قاعدة البيانات.'
                    : 'Are you sure you want to delete this calculation record? It will be removed from Firestore instantly.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRecordToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDeleteRecord(recordToDelete.id);
                    setRecordToDelete(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-rose-500/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-b border-rose-900/40 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-100">
                    {lang === 'ar' ? 'تأكيد حذف السجلات المحددة' : 'Confirm Batch Delete Records'}
                  </h3>
                  <p className="text-[11px] text-rose-300/80 font-medium">
                    {lang === 'ar' ? `حذف ${selectedIds.length} سجلات حسابية محددة` : `Delete ${selectedIds.length} selected calculations`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ar'
                    ? `هل أنت تأكد من رغبتك في حذف عدد (${selectedIds.length}) سجلات حسابية محددة نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`
                    : `Are you sure you want to permanently delete the ${selectedIds.length} selected calculation records from the database? This action cannot be undone.`}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirm(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleExecuteBatchDelete}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تأكيد الحذف المحدد' : 'Confirm Delete Selected'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All History Confirmation Modal */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-rose-500/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-b border-rose-900/40 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-100">
                    {lang === 'ar' ? 'تأكيد مسح كافة السجلات' : 'Confirm Clear All Records'}
                  </h3>
                  <p className="text-[11px] text-rose-300/80 font-medium">
                    {lang === 'ar' ? 'مسح كافة العمليات من قاعدة البيانات' : 'Wipe all calculations from Firestore'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ar'
                    ? `تنبيه: أنت على وشك مسح جميع الحسبات المسبقة (${history.length} حسبة) من قاعدة البيانات تماماً. لا يمكن التراجع عن هذا الإجراء.`
                    : `Warning: You are about to erase all ${history.length} calculation records from the Firestore database. This action is irreversible.`}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearAllConfirm(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClearAllHistory();
                    setShowClearAllConfirm(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تأكيد مسح الجميع' : 'Confirm Clear All'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Client Commercial Quote Modal */}
      {selectedQuoteItems && selectedQuoteItems.length > 0 && (
        <ClientQuoteModal
          isOpen={true}
          onClose={() => setSelectedQuoteItems(null)}
          results={selectedQuoteItems}
          lang={lang}
          currentUserCompany={currentUserCompany}
        />
      )}

      {/* High-Resolution Image Lightbox Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white bg-slate-800 hover:bg-rose-600 rounded-full cursor-pointer transition-colors border border-slate-700 shadow-xl"
              title={lang === 'ar' ? 'إغلاق المعاينة' : 'Close Preview'}
            >
              <X className="w-6 h-6" />
            </button>

            <div className="rounded-3xl overflow-hidden border border-slate-700 bg-black/80 shadow-2xl max-h-[80vh] flex items-center justify-center">
              <img
                src={zoomedImage}
                alt="Enlarged cargo or invoice document"
                className="max-h-[80vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="mt-3 text-center text-xs text-slate-300 font-medium bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-800">
              {lang === 'ar' ? 'معاينة مكبرة لصورة الشحنة والمستند' : 'High resolution preview of cargo document'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

