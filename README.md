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

### 4. Product & Cargo Image Gallery & Edit Controls
- **Global Product Catalog Info Modal**: The "Edit Info" button on product catalog cards (`EditProductInfoModal.tsx`) updates global product attributes (Product Name/Title, SKU, and Product Photo) across all calculations in that product group.
- **Transaction Date Control & Editing**: Full date input (`transactionDate`) supported during both initial trade calculation creation (`CalculatorForm.tsx`) and transaction editing (`EditTransactionModal.tsx`).
- **Selling Price & Profit Strategy Controls in Edit Modal**: `EditTransactionModal.tsx` provides target selling price strategy options (Direct Selling Price, Profit Margin %, Cost Markup %) with real-time recalculation preview cards and clear high-contrast inputs.
- **Scoped Trade Direction Transaction Filtering**: Filtering by Trade Direction (`import` vs `export`) or Freight Method in `GalleryView.tsx` scopes transaction records directly inside product group modals (`modalFilteredRecords`), updating matching transaction counts and record listings.
- **Universal Record Deletion**: Dedicated Delete buttons (`Trash2`) with safety confirmation modals available across both the **Dashboard Historical Calculation Table** (`DashboardView.tsx`) and the **Gallery Product Group Records Modal** (`GalleryView.tsx`), complete with batch multi-select delete and clear-all operations.
- **Clean Card Action Bar**: Main product cards feature a clean 2-button action layout ("View Records" and "Edit Info"). The "Duplicate in Calculator" button is located inside the View Records modal alongside "Edit Transaction", "Delete", and "PDF Export".
- **Enhanced Multi-Transaction Filtering**: Search, Trade Direction (Import/Export), and Freight Mode filters evaluate across **all historical calculations** in each product catalog group. Portfolio header totals adjust dynamically to sum values specifically for transactions matching active filter criteria.
- **Real-Time Modal Sync**: The Product Records detail modal dynamically updates in real-time when saving transaction edits, instantly reflecting new numbers, images, and totals without closing the modal.
- **Card Click Focus & Header Auto-Calculation**: Pressing any product card in the gallery highlights the card and focuses the Gallery Header KPI section to auto-calculate all aggregate metrics (total cargo units, purchase cost FOB, landed value, sales revenue, net profit) specifically for that product card, with a 1-click reset button to view overall catalog totals.
- **Comprehensive Multi-Record Header Totals**: Gallery header totals aggregate all units and calculations across historical trade records for complete financial portfolio oversight.
- **Edit Transaction & Image Capability**: Interactive edit modal (`EditTransactionModal.tsx`) available in both the **Gallery View** and the **History Dashboard Table**. Importers/exporters can modify product titles, SKUs, supplier costs, supplier currency, target currency, trade direction (Import/Export), freight mode, and upload/replace product pictures or invoice documents. Automatically recalculates all landed costs and profit margins in real-time.
- **Catalog Photo View**: Interactive "Gallery" tab (`GalleryView.tsx`) displaying all saved product photos, invoice documentation, and cargo pictures.
- **Header Portfolio Summary (Column Totals)**: Hero section header featuring real-time KPI aggregate totals across the catalog: Total Catalog Products, Attached Photos Count, Total Cargo Units, Total Purchase Value (FOB in original supplier currencies and target currency), Total Landed Cost Value, Total Projected Sales Revenue, and Total Estimated Net Profit with Margin %.
- **Product Cost Price View**: Displays Supplier Unit Purchase Price (FOB factory cost in supplier currency and converted target currency) directly on product catalog cards and inside detailed calculation record breakdowns.
- **Automatic Catalog Grouping**: Groups historical trade calculations by SKU and Title, showing product images, trade direction badges (Import/Export), supplier unit cost, landed cost per unit, suggested selling price, net profit margin %, and calculation records count.
- **High-Res Lightbox Inspector**: Full-screen modal to inspect product photos with zoom controls and 1-click photo download.
- **Product Calculation History Drawer**: Modal view displaying all historical calculation entries for a specific product with supplier cost prices, total purchase costs, landed costs, PDF reports, and 1-click duplicate into calculator.
- **Responsive Filtering & Search**: Instant search by Product Title, SKU, or Supplier, with filters for Trade Direction (Import/Export), Photo Availability, and Freight Mode.

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
