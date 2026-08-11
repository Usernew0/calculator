import React, { useState, useEffect, useMemo } from 'react';
import { CalculationResult, CalculationInput, FreightMethod, TradeDirection } from '../types';
import { calculateTradeAndFreight } from '../utils/calculator';
import { POPULAR_CURRENCIES, FREIGHT_METHODS, formatCurrency } from '../data/currencies';
import { translations, Language } from '../data/translations';
import {
  X,
  Edit3,
  Image as ImageIcon,
  Upload,
  Trash2,
  Check,
  Package,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  TrendingUp,
  Percent,
  Tag,
  Truck,
  Scale,
  Sparkles,
  Globe,
} from 'lucide-react';

interface EditTransactionModalProps {
  item: CalculationResult | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedResult: CalculationResult) => void;
  rates: Record<string, number>;
  t: typeof translations['en'];
  lang: Language;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
  rates,
  t,
  lang,
}) => {
  const [input, setInput] = useState<CalculationInput | null>(null);
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    if (item) {
      setInput({ ...item.input });
      setImagePreview(item.input.invoiceImage || '');
      // Format item.createdAt to YYYY-MM-DD for date input
      const dateObj = new Date(item.createdAt);
      const formattedDate = !isNaN(dateObj.getTime())
        ? dateObj.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      setTransactionDate(formattedDate);
    }
  }, [item]);

  // Recalculate financial breakdown live in the edit form
  const liveResult = useMemo(() => {
    if (!input) return null;
    return calculateTradeAndFreight(
      {
        ...input,
        invoiceImage: imagePreview || undefined,
        transactionDate: transactionDate,
      },
      rates
    );
  }, [input, imagePreview, transactionDate, rates]);

  if (!isOpen || !item || !input || !liveResult) return null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setInput((prev) => (prev ? { ...prev, invoiceImage: base64 } : prev));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUrlChange = (url: string) => {
    setImagePreview(url);
    setInput((prev) => (prev ? { ...prev, invoiceImage: url } : prev));
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    setInput((prev) => (prev ? { ...prev, invoiceImage: undefined } : prev));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input || !liveResult) return;

    // Convert selected transactionDate back to ISO string
    let finalCreatedAt = item.createdAt;
    if (transactionDate) {
      const parsedDate = new Date(transactionDate);
      if (!isNaN(parsedDate.getTime())) {
        finalCreatedAt = parsedDate.toISOString();
      }
    }

    const finalResult: CalculationResult = {
      ...liveResult,
      id: item.id,
      createdAt: finalCreatedAt,
      userId: item.userId,
    };

    onSave(finalResult);
    onClose();
  };

  const targetCurr = input.targetCurrency || 'EGP';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                {t.editModalTitle || (lang === 'ar' ? 'تعديل المعاملة وسعر البيع' : 'Edit Trade Transaction & Selling Price')}
              </h2>
              <p className="text-xs text-slate-400">
                {t.editModalSubtitle || (lang === 'ar' ? 'تحديث اتجاه التجارة، التاريخ، سعر البيع المستهدف، تكاليف الشراء والصورة' : 'Update trade direction, transaction date, target selling price, supplier costs, or cargo image')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Section 1: Trade Direction & Transaction Date */}
          <div className="bg-slate-50 dark:bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>{lang === 'ar' ? '1. اتجاه التجارة وتاريخ المعاملة' : '1. Trade Direction & Transaction Date'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Import Toggle */}
              <button
                type="button"
                onClick={() => setInput((prev) => (prev ? { ...prev, tradeDirection: 'import' } : prev))}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer min-h-[46px] ${
                  input.tradeDirection !== 'export'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30 ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-blue-300 shrink-0" />
                <span className="font-extrabold">{t.importOption || (lang === 'ar' ? 'استيراد (Import)' : 'Import Trade')}</span>
              </button>

              {/* Export Toggle */}
              <button
                type="button"
                onClick={() => setInput((prev) => (prev ? { ...prev, tradeDirection: 'export' } : prev))}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer min-h-[46px] ${
                  input.tradeDirection === 'export'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/30 ring-2 ring-amber-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="font-extrabold">{t.exportOption || (lang === 'ar' ? 'تصدير (Export)' : 'Export Trade')}</span>
              </button>

              {/* Transaction Date Picker */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{t.transactionDateLabel || (lang === 'ar' ? 'تاريخ العملية' : 'Transaction Date')}</span>
                </label>
                <input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-extrabold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all min-h-[46px]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Product & Cargo Info */}
          <div className="bg-slate-50 dark:bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/90 space-y-3">
            <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-500" />
              <span>{lang === 'ar' ? '2. بيانات المنتج والتصنيف' : '2. Product Identification & SKU'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.titleLabel || (lang === 'ar' ? 'اسم المنتج / الشحنة' : 'Product / Cargo Title')}
                </label>
                <input
                  type="text"
                  required
                  value={input.title}
                  onChange={(e) => setInput((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  placeholder={lang === 'ar' ? 'مثال: شحنة لوحات إلكترونية' : 'e.g. Electronic Circuit Boards'}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.skuSupplierLabel || (lang === 'ar' ? 'رمز SKU / المورد' : 'SKU / Supplier')}
                </label>
                <input
                  type="text"
                  value={input.skuSupplier || ''}
                  onChange={(e) => setInput((prev) => (prev ? { ...prev, skuSupplier: e.target.value } : prev))}
                  placeholder="SKU-88210"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Quantity & Supplier Pricing */}
          <div className="bg-slate-50 dark:bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/90 space-y-3">
            <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                {lang === 'ar' ? '3. الكمية وأسعار الشراء من المصنع' : '3. Quantity & Supplier Cost Pricing'}
              </span>
              <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 font-mono">
                {lang === 'ar' ? 'تكلفة الشراء الإجمالية: ' : 'Total Purchase FOB: '}
                {formatCurrency(liveResult.totalOriginalPriceTarget, targetCurr)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Quantity */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.quantityLabel}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={input.quantity}
                  onChange={(e) =>
                    setInput((prev) =>
                      prev ? { ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) } : prev
                    )
                  }
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Supplier Unit Cost */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.supplierUnitPrice || (lang === 'ar' ? 'سعر المصنع للقطعة' : 'Supplier Unit Cost')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={input.originalPrice}
                  onChange={(e) =>
                    setInput((prev) =>
                      prev ? { ...prev, originalPrice: Math.max(0, parseFloat(e.target.value) || 0) } : prev
                    )
                  }
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-sky-400 dark:border-sky-500/50 rounded-xl text-xs font-mono font-black text-sky-700 dark:text-sky-300 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Supplier Currency */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.originalPurchaseCurrencyLabel || (lang === 'ar' ? 'عملة المصنع' : 'Supplier Currency')}
                </label>
                <select
                  value={input.originalCurrency}
                  onChange={(e) => setInput((prev) => (prev ? { ...prev, originalCurrency: e.target.value } : prev))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  {POPULAR_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.symbol} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Currency */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.targetCurrencyLabel || (lang === 'ar' ? 'عملة التشغيل / الهدف' : 'Target Operating Currency')}
                </label>
                <select
                  value={input.targetCurrency}
                  onChange={(e) => setInput((prev) => (prev ? { ...prev, targetCurrency: e.target.value } : prev))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border-2 border-emerald-500/50 dark:border-emerald-500/60 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  {POPULAR_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.symbol} ({c.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Freight & Weight Logistics */}
          <div className="bg-slate-50 dark:bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/90 space-y-3">
            <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-500" />
                {lang === 'ar' ? '4. معايير الشحن والوزن' : '4. Freight Method & Cargo Weight'}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {lang === 'ar' ? 'تكلفة الشحن: ' : 'Freight Cost: '}
                {formatCurrency(liveResult.freightCostTarget, targetCurr)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.freightMethodLabel}
                </label>
                <select
                  value={input.freightMethod}
                  onChange={(e) =>
                    setInput((prev) => (prev ? { ...prev, freightMethod: e.target.value as FreightMethod } : prev))
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                >
                  {FREIGHT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {lang === 'ar' ? m.nameAr : m.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t.freightRateLabel}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.freightRatePerUnit || 0}
                  onChange={(e) =>
                    setInput((prev) => (prev ? { ...prev, freightRatePerUnit: parseFloat(e.target.value) || 0 } : prev))
                  }
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white font-extrabold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{t.weightLabel}</span>
                  <span className="text-[10px] uppercase font-mono text-emerald-500">({input.weightUnit || 'kg'})</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.weight || 0}
                  onChange={(e) =>
                    setInput((prev) => (prev ? { ...prev, weight: parseFloat(e.target.value) || 0 } : prev))
                  }
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white font-extrabold focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: SELLING PRICE & PROFIT STRATEGY (ENHANCED & ADDED) */}
          <div className="bg-emerald-500/5 dark:bg-emerald-950/20 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
              <label className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>{t.sellingPriceLabel || (lang === 'ar' ? '5. سعر البيع واحتساب الربحية' : '5. Target Selling Price & Profit Strategy')}</span>
              </label>

              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {lang === 'ar' ? 'حساب حي مباشر' : 'Live Calculation'}
              </span>
            </div>

            {/* Pricing Strategy Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.pricingStrategyLabel || (lang === 'ar' ? 'طريقة تحديد السعر' : 'Pricing Method')}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Option 1: Direct Target Selling Price */}
                <button
                  type="button"
                  onClick={() => setInput((prev) => (prev ? { ...prev, pricingStrategy: 'target_price' } : prev))}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    (input.pricingStrategy || 'target_price') === 'target_price'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.directSellingPriceOption || (lang === 'ar' ? 'سعر بيع مستهدف للقطعة' : 'Target Selling Price')}</span>
                </button>

                {/* Option 2: Target Profit Margin % */}
                <button
                  type="button"
                  onClick={() => setInput((prev) => (prev ? { ...prev, pricingStrategy: 'margin' } : prev))}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    input.pricingStrategy === 'margin'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.targetMarginOption || (lang === 'ar' ? 'هامش ربح مستهدف %' : 'Profit Margin %')}</span>
                </button>

                {/* Option 3: Target Markup % */}
                <button
                  type="button"
                  onClick={() => setInput((prev) => (prev ? { ...prev, pricingStrategy: 'markup' } : prev))}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    input.pricingStrategy === 'markup'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/30'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.targetMarkupOption || (lang === 'ar' ? 'نسبة علامة فوق التكلفة %' : 'Markup %')}</span>
                </button>
              </div>
            </div>

            {/* Target Value Input Field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  {input.pricingStrategy === 'margin'
                    ? (lang === 'ar' ? 'نسبة هامش الربح المطلوبة (%)' : 'Target Profit Margin (%)')
                    : input.pricingStrategy === 'markup'
                    ? (lang === 'ar' ? 'نسبة العلامة فوق التكلفة (%)' : 'Target Markup (%)')
                    : (lang === 'ar' ? `سعر بيع القطعة المستهدف (${targetCurr})` : `Selling Price per Unit (${targetCurr})`)}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={input.targetValue || 0}
                    onChange={(e) =>
                      setInput((prev) =>
                        prev ? { ...prev, targetValue: Math.max(0, parseFloat(e.target.value) || 0) } : prev
                      )
                    }
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-400 rounded-xl text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    {input.pricingStrategy === 'margin' || input.pricingStrategy === 'markup' ? '%' : targetCurr}
                  </span>
                </div>
              </div>

              {/* Profit & Selling Price Live Metric Cards */}
              <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-500/30">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">
                    {t.landedCostPerUnit || (lang === 'ar' ? 'تكلفة الوصول للقطعة' : 'Landed Cost / Unit')}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 block">
                    {formatCurrency(liveResult.landedCostPerUnitTarget, targetCurr)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">
                    {t.suggestedSellingPrice || (lang === 'ar' ? 'سعر البيع المحسوب' : 'Selling Price / Unit')}
                  </span>
                  <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 block">
                    {formatCurrency(liveResult.suggestedSellingPricePerUnitTarget, targetCurr)}
                  </span>
                </div>

                <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500">
                    {lang === 'ar' ? 'صافي الربح للقطعة: ' : 'Net Profit / Unit: '}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(liveResult.profitPerUnitTarget, targetCurr)}
                    </strong>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                    {liveResult.actualMarginPercentage.toFixed(1)}% Margin
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Image Photo Attachment */}
          <div className="bg-slate-50 dark:bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                <span>{lang === 'ar' ? '6. صورة المنتج / مستند الشحنة' : '6. Cargo Image / Document Attachment'}</span>
              </label>

              {imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-rose-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.removeImageBtn || (lang === 'ar' ? 'حذف الصورة' : 'Remove Image')}</span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {imagePreview ? (
                <div className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-slate-900 shadow-md">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 shrink-0 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <Package className="w-6 h-6 mb-1 text-slate-400" />
                  <span className="text-[10px] font-medium">{lang === 'ar' ? 'بدون صورة' : 'No photo'}</span>
                </div>
              )}

              <div className="flex-1 space-y-2.5 w-full">
                <div className="flex items-center gap-2">
                  <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0 min-h-[38px]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t.uploadImageFile || (lang === 'ar' ? 'رفع ملف صورة' : 'Upload File')}</span>
                    <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                  </label>
                  <span className="text-xs text-slate-400">{lang === 'ar' ? 'أو أدخل رابط مباشر:' : 'or enter image URL:'}</span>
                </div>

                <input
                  type="url"
                  placeholder="https://example.com/product-image.jpg"
                  value={imagePreview.startsWith('data:') ? '' : imagePreview}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[42px]"
            >
              {t.cancelBtn || (lang === 'ar' ? 'إلغاء' : 'Cancel')}
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/40 transition-all cursor-pointer flex items-center gap-2 min-h-[42px]"
            >
              <Check className="w-4 h-4" />
              <span>{t.saveChangesBtn || (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
