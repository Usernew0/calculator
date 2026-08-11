import React, { useState, useMemo, useRef } from 'react';
import { CalculationInput, FreightMethod, WeightUnit, DimensionUnit, TransportRateBasis, ExtraFee, CalculationResult } from '../types';
import { POPULAR_CURRENCIES, getCurrencySymbol } from '../data/currencies';
import { calculateTradeAndFreight } from '../utils/calculator';
import { CalculationResultsCard } from './CalculationResultsCard';
import { translations, Language } from '../data/translations';
import {
  Package,
  DollarSign,
  Scale,
  Truck,
  Globe,
  TrendingUp,
  Plus,
  Trash2,
  RotateCcw,
  Camera,
  Upload,
  Image as ImageIcon,
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
} from 'lucide-react';
import { HsCodeLibraryModal } from './HsCodeLibraryModal';
import { HsCodeItem } from '../data/hsCodes';
import { compressAndResizeImage } from '../utils/imageCompressor';

interface CalculatorFormProps {
  rates: Record<string, number>;
  onSaveToHistory: (result: CalculationResult) => void;
  savedIds: string[];
  t: typeof translations['en'];
  lang: Language;
  initialInput?: CalculationInput | null;
  history?: CalculationResult[];
}

const DEFAULT_INPUT: CalculationInput = {
  title: '',
  skuSupplier: '',
  category: '',
  tradeDirection: 'import',
  quantity: 0,
  originalPrice: 0,
  originalCurrency: 'EGP',
  weight: 0,
  weightUnit: 'kg',
  useWeightOnly: true,
  length: 0,
  width: 0,
  height: 0,
  dimensionUnit: 'cm',
  volumetricFactor: 5000,
  freightMethod: 'air_express',
  freightCurrency: 'EGP',
  freightRatePerUnit: 0,
  freightRateType: 'per_weight',
  freightRateBasis: 'per_kg',
  showCustomRates: false,
  originHandlingFee: 0,
  destinationHandlingFee: 0,
  customsClearanceFee: 0,
  dutyPercentage: 0,
  insurancePercentage: 0,
  inlandDeliveryFee: 0,
  extraFees: [],
  targetCurrency: 'EGP',
  pricingStrategy: 'target_price',
  targetValue: 0,
};

export const CalculatorForm: React.FC<CalculatorFormProps> = ({
  rates,
  onSaveToHistory,
  savedIds,
  t,
  lang,
  initialInput,
  history = [],
}) => {
  const [formData, setFormData] = useState<CalculationInput>(DEFAULT_INPUT);
  const [isPreFilledNoticeVisible, setIsPreFilledNoticeVisible] = useState<boolean>(false);
  const [isHistoryProductModalOpen, setIsHistoryProductModalOpen] = useState<boolean>(false);
  const [historyProductSearch, setHistoryProductSearch] = useState<string>('');
  const [rawTotalCost, setRawTotalCost] = useState<string | null>(null);

  // Extract unique saved products from history calculations
  const uniqueHistoryProducts = useMemo(() => {
    if (!history || history.length === 0) return [];
    const map = new Map<string, CalculationInput>();
    history.forEach((item) => {
      if (item.input && item.input.title && item.input.title.trim()) {
        const key = `${item.input.title.trim().toLowerCase()}||${(item.input.skuSupplier || '').trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, item.input);
        }
      }
    });
    return Array.from(map.values());
  }, [history]);

  React.useEffect(() => {
    if (initialInput) {
      setFormData(initialInput);
      setIsPreFilledNoticeVisible(true);
    }
  }, [initialInput]);
  const [newFeeName, setNewFeeName] = useState('');
  const [newFeeAmount, setNewFeeAmount] = useState<number | ''>('');
  const [newFeeType, setNewFeeType] = useState<'fixed' | 'percentage'>('fixed');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [isScanningAi, setIsScanningAi] = useState(false);
  const [aiScanStatus, setAiScanStatus] = useState<string | null>(null);

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert(lang === 'ar' ? 'الرجاء اختيار صورة صالحة' : 'Please select a valid image file');
      return;
    }
    try {
      const compressedBase64 = await compressAndResizeImage(file, 1000, 1000, 0.75);
      setFormData((prev) => ({ ...prev, invoiceImage: compressedBase64 }));
      setAiScanStatus(null);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          setFormData((prev) => ({ ...prev, invoiceImage: base64 }));
          setAiScanStatus(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanWithAi = async () => {
    if (!formData.invoiceImage) return;
    setIsScanningAi(true);
    setAiScanStatus(t.scanningWithAi);

    try {
      const res = await fetch('/api/parse-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: formData.invoiceImage }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse image');
      }

      const ext = data.extracted;
      setFormData((prev) => ({
        ...prev,
        title: ext.title || prev.title,
        skuSupplier: ext.skuSupplier || prev.skuSupplier,
        quantity: typeof ext.quantity === 'number' && ext.quantity > 0 ? ext.quantity : prev.quantity,
        originalPrice: typeof ext.originalPrice === 'number' && ext.originalPrice > 0 ? ext.originalPrice : prev.originalPrice,
        originalCurrency: ext.originalCurrency && POPULAR_CURRENCIES.some(c => c.code === ext.originalCurrency) ? ext.originalCurrency : prev.originalCurrency,
        weight: typeof ext.weight === 'number' && ext.weight > 0 ? ext.weight : prev.weight,
        category: ext.category || prev.category,
      }));

      setAiScanStatus(lang === 'ar' ? 'تم استخراج البيانات وتعبئة الحاسبة بنجاح ✨' : 'Data auto-extracted successfully! ✨');
    } catch (err: any) {
      console.error('AI scan error:', err);
      setAiScanStatus(lang === 'ar' ? 'تعذر الاستخراج، يرجى إدخال البيانات يدوياً' : 'AI scan could not parse all fields. Enter manually.');
    } finally {
      setIsScanningAi(false);
    }
  };

  const [isHsModalOpen, setIsHsModalOpen] = useState(false);

  const handleSelectHsCode = (item: HsCodeItem) => {
    setFormData((prev) => {
      const desc = lang === 'ar' ? item.descriptionAr : item.descriptionEn;
      const cat = lang === 'ar' ? item.categoryAr : item.categoryEn;
      const updatedTitle = prev.title ? prev.title : desc;
      return {
        ...prev,
        dutyPercentage: item.dutyRate,
        category: prev.category || cat,
        title: updatedTitle,
        showCustomRates: true,
      };
    });
  };

  // Compute live calculation
  const calculationResult = useMemo(() => {
    return calculateTradeAndFreight(formData, rates);
  }, [formData, rates]);

  const autoFillFromHistory = (
    field: 'title' | 'skuSupplier',
    val: string,
    currentForm: CalculationInput
  ): CalculationInput => {
    if (!val || val.trim().length < 1) return { ...currentForm, [field]: val };

    const clean = val.trim().toLowerCase();
    const matched = uniqueHistoryProducts.find((p) => {
      if (field === 'title') {
        return p.title && p.title.trim().toLowerCase() === clean;
      } else {
        return p.skuSupplier && p.skuSupplier.trim().toLowerCase() === clean;
      }
    });

    if (matched) {
      return {
        ...currentForm,
        [field]: val,
        title: field === 'skuSupplier' ? (matched.title || currentForm.title) : val,
        skuSupplier: field === 'title' ? (matched.skuSupplier || currentForm.skuSupplier) : val,
        invoiceImage: matched.invoiceImage || currentForm.invoiceImage,
        category: matched.category || currentForm.category,
        originalPrice: matched.originalPrice || currentForm.originalPrice,
        originalCurrency: matched.originalCurrency || currentForm.originalCurrency,
        weight: matched.weight || currentForm.weight,
        weightUnit: matched.weightUnit || currentForm.weightUnit,
        dutyPercentage: matched.dutyPercentage ?? currentForm.dutyPercentage,
        tradeDirection: matched.tradeDirection || currentForm.tradeDirection || 'import',
      };
    }

    return { ...currentForm, [field]: val };
  };

  const handleChange = (
    field: keyof CalculationInput,
    value: string | number | boolean | ExtraFee[] | undefined
  ) => {
    setRawTotalCost(null);
    setFormData((prev) => {
      if ((field === 'title' || field === 'skuSupplier') && typeof value === 'string') {
        return autoFillFromHistory(field, value, prev);
      }
      return { ...prev, [field]: value };
    });
  };

  const handleResetForm = () => {
    setFormData(DEFAULT_INPUT);
    setNewFeeName('');
    setNewFeeAmount('');
  };

  const handleAddExtraFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeeName || typeof newFeeAmount !== 'number' || newFeeAmount <= 0) return;

    const newFee: ExtraFee = {
      id: Date.now().toString(),
      name: newFeeName,
      amount: newFeeAmount,
      type: newFeeType,
    };

    setFormData((prev) => ({
      ...prev,
      extraFees: [...prev.extraFees, newFee],
    }));

    setNewFeeName('');
    setNewFeeAmount('');
  };

  const handleRemoveExtraFee = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      extraFees: prev.extraFees.filter((f) => f.id !== id),
    }));
  };

  const isCurrentSaved = savedIds.includes(calculationResult.id);

  return (
    <div className="space-y-6">
      {/* Pre-filled Notification Banner when Duplicating Record */}
      {isPreFilledNoticeVisible && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {lang === 'ar'
                ? `تمت تعبئة بيانات الحاسبة بنجاح من سجل الشحنة "${formData.title || 'سجل سابق'}". يمكنك تعديل أي قيم ثم إجراء حسبة جديدة.`
                : `Calculator form pre-filled from historical record "${formData.title || 'Historical Record'}". You can modify any value and recalculate.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsPreFilledNoticeVisible(false)}
            className="p-1 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid: Inputs (Left 7 Columns) vs Live Result Card (Right 5 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Inputs Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Item & Basic Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs transition-colors duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{t.section1Title}</h2>
              </div>

              <div className="flex items-center gap-2">
                {uniqueHistoryProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsHistoryProductModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95 min-h-[36px]"
                    title={t.quickSelectFromHistory || 'Pick Saved Product / SKU from History'}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{t.selectProductFromHistoryBtn || (lang === 'ar' ? 'اختر منتج من السجل' : 'Select Saved Product')}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-[10px] font-black">
                      {uniqueHistoryProducts.length}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
                  title={t.clearAllInputs}
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.clearAllInputs}</span>
                </button>
              </div>
            </div>

            {/* Datalists for Autocomplete Native Browser Support */}
            <datalist id="calc-history-titles">
              {uniqueHistoryProducts.map((p, idx) => (
                <option key={`title-opt-${idx}`} value={p.title}>
                  {p.skuSupplier ? `SKU: ${p.skuSupplier}` : ''}
                </option>
              ))}
            </datalist>

            <datalist id="calc-history-skus">
              {uniqueHistoryProducts.map((p, idx) => (
                p.skuSupplier ? (
                  <option key={`sku-opt-${idx}`} value={p.skuSupplier}>
                    {p.title}
                  </option>
                ) : null
              ))}
            </datalist>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trade Operation Type Toggle: Import vs Export */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {t.tradeDirectionLabel || (lang === 'ar' ? 'نوع العملية التجارية' : 'Trade Operation Type')}
                </label>
                <div className="grid grid-cols-2 gap-2.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => handleChange('tradeDirection', 'import')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      (formData.tradeDirection || 'import') === 'import'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <ArrowDownLeft className={`w-4 h-4 ${(formData.tradeDirection || 'import') === 'import' ? 'text-white' : 'text-blue-500'}`} />
                    <span>{t.importOption || (lang === 'ar' ? 'شحنة استيراد (Import)' : 'Import Shipment')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange('tradeDirection', 'export')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      formData.tradeDirection === 'export'
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 ring-2 ring-amber-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <ArrowUpRight className={`w-4 h-4 ${formData.tradeDirection === 'export' ? 'text-white' : 'text-amber-500'}`} />
                    <span>{t.exportOption || (lang === 'ar' ? 'شحنة تصدير (Export)' : 'Export Shipment')}</span>
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {t.productTitleLabel}
                  </label>
                  {uniqueHistoryProducts.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t.orEnterNewProduct || (lang === 'ar' ? 'اختر سابقاً أو اكتب اسم جديد' : 'Select from history or type new')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  list="calc-history-titles"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder={t.productTitlePlaceholder}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.skuLabel}
                </label>
                <input
                  type="text"
                  list="calc-history-skus"
                  value={formData.skuSupplier}
                  onChange={(e) => handleChange('skuSupplier', e.target.value)}
                  placeholder={t.skuPlaceholder}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.quantityLabel}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity || ''}
                  onChange={(e) => handleChange('quantity', e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder={t.quantityPlaceholder}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t.transactionDateLabel || (lang === 'ar' ? 'تاريخ العملية' : 'Transaction Date')}</span>
                </label>
                <input
                  type="date"
                  value={formData.transactionDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleChange('transactionDate', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Image Upload & Camera Capture Block */}
              <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    {t.uploadPhotoLabel}
                  </span>
                  {formData.invoiceImage && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {t.imageAttachedSuccess}
                    </span>
                  )}
                </label>

                {/* Hidden File Inputs */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0]);
                    }
                  }}
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageFile(e.target.files[0]);
                    }
                  }}
                />

                {formData.invoiceImage ? (
                  <div className="relative p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 bg-black/5 dark:bg-black/20 flex items-center justify-center">
                      <img
                        src={formData.invoiceImage}
                        alt="Uploaded cargo invoice"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex-1 w-full flex flex-col gap-2">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {lang === 'ar' ? 'تم إرفاق صورة المنتج/الفاتورة بنجاح وتوثيقها.' : 'Product / invoice picture attached.'}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleScanWithAi}
                          disabled={isScanningAi}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {isScanningAi ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          )}
                          <span>{t.aiScanBtn}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, invoiceImage: undefined }));
                            setAiScanStatus(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t.removePhotoBtn}</span>
                        </button>
                      </div>

                      {aiScanStatus && (
                        <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                          {aiScanStatus}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-2 border-dashed border-slate-300 dark:border-slate-700/80 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-start">
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {lang === 'ar' ? 'التقط صورة بالكاميرا أو ارفع الفاتورة' : 'Capture photo or upload document image'}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {lang === 'ar' ? 'يدعم الصور (JPG, PNG) لاستخراج البيانات تلقائياً وحفظها في التقرير' : 'Supports JPG, PNG for AI extraction & PDF report logs'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{t.takeCameraPhotoBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{t.uploadDevicePhotoBtn}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Original Price & Currency */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs transition-colors duration-200">
            <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{t.section2Title}</h2>
              </div>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                {formData.originalCurrency}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Unit Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.unitPriceLabel}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                    {getCurrencySymbol(formData.originalCurrency)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.originalPrice || ''}
                    onChange={(e) => handleChange('originalPrice', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    placeholder={t.unitPricePlaceholder}
                    className="w-full pl-9 pr-3.5 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Option B: Total Purchase Cost for All Units */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.totalPriceLabel || (lang === 'ar' ? 'إجمالي سعر الشراء (جميع القطع)' : 'Total Purchase Cost (All Units)')}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                    {getCurrencySymbol(formData.originalCurrency)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rawTotalCost !== null ? rawTotalCost : ((formData.originalPrice * formData.quantity) > 0 ? (formData.originalPrice * formData.quantity) : '')}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      setRawTotalCost(valStr);
                      const numVal = parseFloat(valStr);
                      const qty = formData.quantity > 0 ? formData.quantity : 1;
                      if (!isNaN(numVal) && numVal >= 0) {
                        setFormData((prev) => ({ ...prev, originalPrice: numVal / qty }));
                      } else if (valStr === '') {
                        setFormData((prev) => ({ ...prev, originalPrice: 0 }));
                      }
                    }}
                    onBlur={() => setRawTotalCost(null)}
                    placeholder={t.totalPricePlaceholder || '0.00'}
                    className="w-full pl-9 pr-3.5 py-2 text-sm font-extrabold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Currency Selector */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.originalCurrencyLabel}
                </label>
                <select
                  value={formData.originalCurrency}
                  onChange={(e) => handleChange('originalCurrency', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                >
                  {POPULAR_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.flag} {curr.code} - {curr.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Helpful Banner */}
              <div className="sm:col-span-2 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-medium">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {t.costInputModeHelp || (lang === 'ar' ? 'أدخل سعر القطعة الواحدة أو الإجمالي لجميع القطع — تعديل أيهما يحسب الآخر تلقائياً.' : 'Enter Unit Price OR Total Batch Cost — changing either calculates the other automatically.')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {formData.quantity} {lang === 'ar' ? 'قطعة' : 'units'} × {getCurrencySymbol(formData.originalCurrency)}{formData.originalPrice.toFixed(2)}
                  </div>
                </div>

                <div className="font-black text-base text-indigo-950 dark:text-indigo-100 shrink-0">
                  {getCurrencySymbol(formData.originalCurrency)}
                  {(formData.originalPrice * formData.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Weight & Dimensions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs transition-colors duration-200">
            <div className="flex items-center justify-between pb-2 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{t.section3Title}</h2>
              </div>
              <span className="text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                {t.weightBadge}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.unitGrossWeightLabel}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weight || ''}
                    onChange={(e) => handleChange('weight', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 1.5"
                    className="w-full px-3.5 py-2 text-sm font-extrabold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <select
                    value={formData.weightUnit}
                    onChange={(e) => {
                      const newUnit = e.target.value as WeightUnit;
                      handleChange('weightUnit', newUnit);
                      if (newUnit === 'g') {
                        handleChange('freightRateBasis', 'per_g');
                      } else if (newUnit === 'kg') {
                        handleChange('freightRateBasis', 'per_kg');
                      } else if (newUnit === 'lbs') {
                        handleChange('freightRateBasis', 'per_lb');
                      } else if (newUnit === 'tonnes') {
                        handleChange('freightRateBasis', 'per_tonne');
                      }
                    }}
                    className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0 cursor-pointer"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="lbs">lbs</option>
                    <option value="tonnes">tonnes</option>
                  </select>
                </div>
              </div>

              {/* Live Weight Calculation Banner */}
              <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-3 flex flex-col justify-between shadow-inner border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                    {t.totalMeasuredWeightBanner}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formData.quantity} units × {formData.weight} {formData.weightUnit}
                  </span>
                </div>
                <div className="text-xl font-black text-amber-300 my-0.5">
                  {(formData.weight * formData.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} {formData.weightUnit}
                </div>
                <div className="text-[10px] text-slate-300 font-mono flex flex-wrap gap-2">
                  {formData.weightUnit === 'g' ? (
                    <>
                      <span>≈ {((formData.weight * formData.quantity) / 1000).toFixed(3)} kg</span>
                    </>
                  ) : (
                    <>
                      <span>≈ {((formData.weight * formData.quantity) * 1000).toLocaleString()} g</span>
                      <span>•</span>
                      <span>{((formData.weight * formData.quantity) * 2.20462).toFixed(2)} lbs</span>
                    </>
                  )}
                </div>
              </div>

              {/* Option to toggle volumetric dimensions */}
              <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!formData.useWeightOnly}
                    onChange={(e) => handleChange('useWeightOnly', !e.target.checked)}
                    className="w-4 h-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.includeDimensionsCheckbox}
                  </span>
                </label>
              </div>

              {!formData.useWeightOnly && (
                <div className="sm:col-span-2 grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      {t.lengthLabel} ({formData.dimensionUnit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.length || ''}
                      onChange={(e) => handleChange('length', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      {t.widthLabel} ({formData.dimensionUnit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.width || ''}
                      onChange={(e) => handleChange('width', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      {t.heightLabel} ({formData.dimensionUnit})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.height || ''}
                      onChange={(e) => handleChange('height', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Freight Method & Transport Fees */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{t.section4Title}</h2>
              </div>
              <span className="text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                {t.logisticsBadge}
              </span>
            </div>

            {/* Freight Method Radio Group */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                {t.shippingModeLabel}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'air_express', name: t.airExpress, sub: t.airExpressSub },
                  { id: 'air_standard', name: t.airCargo, sub: t.airCargoSub },
                  { id: 'sea_lcl', name: t.seaLcl, sub: t.seaLclSub },
                  { id: 'sea_fcl', name: t.seaFcl, sub: t.seaFclSub },
                  { id: 'road_freight', name: t.roadFreight, sub: t.roadFreightSub },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleChange('freightMethod', mode.id as FreightMethod)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      formData.freightMethod === mode.id
                        ? 'bg-teal-500 text-slate-950 font-bold border-teal-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 font-medium'
                    }`}
                  >
                    <div className="text-xs">{mode.name}</div>
                    <div className="text-[10px] opacity-75">{mode.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Transport Fees Setup */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-teal-50/40 dark:bg-teal-950/30 p-4 rounded-xl border border-teal-100 dark:border-teal-900/60">
              {/* Transport Currency Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {t.feeCurrencyLabel}
                  </label>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleChange('freightCurrency', formData.originalCurrency)}
                      className="text-teal-700 dark:text-teal-400 underline font-semibold hover:text-teal-900 cursor-pointer"
                    >
                      ={formData.originalCurrency}
                    </button>
                  </div>
                </div>
                <select
                  value={formData.freightCurrency || formData.originalCurrency}
                  onChange={(e) => handleChange('freightCurrency', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                >
                  {POPULAR_CURRENCIES.map((curr) => (
                    <option key={`fcurr_${curr.code}`} value={curr.code}>
                      {curr.flag} {curr.code} ({curr.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rate Basis Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.rateBasisLabel}
                </label>
                <select
                  value={formData.freightRateBasis || 'per_kg'}
                  onChange={(e) => {
                    const basis = e.target.value as TransportRateBasis;
                    handleChange('freightRateBasis', basis);
                    if (basis === 'per_cbm') {
                      handleChange('freightRateType', 'per_volume');
                    } else if (basis === 'flat') {
                      handleChange('freightRateType', 'flat');
                    } else {
                      handleChange('freightRateType', 'per_weight');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs"
                >
                  <option value="per_kg">{t.perKg}</option>
                  <option value="per_g">{t.perG}</option>
                  <option value="per_lb">{t.perLb}</option>
                  <option value="per_tonne">{t.perTonne}</option>
                  <option value="per_item">{t.perItem}</option>
                  <option value="per_cbm">{t.perCbm}</option>
                  <option value="flat">{t.flatRate}</option>
                </select>
              </div>

              {/* Transport Rate Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.rateAmountLabel} ({formData.freightCurrency || formData.originalCurrency})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-teal-700 dark:text-teal-400 font-extrabold text-sm">
                    {getCurrencySymbol(formData.freightCurrency || formData.originalCurrency)}
                  </span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.freightRatePerUnit || ''}
                    onChange={(e) => handleChange('freightRatePerUnit', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 text-sm font-extrabold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>
              </div>

              {/* Live Manual Transport Cost Formula Card */}
              <div className="sm:col-span-3 bg-teal-900 dark:bg-teal-950 text-teal-50 p-3 rounded-xl border border-teal-800 flex flex-wrap items-center justify-between gap-2 shadow-inner">
                <div className="text-xs">
                  <span className="text-teal-300 font-bold uppercase tracking-wide text-[10px] block">
                    {t.calculatedFeeBanner} ({formData.freightCurrency || formData.originalCurrency})
                  </span>
                  <span className="font-semibold text-white text-sm">
                    {getCurrencySymbol(formData.freightCurrency || formData.originalCurrency)}
                    {(calculationResult.freightCostInFreightCurrency || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' '}{formData.freightCurrency || formData.originalCurrency}
                  </span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-teal-300 font-bold uppercase tracking-wide text-[10px] block">
                    {t.inTargetCurrency} ({formData.targetCurrency})
                  </span>
                  <span className="font-extrabold text-amber-300 text-base">
                    {getCurrencySymbol(formData.targetCurrency)}
                    {calculationResult.freightCostTarget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Optional Custom Rates & Fees Toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!formData.showCustomRates}
                  onChange={(e) => handleChange('showCustomRates', e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.enableCustomsCheckbox}
                </span>
              </label>
            </div>

            {formData.showCustomRates && (
              <div className="space-y-4 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {t.customsDutyLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsHsModalOpen(true)}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
                        title={lang === 'ar' ? 'البحث عن كود التعريفة الجمركية' : 'Lookup Tariff HS Code'}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'مكتبة الـ HS Code' : 'HS Code Library'}</span>
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.dutyPercentage || ''}
                      onChange={(e) => handleChange('dutyPercentage', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0%"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      {t.insuranceLabel}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.insurancePercentage || ''}
                      onChange={(e) => handleChange('insurancePercentage', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0%"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      {t.originHandlingLabel}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.originHandlingFee || ''}
                      onChange={(e) => handleChange('originHandlingFee', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      {t.customsClearanceLabel}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.customsClearanceFee || ''}
                      onChange={(e) => handleChange('customsClearanceFee', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      {t.destinationPortLabel}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.destinationHandlingFee || ''}
                      onChange={(e) => handleChange('destinationHandlingFee', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      {t.inlandDeliveryLabel}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.inlandDeliveryFee || ''}
                      onChange={(e) => handleChange('inlandDeliveryFee', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Custom Extra Fees Builder */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    {t.customExtraFeesLabel}
                  </label>

                  {formData.extraFees.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {formData.extraFees.map((fee) => (
                        <div
                          key={fee.id}
                          className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{fee.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {fee.type === 'percentage' ? `${fee.amount}% ${t.ofItemCost}` : `${getCurrencySymbol(formData.originalCurrency)}${fee.amount}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExtraFee(fee.id)}
                              className="text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder={t.feeNamePlaceholder}
                      value={newFeeName}
                      onChange={(e) => setNewFeeName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={t.amountPlaceholder}
                        value={newFeeAmount}
                        onChange={(e) => setNewFeeAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                      />
                      <select
                        value={newFeeType}
                        onChange={(e) => setNewFeeType(e.target.value as 'fixed' | 'percentage')}
                        className="px-2 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                      >
                        <option value="fixed">{t.fixedCurrency}</option>
                        <option value="percentage">{t.percentOfPrice}</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleAddExtraFee}
                        className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.addButton}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Target Currency & Profit Margin Strategy */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4 transition-colors duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base">{t.section5Title}</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.targetCurrencyLabel}
                </label>
                <select
                  value={formData.targetCurrency}
                  onChange={(e) => handleChange('targetCurrency', e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 font-extrabold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/30"
                >
                  {POPULAR_CURRENCIES.map((curr) => (
                    <option key={`tcurr_${curr.code}`} value={curr.code}>
                      {curr.flag} {curr.code} - {curr.name} ({curr.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {t.pricingGoalLabel}
                </label>
                <select
                  value={formData.pricingStrategy}
                  onChange={(e) => handleChange('pricingStrategy', e.target.value as any)}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="target_price">{t.setTargetPriceMode}</option>
                  <option value="margin">{t.setDesiredMarginMode}</option>
                  <option value="markup">{t.setDesiredMarkupMode}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  {formData.pricingStrategy === 'target_price'
                    ? `${t.targetSellingPriceLabel} (${formData.targetCurrency} / Unit)`
                    : formData.pricingStrategy === 'margin'
                    ? t.targetMarginLabel
                    : t.targetMarkupLabel}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                    {formData.pricingStrategy === 'target_price' ? getCurrencySymbol(formData.targetCurrency) : '%'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.targetValue || ''}
                    onChange={(e) => handleChange('targetValue', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-9 pr-3.5 py-2 text-sm font-extrabold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Result Output Panel Column */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <CalculationResultsCard
            result={calculationResult}
            onSave={onSaveToHistory}
            isSaved={isCurrentSaved}
            t={t}
            lang={lang}
          />
        </div>
      </div>

      {/* HS Code Customs Duty Library Modal */}
      <HsCodeLibraryModal
        isOpen={isHsModalOpen}
        onClose={() => setIsHsModalOpen(false)}
        onSelectHsCode={handleSelectHsCode}
        lang={lang}
      />

      {/* Select Saved Product from History Modal */}
      {isHistoryProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col divide-y divide-slate-100 dark:divide-slate-800 text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">
                    {t.quickSelectFromHistory || (lang === 'ar' ? 'اختر منتج من سجل الحسابات' : 'Select Product from History')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {uniqueHistoryProducts.length} {t.savedProductsCount || (lang === 'ar' ? 'منتجات محفوظة' : 'saved products available')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryProductModalOpen(false)}
                className="p-2 rounded-2xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer border border-slate-700 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter input */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50">
              <input
                type="text"
                value={historyProductSearch}
                onChange={(e) => setHistoryProductSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث باسم المنتج أو رمز SKU...' : 'Search by product title or SKU...'}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* List Body */}
            <div className="p-4 overflow-y-auto space-y-2.5 max-h-[50vh]">
              {uniqueHistoryProducts
                .filter((p) => {
                  if (!historyProductSearch.trim()) return true;
                  const q = historyProductSearch.toLowerCase();
                  return (
                    (p.title && p.title.toLowerCase().includes(q)) ||
                    (p.skuSupplier && p.skuSupplier.toLowerCase().includes(q))
                  );
                })
                .map((prod, idx) => (
                  <div
                    key={`prod-hist-${idx}`}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        title: prod.title || '',
                        skuSupplier: prod.skuSupplier || '',
                        category: prod.category || prev.category,
                        originalPrice: prod.originalPrice || prev.originalPrice,
                        originalCurrency: prod.originalCurrency || prev.originalCurrency,
                        weight: prod.weight || prev.weight,
                        weightUnit: prod.weightUnit || prev.weightUnit,
                        dutyPercentage: prod.dutyPercentage ?? prev.dutyPercentage,
                        invoiceImage: prod.invoiceImage || prev.invoiceImage,
                      }));
                      setIsHistoryProductModalOpen(false);
                      setIsPreFilledNoticeVisible(true);
                    }}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {prod.invoiceImage ? (
                        <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
                          <img
                            src={prod.invoiceImage}
                            alt={prod.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {prod.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono text-[11px] font-semibold bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                            {prod.skuSupplier || 'N/A'}
                          </span>
                          <span>•</span>
                          <span>{prod.originalPrice} {prod.originalCurrency}</span>
                          <span>•</span>
                          <span>{prod.weight} {prod.weightUnit}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 px-3 py-2 bg-blue-500/10 hover:bg-blue-500 text-blue-600 hover:text-white dark:text-blue-400 dark:hover:text-white border border-blue-500/30 rounded-xl text-xs font-bold transition-all"
                    >
                      {lang === 'ar' ? 'استخدام البيانات' : 'Use Product'}
                    </button>
                  </div>
                ))}

              {uniqueHistoryProducts.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs">
                  {t.noHistoryProducts || (lang === 'ar' ? 'لا توجد منتجات محفوظة في السجل بعد' : 'No saved products found in history yet')}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryProductModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {t.modalClose || (lang === 'ar' ? 'إغلاق' : 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

