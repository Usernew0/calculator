import React, { useState } from 'react';
import { CalculationResult } from '../types';
import { formatCurrency, getCurrencySymbol } from '../data/currencies';
import { Download, BookmarkCheck, Scale, TrendingUp, FileText } from 'lucide-react';
import { exportSingleCalculationPDF } from '../utils/pdfExport';
import { translations, Language } from '../data/translations';
import { PricingStrategyModal } from './PricingStrategyModal';
import { ClientQuoteModal } from './ClientQuoteModal';

interface CalculationResultsCardProps {
  result: CalculationResult;
  onSave: (result: CalculationResult) => void;
  isSaved?: boolean;
  t: typeof translations['en'];
  lang: Language;
}

export const CalculationResultsCard: React.FC<CalculationResultsCardProps> = ({
  result,
  onSave,
  isSaved = false,
  t,
  lang,
}) => {
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const { input } = result;
  const targetCurr = input.targetCurrency;
  const targetSymbol = getCurrencySymbol(targetCurr);

  // Percentages for cost distribution
  const totalLanded = result.totalLandedCostTarget || 1;
  const itemCostPct = (result.totalOriginalPriceTarget / totalLanded) * 100;
  const transportPct = (result.totalTransportFeesTarget / totalLanded) * 100;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col justify-between transition-colors duration-200">
      {/* Header Banner */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 border-b border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                {t.landedCostBannerTitle}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                (input.tradeDirection || 'import') === 'export'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {(input.tradeDirection || 'import') === 'export' ? (t.exportBadge || (lang === 'ar' ? 'تصدير' : 'Export')) : (t.importBadge || (lang === 'ar' ? 'استيراد' : 'Import'))}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white line-clamp-1">{input.title || t.calculationSummaryDefault}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {input.quantity.toLocaleString()} {t.unitsAt} {input.originalPrice} {input.originalCurrency} / unit (FX: 1 {input.originalCurrency} = {result.exchangeRate.toFixed(4)} {targetCurr})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsPricingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 transition-all cursor-pointer"
              title={lang === 'ar' ? 'استراتيجية تسعير الشحنة وهامش الربحية' : 'Pricing Strategy & Risk Stress Test'}
            >
              <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'ar' ? 'استراتيجية التسعير' : 'Pricing Strategy'}</span>
            </button>

            <button
              onClick={() => setIsQuoteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition-all cursor-pointer"
              title={lang === 'ar' ? 'عرض سعر تجاري للعميل' : 'Generate Commercial Client Quote'}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>{lang === 'ar' ? 'عرض سعر للعميل' : 'Client Quote'}</span>
            </button>

            <button
              onClick={() => onSave(result)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isSaved
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-sm'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>{isSaved ? t.savedToHistory : t.saveRecord}</span>
            </button>

            <button
              onClick={() => exportSingleCalculationPDF(result, lang)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.pdfReport}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
        <div className="bg-white dark:bg-slate-900 p-4 text-center">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {t.landedCostPerUnit}
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatCurrency(result.landedCostPerUnitTarget, targetCurr)}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t.totalLabel} {formatCurrency(result.totalLandedCostTarget, targetCurr)}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 text-center">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {t.suggestedSellingPrice}
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(result.suggestedSellingPricePerUnitTarget, targetCurr)}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-1">
            {t.revenueLabel} {formatCurrency(result.totalRevenueTarget, targetCurr)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 text-center">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {t.estNetProfitPerUnit}
          </div>
          <div className="text-xl font-extrabold text-teal-600 dark:text-teal-400">
            {formatCurrency(result.profitPerUnitTarget, targetCurr)}
          </div>
          <div className="text-[10px] text-teal-600 dark:text-teal-400 font-medium mt-1">
            {t.netProfitLabel} {formatCurrency(result.totalProfitTarget, targetCurr)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 text-center">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {t.profitMarginPct}
          </div>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
            {result.actualMarginPercentage.toFixed(1)}%
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-1">
            {t.markupLabel} {result.actualMarkupPercentage.toFixed(1)}% | {t.roiLabel} {result.roiPercentage.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Visual Cost Distribution Ratio Bar */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center text-xs font-semibold mb-2 text-slate-700 dark:text-slate-300">
          <span>{t.costRatioTitle}</span>
          <span className="text-slate-500 dark:text-slate-400 font-normal">
            {t.itemCostVsFreight} ({itemCostPct.toFixed(1)}% / {transportPct.toFixed(1)}%)
          </span>
        </div>
        <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${Math.min(100, Math.max(0, itemCostPct))}%` }}
            className="bg-indigo-500 h-full transition-all duration-500"
            title={`Original Product Cost: ${itemCostPct.toFixed(1)}%`}
          />
          <div
            style={{ width: `${Math.min(100, Math.max(0, transportPct))}%` }}
            className="bg-amber-500 h-full transition-all duration-500"
            title={`Transport & Customs Fees: ${transportPct.toFixed(1)}%`}
          />
        </div>
        <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            <span>{t.purchasePriceLegend} ({formatCurrency(result.totalOriginalPriceTarget, targetCurr)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>{t.freightCustomsLegend} ({formatCurrency(result.totalTransportFeesTarget, targetCurr)})</span>
          </div>
        </div>
      </div>

      {/* Detailed Cost Breakdown List */}
      <div className="p-5 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">{t.itemizedBreakdownTitle}</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">{t.baseProductCostItem} ({input.quantity} {t.colQty})</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(result.totalOriginalPriceTarget, targetCurr)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-slate-600 dark:text-slate-400">
                {t.freightShippingItem} ({input.freightMethod.toUpperCase().replace('_', ' ')})
              </span>
              {input.freightRatePerUnit > 0 && (
                <span className="text-[10px] text-teal-700 dark:text-teal-400 font-mono">
                  Rate: {getCurrencySymbol(input.freightCurrency || input.originalCurrency)}{input.freightRatePerUnit} per {input.freightRateBasis ? input.freightRateBasis.replace('per_', '') : input.weightUnit}
                </span>
              )}
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(result.freightCostTarget, targetCurr)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">{t.importCustomsDutyItem} ({input.dutyPercentage}%)</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(result.dutyCostTarget, targetCurr)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">{t.cargoInsuranceItem} ({input.insurancePercentage}%)</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(result.insuranceCostTarget, targetCurr)}</span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">{t.handlingClearanceItem}</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(
                result.originHandlingTarget +
                  result.destinationHandlingTarget +
                  result.customsClearanceTarget +
                  result.inlandDeliveryTarget,
                targetCurr
              )}
            </span>
          </div>

          {result.extraFeesTotalTarget > 0 && (
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">{t.extraLineItemsFee}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(result.extraFeesTotalTarget, targetCurr)}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-2 font-bold text-slate-900 dark:text-slate-100 border-t border-slate-300 dark:border-slate-700">
            <span>{t.totalLandedCostHeader}</span>
            <span className="text-base text-slate-950 dark:text-white">{formatCurrency(result.totalLandedCostTarget, targetCurr)}</span>
          </div>
        </div>
      </div>

      {/* Weight Stats Note */}
      <div className="bg-slate-100 dark:bg-slate-950/80 p-3 px-5 text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 font-medium">
          <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            {t.measuredWeightLabel} <strong>{input.weight} {input.weightUnit}/unit</strong> | {t.totalLabel} <strong>{(input.weight * input.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} {input.weightUnit}</strong> ({result.chargeableWeightKg < 1 ? `${(result.chargeableWeightKg * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} g` : `${result.chargeableWeightKg.toFixed(2)} kg`})
          </span>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
          {t.currencyLabel} <span className="text-slate-900 dark:text-slate-100">{targetCurr} ({targetSymbol})</span>
        </div>
      </div>

      {/* Pricing Strategy & Multi-Tier Profitability Modal */}
      <PricingStrategyModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        result={result}
        lang={lang}
      />

      {/* Commercial Client Quote Modal */}
      <ClientQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        result={result}
        lang={lang}
      />
    </div>
  );
};

