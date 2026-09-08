import React, { useState, useMemo } from 'react';
import { CalculationResult } from '../types';
import { formatCurrency } from '../data/currencies';
import { exportSingleCalculationPDF } from '../utils/pdfExport';
import { translations, Language } from '../data/translations';
import { EditTransactionModal } from './EditTransactionModal';
import { EditProductInfoModal } from './EditProductInfoModal';
import {
  Image as ImageIcon,
  Search,
  Filter,
  Eye,
  Maximize2,
  Download,
  Copy,
  Calculator,
  FileText,
  X,
  Package,
  Layers,
  Sparkles,
  Plane,
  Ship,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Calendar,
  DollarSign,
  Tag,
  Building2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit3,
  Trash2,
} from 'lucide-react';

interface GalleryViewProps {
  history: CalculationResult[];
  onLoadIntoCalculator: (result: CalculationResult) => void;
  onNavigateToCalculator: () => void;
  onSaveRecord?: (result: CalculationResult) => void;
  onDeleteRecord?: (id: string) => void;
  rates: Record<string, number>;
  t: typeof translations['en'];
  lang: Language;
}

interface ProductGroup {
  key: string;
  title: string;
  sku: string;
  supplier: string;
  category: string;
  tradeDirection: 'import' | 'export';
  image?: string;
  latestRecord: CalculationResult;
  records: CalculationResult[];
  totalRecords: number;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  history,
  onLoadIntoCalculator,
  onNavigateToCalculator,
  onSaveRecord,
  onDeleteRecord,
  rates,
  t,
  lang,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'import' | 'export'>('all');
  const [photoFilter, setPhotoFilter] = useState<'with_photo' | 'all'>('with_photo');
  const [freightFilter, setFreightFilter] = useState<string>('all');
  
  // Lightbox Modal state
  const [selectedImage, setSelectedImage] = useState<{ url: string; title: string; sku?: string; date?: string } | null>(null);
  
  // Product Records Modal state
  const [selectedProductGroup, setSelectedProductGroup] = useState<ProductGroup | null>(null);

  // Focused Product Card state for driving header totals
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);

  // Edit Transaction Modal state
  const [editingRecord, setEditingRecord] = useState<CalculationResult | null>(null);

  // Delete Record state
  const [recordToDelete, setRecordToDelete] = useState<CalculationResult | null>(null);

  // Edit Global Product Info Modal state
  const [editingProductGroup, setEditingProductGroup] = useState<ProductGroup | null>(null);

  // Group calculations by Product SKU or Title to form unique catalog items
  const productGroups = useMemo(() => {
    const groupsMap = new Map<string, ProductGroup>();

    history.forEach((item) => {
      const input = item.input;
      const sku = (input.skuSupplier || '').trim();
      const title = (input.title || 'Untitled Product').trim();
      const key = sku ? `sku_${sku.toLowerCase()}` : `title_${title.toLowerCase()}`;
      
      const tradeDir = input.tradeDirection || 'import';
      const image = input.invoiceImage;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          title: input.title || (lang === 'ar' ? 'منتج بدون عنوان' : 'Untitled Product'),
          sku: input.skuSupplier || 'N/A',
          supplier: input.skuSupplier || '',
          category: input.category || 'General',
          tradeDirection: tradeDir,
          image,
          latestRecord: item,
          records: [item],
          totalRecords: 1,
        });
      } else {
        const existing = groupsMap.get(key)!;
        existing.records.push(item);
        existing.totalRecords += 1;
        // Keep the latest record
        if (new Date(item.createdAt) > new Date(existing.latestRecord.createdAt)) {
          existing.latestRecord = item;
        }
        // If existing group has no image but this record has one, attach it
        if (!existing.image && image) {
          existing.image = image;
        }
      }
    });

    return Array.from(groupsMap.values());
  }, [history, lang]);

  // Dynamically resolve active selected product group so modal updates live when edits save
  const activeSelectedProductGroup = useMemo(() => {
    if (!selectedProductGroup) return null;
    return productGroups.find((g) => g.key === selectedProductGroup.key) || null;
  }, [selectedProductGroup, productGroups]);

  // Dynamically filter records in Product Group Modal matching current filters
  const modalFilteredRecords = useMemo(() => {
    if (!activeSelectedProductGroup) return [];
    return activeSelectedProductGroup.records.filter((rec) => {
      if (tradeFilter !== 'all') {
        const dir = rec.input.tradeDirection || 'import';
        if (dir !== tradeFilter) return false;
      }
      if (freightFilter !== 'all') {
        if (rec.input.freightMethod !== freightFilter) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const inp = rec.input;
        const match =
          (inp.title && inp.title.toLowerCase().includes(term)) ||
          (inp.skuSupplier && inp.skuSupplier.toLowerCase().includes(term)) ||
          (inp.category && inp.category.toLowerCase().includes(term));
        if (!match) return false;
      }
      return true;
    });
  }, [activeSelectedProductGroup, tradeFilter, freightFilter, searchTerm]);

  // Dynamically resolve focused product group if selected
  const focusedGroup = useMemo(() => {
    if (!focusedGroupKey) return null;
    return productGroups.find((g) => g.key === focusedGroupKey) || null;
  }, [focusedGroupKey, productGroups]);

  // Filtered product groups - checks across ALL records in each product group
  const filteredGroups = useMemo(() => {
    return productGroups.filter((group) => {
      // 1. Search term (checks group info AND any record in group)
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matchGroup =
          (group.title || '').toLowerCase().includes(term) ||
          (group.sku || '').toLowerCase().includes(term) ||
          (group.category || '').toLowerCase().includes(term);

        const matchRecord = group.records.some((rec) => {
          const inp = rec.input;
          return (
            (inp.title && inp.title.toLowerCase().includes(term)) ||
            (inp.skuSupplier && inp.skuSupplier.toLowerCase().includes(term)) ||
            (inp.category && inp.category.toLowerCase().includes(term)) ||
            (inp.notes && inp.notes.toLowerCase().includes(term))
          );
        });

        if (!matchGroup && !matchRecord) return false;
      }

      // 2. Trade direction filter (checks across ALL records in the group)
      if (tradeFilter !== 'all') {
        const hasTradeMatch = group.records.some((rec) => {
          const dir = rec.input.tradeDirection || 'import';
          return dir === tradeFilter;
        });
        if (!hasTradeMatch) return false;
      }

      // 3. Photo filter (checks group level or any record in group)
      if (photoFilter === 'with_photo') {
        const hasPhoto = !!group.image || group.records.some((rec) => !!rec.input.invoiceImage);
        if (!hasPhoto) return false;
      }

      // 4. Freight method filter (checks across ALL records in the group)
      if (freightFilter !== 'all') {
        const hasFreightMatch = group.records.some((rec) => rec.input.freightMethod === freightFilter);
        if (!hasFreightMatch) return false;
      }

      return true;
    });
  }, [productGroups, searchTerm, tradeFilter, photoFilter, freightFilter]);

  // Statistics & Aggregate Totals across Catalog
  const totalCatalogProducts = productGroups.length;
  const productsWithPhotosCount = productGroups.filter((g) => !!g.image).length;
  const primaryCurrency = history[0]?.input.targetCurrency || 'USD';
  const primaryOriginalCurrency = history[0]?.input.originalCurrency || 'USD';

  const catalogTotals = useMemo(() => {
    let totalUnits = 0;
    let totalPurchaseValTarget = 0;
    let totalPurchaseValOriginal = 0;
    let totalLandedVal = 0;
    let totalRevenueVal = 0;
    let totalProfitVal = 0;

    // Targets for calculation: focused product card or all filtered product groups
    const groupsToCalculate = focusedGroup ? [focusedGroup] : filteredGroups;

    groupsToCalculate.forEach((g) => {
      // Sum across ALL historical calculation records in the group matching current filters
      g.records.forEach((rec) => {
        if (tradeFilter !== 'all') {
          const dir = rec.input.tradeDirection || 'import';
          if (dir !== tradeFilter) return;
        }
        if (freightFilter !== 'all') {
          if (rec.input.freightMethod !== freightFilter) return;
        }

        const qty = rec.input.quantity || 1;
        const purchaseOriginalUnit = rec.input.originalPrice || 0;
        const purchaseOriginalTotal = purchaseOriginalUnit * qty;
        const purchaseTargetVal = rec.totalOriginalPriceTarget || ((rec.originalPriceTarget || 0) * qty);
        const landedVal = rec.totalLandedCostTarget || 0;
        const revVal = rec.totalRevenueTarget || ((rec.suggestedSellingPricePerUnitTarget || 0) * qty);
        const profitVal = rec.totalProfitTarget || (revVal - landedVal);

        totalUnits += qty;
        totalPurchaseValOriginal += purchaseOriginalTotal;
        totalPurchaseValTarget += purchaseTargetVal;
        totalLandedVal += landedVal;
        totalRevenueVal += revVal;
        totalProfitVal += profitVal;
      });
    });

    const profitMargin = totalRevenueVal > 0 ? (totalProfitVal / totalRevenueVal) * 100 : 0;

    return {
      totalUnits,
      totalPurchaseValOriginal,
      totalPurchaseValTarget,
      totalLandedVal,
      totalRevenueVal,
      totalProfitVal,
      profitMargin,
    };
  }, [productGroups, filteredGroups, focusedGroup]);

  const getFreightIcon = (method: string) => {
    switch (method) {
      case 'air_express':
      case 'air_standard':
        return <Plane className="w-3.5 h-3.5 text-sky-400" />;
      case 'sea_lcl':
      case 'sea_fcl':
        return <Ship className="w-3.5 h-3.5 text-indigo-400" />;
      case 'road_freight':
        return <Truck className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Package className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getFreightLabel = (method: string) => {
    switch (method) {
      case 'air_express': return t.airExpress;
      case 'air_standard': return t.airCargo;
      case 'sea_lcl': return t.seaLcl;
      case 'sea_fcl': return t.seaFcl;
      case 'road_freight': return t.roadFreight;
      default: return method;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Gallery Header Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950/60 p-6 sm:p-8 text-white border border-slate-700/60 shadow-xl">
        <div className="absolute top-0 ltr:right-0 rtl:left-0 -mt-8 ltr:-mr-8 rtl:-ml-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.galleryTab}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {t.galleryMainTitle}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                {t.gallerySubtitle}
              </p>
            </div>
          </div>

          {/* Aggregate Column Totals Grid */}
          <div className="pt-4 border-t border-slate-700/60">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs font-bold uppercase text-emerald-400 tracking-wider">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {focusedGroup
                    ? `${t.calculatingForProduct || (lang === 'ar' ? 'الحسابات مخصصة للمنتج:' : 'Calculated for Product:')} "${focusedGroup.title}"`
                    : t.gallerySummaryHeader}
                </span>
                {focusedGroup && (
                  <span className="font-mono text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                    SKU: {focusedGroup.sku}
                  </span>
                )}
              </div>

              {focusedGroup ? (
                <button
                  type="button"
                  onClick={() => setFocusedGroupKey(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t.showAllProductsTotals || (lang === 'ar' ? 'عرض كافة المنتجات' : 'Show All Catalog Totals')}</span>
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 normal-case font-normal hidden sm:inline-block">
                  {t.clickCardToFocus || (lang === 'ar' ? 'انقر على كارت المنتج لاحتساب إجماليات الهيدر له' : 'Click product card to calculate header totals')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 text-center shadow-xs">
                <div className="text-[11px] text-slate-400 font-medium mb-1">{t.totalGalleryProducts}</div>
                <div className="text-lg font-bold text-slate-100 flex items-center justify-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>{totalCatalogProducts}</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-0.5">{productsWithPhotosCount} {t.filterWithPhotosOnly}</div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 text-center shadow-xs">
                <div className="text-[11px] text-slate-400 font-medium mb-1">{t.totalCargoUnits}</div>
                <div className="text-lg font-bold text-slate-100 font-mono flex items-center justify-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>{catalogTotals.totalUnits.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t.quantityLabel}</div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 text-center shadow-xs">
                <div className="text-[11px] text-sky-300 font-medium mb-1">{t.totalPurchaseValue}</div>
                <div className="text-base font-bold text-sky-300 font-mono">
                  {formatCurrency(catalogTotals.totalPurchaseValOriginal, primaryOriginalCurrency)}
                </div>
                <div className="text-[10px] text-sky-400/80 mt-0.5 font-mono">
                  {formatCurrency(catalogTotals.totalPurchaseValTarget, primaryCurrency)} ({t.convertedToTarget || 'Target'})
                </div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 text-center shadow-xs">
                <div className="text-[11px] text-amber-300 font-medium mb-1">{t.kpiTotalLandedValue}</div>
                <div className="text-base font-bold text-amber-300 font-mono">
                  {formatCurrency(catalogTotals.totalLandedVal, primaryCurrency)}
                </div>
                <div className="text-[10px] text-amber-400/80 mt-0.5">{t.landedCostPerUnit}</div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 text-center shadow-xs">
                <div className="text-[11px] text-emerald-300 font-medium mb-1">{t.totalProjectedSales}</div>
                <div className="text-base font-bold text-emerald-300 font-mono">
                  {formatCurrency(catalogTotals.totalRevenueVal, primaryCurrency)}
                </div>
                <div className="text-[10px] text-emerald-400/80 mt-0.5">{t.suggestedSellingPrice}</div>
              </div>

              <div className="bg-slate-800/90 border border-emerald-500/40 rounded-xl p-3 text-center shadow-xs">
                <div className="text-[11px] text-emerald-400 font-medium mb-1">{t.totalEstimatedProfit}</div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {formatCurrency(catalogTotals.totalProfitVal, primaryCurrency)}
                </div>
                <div className="text-[10px] font-bold text-emerald-300 mt-0.5">
                  {t.profitMarginPct}: {catalogTotals.profitMargin.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Controls Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.gallerySearchPlaceholder}
              className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-4 rtl:pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Photos Filter Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setPhotoFilter('with_photo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  photoFilter === 'with_photo'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{t.filterWithPhotosOnly}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/20 font-mono">
                  {productsWithPhotosCount}
                </span>
              </button>
              <button
                onClick={() => setPhotoFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  photoFilter === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t.filterAllCatalog}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/20 font-mono">
                  {totalCatalogProducts}
                </span>
              </button>
            </div>

            {/* Trade Direction Filter */}
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="all">{t.allTradeDirections}</option>
              <option value="import">{t.importOption}</option>
              <option value="export">{t.exportOption}</option>
            </select>

            {/* Freight Method Filter */}
            <select
              value={freightFilter}
              onChange={(e) => setFreightFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              <option value="all">{t.allFreightModes}</option>
              <option value="air_express">{t.airExpress}</option>
              <option value="air_standard">{t.airCargo}</option>
              <option value="sea_lcl">{t.seaLcl}</option>
              <option value="sea_fcl">{t.seaFcl}</option>
              <option value="road_freight">{t.roadFreight}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gallery Cards Grid */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <ImageIcon className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t.noGalleryItemsTitle}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.noGalleryItemsSub}
            </p>
          </div>
          <button
            onClick={onNavigateToCalculator}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-md cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            <span>{t.goToCalculatorBtn}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGroups.map((group) => {
            const matchingRecords = group.records.filter((rec) => {
              if (tradeFilter !== 'all') {
                const dir = rec.input.tradeDirection || 'import';
                if (dir !== tradeFilter) return false;
              }
              if (freightFilter !== 'all') {
                if (rec.input.freightMethod !== freightFilter) return false;
              }
              return true;
            });
            const latest = matchingRecords[0] || group.latestRecord;
            const input = latest.input;
            const isImport = (input.tradeDirection || 'import') !== 'export';
            const targetCurr = input.targetCurrency || 'USD';
            const margin = latest.actualMarginPercentage || 0;
            const isFocused = focusedGroupKey === group.key;

            return (
              <div
                key={group.key}
                onClick={() => setFocusedGroupKey(isFocused ? null : group.key)}
                className={`group bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                  isFocused
                    ? 'border-emerald-500 ring-2 ring-emerald-500/80 shadow-xl scale-[1.01]'
                    : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm hover:shadow-lg'
                }`}
              >
                <div>
                  {/* Card Image Area */}
                  <div className="relative h-48 bg-slate-100 dark:bg-slate-950 overflow-hidden border-b border-slate-100 dark:border-slate-800">
                    {group.image ? (
                      <>
                        <img
                          src={group.image}
                          alt={group.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImage({
                                url: group.image!,
                                title: group.title,
                                sku: group.sku,
                                date: new Date(latest.createdAt).toLocaleDateString(),
                              });
                            }}
                            className="p-2.5 rounded-xl bg-slate-900/90 text-white hover:bg-emerald-500 hover:text-slate-950 transition-colors shadow-md cursor-pointer"
                            title={t.viewFullImage}
                          >
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 text-slate-400">
                        <Package className="w-10 h-10 mb-2 stroke-1 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {lang === 'ar' ? 'بدون صورة مرفقة' : 'No Photo Attached'}
                        </span>
                      </div>
                    )}

                    {/* Trade Direction Badge Overlay */}
                    <div className="absolute top-3 ltr:left-3 rtl:right-3 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm backdrop-blur-md ${
                          isImport
                            ? 'bg-emerald-500/90 text-slate-950'
                            : 'bg-indigo-600/90 text-white'
                        }`}
                      >
                        {isImport ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                        <span>{isImport ? t.importBadge : t.exportBadge}</span>
                      </span>
                    </div>

                    {/* Records Count Badge */}
                    <div className="absolute top-3 ltr:right-3 rtl:left-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/80 text-emerald-300 border border-slate-700/80 text-[11px] font-bold backdrop-blur-md font-mono">
                        <Layers className="w-3 h-3 text-emerald-400" />
                        <span>
                          {tradeFilter !== 'all' || freightFilter !== 'all'
                            ? `${matchingRecords.length} / ${group.totalRecords}`
                            : group.totalRecords}{' '}
                          {t.recordsCount}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1 group-hover:text-emerald-500 transition-colors">
                        {group.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                          {group.sku !== 'N/A' ? group.sku : (lang === 'ar' ? 'بدون رمز' : 'No SKU')}
                        </span>
                        <span className="flex items-center gap-1">
                          {getFreightIcon(input.freightMethod)}
                          <span className="text-[11px]">{getFreightLabel(input.freightMethod)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Cost & Margin Metrics Box */}
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{t.supplierUnitPrice}:</span>
                        <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
                          {formatCurrency(input.originalPrice || 0, input.originalCurrency || 'USD')}
                          {input.originalCurrency !== targetCurr && latest.originalPriceTarget ? (
                            <span className="text-[10px] text-slate-400 font-normal ltr:ml-1 rtl:mr-1">
                              ({formatCurrency(latest.originalPriceTarget, targetCurr)})
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{t.landedCostPerUnit}:</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(latest.landedCostPerUnitTarget || 0, targetCurr)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">{t.suggestedSellingPrice}:</span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(latest.suggestedSellingPricePerUnitTarget || 0, targetCurr)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">{t.profitMarginPct}:</span>
                        <span
                          className={`font-bold font-mono px-1.5 py-0.2 rounded text-[11px] ${
                            margin >= 20
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : margin >= 5
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {margin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProductGroup(group);
                      setFocusedGroupKey(group.key);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title={t.viewProductRecords}
                  >
                    <Layers className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="truncate">{t.viewProductRecords}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProductGroup(group);
                      setFocusedGroupKey(group.key);
                    }}
                    className="py-2.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    title={t.editProductInfoBtn || (lang === 'ar' ? 'تعديل بيانات المنتج' : 'Edit Product Info')}
                  >
                    <Edit3 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="truncate">{t.editProductInfoBtn || (lang === 'ar' ? 'تعديل البيانات' : 'Edit Info')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox High-Res Image Inspection Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">{selectedImage.title}</h3>
                  {selectedImage.sku && (
                    <span className="text-xs text-slate-400 font-mono">SKU: {selectedImage.sku}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedImage.url}
                  download={`product-${selectedImage.sku || 'image'}.png`}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - Image View */}
            <div className="p-4 flex items-center justify-center bg-slate-950/50 max-h-[70vh] overflow-auto">
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>{t.imageLightboxTitle}</span>
              {selectedImage.date && <span>{t.calculatedOn}: {selectedImage.date}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Product Records Detail Modal */}
      {activeSelectedProductGroup && (
        <div
          className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedProductGroup(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {t.productRecordsModalTitle} {activeSelectedProductGroup.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                    <span>SKU: {activeSelectedProductGroup.sku}</span>
                    <span>•</span>
                    <span>
                      {tradeFilter !== 'all' || freightFilter !== 'all' || searchTerm !== ''
                        ? `${modalFilteredRecords.length} / ${activeSelectedProductGroup.totalRecords}`
                        : activeSelectedProductGroup.totalRecords}{' '}
                      {t.recordsCount}
                      {tradeFilter !== 'all' &&
                        ` (${
                          tradeFilter === 'import'
                            ? (lang === 'ar' ? 'استيراد' : 'Import')
                            : (lang === 'ar' ? 'تصدير' : 'Export')
                        })`}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedProductGroup(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Records List Body */}
            <div className="p-6 overflow-y-auto space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
              {modalFilteredRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                  <p className="text-sm font-bold">
                    {lang === 'ar'
                      ? 'لا توجد معاملات متطابقة للفلاتر المحددة لهذا المنتج'
                      : 'No transactions match the selected filters for this product'}
                  </p>
                </div>
              ) : (
                modalFilteredRecords.map((rec) => {
                const targetCurr = rec.input.targetCurrency || 'USD';

                return (
                  <div key={rec.id} className="pt-4 first:pt-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                          {new Date(rec.createdAt).toLocaleDateString()} {new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {/* Trade Direction Badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            rec.input.tradeDirection === 'export'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {rec.input.tradeDirection === 'export' ? (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{t.exportOption || (lang === 'ar' ? 'تصدير' : 'Export')}</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{t.importOption || (lang === 'ar' ? 'استيراد' : 'Import')}</span>
                            </>
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                          {getFreightIcon(rec.input.freightMethod)}
                          <span>{getFreightLabel(rec.input.freightMethod)}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingRecord(rec)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title={t.editTransactionBtn || (lang === 'ar' ? 'تعديل المعاملة والصورة' : 'Edit Transaction & Image')}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{t.editTransactionBtn || (lang === 'ar' ? 'تعديل' : 'Edit')}</span>
                        </button>

                        <button
                          onClick={() => exportSingleCalculationPDF(rec, lang)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-500" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedProductGroup(null);
                            onLoadIntoCalculator(rec);
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>{t.duplicateInCalc}</span>
                        </button>

                        <button
                          onClick={() => setRecordToDelete(rec)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title={t.deleteRecord || (lang === 'ar' ? 'حذف الحسبة' : 'Delete Record')}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>{t.deleteRecord || (lang === 'ar' ? 'حذف' : 'Delete')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">{t.quantityLabel}:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{rec.input.quantity}</span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">{t.unitPurchaseCost}:</span>
                        <span className="font-bold text-sky-600 dark:text-sky-400 font-mono">
                          {formatCurrency(rec.input.originalPrice, rec.input.originalCurrency)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">{t.totalPurchaseCost}:</span>
                        <span className="font-bold text-sky-700 dark:text-sky-300 font-mono">
                          {formatCurrency(rec.input.originalPrice * rec.input.quantity, rec.input.originalCurrency)}
                          {rec.input.originalCurrency !== targetCurr && (
                            <span className="text-[10px] text-slate-400 font-normal block">
                              ({formatCurrency(rec.totalOriginalPriceTarget || ((rec.originalPriceTarget || 0) * rec.input.quantity), targetCurr)})
                            </span>
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">{t.totalLandedCostHeader}:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                          {formatCurrency(rec.totalLandedCostTarget, targetCurr)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">{t.suggestedSellingPrice}:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(rec.suggestedSellingPricePerUnitTarget, targetCurr)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">{t.profitMarginPct}:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {rec.actualMarginPercentage?.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedProductGroup(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-xs cursor-pointer"
              >
                {t.modalClose}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction / Cargo Photo Modal */}
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

      {/* Edit Global Product Catalog Info Modal */}
      <EditProductInfoModal
        group={editingProductGroup}
        isOpen={!!editingProductGroup}
        onClose={() => setEditingProductGroup(null)}
        onSave={(updatedRecords) => {
          if (onSaveRecord) {
            updatedRecords.forEach((rec) => onSaveRecord(rec));
          }
          setEditingProductGroup(null);
        }}
        t={t}
        lang={lang}
      />

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-5 bg-gradient-to-r from-rose-900/40 via-red-950/30 to-slate-900 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-100">
                    {lang === 'ar' ? 'تأكيد حذف الحسبة' : 'Confirm Delete Record'}
                  </h3>
                  <p className="text-[11px] text-rose-300/80 font-medium">
                    {recordToDelete.input.title}
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
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  {lang === 'ar'
                    ? `هل أنت تأكد من مسح هذه الحسبة (${recordToDelete.input.title}) نهائياً من التاريخ؟`
                    : `Are you sure you want to delete this calculation record (${recordToDelete.input.title}) permanently?`}
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
                    if (onDeleteRecord) {
                      onDeleteRecord(recordToDelete.id);
                    }
                    setRecordToDelete(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حذف نهائي' : 'Delete Record'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
