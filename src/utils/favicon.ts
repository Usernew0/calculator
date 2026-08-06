/**
 * Favicon & Branding Helper Utility
 * Updates website favicon dynamically in document <head> and provides preset SVG favicons.
 */

export interface FaviconPreset {
  id: string;
  nameEn: string;
  nameAr: string;
  dataUrl: string;
}

// Crisp, high-contrast SVG preset icons encoded as Data URIs for instant rendering
export const FAVICON_PRESETS: FaviconPreset[] = [
  {
    id: 'golden-ship',
    nameEn: 'Golden Freight Ship',
    nameAr: 'سفينة شحن ذهبية',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%230f172a"/><path d="M12 40 L52 40 L44 52 L20 52 Z" fill="%23f59e0b"/><path d="M28 16 L28 36 L18 36 Z" fill="%2338bdf8"/><path d="M34 12 L34 36 L48 36 Z" fill="%23f43f5e"/><circle cx="32" cy="32" r="28" fill="none" stroke="%233b82f6" stroke-width="2.5"/></svg>`,
  },
  {
    id: 'global-trade',
    nameEn: 'Global Trade Network',
    nameAr: 'شبكة التجارة العالمية',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%230284c7"/><circle cx="32" cy="32" r="22" fill="none" stroke="%23ffffff" stroke-width="3"/><ellipse cx="32" cy="32" rx="22" ry="9" fill="none" stroke="%2338bdf8" stroke-width="2.5"/><ellipse cx="32" cy="32" rx="9" ry="22" fill="none" stroke="%2338bdf8" stroke-width="2.5"/><path d="M10 32 L54 32" stroke="%23ffffff" stroke-width="2.5"/></svg>`,
  },
  {
    id: 'cargo-box',
    nameEn: 'Emerald Logistics Box',
    nameAr: 'صندوق لوجستيات زمردي',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%23059669"/><path d="M32 10 L52 20 L32 30 L12 20 Z" fill="%2334d399"/><path d="M12 20 L32 30 L32 52 L12 42 Z" fill="%2310b981"/><path d="M52 20 L32 30 L32 52 L52 42 Z" fill="%23047857"/></svg>`,
  },
  {
    id: 'lightning-trade',
    nameEn: 'Express Lightning Trade',
    nameAr: 'تجارة سريعة خاطفة',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%234f46e5"/><path d="M36 8 L18 34 L32 34 L26 56 L46 30 L32 30 Z" fill="%23fbbf24" stroke="%23ffffff" stroke-width="1.5"/></svg>`,
  },
  {
    id: 'shield-security',
    nameEn: 'Gold Shield Security',
    nameAr: 'درع الحماية الذهبي',
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%231e1b4b"/><path d="M32 10 C44 10 50 14 50 24 C50 40 38 50 32 54 C26 50 14 40 14 24 C14 14 20 10 32 10 Z" fill="%23d97706" stroke="%23fef08a" stroke-width="2.5"/><path d="M32 20 L38 32 L26 32 Z" fill="%23ffffff"/></svg>`,
  },
];

export const DEFAULT_FAVICON = FAVICON_PRESETS[0].dataUrl;

/**
 * Updates all favicon link tags in document <head>
 */
export function updateWebsiteFavicon(iconUrl: string): void {
  if (!iconUrl || typeof document === 'undefined') return;

  const url = iconUrl.trim();

  // Primary rel="icon"
  let iconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']") ||
                 document.querySelector<HTMLLinkElement>("link[rel*='icon']");

  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    document.head.appendChild(iconLink);
  }
  iconLink.href = url;

  // Shortcut icon
  let shortcutLink = document.querySelector<HTMLLinkElement>("link[rel='shortcut icon']");
  if (!shortcutLink) {
    shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    document.head.appendChild(shortcutLink);
  }
  shortcutLink.href = url;

  // Apple touch icon
  let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (!appleLink) {
    appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    document.head.appendChild(appleLink);
  }
  appleLink.href = url;
}

/**
 * Gets saved site favicon from localStorage or default
 */
export function getSavedFavicon(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('cargo_site_favicon');
      if (saved && saved.trim()) return saved.trim();
    }
  } catch (err) {
    console.warn('Unable to read saved favicon from localStorage:', err);
  }
  return DEFAULT_FAVICON;
}

/**
 * Saves site favicon to localStorage and triggers window dispatch event
 */
export function setSavedFaviconLocally(iconUrl: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cargo_site_favicon', iconUrl);
    }
    updateWebsiteFavicon(iconUrl);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cargo_favicon_changed', { detail: iconUrl }));
    }
  } catch (err) {
    console.warn('Unable to save favicon to localStorage:', err);
  }
}
