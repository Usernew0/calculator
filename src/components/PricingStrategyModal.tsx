import React, { useState } from 'react';
import { CalculationResult } from '../types';
import { formatCurrency, getCurrencySymbol } from '../data/currencies';
import { Language } from '../data/translations';
import { X, TrendingUp, Layers, AlertTriangle, ShieldCheck, DollarSign, Calculator, Target, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface PricingStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
  lang: Language;
}

export const PricingStrategyModal: React.FC<PricingStrategyModalProps> = ({
  isOpen,
  onClose,
  result,
  lang,
}) => {
  const [fixedOverhead, setFixedOverhead] = useState<number>(1000); // Fixed overhead costs in target currency
  const [targetMonthlyProfit, setTargetMonthlyProfit] = useState<number>(5000);

  if (!isOpen) return null;

  const targetCurr = result.input.targetCurrency;
  const landedCostUnit = result.landedCostPerUnitTarget;
  const currentSellingPrice = result.suggestedSellingPricePerUnitTarget;
  const currentUnitProfit = result.profitPerUnitTarget;

  // Tier 1: Retail (Target Strategy as configured or 30% default)
  const retailMarginPct = Math.max(25, result.actualMarginPercentage || 30);
  const retailPriceUnit = landedCostUnit / (1 - retailMarginPct / 100);
  const retailUnitProfit = retailPriceUnit - landedCostUnit;

  // Tier 2: Wholesale B2B (e.g. 18% margin)
  const wholesaleMarginPct = 18;
  const wholesalePriceUnit = landedCostUnit / (1 - wholesaleMarginPct / 100);
  const wholesaleUnitProfit = wholesalePriceUnit - landedCostUnit;

  // Tier 3: Distributor Bulk (e.g. 10% margin)
  const distributorMarginPct = 10;
  const distributorPriceUnit = landedCostUnit / (1 - distributorMarginPct / 100);
  const distributorUnitProfit = distributorPriceUnit - landedCostUnit;

  // Tier 4: Floor Minimum (Cost + 4% safety contingency)
  const floorPriceUnit = landedCostUnit * 1.04;
  const floorUnitProfit = floorPriceUnit - landedCostUnit;

  // Break-Even Volume Calculation
  // Profit per unit = Selling Price - Landed Cost
  const contributionMarginPerUnit = currentUnitProfit > 0 ? currentUnitProfit : retailUnitProfit;
  const breakEvenUnitsOverhead = contributionMarginPerUnit > 0 ? Math.ceil(fixedOverhead / contributionMarginPerUnit) : 0;
  const targetProfitUnitsRequired = contributionMarginPerUnit > 0 ? Math.ceil((fixedOverhead + targetMonthlyProfit) / contributionMarginPerUnit) : 0;

  // Stress Test Scenarios
  // 1. Base Case
  const baseLanded = landedCostUnit;
  const baseProfit = currentUnitProfit;
  const baseMargin = result.actualMarginPercentage;

  // 2. Worst Case: +10% FX devaluation and +15% freight surge
  const worstFreightCost = result.totalTransportFeesTarget * 1.15;
  const worstOriginalCost = result.totalOriginalPriceTarget * 1.10; // FX shift
  const worstOtherFees = (result.originHandlingTarget + result.destinationHandlingTarget + result.customsClearanceTarget + result.dutyCostTarget + result.insuranceCostTarget + result.inlandDeliveryTarget + result.extraFeesTotalTarget) * 1.08;
  const worstTotalLanded = (worstOriginalCost + worstFreightCost + worstOtherFees);
  const worstLandedUnit = worstTotalLanded / (result.input.quantity || 1);
  const worstProfitUnit = currentSellingPrice - worstLandedUnit;
  const worstMarginPct = currentSellingPrice > 0 ? ((worstProfitUnit) / currentSellingPrice) * 100 : 0;

  // 3. Best Case: -5% FX appreciation and -10% freight rate savings
  const bestFreightCost = result.totalTransportFeesTarget * 0.90;
  const bestOriginalCost = result.totalOriginalPriceTarget * 0.95;
  const bestOtherFees = (result.originHandlingTarget + result.destinationHandlingTarget + result.customsClearanceTarget + result.dutyCostTarget + result.insuranceCostTarget + result.inlandDeliveryTarget + result.extraFeesTotalTarget) * 0.95;
  const bestTotalLanded = (bestOriginalCost + bestFreightCost + bestOtherFees);
  const bestLandedUnit = bestTotalLanded / (result.input.quantity || 1);
  const bestProfitUnit = currentSellingPrice - bestLandedUnit;
  const bestMarginPct = currentSellingPrice > 0 ? ((bestProfitUnit) / currentSellingPrice) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'استراتيجية تسعير الشحنة وهامش الربحية' : 'Shipment Pricing & Profitability Strategy'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'تحليل شرائح الأسعار، نقطة التعادل، ومحاكاة مخاطر تقلبات الشحن وسعر الصرف'
                  : 'Multi-tier pricing channels, break-even unit volume, and market risk stress test'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
          {/* Item Baseline KPI Summary */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'تكلفة الوصل (الواصل)' : 'Unit Landed Cost'}
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(landedCostUnit, targetCurr)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'سعر البيع المقترح الحالي' : 'Current Target Price'}
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(currentSellingPrice, targetCurr)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'صافي الربح للقطعة' : 'Net Profit / Unit'}
              </span>
              <span className="text-lg font-black text-teal-600 dark:text-teal-400">
                {formatCurrency(currentUnitProfit, targetCurr)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'هامش الربح الحالي' : 'Current Net Margin'}
              </span>
              <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                {baseMargin.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Section 1: Multi-Tier Pricing Channels Matrix */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span>{lang === 'ar' ? '1. شرائح التسعير متعدد القنوات (Multi-Tier Channels)' : '1. Multi-Tier Channel Pricing Strategy'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Retail */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase">
                    {lang === 'ar' ? 'تجزئة (Retail)' : 'Retail Channel'}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                    {retailMarginPct.toFixed(0)}% Margin
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {formatCurrency(retailPriceUnit, targetCurr)}
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(retailUnitProfit, targetCurr)} {lang === 'ar' ? 'ربح/قطعة' : 'profit/unit'}
                </div>
              </div>

              {/* Wholesale B2B */}
              <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5 dark:bg-teal-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-teal-700 dark:text-teal-400 uppercase">
                    {lang === 'ar' ? 'جملة (B2B Wholesale)' : 'B2B Wholesale'}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300">
                    {wholesaleMarginPct}% Margin
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {formatCurrency(wholesalePriceUnit, targetCurr)}
                </div>
                <div className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                  +{formatCurrency(wholesaleUnitProfit, targetCurr)} {lang === 'ar' ? 'ربح/قطعة' : 'profit/unit'}
                </div>
              </div>

              {/* Distributor Bulk */}
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase">
                    {lang === 'ar' ? 'موزعين (Distributor)' : 'Bulk Distributor'}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-300">
                    {distributorMarginPct}% Margin
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {formatCurrency(distributorPriceUnit, targetCurr)}
                </div>
                <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  +{formatCurrency(distributorUnitProfit, targetCurr)} {lang === 'ar' ? 'ربح/قطعة' : 'profit/unit'}
                </div>
              </div>

              {/* Floor Protection Price */}
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase">
                    {lang === 'ar' ? 'الحد الأدنى الأمان' : 'Minimum Price Floor'}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300">
                    +4% Safety
                  </span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {formatCurrency(floorPriceUnit, targetCurr)}
                </div>
                <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  +{formatCurrency(floorUnitProfit, targetCurr)} {lang === 'ar' ? 'هامش طوارئ' : 'safety buffer'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Break-Even & Sales Volume Target Calculator */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-500" />
              <span>{lang === 'ar' ? '2. حساب نقطة التعادل والكمية المستهدفة (Break-Even Volume)' : '2. Break-Even & Volume Target Simulator'}</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    {lang === 'ar' ? 'التكاليف الإدارية والتشغيلية الثابتة للمشروع / الشهر' : 'Fixed Monthly Overhead Expenses'} ({targetCurr})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={fixedOverhead}
                    onChange={(e) => setFixedOverhead(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-black rounded-lg bg-slate-800 border border-slate-700 text-amber-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    {lang === 'ar' ? 'الربح الشهري المستهدف للمشروع' : 'Target Monthly Net Profit Goal'} ({targetCurr})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={targetMonthlyProfit}
                    onChange={(e) => setTargetMonthlyProfit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-black rounded-lg bg-slate-800 border border-slate-700 text-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Volume Target Output Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      {lang === 'ar' ? 'كمية التعادل لتغطية المصاريف' : 'Break-Even Unit Volume'}
                    </span>
                    <span className="text-xl font-black text-amber-300">
                      {breakEvenUnitsOverhead.toLocaleString()} {lang === 'ar' ? 'قطعة' : 'units'}
                    </span>
                  </div>
                  <Target className="w-6 h-6 text-amber-400/80" />
                </div>

                <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      {lang === 'ar' ? 'المبيعات المطلوبة للربح المستهدف' : 'Units Required for Profit Target'}
                    </span>
                    <span className="text-xl font-black text-emerald-400">
                      {targetProfitUnitsRequired.toLocaleString()} {lang === 'ar' ? 'قطعة' : 'units'}
                    </span>
                  </div>
                  <Zap className="w-6 h-6 text-emerald-400/80" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: FX & Shipping Stress Test Scenarios */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>{lang === 'ar' ? '3. اختبار تحمل مخاطر السوق والسعر (Stress Test Scenarios)' : '3. FX & Shipping Market Stress Test'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Best Case */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'السيناريو المتفائل (Best)' : 'Best Case Scenario'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    -5% FX / -10% Freight
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'التكلفة للقطعة:' : 'Landed/Unit:'}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(bestLandedUnit, targetCurr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'الربح للقطعة:' : 'Profit/Unit:'}</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(bestProfitUnit, targetCurr)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-500/20 font-bold">
                    <span className="text-slate-600 dark:text-slate-300">{lang === 'ar' ? 'الهامش المتوقع:' : 'Expected Margin:'}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{bestMarginPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Base Case */}
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'السيناريو الحالي (Base)' : 'Base Case Scenario'}
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    Live Rates
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'التكلفة للقطعة:' : 'Landed/Unit:'}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(baseLanded, targetCurr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'الربح للقطعة:' : 'Profit/Unit:'}</span>
                    <span className="font-black text-teal-600 dark:text-teal-400">{formatCurrency(baseProfit, targetCurr)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-500/20 font-bold">
                    <span className="text-slate-600 dark:text-slate-300">{lang === 'ar' ? 'الهامش الحالي:' : 'Current Margin:'}</span>
                    <span className="text-blue-600 dark:text-blue-400">{baseMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Worst Case */}
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'السيناريو المتشائم (Worst)' : 'Worst Case Scenario'}
                  </span>
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    +10% FX / +15% Freight
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'التكلفة للقطعة:' : 'Landed/Unit:'}</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(worstLandedUnit, targetCurr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{lang === 'ar' ? 'الربح للقطعة:' : 'Profit/Unit:'}</span>
                    <span className={`font-black ${worstProfitUnit < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>
                      {formatCurrency(worstProfitUnit, targetCurr)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-rose-500/20 font-bold">
                    <span className="text-slate-600 dark:text-slate-300">{lang === 'ar' ? 'الهامش المتبقي:' : 'Rem. Margin:'}</span>
                    <span className={worstMarginPct < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}>
                      {worstMarginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            {lang === 'ar' ? 'إغلاق التحليل' : 'Close Analysis'}
          </button>
        </div>
      </div>
    </div>
  );
};
