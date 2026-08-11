import { CurrencyRate } from '../types';

export const POPULAR_CURRENCIES: CurrencyRate[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', rateToUSD: 1.0, flag: '🇺🇸', change24h: 0 },
  { code: 'EUR', name: 'Euro', symbol: '€', rateToUSD: 0.92, flag: '🇪🇺', change24h: 0.12 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rateToUSD: 0.78, flag: '🇬🇧', change24h: -0.05 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rateToUSD: 154.5, flag: '🇯🇵', change24h: -0.28 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', rateToUSD: 1.38, flag: '🇨🇦', change24h: 0.08 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rateToUSD: 1.52, flag: '🇦🇺', change24h: 0.15 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: 'CN¥', rateToUSD: 7.24, flag: '🇨🇳', change24h: -0.02 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', rateToUSD: 3.6725, flag: '🇦🇪', change24h: 0.0 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', rateToUSD: 3.75, flag: '🇸🇦', change24h: 0.0 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', rateToUSD: 83.9, flag: '🇮🇳', change24h: -0.1 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'EGP', rateToUSD: 48.6, flag: '🇪🇬', change24h: -0.35 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', rateToUSD: 5.65, flag: '🇧🇷', change24h: 0.22 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', rateToUSD: 0.88, flag: '🇨🇭', change24h: 0.04 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rateToUSD: 1.35, flag: '🇸🇬', change24h: 0.06 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', rateToUSD: 7.81, flag: '🇭🇰', change24h: 0.01 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', rateToUSD: 18.5, flag: '🇲🇽', change24h: -0.4 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', rateToUSD: 1375.0, flag: '🇰🇷', change24h: -0.18 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', rateToUSD: 33.2, flag: '🇹🇷', change24h: -0.65 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', rateToUSD: 18.2, flag: '🇿🇦', change24h: 0.18 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', rateToUSD: 1.66, flag: '🇳🇿', change24h: 0.09 },
];

export function getCurrencySymbol(code: string): string {
  const found = POPULAR_CURRENCIES.find((c) => c.code === code);
  if (found) return found.symbol;
  try {
    return (0).toLocaleString(undefined, { style: 'currency', currency: code }).replace(/\d|\s|\./g, '') || code;
  } catch {
    return code;
  }
}

export function formatCurrency(amount: number, code: string, rates?: Record<string, number>): string {
  if (isNaN(amount) || !isFinite(amount)) return '0.00';
  const symbol = getCurrencySymbol(code);
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formattedNumber}`;
}

export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string,
  rates: Record<string, number>
): { converted: number; rate: number } {
  if (fromCode === toCode) return { converted: amount, rate: 1.0 };
  
  const fromRateToUSD = rates[fromCode] || 1.0;
  const toRateToUSD = rates[toCode] || 1.0;

  // Amount in USD = amount / fromRateToUSD
  // Amount in target = Amount in USD * toRateToUSD
  const rate = toRateToUSD / fromRateToUSD;
  const converted = amount * rate;

  return { converted, rate };
}

export function detectUserDefaultCurrency(): string {
  try {
    const languages = typeof navigator !== 'undefined'
      ? (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''])
      : [];

    const regionToCurrency: Record<string, string> = {
      US: 'USD',
      EG: 'EGP',
      SA: 'SAR',
      AE: 'AED',
      GB: 'GBP',
      JP: 'JPY',
      CN: 'CNY',
      IN: 'INR',
      BR: 'BRL',
      CA: 'CAD',
      AU: 'AUD',
      MX: 'MXN',
      KR: 'KRW',
      TR: 'TRY',
      ZA: 'ZAR',
      NZ: 'NZD',
      CH: 'CHF',
      SG: 'SGD',
      HK: 'HKD',
      DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
      AT: 'EUR', IE: 'EUR', FI: 'EUR', PT: 'EUR', GR: 'EUR'
    };

    for (const lang of languages) {
      if (!lang) continue;
      const parts = lang.split('-');
      if (parts.length > 1) {
        const country = parts[parts.length - 1].toUpperCase();
        if (regionToCurrency[country]) {
          return regionToCurrency[country];
        }
      }
    }

    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.includes('Cairo') || tz.includes('Egypt')) return 'EGP';
      if (tz.includes('Riyadh') || tz.includes('Saudi')) return 'SAR';
      if (tz.includes('Dubai') || tz.includes('Abu_Dhabi')) return 'AED';
      if (tz.includes('London')) return 'GBP';
      if (tz.includes('Tokyo')) return 'JPY';
      if (tz.includes('Shanghai') || tz.includes('Chongqing') || tz.includes('Urumqi')) return 'CNY';
      if (tz.includes('Kolkata') || tz.includes('Calcutta')) return 'INR';
      if (tz.includes('Berlin') || tz.includes('Paris') || tz.includes('Rome') || tz.includes('Madrid') || tz.includes('Amsterdam') || tz.includes('Athens') || tz.includes('Brussels') || tz.includes('Vienna')) return 'EUR';
      if (tz.includes('Toronto') || tz.includes('Vancouver')) return 'CAD';
      if (tz.includes('Sydney') || tz.includes('Melbourne') || tz.includes('Brisbane')) return 'AUD';
      if (tz.includes('Sao_Paulo')) return 'BRL';
      if (tz.includes('New_York') || tz.includes('Chicago') || tz.includes('Los_Angeles') || tz.includes('Denver')) return 'USD';
    }
  } catch (err) {
    console.info('Auto-currency detection fallback:', err);
  }

  return 'EGP';
}

export const FREIGHT_METHODS = [
  { id: 'air_express', nameEn: 'Air Express Freight', nameAr: 'شحن جوي سريع' },
  { id: 'air_standard', nameEn: 'Air Cargo Standard', nameAr: 'شحن جوي عادي' },
  { id: 'sea_lcl', nameEn: 'Sea Freight LCL (Groupage)', nameAr: 'شحن بحري جزئي (LCL)' },
  { id: 'sea_fcl', nameEn: 'Sea Freight FCL (Container)', nameAr: 'شحن بحري حاوية (FCL)' },
  { id: 'road_freight', nameEn: 'Road Land Freight', nameAr: 'شحن بري' },
];
