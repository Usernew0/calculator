# Elegant FX — Global Landed Cost & Profit Calculator

Elegant FX is a full-stack, enterprise-grade Freight Landed Cost & Profit Margin Analysis web application designed for global trade, importers, exporters, and logistics managers.

---

## 🌟 Key Features

### 1. Landed Cost & Profit Calculator
- **Trade Operation Selection**: Choose between **Import** (استيراد) and **Export** (تصدير) shipment operations with saved history, filtering, and report badging.
- **Dual Cost Entry Mode**: Input either Unit Purchase Price (per piece) OR Total Purchase Cost for all units — changing either automatically calculates the other based on quantity.
- **Instant Product & SKU Auto-Fill**: Selecting or typing a product title or SKU automatically matches saved items from history and pre-fills the title, SKU, category, price, currency, weight, duty rate, and attached cargo/invoice image.
- **Multi-Currency Support**: Supports EGP (Egyptian Pound), USD, EUR, GBP, JPY, CNY, AED, SAR, BRL, and all major world currencies.
- **Default Currency**: Default base and target currency set to **EGP** for seamless Egyptian trade calculations.
- **Freight Mode Engine**:
  - Air Express (Courier)
  - Air Cargo (Standard)
  - Sea LCL (Less than Container Load)
  - Sea FCL (Full Container Load)
  - Road Freight (Trucking)
- **Flexible Rate Basis**: Calculate freight by weight (`per kg`, `per g`, `per lb`, `per tonne`), by volume (`per CBM`), per unit, or flat shipment rates.
- **Volumetric CBM Calculator**: Automatic dimensional weight calculation (`Length × Width × Height / Volumetric Factor`).
- **Optional Import Duties & Handling**: Calculate customs duty %, insurance %, origin handling, destination clearance, inland delivery, and custom fee line items.
- **Profit Strategy Planning**: Calculate suggested selling prices based on Target Unit Selling Price, Target Net Margin %, or Target Cost Markup %.

---

### 2. Live Market Exchange Rates
- **Official XE Currency Converter Integration**: Live exchange rates are directly fetched from **XE Currency Converter (www.xe.com)** mid-market rate feeds, ensuring 100% accurate, up-to-date currency conversions.
- **Direct XE.com Verification**: Includes a direct link button to XE Currency Converter (`https://www.xe.com/currencyconverter/`) for quick rate verification.
- **Auto-Refresh Ticker**: Periodic auto-refresh timer (30s, 1m, 5m, or manual) with animated countdown progress indicator.
- **Quick Currency Converter**: Instant conversion widget between any currency pair.
- **Dynamic Rates Matrix**: Interactive matrix search and base currency switcher.

---

### 3. Historical Dashboard & Analytics
- **Saved Calculation History**: Store landed cost calculations in browser persistent storage (`localStorage`) and isolated per-user Firestore database storage.
- **Multi-Select Checkboxes & Batch Operations**:
  - **Select All / Deselect All Controls**: Toggle selection across filtered calculation records in desktop table headers and mobile card headers.
  - **Batch PDF Summary Export**: Select multiple records and export them as a single compiled PDF summary report with combined financial metrics.
  - **Batch Deletion**: Select multiple records and permanently delete them simultaneously from the database with confirmation prompts.
  - **Multi-Item Client Quotes**: Generate unified commercial offers for multiple selected shipment calculations.
- **Financial Analytics Charts**: Visual trend breakdown (Landed Cost vs Net Profit) using Recharts.
- **Cost Composition Pie Chart**: Itemized expense structure distribution (Product, Freight, Duty, Insurance, Handling).
- **PDF Report Generation**: Download official PDF reports for individual calculations or complete historical summaries using `jspdf` and `jspdf-autotable`.
- **CSV Data Export**: Export saved historical records to CSV for Excel and Google Sheets analysis.

---

### 4. Admin Control Panel & Website Favicon Settings
- **Website Favicon & Branding Management**: System administrators can set and publish custom website favicons (`favicon.ico` / `<link rel="icon">`) that display in browser tabs, mobile web shortcuts, and bookmarks for all site visitors.
- **5 High-Resolution SVG Presets**: Built-in SVG favicon presets (Golden Freight Ship, Global Trade Network, Emerald Logistics Box, Express Lightning Trade, Gold Shield Security).
- **Custom Image Upload**: Support uploading `.ico`, `.png`, `.svg`, `.jpg`, `.webp` images with auto HTML5 canvas downscaling to 64x64 Data-URIs.
- **External URL Input & Live Mockup**: Enter custom image URLs and preview the tab icon in a simulated live browser header mockup before publishing.
- **Firestore & Supabase Real-Time Sync**: Favicon updates publish instantly to Firestore (`site_settings/branding`), Supabase (`site_settings`), and `localStorage`.
- **User Account Management**: Full management of user accounts, password resets, role permissions, and dual database diagnostics (Firestore & Supabase).

---

### 5. UI & Accessibility Design
- **Responsive Web & Mobile Layout**:
  - **Desktop**: Multi-column layout with sticky calculation result sidecards and side-by-side analytics.
  - **Mobile**: Touch-friendly inputs (min 44px height), stacked vertical forms, collapsible mobile drawer menu with hamburger toggle, and horizontally scrollable tables/tickers (`no-scrollbar`).
- **Bilingual Support**: Native Arabic (RTL) and English (LTR) language support with Cairo font family.
- **Light & Dark Theme Toggle**: Built-in toggle supporting dark and light themes with preference persistence.
- **Auto-Updated Documentation**: Maintained via `AGENTS.md` and `DOCUMENTATION.md` for seamless developer tracking.

---

## 💻 Responsive Breakpoints

| Device | Screen Width | Layout Strategy |
| :--- | :--- | :--- |
| **Mobile** | `< 640px` | Single-column stacked layout, hamburger mobile drawer navigation, touch targets $\ge 44\text{px}$, responsive mobile history card grid |
| **Tablet** | `640px – 1024px` | 2-column input grid, inline controls, responsive ticker bar |
| **Desktop** | `> 1024px` | 12-column grid system with sticky results panel and full analytics charts |

---

## 📚 Project Documentation & Guidelines

- **`AGENTS.md`**: Persistent rules and standards for automated updates and responsiveness.
- **`RESPONSIVE.md`**: Mobile responsive hamburger menu matrix, touch target specifications, and breakpoint layout rules.
- **`DOCUMENTATION.md`**: Technical specification, real-time rates architecture, PDF engine, and auto-updated revision log.

---

## 🛠️ Getting Started

```bash
# Install dependencies
npm install

# Start development server (Port 3000)
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

---

*Elegant FX — Empowering global trade with precise landed cost insights.*
