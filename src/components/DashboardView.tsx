import React, { useState, useMemo, useEffect } from 'react';
import { CalculationResult, FlightConsignment } from '../types';
import { formatCurrency } from '../data/currencies';
import { exportSingleCalculationPDF, exportHistoricalSummaryPDF, exportFlightManifestPDF } from '../utils/pdfExport';
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
  Edit3,
  Layers,
  Plus,
  RefreshCw,
  Building2,
  Compass,
  Globe,
  Scale,
  Upload,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Link2,
  Unlink2,
  Ticket,
  ArrowLeftRight,
} from 'lucide-react';
import { ClientQuoteModal } from './ClientQuoteModal';
import { EditTransactionModal } from './EditTransactionModal';
import { MultiHistoryAnalysisModal } from './MultiHistoryAnalysisModal';
import { FlightConsignmentModal } from './FlightConsignmentModal';
import { getFlightsApi, deleteFlightApi, saveFlightConsignmentApi, saveCalculationApi } from '../lib/api';
import { subscribeToFlightConsignments, saveFlightConsignmentToFirestore, saveCalculationToFirestore } from '../lib/firebase';
import {
  getCalculationGrossWeightKg,
  getCalculationChargeableWeightKg,
  getCalculationVolumeCBM,
  getCalculationPieces,
  getCalculationLandedCost,
  getCalculationRevenue,
  getCalculationProfit,
} from '../utils/calculator';

interface DashboardViewProps {
  history: CalculationResult[];
  onDeleteRecord: (id: string) => void;
  onBatchDeleteRecords?: (ids: string[]) => void;
  onClearAllHistory: () => void;
  onLoadIntoCalculator: (result: CalculationResult) => void;
  onSaveRecord?: (result: CalculationResult) => void;
  rates?: Record<string, number>;
  t: typeof translations['en'];
  lang: Language;
  currentUserCompany?: string;
  currentUser?: any;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  history,
  onDeleteRecord,
  onBatchDeleteRecords,
  onClearAllHistory,
  onLoadIntoCalculator,
  onSaveRecord,
  rates = {},
  t,
  lang,
  currentUserCompany = '',
  currentUser,
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
  const [showMultiAnalysisModal, setShowMultiAnalysisModal] = useState<boolean>(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<CalculationResult | null>(null);

  // Flight Consignments State
  const [dashboardSubTab, setDashboardSubTab] = useState<'records' | 'flights'>('records');
  const [flights, setFlights] = useState<FlightConsignment[]>([]);
  const [isLoadingFlights, setIsLoadingFlights] = useState<boolean>(false);
  const [showFlightConsignmentModal, setShowFlightConsignmentModal] = useState<boolean>(false);
  const [flightModalInitialFlight, setFlightModalInitialFlight] = useState<FlightConsignment | null>(null);
  const [flightModalCustomSelectedItems, setFlightModalCustomSelectedItems] = useState<CalculationResult[] | null>(null);
  const [expandedFlightCargoIds, setExpandedFlightCargoIds] = useState<string[]>([]);
  const [selectedFlightForView, setSelectedFlightForView] = useState<FlightConsignment | null>(null);
  const [flightToDelete, setFlightToDelete] = useState<FlightConsignment | null>(null);
  const [isExportingFlightPdf, setIsExportingFlightPdf] = useState<string | null>(null);

  const handleToggleExpandFlightCargo = (flightId: string) => {
    setExpandedFlightCargoIds((prev) =>
      prev.includes(flightId) ? prev.filter((id) => id !== flightId) : [...prev, flightId]
    );
  };

  const handleOpenFlightModalForSingleItem = (item: CalculationResult) => {
    setFlightModalInitialFlight(null);
    setFlightModalCustomSelectedItems([item]);
    setShowFlightConsignmentModal(true);
  };

  const handleOpenAddCargoToFlight = (flight: FlightConsignment) => {
    setFlightModalInitialFlight(flight);
    setFlightModalCustomSelectedItems(null);
    setShowFlightConsignmentModal(true);
  };

  const handleUnlinkItemFromFlight = async (flight: FlightConsignment, calcId: string) => {
    try {
      const remainingCalcIds = (flight.calculationIds || []).filter((id) => id !== calcId);
      const remainingItems = history.filter((h) => remainingCalcIds.includes(h.id));

      const totalLandedCost = remainingItems.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);
      const totalRevenue = remainingItems.reduce((sum, item) => sum + getCalculationRevenue(item), 0);
      const totalProfit = totalRevenue - totalLandedCost;
      const totalGrossWeightKg = remainingItems.reduce((sum, item) => sum + getCalculationGrossWeightKg(item), 0);
      const totalChargeableWeightKg = remainingItems.reduce((sum, item) => sum + getCalculationChargeableWeightKg(item), 0);
      const totalVolumeCbm = remainingItems.reduce((sum, item) => sum + getCalculationVolumeCBM(item), 0);
      const totalPackagesCount = remainingItems.reduce((sum, item) => sum + getCalculationPieces(item), 0);

      const updatedFlight: FlightConsignment = {
        ...flight,
        calculationIds: remainingCalcIds,
        totalLandedCost,
        totalLandedCostEGP: totalLandedCost,
        totalRevenue,
        totalRevenueEGP: totalRevenue,
        totalProfit,
        totalProfitEGP: totalProfit,
        totalGrossWeightKg,
        totalWeightKg: totalGrossWeightKg,
        totalChargeableWeightKg,
        totalVolumeCbm,
        totalPackagesCount,
        totalPieces: totalPackagesCount,
        updatedAt: new Date().toISOString(),
      };

      // 1. Save updated flight to API and Firestore
      try {
        await saveFlightConsignmentApi(updatedFlight);
      } catch (e) {
        console.info('API flight update notice:', e);
      }
      try {
        await saveFlightConsignmentToFirestore(updatedFlight);
      } catch (e) {
        console.info('Firestore flight update notice:', e);
      }

      // 2. Update calculation record to remove flight link
      const unlinkedItem = history.find((h) => h.id === calcId);
      if (unlinkedItem) {
        const updatedCalc: CalculationResult = {
          ...unlinkedItem,
          flightConsignmentId: undefined,
          flightNumber: undefined,
        };
        try {
          await saveCalculationApi(updatedCalc);
        } catch (e) {
          console.info('API calc update notice:', e);
        }
        try {
          await saveCalculationToFirestore(updatedCalc);
        } catch (e) {
          console.info('Firestore calc update notice:', e);
        }
        if (onSaveRecord) {
          onSaveRecord(updatedCalc);
        }
      }

      // 3. Update local flight state
      setFlights((prev) =>
        prev.map((f) => (f.id === updatedFlight.id ? updatedFlight : f))
      );
      if (selectedFlightForView?.id === updatedFlight.id) {
        setSelectedFlightForView(updatedFlight);
      }
    } catch (err: any) {
      console.error('Failed to unlink item from flight:', err);
      alert(lang === 'ar' ? 'فشل إلغاء ربط المنتج بالرحلة' : 'Failed to unlink item from flight');
    }
  };

  // Load and Subscribe to Flights
  useEffect(() => {
    let isMounted = true;
    const fetchFlights = async () => {
      setIsLoadingFlights(true);
      try {
        const list = await getFlightsApi(currentUser?.userId || currentUser?.username);
        if (isMounted && list) {
          setFlights(list);
        }
      } catch (err) {
        console.info('Flight fetch notice:', err);
      } finally {
        if (isMounted) setIsLoadingFlights(false);
      }
    };

    fetchFlights();

    const unsubscribe = subscribeToFlightConsignments((updatedFlights) => {
      if (isMounted) {
        setFlights(updatedFlights);
      }
    }, currentUser?.userId || currentUser?.username);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser]);

  const handleDeleteFlight = async (flightId: string) => {
    try {
      await deleteFlightApi(flightId);
      setFlights((prev) => prev.filter((f) => f.id !== flightId));
      if (selectedFlightForView?.id === flightId) {
        setSelectedFlightForView(null);
      }
    } catch (err: any) {
      console.error('Failed to delete flight:', err);
      alert(err?.message || (lang === 'ar' ? 'فشل حذف الرحلة' : 'Failed to delete flight'));
    }
  };

  const handleExportFlightManifest = async (flight: FlightConsignment) => {
    setIsExportingFlightPdf(flight.id);
    try {
      // Find all calculation items linked to this flight
      const flightItems = history.filter((h) => flight.calculationIds.includes(h.id));
      await exportFlightManifestPDF(flight, flightItems, lang);
    } catch (err) {
      console.error('Flight manifest export failed:', err);
    } finally {
      setIsExportingFlightPdf(null);
    }
  };

  // Map calculationId to FlightConsignment for fast lookup
  const flightMapByCalcId = useMemo(() => {
    const map: Record<string, FlightConsignment> = {};
    flights.forEach((flight) => {
      (flight.calculationIds || []).forEach((calcId) => {
        map[calcId] = flight;
      });
    });
    return map;
  }, [flights]);

  // Flight search & status filters
  const [flightSearchQuery, setFlightSearchQuery] = useState('');
  const [flightStatusFilter, setFlightStatusFilter] = useState('all');

  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      const q = flightSearchQuery.toLowerCase();
      const matchQuery =
        !q ||
        flight.flightNumber.toLowerCase().includes(q) ||
        flight.airline.toLowerCase().includes(q) ||
        flight.originAirport.toLowerCase().includes(q) ||
        flight.destinationAirport.toLowerCase().includes(q) ||
        flight.originCountry.toLowerCase().includes(q) ||
        flight.destinationCountry.toLowerCase().includes(q) ||
        (flight.masterAwbNumber && flight.masterAwbNumber.toLowerCase().includes(q));

      const matchStatus = flightStatusFilter === 'all' || flight.status === flightStatusFilter;

      return matchQuery && matchStatus;
    });
  }, [flights, flightSearchQuery, flightStatusFilter]);

  // Selected items list memo
  const selectedItemsList = useMemo(() => {
    return history.filter((item) => selectedIds.includes(item.id));
  }, [history, selectedIds]);

  // Quick live aggregates for selected items
  const selectedQuickMetrics = useMemo(() => {
    if (selectedItemsList.length === 0) return { cost: 0, profit: 0, revenue: 0, margin: 0, imports: 0, exports: 0, curr: 'USD' };
    const curr = selectedItemsList[0]?.input.targetCurrency || 'USD';
    let cost = 0;
    let profit = 0;
    let revenue = 0;
    let imports = 0;
    let exports = 0;

    selectedItemsList.forEach((item) => {
      cost += item.totalLandedCostTarget || 0;
      profit += item.totalProfitTarget || 0;
      revenue += item.totalRevenueTarget || 0;
      if (item.input.tradeDirection === 'export') {
        exports++;
      } else {
        imports++;
      }
    });

    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { cost, profit, revenue, margin, imports, exports, curr };
  }, [selectedItemsList]);

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
      if (sortBy === 'weight_desc') return getCalculationGrossWeightKg(b) - getCalculationGrossWeightKg(a);
      if (sortBy === 'weight_asc') return getCalculationGrossWeightKg(a) - getCalculationGrossWeightKg(b);
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
      'Gross Weight (kg)',
      'Chargeable Weight (kg)',
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
      getCalculationGrossWeightKg(r).toFixed(2),
      getCalculationChargeableWeightKg(r).toFixed(2),
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

      {/* Subtab Navigation Bar: Records vs Flight Consignments */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-200/60 dark:bg-slate-800/80 rounded-2xl border border-slate-300/80 dark:border-slate-700/80 transition-colors">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDashboardSubTab('records')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              dashboardSubTab === 'records'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/50'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-500" />
            <span>{lang === 'ar' ? 'سجلات الحسبات والشحنات' : 'Calculation Records'}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {history.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardSubTab('flights')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
              dashboardSubTab === 'flights'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/50'
            }`}
          >
            <Plane className="w-4 h-4 text-sky-400" />
            <span>{lang === 'ar' ? 'رحلات الطيران والبوالص (Flight Consignments)' : 'Flight Consignments & Manifests'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${dashboardSubTab === 'flights' ? 'bg-sky-700 text-white' : 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300'}`}>
              {flights.length}
            </span>
          </button>
        </div>

        {dashboardSubTab === 'flights' && (
          <button
            type="button"
            onClick={() => setShowFlightConsignmentModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-black shadow-md shadow-sky-950/40 transition-all active:scale-95 cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'ربط رحلة جديدة / رفع PDF' : 'New Flight / Upload PDF'}</span>
          </button>
        )}
      </div>

      {/* SUBTAB 1: Historical Data Table */}
      {dashboardSubTab === 'records' && (
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
                type="button"
                onClick={() => setShowClearAllConfirm(true)}
                className="px-3.5 py-2 text-xs font-black text-rose-600 dark:text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-xl transition-all cursor-pointer min-h-[40px] flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95 group"
                title={lang === 'ar' ? 'مسح جميع الحسبات المحفوظة' : 'Clear all saved calculations'}
              >
                <Trash2 className="w-4 h-4 text-rose-500 group-hover:text-white shrink-0 transition-colors" />
                <span>{t.clearAll || t.clearAllBtn || (lang === 'ar' ? 'مسح الكل' : 'Clear All')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Select Active Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/40 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 shadow-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-wrap items-center gap-2.5">
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

              {/* Live Mini Aggregates Strip */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400">{lang === 'ar' ? 'التكلفة:' : 'Cost:'}</span>{' '}
                  <strong className="text-white font-mono">{formatCurrency(selectedQuickMetrics.cost, selectedQuickMetrics.curr)}</strong>
                </div>
                <div className="w-px h-3 bg-slate-700" />
                <div>
                  <span className="text-slate-400">{lang === 'ar' ? 'الربح:' : 'Profit:'}</span>{' '}
                  <strong className="text-teal-400 font-mono">+{formatCurrency(selectedQuickMetrics.profit, selectedQuickMetrics.curr)}</strong>
                </div>
                <div className="w-px h-3 bg-slate-700" />
                <div>
                  <span className="text-slate-400">{lang === 'ar' ? 'الهامش:' : 'Margin:'}</span>{' '}
                  <strong className="text-blue-400 font-mono">{selectedQuickMetrics.margin.toFixed(1)}%</strong>
                </div>
                {(selectedQuickMetrics.imports > 0 || selectedQuickMetrics.exports > 0) && (
                  <>
                    <div className="w-px h-3 bg-slate-700" />
                    <span className="text-[10px] text-slate-300">
                      ({selectedQuickMetrics.imports} {lang === 'ar' ? 'استيراد' : 'Imp'} / {selectedQuickMetrics.exports} {lang === 'ar' ? 'تصدير' : 'Exp'})
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Comprehensive Multi-History Analysis Button */}
              <button
                type="button"
                onClick={() => setShowMultiAnalysisModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50 transition-all active:scale-95 min-h-[38px] group"
                title={lang === 'ar' ? 'لوحة التحليل المالي والربحي المجمع للشحنات المحددة' : 'Consolidated financial & profit analysis'}
              >
                <BarChart3 className="w-4 h-4 text-slate-950 shrink-0 group-hover:scale-110 transition-transform" />
                <span>
                  {lang === 'ar'
                    ? `تحليل الحسبات المحددة (${selectedIds.length})`
                    : `Analyze Selected (${selectedIds.length})`}
                </span>
              </button>

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

              {/* Consolidate into Flight Consignment */}
              <button
                type="button"
                onClick={() => setShowFlightConsignmentModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-950/50 transition-all active:scale-95 min-h-[38px] group"
                title={lang === 'ar' ? 'ربط الحسبات المحددة برحلة طيران وبوليصة شحن' : 'Consolidate selected records into a Flight Consignment'}
              >
                <Plane className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                <span>
                  {lang === 'ar'
                    ? `ربط برحلة (${selectedIds.length})`
                    : `Consolidate Flight (${selectedIds.length})`}
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
                    ? `حذف (${selectedIds.length})`
                    : `Delete (${selectedIds.length})`}
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
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                            {item.input.title}
                          </h3>
                          {flightMapByCalcId[item.id] && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFlightForView(flightMapByCalcId[item.id]);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 transition-colors cursor-pointer"
                              title={`${flightMapByCalcId[item.id].airline} (${flightMapByCalcId[item.id].originAirport} → ${flightMapByCalcId[item.id].destinationAirport})`}
                            >
                              <Plane className="w-2.5 h-2.5 shrink-0 text-sky-500" />
                              <span>{flightMapByCalcId[item.id].flightNumber}</span>
                            </button>
                          )}
                        </div>
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

                  {/* 5-Metric Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{t.thQty}</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {item.input.quantity.toLocaleString()} {lang === 'ar' ? 'قطع' : 'pcs'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-sky-600 dark:text-sky-400 uppercase font-bold">{t.thWeight || (lang === 'ar' ? 'الوزن' : 'Weight')}</div>
                      <div className="font-bold text-sky-600 dark:text-sky-400">
                        {getCalculationGrossWeightKg(item).toFixed(1)} <span className="text-[10px] font-normal text-slate-500">KG</span>
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

                    <div className="col-span-2 sm:col-span-2">
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
                      onClick={() => {
                        const linkedFlight = flightMapByCalcId[item.id];
                        if (linkedFlight) {
                          setSelectedFlightForView(linkedFlight);
                        } else {
                          handleOpenFlightModalForSingleItem(item);
                        }
                      }}
                      className={`p-2.5 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-all active:scale-95 border ${
                        flightMapByCalcId[item.id]
                          ? 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30'
                          : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                      }`}
                      title={flightMapByCalcId[item.id] ? (lang === 'ar' ? 'معاينة بوليصة الرحلة والأرباح' : 'Inspect Flight Consignment & P&L') : (lang === 'ar' ? 'ربط برحلة طيران' : 'Link to Flight')}
                    >
                      <Plane className="w-4 h-4 shrink-0 text-sky-500" />
                    </button>

                    <button
                      onClick={() => setEditingRecord(item)}
                      className="p-2.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center transition-all active:scale-95"
                      title={t.editTransactionBtn || (lang === 'ar' ? 'تعديل المعاملة والصورة' : 'Edit Transaction')}
                    >
                      <Edit3 className="w-4 h-4 shrink-0 text-emerald-500" />
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
                    onClick={() => setSortBy(sortBy === 'weight_desc' ? 'weight_asc' : 'weight_desc')}
                    className="flex items-center gap-1.5 justify-end rtl:justify-start hover:text-sky-400 transition-colors cursor-pointer w-full"
                    title={lang === 'ar' ? 'ترتيب حسب الوزن' : 'Sort by weight'}
                  >
                    <span>{t.thWeight || (lang === 'ar' ? 'الوزن (كجم)' : 'Weight (kg)')}</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortBy.startsWith('weight') ? 'text-sky-400 font-bold' : 'text-slate-500'}`} />
                  </button>
                </th>

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

                <th className="py-3.5 px-4 text-center text-slate-300 min-w-[280px] whitespace-nowrap">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    {history.length === 0 ? t.noRecordsSaved : t.noFilteredRecords}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const curr = item.input.targetCurrency;
                  const isSelected = selectedIds.includes(item.id);
                  const grossWeight = getCalculationGrossWeightKg(item);
                  const chargeableWeight = getCalculationChargeableWeightKg(item);
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
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{item.input.title}</div>
                              {flightMapByCalcId[item.id] && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFlightForView(flightMapByCalcId[item.id]);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 transition-colors cursor-pointer"
                                  title={`${flightMapByCalcId[item.id].airline} (${flightMapByCalcId[item.id].originAirport} → ${flightMapByCalcId[item.id].destinationAirport})`}
                                >
                                  <Plane className="w-2.5 h-2.5 shrink-0 text-sky-500" />
                                  <span>{flightMapByCalcId[item.id].flightNumber}</span>
                                </button>
                              )}
                            </div>
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
                      <td className="py-3 px-4 text-right rtl:text-left font-mono">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {grossWeight.toFixed(1)} <span className="text-[10px] text-slate-400">kg</span>
                        </div>
                        {Math.abs(chargeableWeight - grossWeight) > 0.05 && (
                          <div className="text-[10px] text-sky-600 dark:text-sky-400" title="Chargeable Weight">
                            {chargeableWeight.toFixed(1)} chg
                          </div>
                        )}
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
                      <td className="py-3 px-4 min-w-[280px] whitespace-nowrap">
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
                            onClick={() => {
                              const linkedFlight = flightMapByCalcId[item.id];
                              if (linkedFlight) {
                                setSelectedFlightForView(linkedFlight);
                              } else {
                                handleOpenFlightModalForSingleItem(item);
                              }
                            }}
                            title={flightMapByCalcId[item.id] ? (lang === 'ar' ? 'معاينة بوليصة الرحلة والأرباح' : 'Inspect Flight Consignment & P&L') : (lang === 'ar' ? 'ربط برحلة طيران' : 'Link to Flight')}
                            className={`p-1.5 rounded-lg font-bold cursor-pointer text-xs flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95 border ${
                              flightMapByCalcId[item.id]
                                ? 'bg-sky-500/10 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 border-sky-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <Plane className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingRecord(item)}
                            title={t.editTransactionBtn || (lang === 'ar' ? 'تعديل المعاملة والصورة' : 'Edit Transaction & Image')}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg font-bold cursor-pointer text-xs flex items-center justify-center transition-all shadow-2xs hover:scale-105 active:scale-95"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
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
      )}

      {/* SUBTAB 2: Flight Consignments & Air Manifests */}
      {dashboardSubTab === 'flights' && (
        <div className="space-y-6">
          {/* Flight Consignments KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {lang === 'ar' ? 'إجمالي الرحلات' : 'Total Flights'}
                </span>
                <Plane className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {flights.length}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'ar' ? 'بوالص جوية مسجلة' : 'Registered manifests'}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {lang === 'ar' ? 'إجمالي وزن الشحن' : 'Total Air Weight'}
                </span>
                <Scale className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {flights.reduce((sum, f) => {
                  const linked = history.filter((h) => (f.calculationIds || []).includes(h.id));
                  const w = (f.totalWeightKg && f.totalWeightKg > 0)
                    ? f.totalWeightKg
                    : (f.totalGrossWeightKg && f.totalGrossWeightKg > 0)
                    ? f.totalGrossWeightKg
                    : linked.reduce((s, item) => s + getCalculationGrossWeightKg(item), 0);
                  return sum + w;
                }, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs">KG</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {flights.reduce((sum, f) => {
                  const linked = history.filter((h) => (f.calculationIds || []).includes(h.id));
                  const p = (f.totalPieces && f.totalPieces > 0)
                    ? f.totalPieces
                    : (f.totalPackagesCount && f.totalPackagesCount > 0)
                    ? f.totalPackagesCount
                    : linked.reduce((s, item) => s + getCalculationPieces(item), 0);
                  return sum + p;
                }, 0).toLocaleString()} {lang === 'ar' ? 'طرد / كرتونة' : 'packages'}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {lang === 'ar' ? 'الحجم الإجمالي' : 'Total Volume'}
                </span>
                <Layers className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {flights.reduce((sum, f) => {
                  const linked = history.filter((h) => (f.calculationIds || []).includes(h.id));
                  const v = (f.totalVolumeCbm && f.totalVolumeCbm > 0)
                    ? f.totalVolumeCbm
                    : linked.reduce((s, item) => s + getCalculationVolumeCBM(item), 0);
                  return sum + v;
                }, 0).toFixed(2)} <span className="text-xs">CBM</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'ar' ? 'حجم البضائع الجوية' : 'Cubic meter volume'}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {lang === 'ar' ? 'تكلفة الشحنات الجوية' : 'Total Landed Cost'}
                </span>
                <DollarSign className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrency(
                  flights.reduce((sum, f) => {
                    const linked = history.filter((h) => (f.calculationIds || []).includes(h.id));
                    const c = (f.totalLandedCostEGP && f.totalLandedCostEGP > 0)
                      ? f.totalLandedCostEGP
                      : (f.totalLandedCost && f.totalLandedCost > 0)
                      ? f.totalLandedCost
                      : linked.reduce((s, item) => s + getCalculationLandedCost(item), 0);
                    return sum + c;
                  }, 0),
                  'EGP'
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {lang === 'ar' ? 'تكلفة البضائع المجمعة' : 'Consolidated cost'}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">
                  {lang === 'ar' ? 'صافي الربح المتوقع' : 'Projected Profit'}
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  flights.reduce((sum, f) => {
                    const linked = history.filter((h) => (f.calculationIds || []).includes(h.id));
                    const p = (f.totalProfitEGP !== undefined && f.totalProfitEGP !== 0)
                      ? f.totalProfitEGP
                      : (f.totalProfit !== undefined && f.totalProfit !== 0)
                      ? f.totalProfit
                      : linked.reduce((s, item) => s + getCalculationProfit(item), 0);
                    return sum + p;
                  }, 0),
                  'EGP'
                )}
              </div>
              <div className="text-[11px] text-emerald-500/80 font-bold mt-1">
                {lang === 'ar' ? 'أرباح الشحنات المربوطة' : 'Expected net margin'}
              </div>
            </div>
          </div>

          {/* Flights Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Plane className="w-5 h-5 text-sky-500" />
                  <span>{lang === 'ar' ? 'إدارة رحلات الطيران وبوالص الشحن (Air Manifests)' : 'Flight Manifests & Consignments'}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    {filteredFlights.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'ar'
                    ? 'ربط الحسبات والمنتجات برقم الرحلة والمطار، واستخراج بيانات المانيفست الذكي من ملفات PDF'
                    : 'Link calculations & products to flights, airports, and parse manifests automatically from PDF'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowFlightConsignmentModal(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md shadow-sky-950/40 transition-all active:scale-95 cursor-pointer min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إنشاء رحلة / رفع PDF' : 'New Flight / Upload PDF'}</span>
              </button>
            </div>

            {/* Search & Status Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 rtl:left-auto rtl:right-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'بحث برقم الرحلة، شركة الطيران، المطار، أو رقم البوليصة...' : 'Search by flight #, airline, airport, AWB #...'}
                  value={flightSearchQuery}
                  onChange={(e) => setFlightSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 min-h-[40px] transition-all"
                />
              </div>

              <div className="relative">
                <select
                  value={flightStatusFilter}
                  onChange={(e) => setFlightStatusFilter(e.target.value)}
                  className="px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 cursor-pointer min-h-[40px]"
                >
                  <option value="all">{lang === 'ar' ? 'كافة حالات الرحلات' : 'All Statuses'}</option>
                  <option value="scheduled">{lang === 'ar' ? 'مجدولة (Scheduled)' : 'Scheduled'}</option>
                  <option value="in_transit">{lang === 'ar' ? 'في مسار الرحلة (In Transit)' : 'In Transit'}</option>
                  <option value="customs_clearance">{lang === 'ar' ? 'تخليص جمركي (Customs Clearance)' : 'Customs Clearance'}</option>
                  <option value="arrived">{lang === 'ar' ? 'وصلت المطار (Arrived)' : 'Arrived'}</option>
                  <option value="delivered">{lang === 'ar' ? 'تم التسليم (Delivered)' : 'Delivered'}</option>
                  <option value="cancelled">{lang === 'ar' ? 'ملغية (Cancelled)' : 'Cancelled'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Flights Grid / Cards */}
          {filteredFlights.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center mx-auto border border-sky-500/20">
                <Plane className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                  {flights.length === 0
                    ? (lang === 'ar' ? 'لا توجد رحلات طيران مسجلة بعد' : 'No Flight Consignments Registered Yet')
                    : (lang === 'ar' ? 'لا توجد رحلات مطابقة لمعايير البحث' : 'No flights matched your filter')}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {flights.length === 0
                    ? (lang === 'ar'
                        ? 'يمكنك تحديد عدة حسبات من جدول الحسابات والضغط على "ربط برحلة"، أو رفع ملف PDF لمانيفست الطيران مباشرة لاستخراج كافة البيانات.'
                        : 'Select multiple items in the calculation table and click "Consolidate Flight", or upload a Flight Manifest PDF to parse cargo data automatically.')
                    : (lang === 'ar' ? 'جرب تغيير مصطلح البحث أو فلتر الحالة' : 'Try adjusting your search query or status filter')}
                </p>
              </div>

              {flights.length === 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFlightConsignmentModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md shadow-sky-950/40 transition-all cursor-pointer min-h-[42px]"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'رفع بوليصة / مانيفست PDF أو إدخال يدوي' : 'Upload Flight Manifest PDF / Manual Entry'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardSubTab('records')}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[42px]"
                  >
                    <span>{lang === 'ar' ? 'الذهاب لجدول الحسبات لتحديد شحنات' : 'Go to Calculation Records'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredFlights.map((flight) => {
                const linkedItems = history.filter((h) => (flight.calculationIds || []).includes(h.id));
                const isExpanded = expandedFlightCargoIds.includes(flight.id);

                const flightGrossWeight = (flight.totalWeightKg && flight.totalWeightKg > 0)
                  ? flight.totalWeightKg
                  : (flight.totalGrossWeightKg && flight.totalGrossWeightKg > 0)
                  ? flight.totalGrossWeightKg
                  : linkedItems.reduce((sum, item) => sum + getCalculationGrossWeightKg(item), 0);

                const flightChargeableWeight = (flight.totalChargeableWeightKg && flight.totalChargeableWeightKg > 0)
                  ? flight.totalChargeableWeightKg
                  : linkedItems.reduce((sum, item) => sum + getCalculationChargeableWeightKg(item), 0);

                const flightVolume = (flight.totalVolumeCbm && flight.totalVolumeCbm > 0)
                  ? flight.totalVolumeCbm
                  : linkedItems.reduce((sum, item) => sum + getCalculationVolumeCBM(item), 0);

                const flightPieces = (flight.totalPieces && flight.totalPieces > 0)
                  ? flight.totalPieces
                  : (flight.totalPackagesCount && flight.totalPackagesCount > 0)
                  ? flight.totalPackagesCount
                  : linkedItems.reduce((sum, item) => sum + getCalculationPieces(item), 0);

                const flightLandedCost = (flight.totalLandedCostEGP && flight.totalLandedCostEGP > 0)
                  ? flight.totalLandedCostEGP
                  : (flight.totalLandedCost && flight.totalLandedCost > 0)
                  ? flight.totalLandedCost
                  : linkedItems.reduce((sum, item) => sum + getCalculationLandedCost(item), 0);

                const flightRevenue = (flight.totalRevenueEGP && flight.totalRevenueEGP > 0)
                  ? flight.totalRevenueEGP
                  : (flight.totalRevenue && flight.totalRevenue > 0)
                  ? flight.totalRevenue
                  : linkedItems.reduce((sum, item) => sum + getCalculationRevenue(item), 0);

                const flightProfit = (flight.totalProfitEGP !== undefined && flight.totalProfitEGP !== 0)
                  ? flight.totalProfitEGP
                  : (flight.totalProfit !== undefined && flight.totalProfit !== 0)
                  ? flight.totalProfit
                  : flightRevenue - flightLandedCost;

                const isProfitable = flightProfit >= 0;
                const profitMargin = flightRevenue > 0 ? (flightProfit / flightRevenue) * 100 : 0;
                const roiPercent = flightLandedCost > 0 ? (flightProfit / flightLandedCost) * 100 : 0;

                const statusBadgeStyle = {
                  scheduled: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
                  in_transit: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                  customs_clearance: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
                  arrived: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
                  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                }[flight.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';

                const statusLabel = {
                  scheduled: lang === 'ar' ? 'مجدولة' : 'Scheduled',
                  in_transit: lang === 'ar' ? 'في مسار الرحلة' : 'In Transit',
                  customs_clearance: lang === 'ar' ? 'تخليص جمركي' : 'Customs Clearance',
                  arrived: lang === 'ar' ? 'وصلت المطار' : 'Arrived',
                  delivered: lang === 'ar' ? 'تم التسليم' : 'Delivered',
                  cancelled: lang === 'ar' ? 'ملغية' : 'Cancelled',
                }[flight.status] || flight.status;

                return (
                  <div
                    key={flight.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:border-sky-500/40 transition-all space-y-4"
                  >
                    {/* Top Flight Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center shrink-0">
                          <Plane className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                              {flight.flightNumber}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {flight.airline}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${statusBadgeStyle}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {flight.flightDate}
                            </span>
                            {flight.masterAwbNumber && (
                              <span className="flex items-center gap-1 font-mono">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                AWB: <strong className="text-slate-700 dark:text-slate-300">{flight.masterAwbNumber}</strong>
                              </span>
                            )}
                            {flight.flightTicketPrice !== undefined && flight.flightTicketPrice !== null && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold">
                                <Ticket className="w-3.5 h-3.5 text-amber-500" />
                                <span>
                                  {lang === 'ar' ? 'تذكرة السفر:' : 'Ticket:'} {formatCurrency(flight.flightTicketPrice, flight.flightTicketCurrency || 'USD')}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Route Display */}
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                          <div className="text-center">
                            <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              {flight.originAirport}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                              {flight.originCountry}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sky-500 font-bold px-1">
                            <span className="w-3 h-px bg-sky-400" />
                            {flight.tripType === 'round_trip' ? (
                              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <Plane className="w-3.5 h-3.5 rtl:-rotate-90 rotate-90" />
                            )}
                            <span className="w-3 h-px bg-sky-400" />
                          </div>
                          <div className="text-center">
                            <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                              {flight.destinationAirport}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                              {flight.destinationCountry}
                            </div>
                          </div>
                        </div>
                        {flight.tripType === 'round_trip' && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            <span>{lang === 'ar' ? 'رحلة ذهاب وعودة' : 'Round-Trip'}</span>
                            {flight.returnFlightDate && (
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                ({lang === 'ar' ? 'العودة:' : 'Ret:'} {flight.returnFlightDate})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Flight P&L Highlight Banner */}
                    <div
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isProfitable
                          ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isProfitable ? (
                          <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-rose-500 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-black uppercase tracking-wider">
                            {isProfitable
                              ? (lang === 'ar' ? 'صافي أرباح الرحلة (Net Profit)' : 'Flight Net Profit Status')
                              : (lang === 'ar' ? 'صافي خسائر الرحلة (Net Loss)' : 'Flight Net Deficit / Loss Status')}
                          </div>
                          <div className="text-lg sm:text-xl font-black">
                            {isProfitable ? '+' : ''}
                            {formatCurrency(flightProfit, 'EGP')}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className={`px-2.5 py-1 rounded-lg border ${
                          isProfitable
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`}>
                          {lang === 'ar' ? 'هامش الربح' : 'Margin'}: {profitMargin.toFixed(1)}%
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg border ${
                          isProfitable
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`}>
                          ROI: {roiPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Cargo & Financial 4-Box Matrix */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                          {lang === 'ar' ? 'الوزن الإجمالي' : 'Gross Weight'}
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                          {flightGrossWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs">KG</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {flightPieces} {lang === 'ar' ? 'طرد' : 'pcs'} • {flightVolume.toFixed(2)} CBM
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                          {lang === 'ar' ? 'الحسبات المربوطة' : 'Linked Shipments'}
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                          {flight.calculationIds?.length || 0} {lang === 'ar' ? 'حسبة' : 'shipments'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {linkedItems.length > 0 ? linkedItems.map((i) => i.input.title).join(', ').slice(0, 25) + '...' : 'Manifest record'}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                          {lang === 'ar' ? 'تكلفة الشحنة' : 'Total Landed Cost'}
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                          {formatCurrency(flightLandedCost, 'EGP')}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {flight.freightCostUSD ? `$${flight.freightCostUSD.toLocaleString()} Air Freight` : 'Total Landed'}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                          {lang === 'ar' ? 'إجمالي المبيعات' : 'Expected Revenue'}
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                          {formatCurrency(flightRevenue, 'EGP')}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          {formatCurrency(flightProfit, 'EGP')} {lang === 'ar' ? 'صافي' : 'Net'}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Itemized Cargo Breakdown Accordion */}
                    <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
                      <button
                        type="button"
                        onClick={() => handleToggleExpandFlightCargo(flight.id)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>
                            {lang === 'ar'
                              ? `تفاصيل البضائع والمنتجات المربوطة بالرحلة (${linkedItems.length})`
                              : `Itemized Cargo & Linked Products (${linkedItems.length})`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="text-[11px] font-medium">
                            {isExpanded ? (lang === 'ar' ? 'إخفاء' : 'Collapse') : (lang === 'ar' ? 'عرض التفاصيل' : 'Expand')}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 space-y-3 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
                          {linkedItems.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400 space-y-2">
                              <div>{lang === 'ar' ? 'لا توجد منتجات مربوطة بهذه الرحلة بعد.' : 'No products linked to this flight yet.'}</div>
                              <button
                                type="button"
                                onClick={() => handleOpenAddCargoToFlight(flight)}
                                className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'ربط منتجات من سجل الحسابات' : 'Link Products from History'}</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left rtl:text-right text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase font-black">
                                      <th className="py-2 px-2">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                                      <th className="py-2 px-2 text-right rtl:text-left">{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                                      <th className="py-2 px-2 text-right rtl:text-left">{lang === 'ar' ? 'الوزن (KG)' : 'Weight (KG)'}</th>
                                      <th className="py-2 px-2 text-right rtl:text-left">{lang === 'ar' ? 'التكلفة' : 'Landed'}</th>
                                      <th className="py-2 px-2 text-right rtl:text-left">{lang === 'ar' ? 'المبيعات' : 'Revenue'}</th>
                                      <th className="py-2 px-2 text-right rtl:text-left">{lang === 'ar' ? 'الربح' : 'Profit'}</th>
                                      <th className="py-2 px-2 text-center w-16">{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                    {linkedItems.map((item) => {
                                      const itemGrossWeight = getCalculationGrossWeightKg(item);
                                      const itemChargeable = getCalculationChargeableWeightKg(item);
                                      const itemLanded = getCalculationLandedCost(item);
                                      const itemRev = getCalculationRevenue(item);
                                      const itemProfit = getCalculationProfit(item);
                                      const itemIsProfit = itemProfit >= 0;
                                      return (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                          <td className="py-2.5 px-2">
                                            <div className="flex items-center gap-2">
                                              {item.input.invoiceImage ? (
                                                <img
                                                  src={item.input.invoiceImage}
                                                  alt={item.input.title}
                                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                                />
                                              ) : (
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                                  <Package className="w-4 h-4" />
                                                </div>
                                              )}
                                              <div>
                                                <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{item.input.title}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{item.input.skuSupplier || 'N/A'}</div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-2 text-right rtl:text-left font-semibold">
                                            {item.input.quantity.toLocaleString()}
                                          </td>
                                          <td className="py-2.5 px-2 text-right rtl:text-left font-mono font-bold text-slate-700 dark:text-slate-300">
                                            <div>{itemGrossWeight.toFixed(1)} kg</div>
                                            {itemChargeable !== itemGrossWeight && itemChargeable > 0 && (
                                              <div className="text-[10px] text-slate-400 font-normal">chg: {itemChargeable.toFixed(1)} kg</div>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-2 text-right rtl:text-left font-bold text-slate-800 dark:text-slate-200">
                                            {formatCurrency(itemLanded, item.input.targetCurrency)}
                                          </td>
                                          <td className="py-2.5 px-2 text-right rtl:text-left font-bold text-slate-800 dark:text-slate-200">
                                            {formatCurrency(itemRev, item.input.targetCurrency)}
                                          </td>
                                          <td className="py-2.5 px-2 text-right rtl:text-left font-bold">
                                            <span className={itemIsProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                              {itemIsProfit ? '+' : ''}{formatCurrency(itemProfit, item.input.targetCurrency)}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => handleUnlinkItemFromFlight(flight, item.id)}
                                              className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                              title={lang === 'ar' ? 'إلغاء ربط المنتج بالرحلة' : 'Unlink from Flight'}
                                            >
                                              <Unlink2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              <div className="pt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddCargoToFlight(flight)}
                                  className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{lang === 'ar' ? 'إضافة / ربط منتجات أخرى للرحلة' : 'Add / Link More Cargo'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="text-xs text-slate-400 font-mono">
                        ID: {flight.id.slice(0, 8)}...
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Edit Flight */}
                        <button
                          type="button"
                          onClick={() => handleOpenAddCargoToFlight(flight)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[34px]"
                          title={lang === 'ar' ? 'تعديل بيانات الرحلة والربط' : 'Edit Flight Details & Linked Cargo'}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                        </button>

                        {/* View / Inspect Manifest */}
                        <button
                          type="button"
                          onClick={() => setSelectedFlightForView(flight)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer min-h-[34px]"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>{lang === 'ar' ? 'معاينة المانيفست' : 'Inspect Cargo'}</span>
                        </button>

                        {/* Export Flight Manifest PDF */}
                        <button
                          type="button"
                          onClick={() => handleExportFlightManifest(flight)}
                          disabled={isExportingFlightPdf === flight.id}
                          className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer min-h-[34px]"
                        >
                          {isExportingFlightPdf === flight.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-slate-950" />
                          )}
                          <span>{lang === 'ar' ? 'تصدير مانيفست PDF' : 'Manifest PDF'}</span>
                        </button>

                        {/* Delete Flight */}
                        <button
                          type="button"
                          onClick={() => setFlightToDelete(flight)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                          title={lang === 'ar' ? 'حذف بوليصة الرحلة' : 'Delete Flight Manifest'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                    <span className="text-slate-400 text-[11px] block">{lang === 'ar' ? 'الوزن الإجمالي القائم' : 'Total Gross Weight'}</span>
                    <span className="font-extrabold text-sky-600 dark:text-sky-400">{getCalculationGrossWeightKg(selectedDetailModal).toFixed(1)} kg ({selectedDetailModal.input.weight} {selectedDetailModal.input.weightUnit}/pc)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalChargeableWeight}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{getCalculationChargeableWeightKg(selectedDetailModal).toFixed(1)} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.modalVolumetricCbm}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{getCalculationVolumeCBM(selectedDetailModal).toFixed(3)} CBM</span>
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
                    <span className="text-slate-400 text-[11px] block">{t.modalFreightMethod}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 uppercase">{selectedDetailModal.input.freightMethod.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">{t.tradeDirectionLabel || (lang === 'ar' ? 'نوع العملية' : 'Trade Operation')}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">
                      {selectedDetailModal.input.tradeDirection === 'export' ? (lang === 'ar' ? 'تصدير (Export)' : 'Export Shipment') : (lang === 'ar' ? 'استيراد (Import)' : 'Import Shipment')}
                    </span>
                  </div>
                  {flightMapByCalcId[selectedDetailModal.id] && (
                    <div>
                      <span className="text-sky-500 text-[11px] block font-bold">{lang === 'ar' ? 'رحلة الطيران المربوطة' : 'Linked Air Flight'}</span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400">
                        {flightMapByCalcId[selectedDetailModal.id].flightNumber} ({flightMapByCalcId[selectedDetailModal.id].airline})
                      </span>
                    </div>
                  )}
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

      {/* Multi-History Analysis Modal */}
      {showMultiAnalysisModal && selectedItemsList.length > 0 && (
        <MultiHistoryAnalysisModal
          isOpen={showMultiAnalysisModal}
          onClose={() => setShowMultiAnalysisModal(false)}
          selectedItems={selectedItemsList}
          rates={rates}
          lang={lang}
          t={t}
          onLoadIntoCalculator={onLoadIntoCalculator}
          onCreateQuote={(items) => setSelectedQuoteItems(items)}
          onInspectDetail={(item) => setSelectedDetailModal(item)}
        />
      )}

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        item={editingRecord}
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        onSave={(updatedResult) => {
          if (onSaveRecord) {
            onSaveRecord(updatedResult);
          }
          setEditingRecord(null);
        }}
        rates={rates}
        t={t}
        lang={lang}
      />

      {/* Flight Consignment Creation / AI PDF Parser Modal */}
      {showFlightConsignmentModal && (
        <FlightConsignmentModal
          isOpen={showFlightConsignmentModal}
          onClose={() => {
            setShowFlightConsignmentModal(false);
            setFlightModalInitialFlight(null);
            setFlightModalCustomSelectedItems(null);
          }}
          selectedItems={flightModalCustomSelectedItems || selectedItemsList}
          existingFlights={flights}
          allHistoryCalculations={history}
          initialFlight={flightModalInitialFlight}
          currentUser={currentUser}
          lang={lang}
          onFlightSaved={(newFlight, updatedCalculations) => {
            setFlights((prev) => {
              const existingIdx = prev.findIndex((f) => f.id === newFlight.id);
              if (existingIdx >= 0) {
                const copy = [...prev];
                copy[existingIdx] = newFlight;
                return copy;
              }
              return [newFlight, ...prev];
            });
            if (updatedCalculations && updatedCalculations.length > 0 && onSaveRecord) {
              updatedCalculations.forEach((calc) => onSaveRecord(calc));
            }
            setShowFlightConsignmentModal(false);
            setFlightModalInitialFlight(null);
            setFlightModalCustomSelectedItems(null);
            setDashboardSubTab('flights');
          }}
        />
      )}

      {/* Flight Consignment Inspection / Detail View Modal */}
      {selectedFlightForView && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-sky-900 via-blue-900 to-slate-950 text-white rounded-t-3xl flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-500/25 text-sky-300 border border-sky-500/30">
                    {selectedFlightForView.airline}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/20">
                    AWB: {selectedFlightForView.masterAwbNumber || 'N/A'}
                  </span>
                  {selectedFlightForView.flightTicketPrice !== undefined && selectedFlightForView.flightTicketPrice !== null && (
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Ticket className="w-3 h-3 text-amber-400" />
                      <span>{lang === 'ar' ? 'سعر التذكرة:' : 'Ticket Fare:'} {formatCurrency(selectedFlightForView.flightTicketPrice, selectedFlightForView.flightTicketCurrency || 'USD')}</span>
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-xl sm:text-2xl text-white tracking-tight leading-snug flex items-center gap-2">
                  <Plane className="w-6 h-6 text-sky-400" />
                  <span>{selectedFlightForView.flightNumber}</span>
                  {selectedFlightForView.tripType === 'round_trip' && selectedFlightForView.returnFlightNumber && (
                    <span className="text-base text-indigo-300 font-bold">/ {selectedFlightForView.returnFlightNumber}</span>
                  )}
                  <span className="text-sm font-normal text-sky-300">
                    ({selectedFlightForView.originAirport} {selectedFlightForView.tripType === 'round_trip' ? '⇄' : '→'} {selectedFlightForView.destinationAirport})
                  </span>
                </h3>
                <div className="text-xs text-sky-200 mt-1 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    <span>{lang === 'ar' ? 'الذهاب:' : 'Dep:'} {selectedFlightForView.flightDate}</span>
                  </span>
                  {selectedFlightForView.tripType === 'round_trip' && selectedFlightForView.returnFlightDate && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-indigo-200 font-semibold">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{lang === 'ar' ? 'العودة:' : 'Ret:'} {selectedFlightForView.returnFlightDate}</span>
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span>{selectedFlightForView.originCountry} {selectedFlightForView.tripType === 'round_trip' ? '⇄' : '→'} {selectedFlightForView.destinationCountry}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFlightForView(null)}
                className="p-2 rounded-2xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-white transition-colors cursor-pointer border border-white/20 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-6">
              {/* 4-KPI Overview Box */}
              {(() => {
                const linkedCalcItems = (selectedFlightForView.calculationIds || [])
                  .map((calcId) => history.find((h) => h.id === calcId))
                  .filter((x): x is CalculationResult => Boolean(x));

                const modalGrossWeightKg = (selectedFlightForView.totalWeightKg && selectedFlightForView.totalWeightKg > 0)
                  ? selectedFlightForView.totalWeightKg
                  : (selectedFlightForView.totalGrossWeightKg && selectedFlightForView.totalGrossWeightKg > 0)
                  ? selectedFlightForView.totalGrossWeightKg
                  : linkedCalcItems.reduce((acc, curr) => acc + getCalculationGrossWeightKg(curr), 0);

                const modalChargeableWeightKg = (selectedFlightForView.totalChargeableWeightKg && selectedFlightForView.totalChargeableWeightKg > 0)
                  ? selectedFlightForView.totalChargeableWeightKg
                  : linkedCalcItems.reduce((acc, curr) => acc + getCalculationChargeableWeightKg(curr), 0);

                const modalPieces = (selectedFlightForView.totalPieces && selectedFlightForView.totalPieces > 0)
                  ? selectedFlightForView.totalPieces
                  : linkedCalcItems.reduce((acc, curr) => acc + getCalculationPieces(curr), 0);

                const modalVolumeCbm = (selectedFlightForView.totalVolumeCbm && selectedFlightForView.totalVolumeCbm > 0)
                  ? selectedFlightForView.totalVolumeCbm
                  : linkedCalcItems.reduce((acc, curr) => acc + getCalculationVolumeCBM(curr), 0);

                const modalCostEGP = (selectedFlightForView.totalLandedCostEGP && selectedFlightForView.totalLandedCostEGP > 0)
                  ? selectedFlightForView.totalLandedCostEGP
                  : (selectedFlightForView.totalLandedCost && selectedFlightForView.totalLandedCost > 0)
                  ? selectedFlightForView.totalLandedCost
                  : linkedCalcItems.reduce((acc, curr) => acc + getCalculationLandedCost(curr), 0);

                const modalRevenueEGP = (selectedFlightForView.totalRevenueEGP && selectedFlightForView.totalRevenueEGP > 0)
                  ? selectedFlightForView.totalRevenueEGP
                  : (selectedFlightForView.totalRevenue && selectedFlightForView.totalRevenue > 0)
                  ? selectedFlightForView.totalRevenue
                  : linkedCalcItems.reduce((acc, curr) => acc + getCalculationRevenue(curr), 0);

                const modalProfitEGP = (selectedFlightForView.totalProfitEGP !== undefined && selectedFlightForView.totalProfitEGP !== 0)
                  ? selectedFlightForView.totalProfitEGP
                  : (selectedFlightForView.totalProfit !== undefined && selectedFlightForView.totalProfit !== 0)
                  ? selectedFlightForView.totalProfit
                  : modalRevenueEGP - modalCostEGP;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[10px] text-sky-600 dark:text-sky-400 uppercase font-black tracking-wider mb-1">
                        {lang === 'ar' ? 'الوزن الإجمالي (Gross)' : 'Gross Weight'}
                      </div>
                      <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        {modalGrossWeightKg.toFixed(1)} <span className="text-xs">KG</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {modalChargeableWeightKg.toFixed(1)} KG Chg • {modalVolumeCbm.toFixed(2)} CBM
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1">
                        {lang === 'ar' ? 'عدد القطع / الطرود' : 'Total Packages'}
                      </div>
                      <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        {modalPieces.toLocaleString()} <span className="text-xs">{lang === 'ar' ? 'طرد' : 'pcs'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {linkedCalcItems.length} {lang === 'ar' ? 'حسبات مربوطة' : 'Linked Records'}
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-1">
                        {lang === 'ar' ? 'تكلفة الشحنة الإجمالية' : 'Total Landed Cost'}
                      </div>
                      <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        {formatCurrency(modalCostEGP, 'EGP')}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedFlightForView.freightCostUSD ? `$${selectedFlightForView.freightCostUSD.toLocaleString()} Freight` : 'Total In EGP'}
                      </div>
                    </div>

                    <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/25">
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-wider mb-1">
                        {lang === 'ar' ? 'صافي الربح المتوقع' : 'Projected Profit'}
                      </div>
                      <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(modalProfitEGP, 'EGP')}
                      </div>
                      <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-bold mt-0.5">
                        {modalRevenueEGP > 0
                          ? `${((modalProfitEGP / modalRevenueEGP) * 100).toFixed(1)}% margin`
                          : 'Margin'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Linked Shipments List */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{lang === 'ar' ? 'المنتجات والشحنات المربوطة بالرحلة' : 'Cargo & Products Linked to Manifest'}</span>
                  <span className="text-xs font-bold text-slate-400">
                    ({(selectedFlightForView.calculationIds || []).length} {lang === 'ar' ? 'منتج / شحنة' : 'items'})
                  </span>
                </h4>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                  {(selectedFlightForView.calculationIds || []).length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      {lang === 'ar' ? 'لا توجد حسبات محددة مربوطة بالرحلة' : 'No specific calculation records linked.'}
                    </div>
                  ) : (
                    (selectedFlightForView.calculationIds || []).map((calcId) => {
                      const item = history.find((h) => h.id === calcId);
                      if (!item) {
                        return (
                          <div key={calcId} className="p-3 text-xs text-slate-400 font-mono">
                            ID: {calcId} (Archived record)
                          </div>
                        );
                      }
                      const grossWeight = getCalculationGrossWeightKg(item);
                      const chargeableWeight = getCalculationChargeableWeightKg(item);
                      const volumeCbm = getCalculationVolumeCBM(item);

                      return (
                        <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white dark:hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-3">
                            {item.input.invoiceImage ? (
                              <img
                                src={item.input.invoiceImage}
                                alt={item.input.title}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{item.input.title}</div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono mt-0.5">
                                <span>SKU: {item.input.skuSupplier || 'N/A'}</span>
                                <span>•</span>
                                <span>{item.input.quantity.toLocaleString()} pcs</span>
                                <span>•</span>
                                <span className="font-bold text-sky-600 dark:text-sky-400">{grossWeight.toFixed(1)} KG gross</span>
                                <span>({chargeableWeight.toFixed(1)} KG chg)</span>
                                <span>•</span>
                                <span>{volumeCbm.toFixed(3)} CBM</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right rtl:text-left flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                            <div className="font-black text-slate-900 dark:text-white">
                              {formatCurrency(item.totalLandedCostTarget, item.input.targetCurrency)}
                            </div>
                            <div className="text-[10px] font-bold text-emerald-500">
                              +{formatCurrency(item.totalProfitTarget, item.input.targetCurrency)} ({item.actualMarginPercentage?.toFixed(1)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Manifest Remarks & Customs Notes */}
              {selectedFlightForView.notes && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
                  <div className="font-bold text-slate-700 dark:text-slate-300">
                    {lang === 'ar' ? 'ملاحظات وتفاصيل التخليص' : 'Manifest & Customs Notes'}:
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 whitespace-pre-line">
                    {selectedFlightForView.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/80 rounded-b-3xl flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedFlightForView(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>

              <button
                type="button"
                onClick={() => handleExportFlightManifest(selectedFlightForView)}
                disabled={isExportingFlightPdf === selectedFlightForView.id}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-md shadow-sky-950/40 transition-all cursor-pointer min-h-[40px]"
              >
                {isExportingFlightPdf === selectedFlightForView.id ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-slate-950" />
                )}
                <span>{lang === 'ar' ? 'تحميل مانيفست الشحن الرسمي (PDF)' : 'Download Official Air Manifest (PDF)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Flight Confirmation Modal */}
      {flightToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {lang === 'ar' ? 'حذف بوليصة / رحلة الطيران؟' : 'Delete Flight Manifest?'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar'
                  ? `هل أنت متأكد من حذف رحلة الطيران "${flightToDelete.flightNumber}"؟ لن يتم حذف الحسبات المرتبطة بها.`
                  : `Are you sure you want to delete flight "${flightToDelete.flightNumber}"? The linked calculation records will not be deleted.`}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFlightToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer min-h-[40px]"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={() => handleDeleteFlight(flightToDelete.id)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/40 cursor-pointer min-h-[40px]"
              >
                {lang === 'ar' ? 'نعم، حذف الرحلة' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

