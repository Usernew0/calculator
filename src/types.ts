export type FreightMethod = 'air_express' | 'air_standard' | 'sea_lcl' | 'sea_fcl' | 'road_freight';

export type TradeDirection = 'import' | 'export';

export type WeightUnit = 'kg' | 'g' | 'lbs' | 'tonnes';

export type TransportRateBasis = 'per_kg' | 'per_g' | 'per_lb' | 'per_tonne' | 'per_item' | 'per_cbm' | 'flat';

export type DimensionUnit = 'cm' | 'inches';

export interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rateToUSD: number; // relative to 1 USD
  flag: string;
  change24h?: number; // percentage change e.g. +0.12 or -0.05
}

export interface ExtraFee {
  id: string;
  name: string;
  amount: number;
  type: 'fixed' | 'percentage'; // percentage of original price
}

export interface CalculationInput {
  title: string;
  skuSupplier: string;
  category: string;
  tradeDirection?: TradeDirection; // 'import' | 'export'
  transactionDate?: string; // Optional user-set transaction date (ISO or YYYY-MM-DD)
  quantity: number;
  invoiceImage?: string; // Captured camera photo or uploaded document (Base64 / Data URL)
  
  // Original Cost
  originalPrice: number;
  originalCurrency: string;
  
  // Weight & Dimensions
  weight: number; // net or total weight in selected unit
  weightUnit: WeightUnit;
  useWeightOnly?: boolean; // toggle to measure by actual gross weight only
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: DimensionUnit;
  volumetricFactor?: number; // e.g., 5000 for Air (cm3/kg), 6000 for Express, 1000 for Sea (CBM)
  
  // Transport & Freight
  freightMethod: FreightMethod;
  freightCurrency?: string; // Currency for transport fees rate e.g., USD, EUR, EGP
  freightRatePerUnit: number; // rate per kg, g, lb, tonne, item, cbm or flat total
  freightRateType: 'per_weight' | 'per_volume' | 'flat';
  freightRateBasis?: TransportRateBasis; // Specific basis: per_kg, per_g, per_lb, per_tonne, per_item, per_cbm, flat
  showCustomRates?: boolean; // toggle for optional customs, duties & extra fees
  originHandlingFee: number;
  destinationHandlingFee: number;
  customsClearanceFee: number;
  dutyPercentage: number; // % on CIF / FOB
  insurancePercentage: number; // % on FOB
  inlandDeliveryFee: number;
  extraFees: ExtraFee[];

  // Target Currency & FX
  targetCurrency: string;
  customExchangeRate?: number; // if user locks exchange rate manually

  // Flight & Air Consignment Linking
  flightName?: string; // e.g., "MS 777 - EgyptAir Cargo"
  flightNumber?: string; // e.g., "MS 777"
  flightDate?: string; // e.g., "2026-08-25"
  originAirport?: string; // e.g., "CAN (Guangzhou)"
  originCountry?: string; // e.g., "China"
  destinationAirport?: string; // e.g., "CAI (Cairo)"
  destinationCountry?: string; // e.g., "Egypt"
  awbNumber?: string; // Air Waybill # e.g., "077-12345678"
  airline?: string; // e.g., "EgyptAir Cargo"
  flightConsignmentId?: string; // Linked Flight Consignment Batch ID

  // Profit Strategy
  pricingStrategy: 'margin' | 'markup' | 'target_price';
  targetValue: number; // margin % (e.g. 25%), or markup % (e.g. 35%), or target price in target currency
}

export interface FlightConsignment {
  id: string; // e.g. "FLIGHT-20260825-MS777-XYZ"
  userId?: string;
  tripType?: 'one_way' | 'round_trip'; // Trip type: one-way or round-trip
  flightNumber: string; // e.g. "MS 777" (Outbound / Departure flight)
  flightName: string; // e.g. "MS 777 (CAN ➔ CAI)" or "MS 777 / MS 778 (CAI ⇄ CAN)"
  airline?: string; // e.g. "EgyptAir Cargo" or "Emirates"
  flightDate: string; // Departure Date: YYYY-MM-DD
  originAirport: string; // Departure Origin Airport e.g. "CAI (Cairo)" or "CAN (Guangzhou)"
  originCountry?: string; // e.g. "Egypt" or "China"
  destinationAirport: string; // Departure Destination Airport e.g. "CAN (Guangzhou)" or "CAI (Cairo)"
  destinationCountry?: string; // e.g. "China" or "Egypt"
  // Return flight fields (for round-trip tickets)
  returnFlightNumber?: string; // e.g. "MS 778"
  returnFlightDate?: string; // Return Date: YYYY-MM-DD
  returnOriginAirport?: string; // Return Origin Airport e.g. "CAN (Guangzhou)"
  returnDestinationAirport?: string; // Return Destination Airport e.g. "CAI (Cairo)"
  awbNumber?: string; // Air Waybill #
  masterAwbNumber?: string; // Master Air Waybill #
  totalGrossWeightKg?: number;
  totalWeightKg?: number;
  totalChargeableWeightKg?: number;
  totalPackagesCount?: number;
  totalPieces?: number;
  totalVolumeCbm?: number;
  flightTicketPrice?: number; // Cost of passenger/buyer flight ticket (e.g. 500 USD or 25,000 EGP)
  flightTicketCurrency?: string; // Currency of the ticket, defaults to targetCurrency or USD
  freightCostUSD?: number;
  totalLandedCost?: number;
  totalLandedCostEGP?: number;
  totalRevenue?: number;
  totalRevenueEGP?: number;
  totalProfit?: number;
  totalProfitEGP?: number;
  targetCurrency?: string;
  documentPdfUrl?: string; // Stored PDF / image or Data URL of flight manifest / AWB
  documentFileName?: string;
  notes?: string;
  status?: 'scheduled' | 'in_transit' | 'customs_clearance' | 'arrived' | 'cleared' | 'delivered' | 'cancelled';
  calculationIds: string[]; // Linked calculation records
  isDeleted?: boolean; // Soft delete flag
  userDeleted?: boolean; // Tagged when owner user is soft-deleted
  deletedAt?: string; // ISO timestamp of soft deletion
  createdAt: string;
  updatedAt?: string;
}

export interface FlightManifestParsedItem {
  title: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
  currency?: string;
  totalWeightKg?: number;
  cbm?: number;
  hsCode?: string;
  category?: string;
  freightRatePerKg?: number;
}

export interface FlightManifestParsedData {
  tripType?: 'one_way' | 'round_trip';
  flightNumber?: string;
  flightDate?: string;
  airline?: string;
  originAirport?: string;
  originCountry?: string;
  destinationAirport?: string;
  destinationCountry?: string;
  returnFlightNumber?: string;
  returnFlightDate?: string;
  returnOriginAirport?: string;
  returnDestinationAirport?: string;
  awbNumber?: string;
  totalGrossWeightKg?: number;
  totalChargeableWeightKg?: number;
  totalPackagesCount?: number;
  flightTicketPrice?: number;
  flightTicketCurrency?: string;
  currency?: string;
  notes?: string;
  items?: FlightManifestParsedItem[];
}

export interface CalculationResult {
  id: string;
  createdAt: string; // ISO string
  input: CalculationInput;

  // Conversion rates used
  exchangeRate: number; // 1 Original = X Target
  rateTimestamp: string;

  // Breakdown in Target Currency
  originalPriceTarget: number;
  totalOriginalPriceTarget: number;
  
  chargeableWeightKg: number; // volumetric vs actual
  totalGrossWeightKg?: number; // actual total gross weight in kg
  totalGrossWeightGrams?: number; // actual total gross weight in grams
  totalGrossWeightSelectedUnit?: number; // total weight in input unit (kg, g, lbs, tonnes)
  volumeCBM: number;

  freightCurrency?: string;
  freightCostInFreightCurrency?: number;
  freightCostTarget: number;
  originHandlingTarget: number;
  destinationHandlingTarget: number;
  customsClearanceTarget: number;
  dutyCostTarget: number;
  insuranceCostTarget: number;
  inlandDeliveryTarget: number;
  extraFeesTotalTarget: number;

  totalTransportFeesTarget: number;
  totalLandedCostTarget: number;
  landedCostPerUnitTarget: number;

  // Pricing & Profit in Target Currency
  suggestedSellingPricePerUnitTarget: number;
  totalRevenueTarget: number;
  profitPerUnitTarget: number;
  totalProfitTarget: number;
  actualMarginPercentage: number; // % of selling price
  actualMarkupPercentage: number; // % over landed cost
  roiPercentage: number; // % return on investment
  userId?: string; // Optional ID of trader / user who performed calculation
  isDeleted?: boolean; // Soft delete flag
  userDeleted?: boolean; // Tagged when owner user is soft-deleted
  deletedAt?: string; // ISO timestamp of soft deletion
}

export interface UserProfile {
  userId: string; // Unique ID or derived from username
  user_id?: string; // Unified database alias for userId
  username: string; // Username for login
  password?: string; // Password stored in database schema
  role?: 'admin' | 'user'; // User permission level
  status?: 'active' | 'suspended' | 'deleted'; // User status
  isDeleted?: boolean; // Soft delete status flag
  deletedAt?: string; // Timestamp of soft deletion
  deletedBy?: string; // Admin who performed soft delete
  name?: string;
  email?: string;
  phone?: string; // Phone number for SMS OTP password reset
  company?: string;
  createdAt: string;
  lastLoginAt: string;
  twoFactorEnabled?: boolean; // TOTP Two-Factor Authentication flag
  twoFactorSecret?: string; // Base32 encoded TOTP Secret
  twoFactorBackupCodes?: string[]; // Single-use emergency backup recovery codes
  twoFactorConfirmedAt?: string; // ISO date when 2FA was activated
  two_factor_enabled?: boolean;
  two_factor_secret?: string;
  two_factor_enabled_at?: string;
  updatedAt?: string;
}

export interface TwoFactorChallengeData {
  requires2FA: true;
  twoFactorToken: string;
  username: string;
  userId: string;
  isFirstSetup?: boolean;
  twoFactorSecret?: string;
  twoFactorUri?: string;
}

export interface RatesResponse {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string;
  source: string;
}
