import React, { useState, useMemo } from 'react';
import { CalculationResult } from '../types';
import { formatCurrency, POPULAR_CURRENCIES } from '../data/currencies';
import { exportHistoricalSummaryPDF } from '../utils/pdfExport';
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
  X,
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Download,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Plane,
  Ship,
  Truck,
  Layers,
  Percent,
  Scale,
  FileSpreadsheet,
  CheckCircle2,
  Eye,
  Copy,
  Info,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Search,
} from 'lucide-react';

interface MultiHistoryAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: CalculationResult[];
  rates?: Record<string, number>;
  lang: Language;
  t: typeof translations['en'];
  onLoadIntoCalculator?: (result: CalculationResult) => void;
  onCreateQuote?: (items: CalculationResult[]) => void;
  onInspectDetail?: (result: CalculationResult) => void;
}

export const MultiHistoryAnalysisModal: React.FC<MultiHistoryAnalysisModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  rates = {},
  lang,
  t,
  onLoadIntoCalculator,
  onCreateQuote,
  onInspectDetail,
}) => {
  // Default target currency from the first item or USD
  const defaultTargetCurr = selectedItems[0]?.input.targetCurrency || 'USD';
  const [selectedDisplayCurrency, setSelectedDisplayCurrency] = useState<string>(defaultTargetCurr);
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'items' | 'insights'>('overview');
  const [itemSearchQuery, setItemSearchQuery] = useState<string>('');

  // Currency rate converter
  const convertAmount = useMemo(() => {
    return (amount: number, fromCurrency: string): number => {
      if (fromCurrency === selectedDisplayCurrency) return amount;
      const fromRate = rates[fromCurrency] || 1;
      const toRate = rates[selectedDisplayCurrency] || 1;
      const inUSD = amount / fromRate;
      return inUSD * toRate;
    };
  }, [rates, selectedDisplayCurrency]);

  // Aggregated calculations & analysis
  const analysis = useMemo(() => {
    if (selectedItems.length === 0) {
      return {
        totalCount: 0,
        importCount: 0,
        exportCount: 0,
        totalQuantity: 0,
        totalVolumeCBM: 0,
        totalWeightKg: 0,
        totalLandedCost: 0,
        totalProductCost: 0,
        totalFreightCost: 0,
        totalDutyCost: 0,
        totalHandlingInsuranceCost: 0,
        totalRevenue: 0,
        totalProfit: 0,
        overallMarginPercent: 0,
        overallROIPercent: 0,
        highestMarginItem: null as CalculationResult | null,
        lowestMarginItem: null as CalculationResult | null,
        highestCostItem: null as CalculationResult | null,
        imports: {
          count: 0,
          totalLandedCost: 0,
          totalProduct: 0,
          totalFreight: 0,
          totalDuty: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgMargin: 0,
          avgROI: 0,
        },
        exports: {
          count: 0,
          totalLandedCost: 0,
          totalProduct: 0,
          totalFreight: 0,
          totalRevenue: 0,
          totalProfit: 0,
          avgMargin: 0,
          avgROI: 0,
        },
        freightBreakdown: {
          air_express: { count: 0, cost: 0, volume: 0, weight: 0 },
          air_standard: { count: 0, cost: 0, volume: 0, weight: 0 },
          sea_lcl: { count: 0, cost: 0, volume: 0, weight: 0 },
          sea_fcl: { count: 0, cost: 0, volume: 0, weight: 0 },
          road_freight: { count: 0, cost: 0, volume: 0, weight: 0 },
        },
      };
    }

    let totalQuantity = 0;
    let totalVolumeCBM = 0;
    let totalWeightKg = 0;
    let totalLandedCost = 0;
    let totalProductCost = 0;
    let totalFreightCost = 0;
    let totalDutyCost = 0;
    let totalHandlingInsuranceCost = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    let importCount = 0;
    let importLanded = 0;
    let importProduct = 0;
    let importFreight = 0;
    let importDuty = 0;
    let importRevenue = 0;
    let importProfit = 0;

    let exportCount = 0;
    let exportLanded = 0;
    let exportProduct = 0;
    let exportFreight = 0;
    let exportRevenue = 0;
    let exportProfit = 0;

    let highestMarginItem: CalculationResult | null = null;
    let lowestMarginItem: CalculationResult | null = null;
    let highestCostItem: CalculationResult | null = null;
    let maxMargin = -Infinity;
    let minMargin = Infinity;
    let maxCost = -Infinity;

    const freightBreakdown = {
      air_express: { count: 0, cost: 0, volume: 0, weight: 0 },
      air_standard: { count: 0, cost: 0, volume: 0, weight: 0 },
      sea_lcl: { count: 0, cost: 0, volume: 0, weight: 0 },
      sea_fcl: { count: 0, cost: 0, volume: 0, weight: 0 },
      road_freight: { count: 0, cost: 0, volume: 0, weight: 0 },
    };

    selectedItems.forEach((item) => {
      const fromCurr = item.input.targetCurrency;
      const landed = convertAmount(item.totalLandedCostTarget, fromCurr);
      const product = convertAmount(item.totalOriginalPriceTarget, fromCurr);
      const freight = convertAmount(item.freightCostTarget, fromCurr);
      const duty = convertAmount(item.dutyCostTarget, fromCurr);
      const handling = convertAmount(
        item.insuranceCostTarget +
          item.originHandlingTarget +
          item.destinationHandlingTarget +
          item.customsClearanceTarget +
          item.inlandDeliveryTarget +
          item.extraFeesTotalTarget,
        fromCurr
      );
      const revenue = convertAmount(item.totalRevenueTarget, fromCurr);
      const profit = convertAmount(item.totalProfitTarget, fromCurr);

      totalQuantity += item.input.quantity || 0;
      totalVolumeCBM += item.volumeCBM || 0;
      totalWeightKg += item.chargeableWeightKg || 0;

      totalLandedCost += landed;
      totalProductCost += product;
      totalFreightCost += freight;
      totalDutyCost += duty;
      totalHandlingInsuranceCost += handling;
      totalRevenue += revenue;
      totalProfit += profit;

      const isExport = item.input.tradeDirection === 'export';
      if (isExport) {
        exportCount++;
        exportLanded += landed;
        exportProduct += product;
        exportFreight += freight;
        exportRevenue += revenue;
        exportProfit += profit;
      } else {
        importCount++;
        importLanded += landed;
        importProduct += product;
        importFreight += freight;
        importDuty += duty;
        importRevenue += revenue;
        importProfit += profit;
      }

      // Track records for smart insights
      if (item.actualMarginPercentage > maxMargin) {
        maxMargin = item.actualMarginPercentage;
        highestMarginItem = item;
      }
      if (item.actualMarginPercentage < minMargin) {
        minMargin = item.actualMarginPercentage;
        lowestMarginItem = item;
      }
      if (landed > maxCost) {
        maxCost = landed;
        highestCostItem = item;
      }

      const method = item.input.freightMethod as keyof typeof freightBreakdown;
      if (freightBreakdown[method]) {
        freightBreakdown[method].count++;
        freightBreakdown[method].cost += freight;
        freightBreakdown[method].volume += item.volumeCBM || 0;
        freightBreakdown[method].weight += item.chargeableWeightKg || 0;
      }
    });

    const overallMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const overallROIPercent = totalLandedCost > 0 ? (totalProfit / totalLandedCost) * 100 : 0;

    const importMargin = importRevenue > 0 ? (importProfit / importRevenue) * 100 : 0;
    const importROI = importLanded > 0 ? (importProfit / importLanded) * 100 : 0;

    const exportMargin = exportRevenue > 0 ? (exportProfit / exportRevenue) * 100 : 0;
    const exportROI = exportLanded > 0 ? (exportProfit / exportLanded) * 100 : 0;

    return {
      totalCount: selectedItems.length,
      importCount,
      exportCount,
      totalQuantity,
      totalVolumeCBM,
      totalWeightKg,
      totalLandedCost,
      totalProductCost,
      totalFreightCost,
      totalDutyCost,
      totalHandlingInsuranceCost,
      totalRevenue,
      totalProfit,
      overallMarginPercent,
      overallROIPercent,
      highestMarginItem,
      lowestMarginItem,
      highestCostItem,
      imports: {
        count: importCount,
        totalLandedCost: importLanded,
        totalProduct: importProduct,
        totalFreight: importFreight,
        totalDuty: importDuty,
        totalRevenue: importRevenue,
        totalProfit: importProfit,
        avgMargin: importMargin,
        avgROI: importROI,
      },
      exports: {
        count: exportCount,
        totalLandedCost: exportLanded,
        totalProduct: exportProduct,
        totalFreight: exportFreight,
        totalRevenue: exportRevenue,
        totalProfit: exportProfit,
        avgMargin: exportMargin,
        avgROI: exportROI,
      },
      freightBreakdown,
    };
  }, [selectedItems, convertAmount]);

  // Pie chart data
  const pieCostData = useMemo(() => {
    return [
      {
        name: lang === 'ar' ? 'شراء البضائع (FOB)' : 'Product Cost (FOB)',
        value: Math.round(analysis.totalProductCost),
        color: '#6366f1',
      },
      {
        name: lang === 'ar' ? 'الشحن الدولي' : 'Freight Shipping',
        value: Math.round(analysis.totalFreightCost),
        color: '#0d9488',
      },
      {
        name: lang === 'ar' ? 'الجمارك والضرائب' : 'Customs & Tax',
        value: Math.round(analysis.totalDutyCost),
        color: '#f59e0b',
      },
      {
        name: lang === 'ar' ? 'المناولة والتأمين والمصاريف' : 'Handling & Extra',
        value: Math.round(analysis.totalHandlingInsuranceCost),
        color: '#8b5cf6',
      },
    ].filter((item) => item.value > 0);
  }, [analysis, lang]);

  // Bar chart data
  const barComparisonData = useMemo(() => {
    const data = [];
    if (analysis.importCount > 0) {
      data.push({
        category: lang === 'ar' ? 'الاستيراد (Imports)' : 'Imports',
        LandedCost: Math.round(analysis.imports.totalLandedCost),
        Revenue: Math.round(analysis.imports.totalRevenue),
        NetProfit: Math.round(analysis.imports.totalProfit),
      });
    }
    if (analysis.exportCount > 0) {
      data.push({
        category: lang === 'ar' ? 'التصدير (Exports)' : 'Exports',
        LandedCost: Math.round(analysis.exports.totalLandedCost),
        Revenue: Math.round(analysis.exports.totalRevenue),
        NetProfit: Math.round(analysis.exports.totalProfit),
      });
    }
    return data;
  }, [analysis, lang]);

  // Filtered items list
  const filteredSelectedItems = useMemo(() => {
    if (!itemSearchQuery.trim()) return selectedItems;
    const q = itemSearchQuery.toLowerCase();
    return selectedItems.filter(
      (item) =>
        (item.input.title || '').toLowerCase().includes(q) ||
        (item.input.skuSupplier || '').toLowerCase().includes(q) ||
        (item.input.freightMethod || '').toLowerCase().includes(q)
    );
  }, [selectedItems, itemSearchQuery]);

  // Export CSV
  const handleExportSelectedCSV = () => {
    if (selectedItems.length === 0) return;

    const headers = [
      'ID',
      'Date',
      'Title',
      'SKU / Supplier',
      'Trade Direction',
      'Freight Method',
      'Quantity',
      'Original Currency',
      'Target Currency',
      'Total Landed Cost',
      'Total Revenue',
      'Total Net Profit',
      'Profit Margin %',
    ];

    const rows = selectedItems.map((r) => [
      r.id,
      new Date(r.createdAt).toISOString(),
      `"${(r.input.title || '').replace(/"/g, '""')}"`,
      `"${(r.input.skuSupplier || '').replace(/"/g, '""')}"`,
      r.input.tradeDirection || 'import',
      r.input.freightMethod,
      r.input.quantity,
      r.input.originalCurrency,
      r.input.targetCurrency,
      r.totalLandedCostTarget.toFixed(2),
      r.totalRevenueTarget.toFixed(2),
      r.totalProfitTarget.toFixed(2),
      r.actualMarginPercentage.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Consolidated_History_Analysis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-900 dark:text-slate-100">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER: Title, Badges, Currency Selector, and Quick Actions */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                {lang === 'ar' ? 'لوحة التحليل المالي والربحي المجمع' : 'Consolidated Trade & Profit Analytics'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {selectedItems.length} {lang === 'ar' ? 'شحنات محددة' : 'Selected Shipments'}
              </span>
              {analysis.importCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <ArrowDownLeft className="w-3 h-3 text-blue-400" />
                  {analysis.importCount} {lang === 'ar' ? 'استيراد' : 'Imports'}
                </span>
              )}
              {analysis.exportCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  {analysis.exportCount} {lang === 'ar' ? 'تصدير' : 'Exports'}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>
                {lang === 'ar'
                  ? 'التقرير المالي والربحي الشامل للمجموعة المحددة'
                  : 'Executive Financial Audit & Profit Analysis'}
              </span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {lang === 'ar'
                ? 'توضيح مباشر ومبسط لهيكل التكاليف، أرباح التجارة، هوامش العائد الاستثماري، والرسوم الجمركية مع توحيد أسعار الصرف.'
                : 'Clear, self-explanatory breakdown of landed costs, revenues, net profits, tariffs, and logistics volume unified in one currency.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
            {/* Display Currency Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl shadow-inner">
              <span className="text-[11px] text-slate-400 font-bold">{lang === 'ar' ? 'عملة العرض:' : 'Currency:'}</span>
              <select
                value={selectedDisplayCurrency}
                onChange={(e) => setSelectedDisplayCurrency(e.target.value)}
                className="bg-transparent text-xs font-black text-emerald-400 focus:outline-none cursor-pointer"
              >
                {POPULAR_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer border border-slate-700 min-h-[38px] min-w-[38px] flex items-center justify-center"
              title={t.modalClose || 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NAVIGATION SUB-TABS & EXPORT ACTIONS */}
        {/* ========================================================================= */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? '1. الملخص المالي والتدفق' : '1. Financial & Money Flow'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('breakdown')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'breakdown'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? '2. هيكل التكاليف والرسوم' : '2. Cost Breakdown & Charts'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('insights')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'insights'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{lang === 'ar' ? '3. التحليل الذكي والتوصيات' : '3. Smart Insights & Health'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('items')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'items'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? `4. قائمة الشحنات (${selectedItems.length})` : `4. Itemized List (${selectedItems.length})`}</span>
            </button>
          </div>

          {/* Export Quick Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => exportHistoricalSummaryPDF(selectedItems, lang, selectedDisplayCurrency)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
              title={lang === 'ar' ? 'تصدير تقرير PDF مجمع للشحنات المحددة' : 'Export Consolidated PDF Report'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportSelectedCSV}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title={lang === 'ar' ? 'تصدير بيانات الشحنات المحددة إلى Excel/CSV' : 'Export Selected to CSV'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>CSV</span>
            </button>

            {onCreateQuote && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateQuote(selectedItems);
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                title={lang === 'ar' ? 'إنشاء عرض سعر موحد للعميل' : 'Create Consolidated Client Offer'}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'عرض سعر للعميل' : 'Client Offer'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL SCROLLABLE CONTENT */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(95vh-165px)]">

          {/* ===================================================================== */}
          {/* TAB 1: EXECUTIVE OVERVIEW & MONEY FLOW */}
          {/* ===================================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Executive Plain-Language Summary Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-slate-800/80 dark:via-indigo-950/30 dark:to-slate-800/80 border border-blue-200 dark:border-blue-800/60 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      {lang === 'ar' ? 'ملخص التنفيذ المالي باللغة البسيطة' : 'Plain Language Executive Summary'}
                    </h4>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                      {lang === 'ar' ? (
                        <>
                          قمت بتحديد <strong className="text-blue-600 dark:text-blue-400 font-black">{analysis.totalCount} شحنة</strong> (
                          {analysis.importCount > 0 && <span>{analysis.importCount} استيراد</span>}
                          {analysis.importCount > 0 && analysis.exportCount > 0 && <span> و </span>}
                          {analysis.exportCount > 0 && <span>{analysis.exportCount} تصدير</span>}
                          ) بإجمالي تكلفة استثمارية شاملة وصول البضائع قدرها{' '}
                          <strong className="text-slate-900 dark:text-white font-mono font-black">{formatCurrency(analysis.totalLandedCost, selectedDisplayCurrency)}</strong>.
                          من المتوقع تحقيق إجمالي مبيعات قدرها{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{formatCurrency(analysis.totalRevenue, selectedDisplayCurrency)}</strong>،
                          ليكون صافي الربح الحقيقي الصافي هو{' '}
                          <strong className="text-teal-600 dark:text-teal-400 font-mono font-black">{formatCurrency(analysis.totalProfit, selectedDisplayCurrency)}</strong>{' '}
                          (بهامش ربح <strong className="text-blue-600 dark:text-blue-400 font-mono">{analysis.overallMarginPercent.toFixed(1)}%</strong> وعائد على التكلفة{' '}
                          <strong className="text-teal-600 dark:text-teal-400 font-mono">+{analysis.overallROIPercent.toFixed(1)}%</strong>).
                        </>
                      ) : (
                        <>
                          You selected <strong className="text-blue-600 dark:text-blue-400 font-black">{analysis.totalCount} shipments</strong> (
                          {analysis.importCount > 0 && <span>{analysis.importCount} Imports</span>}
                          {analysis.importCount > 0 && analysis.exportCount > 0 && <span> & </span>}
                          {analysis.exportCount > 0 && <span>{analysis.exportCount} Exports</span>}
                          ) with a combined Landed Investment of{' '}
                          <strong className="text-slate-900 dark:text-white font-mono font-black">{formatCurrency(analysis.totalLandedCost, selectedDisplayCurrency)}</strong>.
                          Projected Gross Sales are{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{formatCurrency(analysis.totalRevenue, selectedDisplayCurrency)}</strong>,
                          yielding a Net Profit of{' '}
                          <strong className="text-teal-600 dark:text-teal-400 font-mono font-black">{formatCurrency(analysis.totalProfit, selectedDisplayCurrency)}</strong>{' '}
                          (<strong className="text-blue-600 dark:text-blue-400 font-mono">{analysis.overallMarginPercent.toFixed(1)}% margin</strong>,{' '}
                          <strong className="text-teal-600 dark:text-teal-400 font-mono">+{analysis.overallROIPercent.toFixed(1)}% ROI</strong> on total cost).
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                  <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap shadow-2xs">
                    {analysis.totalQuantity.toLocaleString()} {lang === 'ar' ? 'قطعة إجمالية' : 'Total Units'}
                  </span>
                </div>
              </div>

              {/* 4 Core Financial KPI Cards with Clear Explanations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Landed Cost */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                        {lang === 'ar' ? '1. إجمالي تكلفة الوصول' : '1. Total Landed Cost'}
                      </span>
                      <DollarSign className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-black text-white font-mono tracking-tight">
                      {formatCurrency(analysis.totalLandedCost, selectedDisplayCurrency)}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-700/60 leading-tight">
                    {lang === 'ar' ? 'يشمل: الشراء + الشحن + الجمارك + المناولة والتخليص' : 'Includes: FOB + Freight + Customs + Handling'}
                  </div>
                </div>

                {/* 2. Total Projected Revenue */}
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/20 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 shadow-md flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {lang === 'ar' ? '2. إجمالي المبيعات المتوقعة' : '2. Gross Projected Sales'}
                      </span>
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                      {formatCurrency(analysis.totalRevenue, selectedDisplayCurrency)}
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-3 pt-2 border-t border-emerald-500/20 leading-tight">
                    {lang === 'ar' ? 'إجمالي سعر بيع كافة المنتجات في السوق المستهدف' : 'Total selling price across all targeted markets'}
                  </div>
                </div>

                {/* 3. Net Profit */}
                <div className="p-4 sm:p-5 rounded-2xl bg-teal-950/20 dark:bg-teal-950/40 border border-teal-500/30 text-teal-950 dark:text-teal-100 shadow-md flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                        {lang === 'ar' ? '3. صافي الأرباح المحققة' : '3. Combined Net Profit'}
                      </span>
                      <ShieldCheck className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className="text-2xl font-black text-teal-600 dark:text-teal-400 font-mono tracking-tight">
                      {formatCurrency(analysis.totalProfit, selectedDisplayCurrency)}
                    </div>
                  </div>
                  <div className="text-[11px] text-teal-700/80 dark:text-teal-300/80 mt-3 pt-2 border-t border-teal-500/20 leading-tight flex items-center justify-between">
                    <span>{lang === 'ar' ? 'العائد على الاستثمار (ROI):' : 'Return on Cost (ROI):'}</span>
                    <strong className="font-mono font-black">+{analysis.overallROIPercent.toFixed(1)}%</strong>
                  </div>
                </div>

                {/* 4. Weighted Profit Margin */}
                <div className="p-4 sm:p-5 rounded-2xl bg-blue-950/20 dark:bg-blue-950/40 border border-blue-500/30 text-blue-950 dark:text-blue-100 shadow-md flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                        {lang === 'ar' ? '4. متوسط هامش الربح' : '4. Weighted Margin %'}
                      </span>
                      <Percent className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                      {analysis.overallMarginPercent.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-3 pt-2 border-t border-blue-500/20 leading-tight">
                    {lang === 'ar' ? 'نسبة صافي الربح من إجمالي المبيعات' : 'Net profit percentage of gross revenue'}
                  </div>
                </div>
              </div>

              {/* Connected Visual Money Flow Pipeline */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span>{lang === 'ar' ? 'معادلة التدفق المالي التفصيلية (كيف تم حساب التكاليف والأرباح؟)' : 'Step-by-Step Financial Flow Equation'}</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {selectedDisplayCurrency}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3 text-xs">
                  {/* Step 1: Product FOB */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'ar' ? '1. شراء البضائع (FOB)' : '1. Product Cost (FOB)'}</div>
                      <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                        {formatCurrency(analysis.totalProductCost, selectedDisplayCurrency)}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {analysis.totalLandedCost > 0 ? ((analysis.totalProductCost / analysis.totalLandedCost) * 100).toFixed(1) : 0}% {lang === 'ar' ? 'من التكلفة' : 'of cost'}
                    </div>
                  </div>

                  {/* Step 2: Freight */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'ar' ? '2. الشحن الدولي' : '2. Freight Shipping'}</div>
                      <div className="text-sm font-black text-teal-600 dark:text-teal-400 mt-1 font-mono">
                        {formatCurrency(analysis.totalFreightCost, selectedDisplayCurrency)}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {analysis.totalLandedCost > 0 ? ((analysis.totalFreightCost / analysis.totalLandedCost) * 100).toFixed(1) : 0}% {lang === 'ar' ? 'من التكلفة' : 'of cost'}
                    </div>
                  </div>

                  {/* Step 3: Customs & Tax */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'ar' ? '3. الجمارك والضرائب' : '3. Customs & Duty'}</div>
                      <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
                        {formatCurrency(analysis.totalDutyCost, selectedDisplayCurrency)}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {analysis.totalLandedCost > 0 ? ((analysis.totalDutyCost / analysis.totalLandedCost) * 100).toFixed(1) : 0}% {lang === 'ar' ? 'من التكلفة' : 'of cost'}
                    </div>
                  </div>

                  {/* Step 4: Handling & Clearance */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'ar' ? '4. المناولة والتأمين' : '4. Handling & Extra'}</div>
                      <div className="text-sm font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
                        {formatCurrency(analysis.totalHandlingInsuranceCost, selectedDisplayCurrency)}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {analysis.totalLandedCost > 0 ? ((analysis.totalHandlingInsuranceCost / analysis.totalLandedCost) * 100).toFixed(1) : 0}% {lang === 'ar' ? 'من التكلفة' : 'of cost'}
                    </div>
                  </div>

                  {/* Result: Landed Cost */}
                  <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-700 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="text-[10px] text-slate-300 font-bold uppercase">{lang === 'ar' ? '= إجمالي التكلفة' : '= Landed Cost'}</div>
                      <div className="text-sm font-black text-white mt-1 font-mono">
                        {formatCurrency(analysis.totalLandedCost, selectedDisplayCurrency)}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      100% {lang === 'ar' ? 'التكلفة الكلية' : 'Total Investment'}
                    </div>
                  </div>

                  {/* Result: Net Profit */}
                  <div className="p-3 bg-emerald-950/40 text-emerald-200 rounded-xl border border-emerald-500/40 flex flex-col justify-between shadow-sm">
                    <div>
                      <div className="text-[10px] text-emerald-400 font-bold uppercase">{lang === 'ar' ? '🏆 صافي الربح الصافي' : '🏆 Net Profit'}</div>
                      <div className="text-sm font-black text-emerald-400 mt-1 font-mono">
                        +{formatCurrency(analysis.totalProfit, selectedDisplayCurrency)}
                      </div>
                    </div>
                    <div className="text-[10px] text-emerald-400/80 mt-1 font-bold">
                      {analysis.overallMarginPercent.toFixed(1)}% {lang === 'ar' ? 'هامش ربح' : 'Margin'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trade Direction Comparative Breakdown (Import vs Export) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-500" />
                    <span>{lang === 'ar' ? 'مقارنة العمليات: الاستيراد مقابل التصدير' : 'Trade Comparison: Import vs. Export Operations'}</span>
                  </h4>
                  <span className="text-xs text-slate-400 font-medium">
                    {analysis.importCount} {lang === 'ar' ? 'استيراد' : 'Imports'} • {analysis.exportCount} {lang === 'ar' ? 'تصدير' : 'Exports'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Import Card */}
                  <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-500/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-500">
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-sm text-blue-900 dark:text-blue-200">
                          {lang === 'ar' ? 'عمليات الاستيراد (Import Operations)' : 'Import Operations'}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-black text-xs">
                        {analysis.importCount} {lang === 'ar' ? 'شحنة' : 'shipments'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'تكلفة الوصول الإجمالية:' : 'Landed Cost:'}</div>
                        <div className="font-black text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(analysis.imports.totalLandedCost, selectedDisplayCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'الجمارك والضرائب:' : 'Customs & Tax:'}</div>
                        <div className="font-black text-amber-600 dark:text-amber-400 font-mono">
                          {formatCurrency(analysis.imports.totalDuty, selectedDisplayCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'تكاليف الشحن:' : 'Freight Cost:'}</div>
                        <div className="font-black text-teal-600 dark:text-teal-400 font-mono">
                          {formatCurrency(analysis.imports.totalFreight, selectedDisplayCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'صافي الربح والهامش:' : 'Net Profit (Margin):'}</div>
                        <div className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(analysis.imports.totalProfit, selectedDisplayCurrency)} ({analysis.imports.avgMargin.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Export Card */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-500">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-sm text-amber-900 dark:text-amber-200">
                          {lang === 'ar' ? 'عمليات التصدير (Export Operations)' : 'Export Operations'}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs">
                        {analysis.exportCount} {lang === 'ar' ? 'شحنة' : 'shipments'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'تكلفة التصدير الإجمالية:' : 'Export Landed Cost:'}</div>
                        <div className="font-black text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(analysis.exports.totalLandedCost, selectedDisplayCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'الشحن والنقل الدولي:' : 'Freight & Transport:'}</div>
                        <div className="font-black text-teal-600 dark:text-teal-400 font-mono">
                          {formatCurrency(analysis.exports.totalFreight, selectedDisplayCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'إجمالي المبيعات التصديرية:' : 'Export Sales Revenue:'}</div>
                        <div className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(analysis.exports.totalRevenue, selectedDisplayCurrency)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">{lang === 'ar' ? 'صافي أرباح التصدير:' : 'Export Net Profit:'}</div>
                        <div className="font-black text-teal-600 dark:text-teal-400 font-mono">
                          {formatCurrency(analysis.exports.totalProfit, selectedDisplayCurrency)} ({analysis.exports.avgMargin.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Cargo Metrics Banner */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    {lang === 'ar' ? 'المقاييس الفيزيائية المجمعة للشحنات:' : 'Consolidated Physical Cargo Metrics:'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400">{lang === 'ar' ? 'الحجم:' : 'Volume:'}</span>{' '}
                    <strong className="text-emerald-400 font-black">{analysis.totalVolumeCBM.toFixed(3)} CBM</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">{lang === 'ar' ? 'الوزن القابل للخصم:' : 'Chargeable Weight:'}</span>{' '}
                    <strong className="text-sky-400 font-black">{analysis.totalWeightKg.toFixed(1)} kg</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">{lang === 'ar' ? 'القطع:' : 'Units:'}</span>{' '}
                    <strong className="text-amber-400 font-black">{analysis.totalQuantity.toLocaleString()} pcs</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 2: COST BREAKDOWN & CHARTS */}
          {/* ===================================================================== */}
          {activeTab === 'breakdown' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Donut Pie Chart: Cost Composition */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-blue-500" />
                      <span>{lang === 'ar' ? 'توزيع التكاليف المجمعة (%)' : 'Consolidated Cost Composition (%)'}</span>
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatCurrency(analysis.totalLandedCost, selectedDisplayCurrency)}
                    </span>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieCostData}
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          innerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieCostData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => formatCurrency(Number(value), selectedDisplayCurrency)}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '12px',
                            border: '1px solid #334155',
                            color: '#fff',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-700/60">
                    {pieCostData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0">
                          {analysis.totalLandedCost > 0 ? ((item.value / analysis.totalLandedCost) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Grouped Bar Chart: Financial Comparison */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-emerald-500" />
                      <span>{lang === 'ar' ? 'مقارنة التكلفة مقابل الإيرادات والأرباح' : 'Landed Cost vs. Revenue vs. Profit'}</span>
                    </h4>
                  </div>

                  <div className="h-64">
                    {barComparisonData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barComparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            formatter={(value: any) => formatCurrency(Number(value), selectedDisplayCurrency)}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderRadius: '12px',
                              border: '1px solid #334155',
                              color: '#fff',
                            }}
                          />
                          <Legend />
                          <Bar dataKey="LandedCost" name={lang === 'ar' ? 'تكلفة الوصول' : 'Landed Cost'} fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Revenue" name={lang === 'ar' ? 'المبيعات المتوقعة' : 'Gross Sales'} fill="#059669" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="NetProfit" name={lang === 'ar' ? 'صافي الأرباح' : 'Net Profit'} fill="#14b8a6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        {lang === 'ar' ? 'لا توجد بيانات كافية للمقارنة' : 'Insufficient data for comparison'}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                    {lang === 'ar'
                      ? 'يوضح الرسم مقارنة حقيقية بين رأس المال المستثمر وإجمالي العائدات وصافي الربح المتبقي لكل قطاع.'
                      : 'Comparison illustrating invested capital, total revenue generation, and resulting net margin.'}
                  </p>
                </div>
              </div>

              {/* Logistics Freight Method Analysis */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-500" />
                  <span>{lang === 'ar' ? 'تحليل وسائط الشحن اللوجستية المستخدمة' : 'Freight & Logistics Mode Breakdown'}</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  {(Object.keys(analysis.freightBreakdown) as Array<keyof typeof analysis.freightBreakdown>).map((mode) => {
                    const data = analysis.freightBreakdown[mode];
                    if (data.count === 0) return null;
                    const getModeTitle = () => {
                      switch (mode) {
                        case 'air_express': return lang === 'ar' ? 'شحن جوي سريع' : 'Air Express';
                        case 'air_standard': return lang === 'ar' ? 'شحن جوي قياسي' : 'Air Standard';
                        case 'sea_lcl': return lang === 'ar' ? 'شحن بحري جزئي (LCL)' : 'Sea LCL';
                        case 'sea_fcl': return lang === 'ar' ? 'حاوية كاملة (FCL)' : 'Sea FCL';
                        case 'road_freight': return lang === 'ar' ? 'شحن بري' : 'Road Freight';
                        default: return (mode as string).toUpperCase();
                      }
                    };

                    return (
                      <div key={mode} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-400 font-bold uppercase truncate">{getModeTitle()}</div>
                        <div className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">
                          {formatCurrency(data.cost, selectedDisplayCurrency)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {data.count} {lang === 'ar' ? 'شحنات' : 'shipments'} • {data.volume.toFixed(2)} CBM
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 3: SMART INSIGHTS & RECOMMENDATIONS */}
          {/* ===================================================================== */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Health Status Indicator */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="font-black text-sm text-emerald-900 dark:text-emerald-200">
                      {lang === 'ar' ? 'مؤشر الجدوى والربحية العام' : 'Overall Margin Health'}
                    </span>
                  </div>

                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {analysis.overallMarginPercent >= 25
                      ? lang === 'ar' ? 'ممتاز وعالي الربحية (Excellent)' : 'High Margin (Excellent)'
                      : analysis.overallMarginPercent >= 15
                      ? lang === 'ar' ? 'صحي ومقبول (Healthy)' : 'Healthy Margin'
                      : lang === 'ar' ? 'هامش ضئيل (Low Margin)' : 'Low Margin Alert'}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === 'ar'
                      ? `يحقق هذا المزيج من الشحنات متوسط هامش ربحي ${analysis.overallMarginPercent.toFixed(1)}% مع عائد استثماري على التكلفة +${analysis.overallROIPercent.toFixed(1)}%.`
                      : `Selected batch generates a ${analysis.overallMarginPercent.toFixed(1)}% net margin with +${analysis.overallROIPercent.toFixed(1)}% ROI on landed cost.`}
                  </p>
                </div>

                {/* 2. Star Performing Product */}
                <div className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-500/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-500">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span className="font-black text-sm text-blue-900 dark:text-blue-200">
                      {lang === 'ar' ? 'أعلى شحنة ربحية (Top Performer)' : 'Top Margin Performer'}
                    </span>
                  </div>

                  {analysis.highestMarginItem ? (
                    <div>
                      <div className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                        {analysis.highestMarginItem.input.title}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold mt-1">
                        +{analysis.highestMarginItem.actualMarginPercentage.toFixed(1)}% {lang === 'ar' ? 'هامش ربح' : 'Margin'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                        SKU: {analysis.highestMarginItem.input.skuSupplier || 'N/A'} • {analysis.highestMarginItem.input.freightMethod.toUpperCase()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">{lang === 'ar' ? 'لا توجد بيانات' : 'No data'}</div>
                  )}
                </div>

                {/* 3. Customs & Tariffs Impact */}
                <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="font-black text-sm text-amber-900 dark:text-amber-200">
                      {lang === 'ar' ? 'تأثير الرسوم الجمركية والضرائب' : 'Customs & Tax Impact'}
                    </span>
                  </div>

                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                    {analysis.totalLandedCost > 0 ? ((analysis.totalDutyCost / analysis.totalLandedCost) * 100).toFixed(1) : 0}%
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === 'ar'
                      ? `تمثل الرسوم الجمركية وضريبة القيمة المضافة ${formatCurrency(analysis.totalDutyCost, selectedDisplayCurrency)} من إجمالي تكلفة الشحنات.`
                      : `Customs duties and VAT account for ${formatCurrency(analysis.totalDutyCost, selectedDisplayCurrency)} of total landed expenditures.`}
                  </p>
                </div>
              </div>

              {/* Strategic Trade Optimization Tips */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'ar' ? 'نصائح ذكية لتحسين تكاليف هذه المجموعة:' : 'Smart Optimization Strategies:'}</span>
                </h4>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'ar'
                        ? 'تجميع الشحنات في حاوية بحرية واحدة (FCL) عند تجاوز الحجم التكعيبي 15 CBM يوفر حتى 35% من تكاليف الشحن الجزئي LCL.'
                        : 'Consolidating volume into full container loads (FCL) when volume exceeds 15 CBM can reduce freight costs by up to 35%.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'ar'
                        ? 'مراجعة البنود الجمركية HS Codes للشحنات ذات الرسوم المرتفعة للتأكد من تطبيق الاتفاقيات التجارية التفضيلية المعفية من الرسوم.'
                        : 'Audit HS Codes for high-tariff items to leverage preferential trade agreements and duty exemption clauses.'}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 4: ITEMIZED SELECTED RECORDS TABLE */}
          {/* ===================================================================== */}
          {activeTab === 'items' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder={lang === 'ar' ? 'بحث بالاسم، كود الصنف SKU، أو وسيلة الشحن...' : 'Search by title, SKU, or freight...'}
                    className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lang === 'ar'
                    ? `عرض ${filteredSelectedItems.length} من أصل ${selectedItems.length} شحنة`
                    : `Showing ${filteredSelectedItems.length} of ${selectedItems.length} items`}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
                <table className="w-full text-left rtl:text-right text-xs">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5">{lang === 'ar' ? 'الشحنة / الصنف' : 'Shipment / SKU'}</th>
                      <th className="py-3 px-3.5">{lang === 'ar' ? 'العملية' : 'Type'}</th>
                      <th className="py-3 px-3.5">{lang === 'ar' ? 'وسيلة الشحن' : 'Freight'}</th>
                      <th className="py-3 px-3.5 text-right rtl:text-left">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th className="py-3 px-3.5 text-right rtl:text-left">{lang === 'ar' ? 'تكلفة الوصول' : 'Landed Cost'}</th>
                      <th className="py-3 px-3.5 text-right rtl:text-left">{lang === 'ar' ? 'الإيراد المتوقع' : 'Sales Revenue'}</th>
                      <th className="py-3 px-3.5 text-right rtl:text-left">{lang === 'ar' ? 'صافي الربح' : 'Net Profit'}</th>
                      <th className="py-3 px-3.5 text-center">{lang === 'ar' ? 'الهامش %' : 'Margin %'}</th>
                      <th className="py-3 px-3.5 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredSelectedItems.map((item, idx) => {
                      const isExport = item.input.tradeDirection === 'export';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-mono text-[10px]">#{idx + 1}</span>
                              <div>
                                <div className="font-extrabold">{item.input.title}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{item.input.skuSupplier || 'N/A'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isExport
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {isExport ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                              <span>{isExport ? (lang === 'ar' ? 'تصدير' : 'Export') : (lang === 'ar' ? 'استيراد' : 'Import')}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300 font-bold">
                            {item.input.freightMethod.toUpperCase()}
                          </td>
                          <td className="py-3 px-3.5 text-right rtl:text-left font-mono font-bold">
                            {item.input.quantity.toLocaleString()}
                          </td>
                          <td className="py-3 px-3.5 text-right rtl:text-left font-black text-slate-900 dark:text-slate-100 font-mono">
                            {formatCurrency(item.totalLandedCostTarget, item.input.targetCurrency)}
                          </td>
                          <td className="py-3 px-3.5 text-right rtl:text-left font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatCurrency(item.totalRevenueTarget, item.input.targetCurrency)}
                          </td>
                          <td className="py-3 px-3.5 text-right rtl:text-left font-black text-teal-600 dark:text-teal-400 font-mono">
                            +{formatCurrency(item.totalProfitTarget, item.input.targetCurrency)}
                          </td>
                          <td className="py-3 px-3.5 text-center font-black text-blue-600 dark:text-blue-400 font-mono">
                            {item.actualMarginPercentage.toFixed(1)}%
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {onInspectDetail && (
                                <button
                                  type="button"
                                  onClick={() => onInspectDetail(item)}
                                  className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 cursor-pointer transition-colors"
                                  title={lang === 'ar' ? 'معاينة تفاصيل الحسبة' : 'Inspect Details'}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onLoadIntoCalculator && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onLoadIntoCalculator(item);
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-colors"
                                  title={lang === 'ar' ? 'تحميل في الحاسبة' : 'Load into Calculator'}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0 rounded-b-3xl">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              {lang === 'ar'
                ? `تم تحويل وتوحيد كافة المبالغ تلقائياً إلى: ${selectedDisplayCurrency}`
                : `All figures automatically converted & standardized to: ${selectedDisplayCurrency}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
            >
              {t.modalClose || (lang === 'ar' ? 'إغلاق النافذة' : 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
