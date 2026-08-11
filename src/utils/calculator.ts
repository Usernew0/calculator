import { CalculationInput, CalculationResult } from '../types';
import { convertCurrency } from '../data/currencies';

export function calculateTradeAndFreight(
  input: CalculationInput,
  rates: Record<string, number>
): CalculationResult {
  const quantity = Math.max(1, input.quantity || 1);
  const originalPricePerUnit = Math.max(0, input.originalPrice || 0);
  const totalOriginalPrice = originalPricePerUnit * quantity;

  // 1. Conversion Rate to Target Currency
  let exchangeRate = 1.0;
  if (input.customExchangeRate && input.customExchangeRate > 0) {
    exchangeRate = input.customExchangeRate;
  } else {
    const { rate } = convertCurrency(1, input.originalCurrency, input.targetCurrency, rates);
    exchangeRate = rate;
  }

  // Convert Item Costs to Target Currency
  const originalPriceTarget = originalPricePerUnit * exchangeRate;
  const totalOriginalPriceTarget = totalOriginalPrice * exchangeRate;

  // 2. Weight & Volume Calculations
  const unitWeight = input.weight || 0;
  const totalGrossWeightSelectedUnit = unitWeight * quantity;

  let unitWeightInKg = unitWeight;
  if (input.weightUnit === 'g') {
    unitWeightInKg = unitWeight * 0.001; // 1 gram = 0.001 kg
  } else if (input.weightUnit === 'lbs') {
    unitWeightInKg = unitWeight * 0.453592;
  } else if (input.weightUnit === 'tonnes') {
    unitWeightInKg = unitWeight * 1000;
  }
  const totalGrossWeightKg = unitWeightInKg * quantity;
  const totalGrossWeightGrams = totalGrossWeightKg * 1000;

  // Dimensions & Volumetric Weight
  let lengthCm = input.length || 0;
  let widthCm = input.width || 0;
  let heightCm = input.height || 0;
  if (input.dimensionUnit === 'inches') {
    lengthCm *= 2.54;
    widthCm *= 2.54;
    heightCm *= 2.54;
  }

  const unitVolumeCBM = (lengthCm * widthCm * heightCm) / 1000000; // cm3 to CBM
  const volumeCBM = unitVolumeCBM * quantity;

  const factor = input.volumetricFactor || 5000; // default factor
  const unitVolumetricWeightKg = (lengthCm * widthCm * heightCm) / factor;
  const totalVolumetricWeightKg = unitVolumetricWeightKg * quantity;

  // If user selected Weight Only mode (or dimensions are 0), chargeable weight is purely total actual gross weight
  const isWeightOnly = input.useWeightOnly !== false && (input.useWeightOnly || lengthCm === 0 || widthCm === 0 || heightCm === 0);
  const chargeableWeightKg = isWeightOnly ? totalGrossWeightKg : Math.max(totalGrossWeightKg, totalVolumetricWeightKg);

  // 3. Manual Freight & Transport Cost Calculation
  const freightCurrency = input.freightCurrency || input.originalCurrency;
  const ratePerUnit = input.freightRatePerUnit || 0;
  
  // Determine effective rate basis
  const rateBasis = input.freightRateBasis || (
    input.freightRateType === 'per_volume'
      ? 'per_cbm'
      : input.freightRateType === 'flat'
      ? 'flat'
      : input.weightUnit === 'g'
      ? 'per_g'
      : input.weightUnit === 'lbs'
      ? 'per_lb'
      : input.weightUnit === 'tonnes'
      ? 'per_tonne'
      : 'per_kg'
  );

  let freightCostInFreightCurrency = 0;
  switch (rateBasis) {
    case 'per_g': {
      const chargeableGrams = chargeableWeightKg * 1000;
      freightCostInFreightCurrency = ratePerUnit * chargeableGrams;
      break;
    }
    case 'per_kg': {
      freightCostInFreightCurrency = ratePerUnit * chargeableWeightKg;
      break;
    }
    case 'per_lb': {
      const chargeableLbs = chargeableWeightKg / 0.453592;
      freightCostInFreightCurrency = ratePerUnit * chargeableLbs;
      break;
    }
    case 'per_tonne': {
      const chargeableTonnes = chargeableWeightKg / 1000;
      freightCostInFreightCurrency = ratePerUnit * chargeableTonnes;
      break;
    }
    case 'per_item': {
      freightCostInFreightCurrency = ratePerUnit * quantity;
      break;
    }
    case 'per_cbm': {
      freightCostInFreightCurrency = ratePerUnit * (volumeCBM || 1);
      break;
    }
    case 'flat':
    default: {
      freightCostInFreightCurrency = ratePerUnit;
      break;
    }
  }

  // Convert Freight Cost from freightCurrency to targetCurrency
  const { converted: freightCostTarget } = convertCurrency(
    freightCostInFreightCurrency,
    freightCurrency,
    input.targetCurrency,
    rates
  );

  // 4. Insurance & Duties (Optional)
  const useCustomRates = input.showCustomRates !== false;
  const insurancePercentage = useCustomRates ? Math.max(0, input.insurancePercentage || 0) : 0;
  const insuranceCostTarget = totalOriginalPriceTarget * (insurancePercentage / 100);

  // Duty is calculated on CIF value (Cost + Insurance + Freight)
  const cifValueTarget = totalOriginalPriceTarget + freightCostTarget + insuranceCostTarget;
  const dutyPercentage = useCustomRates ? Math.max(0, input.dutyPercentage || 0) : 0;
  const dutyCostTarget = cifValueTarget * (dutyPercentage / 100);

  // 5. Handling & Miscellaneous Fees
  const originHandlingTarget = useCustomRates ? (input.originHandlingFee || 0) * exchangeRate : 0;
  const destinationHandlingTarget = useCustomRates ? (input.destinationHandlingFee || 0) : 0; // directly in target currency
  const customsClearanceTarget = useCustomRates ? (input.customsClearanceFee || 0) : 0;
  const inlandDeliveryTarget = useCustomRates ? (input.inlandDeliveryFee || 0) : 0;

  let extraFeesTotalTarget = 0;
  if (useCustomRates && input.extraFees && input.extraFees.length > 0) {
    extraFeesTotalTarget = input.extraFees.reduce((acc, fee) => {
      if (fee.type === 'percentage') {
        return acc + totalOriginalPriceTarget * (fee.amount / 100);
      }
      return acc + fee.amount;
    }, 0);
  }

  // 6. Total Landed Cost
  const totalTransportFeesTarget =
    freightCostTarget +
    originHandlingTarget +
    destinationHandlingTarget +
    customsClearanceTarget +
    dutyCostTarget +
    insuranceCostTarget +
    inlandDeliveryTarget +
    extraFeesTotalTarget;

  const totalLandedCostTarget = totalOriginalPriceTarget + totalTransportFeesTarget;
  const landedCostPerUnitTarget = totalLandedCostTarget / quantity;

  // 7. Profit & Pricing Calculations
  let suggestedSellingPricePerUnitTarget = 0;
  let totalRevenueTarget = 0;
  let profitPerUnitTarget = 0;
  let totalProfitTarget = 0;
  let actualMarginPercentage = 0;
  let actualMarkupPercentage = 0;
  let roiPercentage = 0;

  const targetValue = Math.max(0, input.targetValue || 0);

  if (input.pricingStrategy === 'margin') {
    // Target Margin % = (Revenue - Cost) / Revenue
    // Revenue = Cost / (1 - Margin%)
    const marginRatio = Math.min(0.99, targetValue / 100);
    totalRevenueTarget = totalLandedCostTarget / (1 - marginRatio);
    suggestedSellingPricePerUnitTarget = totalRevenueTarget / quantity;
  } else if (input.pricingStrategy === 'markup') {
    // Target Markup % = (Price - Cost) / Cost
    // Price = Cost * (1 + Markup%)
    const markupRatio = targetValue / 100;
    totalRevenueTarget = totalLandedCostTarget * (1 + markupRatio);
    suggestedSellingPricePerUnitTarget = totalRevenueTarget / quantity;
  } else {
    // target_price mode
    suggestedSellingPricePerUnitTarget = targetValue;
    totalRevenueTarget = suggestedSellingPricePerUnitTarget * quantity;
  }

  totalProfitTarget = totalRevenueTarget - totalLandedCostTarget;
  profitPerUnitTarget = totalProfitTarget / quantity;

  if (totalRevenueTarget > 0) {
    actualMarginPercentage = (totalProfitTarget / totalRevenueTarget) * 100;
  }
  if (totalLandedCostTarget > 0) {
    actualMarkupPercentage = (totalProfitTarget / totalLandedCostTarget) * 100;
    roiPercentage = (totalProfitTarget / totalLandedCostTarget) * 100;
  }

  return {
    id: `calc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: input.transactionDate ? new Date(input.transactionDate).toISOString() : new Date().toISOString(),
    input,
    exchangeRate,
    rateTimestamp: new Date().toISOString(),

    originalPriceTarget,
    totalOriginalPriceTarget,

    chargeableWeightKg,
    totalGrossWeightKg,
    totalGrossWeightGrams,
    totalGrossWeightSelectedUnit,
    volumeCBM,

    freightCurrency,
    freightCostInFreightCurrency,
    freightCostTarget,
    originHandlingTarget,
    destinationHandlingTarget,
    customsClearanceTarget,
    dutyCostTarget,
    insuranceCostTarget,
    inlandDeliveryTarget,
    extraFeesTotalTarget,

    totalTransportFeesTarget,
    totalLandedCostTarget,
    landedCostPerUnitTarget,

    suggestedSellingPricePerUnitTarget,
    totalRevenueTarget,
    profitPerUnitTarget,
    totalProfitTarget,
    actualMarginPercentage,
    actualMarkupPercentage,
    roiPercentage,
  };
}
