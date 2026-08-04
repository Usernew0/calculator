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
} from 'lucide-react';

interface DashboardViewProps {
  history: CalculationResult[];
  onDeleteRecord: (id: string) => void;
  onClearAllHistory: () => void;
  onLoadIntoCalculator: (result: CalculationResult) => void;
  t: typeof translations['en'];
  lang: Language;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  history,
  onDeleteRecord,
  onClearAllHistory,
  onLoadIntoCalculator,
  t,
  lang,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('all');
  const [selectedCurrencyFilter] = useState<string>('all');
  const [selectedDetailModal, setSelectedDetailModal] = useState<CalculationResult | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CalculationResult | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);

  // Filtered list
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchSearch =
        item.input.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.input.skuSupplier && item.input.skuSupplier.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.input.category && item.input.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchMethod = selectedMethodFilter === 'all' || item.input.freightMethod === selectedMethodFilter;
      const matchCurrency = selectedCurrencyFilter === 'all' || item.input.targetCurrency === selectedCurrencyFilter;

      return matchSearch && matchMethod && matchCurrency;
    });
  }, [history, searchQuery, selectedMethodFilter, selectedCurrencyFilter]);

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
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4 transition-colors duration-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{t.historicalRecordsTableTitle}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.historicalRecordsTableSub}</p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={t.searchHistoryPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <select
              value={selectedMethodFilter}
              onChange={(e) => setSelectedMethodFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="all">{t.allFreightModes}</option>
              <option value="air_express">{t.airExpress}</option>
              <option value="air_standard">{t.airCargo}</option>
              <option value="sea_lcl">{t.seaLcl}</option>
              <option value="sea_fcl">{t.seaFcl}</option>
              <option value="road_freight">{t.roadFreight}</option>
            </select>

            {history.length > 0 && (
              <button
                onClick={onClearAllHistory}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
              >
                {t.clearAll}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 dark:bg-slate-950 text-white uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">{t.thDate}</th>
                <th className="py-3 px-4">{t.thShipment}</th>
                <th className="py-3 px-4">{t.thFreightMode}</th>
                <th className="py-3 px-4 text-right">{t.thQty}</th>
                <th className="py-3 px-4 text-right">{t.thTotalLanded}</th>
                <th className="py-3 px-4 text-right">{t.thSellingPrice}</th>
                <th className="py-3 px-4 text-right">{t.thNetProfit}</th>
                <th className="py-3 px-4 text-right">{t.thMargin}</th>
                <th className="py-3 px-4 text-center">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {history.length === 0 ? t.noRecordsSaved : t.noFilteredRecords}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const curr = item.input.targetCurrency;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.input.title}</div>
                        <div className="text-[10px] text-slate-400">{item.input.skuSupplier || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {item.input.freightMethod.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">{item.input.quantity.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.totalLandedCostTarget, curr)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(item.suggestedSellingPricePerUnitTarget, curr)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-teal-600 dark:text-teal-400">
                        {formatCurrency(item.totalProfitTarget, curr)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                        {item.actualMarginPercentage.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedDetailModal(item)}
                            title={t.inspectDetails}
                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onLoadIntoCalculator(item)}
                            title={t.loadIntoCalc}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg font-bold cursor-pointer text-xs"
                          >
                            {t.load}
                          </button>

                          <button
                            onClick={() => exportSingleCalculationPDF(item, lang)}
                            title={t.downloadPdf}
                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setRecordToDelete(item)}
                            title={t.deleteRecord}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Detail Modal */}
      {selectedDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4 text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{selectedDetailModal.input.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.calculatedOn} {new Date(selectedDetailModal.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedDetailModal(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl text-center text-xs">
              <div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">{t.landedCostPerUnit}</div>
                <div className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCurrency(selectedDetailModal.landedCostPerUnitTarget, selectedDetailModal.input.targetCurrency)}
                </div>
              </div>

              <div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">{t.sellingPricePerUnit}</div>
                <div className="font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(
                    selectedDetailModal.suggestedSellingPricePerUnitTarget,
                    selectedDetailModal.input.targetCurrency
                  )}
                </div>
              </div>

              <div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">{t.totalNetProfitCard}</div>
                <div className="font-extrabold text-teal-600 dark:text-teal-400 mt-0.5">
                  {formatCurrency(selectedDetailModal.totalProfitTarget, selectedDetailModal.input.targetCurrency)}
                </div>
              </div>

              <div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">{t.marginPercentage}</div>
                <div className="font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                  {selectedDetailModal.actualMarginPercentage.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">{t.inputsAndSpecs}</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-xl">
                <div>{t.quantityLabel}: <strong>{selectedDetailModal.input.quantity}</strong></div>
                <div>{t.unitPriceLabel}: <strong>{selectedDetailModal.input.originalPrice} {selectedDetailModal.input.originalCurrency}</strong></div>
                <div>{t.freightMethodLabel}: <strong>{selectedDetailModal.input.freightMethod}</strong></div>
                <div>{t.customsDutyLabel}: <strong>{selectedDetailModal.input.dutyPercentage}%</strong></div>
                <div>{t.chargeableWeightLabel}: <strong>{selectedDetailModal.chargeableWeightKg.toFixed(1)} kg</strong></div>
                <div>{t.volumetricCbmLabel}: <strong>{selectedDetailModal.volumeCBM.toFixed(3)} CBM</strong></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => exportSingleCalculationPDF(selectedDetailModal, lang)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.exportPdfReport}</span>
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
    </div>
  );
};

