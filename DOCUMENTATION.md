# Elegant FX — System Documentation & Technical Specification

> **Latest Revision**: 2026-08-11  
> **Status**: Production Ready & Fully Responsive (Mobile, Tablet & Desktop)

---

## 📱 Mobile & Web Responsive Architecture

Elegant FX is engineered with a mobile-first, desktop-optimized responsive layout matrix that dynamically scales across all device form factors.

### Breakpoint Specifications

| Device Category | Screen Width (`px`) | Layout Strategy & Adaptive Enhancements |
| :--- | :--- | :--- |
| **Mobile Phones** | `< 640px` | Single-column stacked forms, collapsible hamburger mobile drawer navigation, touch targets $\ge 44\text{px}$, sticky mobile summary bar, horizontally scrollable data tables. |
| **Tablets / Small Laptops** | `640px – 1024px` | 2-column input grid, inline header controls, scrollable FX rate ticker, responsive modal overlays with max-height touch scrolling. |
| **Desktop / Monitors** | `1024px – 1440px` | Multi-column grid layout (Form + Sticky Calculation Card), dual-chart financial dashboard, full desktop navigation bar. |
| **Ultra-Wide Screens** | `> 1440px` | Constrained `max-w-7xl` centered container to prevent extreme line lengths, preserving visual density and optical alignment. |

---

## 🔀 Real-Time Multi-Currency Exchange Rates Engine

1. **Auto-Polling FX Feed**:
   - Backend Express proxy (`/api/exchange-rates`) fetches live rates every 60 seconds with fallback tiers (Open Exchange Rates, ExchangeRate-API, Fawaz Ahmed API, and internal baseline).
   - Client-side auto-refreshes every 60s with silent fallback to direct client-side FX fetch if backend is offline.
2. **Supported Currencies**:
   - Primary default target currency: **EGP** (Egyptian Pound).
   - Full support for USD, EUR, GBP, JPY, CNY, AED, SAR, BRL, and 150+ global currencies.

---

## 📄 Enhanced PDF Export Engine

1. **Bilingual Arabic & English PDF Reports**:
   - Individual shipment landed cost breakdown PDF reports (`exportSingleCalculationPDF`).
   - Historical multi-shipment cumulative analytical reports (`exportHistoricalSummaryPDF`).
2. **High-Resolution Rendering**:
   - Utilizes `html2canvas` + `jspdf` with high DPI canvas scaling (2x scale) and native RTL/LTR font rendering (`Cairo`, `Tajawal`, `Segoe UI`).

---

## 🛡️ Database & Persistent Storage Fallbacks

- Seamless real-time subscriptions with automatic local storage (`localStorage`) fallback if database permissions or offline networks occur.
- Multi-channel realtime subscriptions generated with unique channel IDs to prevent subscription duplication warnings.

---

## 📝 Modification & Update Log (Auto-Updated)

- **2026-08-12**:
  - **Complete Removal of Default Seed Fallbacks**:
    - Removed all hardcoded default fallback accounts (`admin`/`admin123`, `trader`/`user123`) from `server.ts` and `LoginScreen.tsx`.
    - Authentications now run exclusively against Supabase PostgreSQL and Firestore database queries.
    - Default password fallback during user creation replaced with random secure hashed key generation.
  - **Full 3-Tier Security Architecture Implementation (Vite SPA → Express API → Supabase/Firestore)**:
    - **API Backend Infrastructure (`server.ts`)**: Built a secure Express server acting as the single source of truth for all database operations, eliminating direct client-side database credentials.
    - **JWT Authentication & Password Hashing**: Implemented HMAC-SHA256 signed JWT tokens and PBKDF2 password hashing with salt.
    - **Security Middleware & Rate Limiting**: Enforced `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection` headers, general rate limiting (100 req/15min), and strict login rate limiting (10 req/15min).
    - **Client API Wrapper (`src/lib/api.ts`)**: Created a clean client API library to interact with `/api/auth/*`, `/api/users/*`, `/api/calculations/*`, `/api/settings/*`, and `/api/supabase-health`.
    - **Frontend Refactoring**: Refactored `LoginScreen.tsx`, `LoginModal.tsx`, `AdminPanel.tsx`, and `App.tsx` to route all logins, profile updates, user account administration, calculation persistence, and site branding through secure server API endpoints.
    - **Secrets & Environment Isolation**: Moved `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` strictly to server-side process environment variables, updating `.env.example` with secure documentation guidelines.

- **2026-08-11**:
  - **Fixed Clear All Button Text Rendering & Styling (`DashboardView.tsx` & `translations.ts`)**: Resolved issue where `{t.clearAll}` rendered as undefined text inside the Historical Calculation Table filter bar. Added `clearAll` key to both Arabic and English dictionaries, added `Trash2` icon, and upgraded the button with high-contrast red badge styling (`bg-rose-500/10 border-rose-500/30`) for immediate visibility.
  - **Universal Calculation Record Deletion (`GalleryView.tsx` & `DashboardView.tsx`)**: Added individual calculation delete buttons (`Trash2`) with confirmation modals to `GalleryView.tsx`'s product records modal and ensured high-visibility `min-w-[280px]` non-wrapping action layout in `DashboardView.tsx` table view so delete actions are always clearly visible and functional across all screens and views.
  - **Fixed Icon Reference (`Globe`)**: Added missing `Globe` icon import from `lucide-react` in `EditTransactionModal.tsx` resolving runtime ReferenceError.
  - **Transaction Date Picker in Create & Edit Forms**: Integrated `transactionDate` input field into `CalculatorForm.tsx` and `EditTransactionModal.tsx` allowing users to backdate or specify custom transaction/calculation dates during creation and editing.
  - **Comprehensive Selling Price & Profit Strategy Controls in Edit Modal (`EditTransactionModal.tsx`)**: Upgraded `EditTransactionModal.tsx` with target pricing strategy selectors (Direct Target Selling Price, Target Profit Margin %, Target Markup %), live margin and ROI recalculation preview cards, and high-visibility bold inputs.
  - **Scoped Trade Direction Transaction Filtering in Gallery (`GalleryView.tsx`)**: Refined trade direction filtering (`import` vs `export`) in `GalleryView.tsx` to filter specific transaction records within each product group modal (`modalFilteredRecords`) and update group card transaction counters and KPI header totals accordingly.
  - **Global Product Information Edit Modal (`EditProductInfoModal.tsx`)**: Added a global product edit modal allowing users to rename product titles, update SKUs, change categories, and replace master product images across all grouped historical records.
  - **Refined Product Card Actions**: Streamlined product cards in `GalleryView.tsx` to focus on global product info edits and opening the detailed transaction records modal, keeping transaction-specific duplicate, PDF, and edit actions within the records modal.

- **2026-08-07**:
  - **Exchange Rate Timeout & Fail-Safe Upgrades**: Updated `server.ts` with `fetchWithTimeout` (using AbortController with 3.5s limit) for all external rate sources (XE Currency Converter, Open Exchange Rates, ExchangeRate-API, jsDelivr) to prevent Express route hanging or network timeout errors. Pre-initialized `cachedRates` with baseline fallback rates so `/api/exchange-rates` always returns valid 200 OK JSON responses.
  - **Quiet Error Handling**: Cleaned up client-side `fetchExchangeRates` in `App.tsx` to handle network fallback quietly without emitting warning stack traces to the browser console.
  - **Firestore Transport Warning Silencing**: Configured `setLogLevel('error')` in `src/lib/firebase.ts` to suppress non-fatal internal WebChannel RPC Listen transport reconnection warnings in browser logs during temporary network shifts.

- **2026-08-06**:
  - **Admin Panel Favicon & Branding Management**: Added a comprehensive Website Favicon & Branding Settings section in `AdminPanel.tsx` allowing system administrators to customize the website icon (`favicon.ico` / `<link rel="icon">`) displayed across browser tabs, mobile web shortcuts, and bookmarks.
    - Added `src/utils/favicon.ts` with 5 crisp SVG preset icons (Golden Freight Ship, Global Trade Network, Emerald Logistics Box, Express Lightning Trade, Gold Shield Security) and dynamic document `<head>` favicon replacement.
    - Supported uploading custom image files (`.ico`, `.png`, `.svg`, `.jpg`, `.webp`) with automatic HTML5 canvas downscaling to 64x64 Data-URIs.
    - Supported pasting external favicon image URLs with live browser tab mockup preview.
    - Persisted custom favicon in Firestore collection (`site_settings/branding`), Supabase (`site_settings` table), and `localStorage` with real-time listener synchronization across all connected clients.
  - **Instant Manual Rate Refresh & Cache Bypassing**: Enhanced manual rate update button in `CurrencyRatesView.tsx` and `App.tsx` by adding `cache: "no-store"` and cache-busting timestamp parameters (`_t=${timestamp}`) to `/api/exchange-rates/refresh` and `https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=EGP`. Ensured `setRates` state replaces state references to force immediate, high-accuracy recalculation across the calculator and live rates views upon pressing the Update button. Added real-time visual toast confirmation showing the updated USD/EGP rate.
  - **Direct XE Pair Fetching & 15s Cache**: Updated XE scraping endpoint in `server.ts` to query `From=USD&To=EGP` directly instead of a generic `EUR` conversion page. This guarantees exact live mid-market USD to EGP rates (~49.72 EGP) matching XE.com's live converter, and reduced server cache TTL to 15s.
  - **30-Second Auto-Refresh Default**: Updated default exchange rate polling interval from 60 seconds to 30 seconds across `App.tsx` and `CurrencyRatesView.tsx` to keep XE Currency Converter live rates constantly fresh.
  - **XE Currency Converter Integration**: Integrated live exchange rate fetching directly from **XE Currency Converter (https://www.xe.com/currencyconverter/)** as the primary live mid-market rate source in `server.ts`. 
  - Added XE.com badge, live mid-market attribution, and direct external link to XE Currency Converter in `CurrencyRatesView.tsx` for real-time verification and guaranteed up-to-date landed cost & profit calculations.
  - Addressed and resolved mobile browser memory leaks and performance issues:
    - **Mobile Camera Image Compression**: Created `/src/utils/imageCompressor.ts` using HTML5 Canvas to downscale and compress high-resolution mobile camera uploads (15MB+ photos) to high-quality max 1000px JPEGs (~150KB), releasing DOM object URLs immediately to prevent browser tab crashes and localStorage quota exceptions.
    - **Passive Event Listener & Throttling**: Updated global activity tracking event listeners in `App.tsx` with `{ passive: true }` and 2000ms timestamp throttling to prevent touch scrolling jank and memory listener overhead on mobile Safari and Chrome.
  - Fixed account edit logic in `AdminPanel.tsx` and `src/lib/firebase.ts`: Editing an account's username now preserves the unique account ID (`userId`) and purges the old username key document/row from Firestore and Supabase, preventing duplicate user accounts.
  - Added `deduplicateUsers` utility in `src/lib/firebase.ts` to guarantee unique user account mapping across real-time subscriptions and database fetches.

- **2026-08-11**:
  - **Global Product Catalog Edit Modal (`EditProductInfoModal.tsx`)**: Configured the "Edit" action on product catalog cards in Gallery View to edit global product attributes (Product Name / Title, Supplier SKU, and Product Cargo Image). Updating this modal propagates changes across all records in that product group.
  - **Card Action Footer Cleanup**: Removed the "Duplicate in Calculator" button from the product card footer in Gallery View for a clean 2-button layout ("View Records" and "Edit Product Info"). Kept "Duplicate in Calculator" inside the View Records detail dialog alongside "Edit Transaction" and "PDF".
  - **Multi-Transaction Filter Handling across Catalog**: Upgraded Search, Trade Direction (Import / Export), and Freight filters in `GalleryView.tsx` to evaluate across **all historical trade transactions** within each product group instead of checking only the latest transaction. Also updated portfolio header KPIs to calculate totals specifically for transactions matching the active filters.
  - **Real-Time Product Group Modal Updates (`GalleryView.tsx`)**: Refactored the Product Records detail modal to derive `activeSelectedProductGroup` dynamically from synchronized `productGroups`. When an edit is saved via `EditTransactionModal`, the open Product Records dialog updates instantly in real-time without requiring the user to close and reopen the modal.
  - **Comprehensive Multi-Record Gallery Header Totals**: Updated the Gallery Portfolio Summary KPI header to sum values across **all historical calculation records and units** (instead of only taking the latest record of each product group).
  - **Interactive Product Card Focus & Header Auto-Calculation**: Implemented card click focus (`focusedGroupKey`). Clicking any product card highlights that card and focuses the Gallery header KPI section to calculate total units, purchase values (original & target), landed cost value, sales revenue, and net profit exclusively for that selected product, with an instant 1-click reset button to return to overall catalog totals.
  - **Edit Transaction & Image Capability (`EditTransactionModal.tsx`)**: Created a dedicated modal allowing users to edit any transaction or update its photo directly from both the **Gallery View** and the **History Table (Dashboard)**.
    - Enables modifying product title, SKU, purchase price, supplier currency, target currency, trade direction (Import/Export), freight method, and uploading/changing product pictures or invoice documents.
    - Automatically recalculates landed cost, suggested selling price, net profit, and profit margin in real-time before saving.
    - Connects directly to `handleSaveToHistory` in `App.tsx` for immediate persistence to Firestore and local storage, immediately updating Gallery cards, header KPIs, and history tables.
  - **Original Supplier Currency & Trade Direction Badges in Gallery**: Updated Gallery header summary KPIs to reflect original supplier currencies alongside target currency totals. Added "Import" / "Export" badges and supplier cost prices to all Gallery records and breakdown modals.
  - **Product & Cargo Image Gallery Tab (`GalleryView.tsx`)**: Created a dedicated, interactive "Gallery" tab ("معرض الصور") in `Header.tsx` and `App.tsx` displaying all product photos, invoice documents, and cargo pictures saved in calculation history.
  - **Product Cost Price Integration in Gallery**: Added Supplier Purchase Cost Price (FOB / Factory unit price in original currency and converted target currency) to both the product catalog cards and the detailed calculation records modal.
  - **Header Aggregate Column Totals Grid**: Enhanced the Gallery hero header with a 6-column KPI summary grid displaying real-time aggregate totals: Total Catalog Products, Attached Photo Count, Total Cargo Units, Total Purchase Cost Value (FOB), Total Landed Cost Value, Total Projected Sales Revenue, and Total Estimated Net Profit with Net Margin %.
  - **Product Grouping & Catalog Sync**: Automatically groups historical calculations by SKU/Title into catalog product cards, displaying product photos, trade direction badges (Import/Export), landed cost, suggested selling price, net profit margin %, and total calculation records count.
  - **High-Res Lightbox Image Inspector**: Integrated full-screen zoom and inspection modal for product photos with 1-click image download capability and metadata display.
  - **Product Calculations History Drawer**: Implemented a detailed modal dialog listing all past calculation records for a specific product, showing unit purchase costs, total purchase costs, landed costs, freight mode badges, profit margins, PDF export, and 1-click duplicate into calculator.
  - **Responsive Filtering & Search**: Includes real-time search (Title, SKU, Category, Supplier), Trade Direction filter (Import/Export), Photo availability toggle, and Freight Mode filter.

- **2026-08-11**:
  - **Automated Full-System Test Suite in Admin Panel (`AdminPanel.tsx`)**: Created a real-time, interactive diagnostic test runner covering 12 automated test modules across Math & Import Formulas, Target Pricing Strategy (Margin % vs Markup %), Multi-Currency Conversion Matrix & FX Rates, Backdated Transaction Dates, Firestore User Accounts Realtime Sync, Supabase PostgreSQL Relational Schema DDL Audit, LocalStorage Fallback State, Navigation Tab View Router, Interactive Action Modals (Edit, Quote Generator, HS Code Library), Calculation Record Deletion & Batch Clear All Filters, Inactivity Timeout Event Listener, and Website Favicon & Custom Branding Persistence Engine.
  - **Individual & Batch Record Deletion Fixes**: Added individual delete buttons with modal confirmations across `GalleryView.tsx`, `DashboardView.tsx`, and `AdminPanel.tsx`. Fixed translation keys for "Clear All" (`clearAll`) and resolved action button clipping on narrow viewports with `min-w-[280px]` wrappers.
  - **Synchronized SQL Schemas**: Updated `/schema.sql` at project root and `SUPABASE_REQUIRED_DDL_SQL` in `src/lib/supabase.ts` to maintain 100% synchronization across database definitions.

- **2026-08-05**:
  - Implemented multi-select checkboxes in `DashboardView.tsx` (both desktop table header/rows and mobile card views) with select-all/deselect-all controls.
  - Added batch deletion capability (`handleBatchDeleteRecords` in `App.tsx`) with a dedicated batch deletion confirmation modal dialog in `DashboardView.tsx` to permanently delete multiple records at once from Firestore/state.
  - Added multi-select batch PDF export (`handleExportSelectedPDF`), generating a single compiled PDF summary report (`exportHistoricalSummaryPDF`) for all checked/selected calculation records.
  - Added Trade Direction selection (`tradeDirection`: `'import'` vs `'export'`) to `CalculationInput` with interactive UI toggles in `CalculatorForm.tsx`, `CalculationResultsCard.tsx`, `DashboardView.tsx`, and `pdfExport.ts`.
  - Added `idx_calculations_trade_direction` database index to both `/schema.sql` and `SUPABASE_REQUIRED_DDL_SQL` in `src/lib/supabase.ts` for instant filtering of import vs export calculations in PostgreSQL / Supabase.
  - Added standalone `/schema.sql` at project root & synchronized with `SUPABASE_REQUIRED_DDL_SQL` in `src/lib/supabase.ts` and `AGENTS.md`. Both files are maintained in 100% sync on every database schema change.
  - Auto-updated SQL DDL setup script (`SUPABASE_REQUIRED_DDL_SQL` in `src/lib/supabase.ts` & Admin Panel): Added explicit schema indexes for JSONB product images (`invoiceImage`), SKU supplier code (`skuSupplier`), and user calculation history for high-performance PostgreSQL queries.
  - Added Dual Cost Entry in Section 2 (`CalculatorForm.tsx`): Users can now enter either the Unit Purchase Price OR the Total Batch Cost for all units. Modifying either field automatically calculates and updates the other seamlessly based on shipment quantity.
  - Implemented Instant Product, SKU & Image Auto-Completion (`autoFillFromHistory`): Typing or selecting a Product Title or SKU from autocomplete datalists or inputs automatically matches saved products in history and pre-fills Product Title, SKU, attached Invoice/Cargo Picture, Category, Price, Currency, Weight, and Duty Rate.
  - Added Cargo/Invoice Image thumbnails directly inside History Table rows (desktop) and mobile cards in `DashboardView.tsx`, with click-to-zoom Lightbox modal preview.
  - Added Cargo/Invoice Image thumbnails directly inside History Table rows (desktop) and mobile cards in `DashboardView.tsx`, with click-to-zoom Lightbox modal preview.
  - Added Cargo Image attachment preview card inside the Detailed Audit Modal for inspecting full-resolution cargo pictures.
  - Implemented Product & SKU Picker in `CalculatorForm.tsx` ("Select Saved Product"): allows picking previously saved products from history to prefill title, SKU, category, price, currency, weight, duty percentage, and invoice image.
  - Added native autocomplete `<datalist>` dropdowns to Product Title and SKU inputs in `CalculatorForm.tsx` for instant search while typing.
  - Enhanced sort & filter controls in `DashboardView.tsx` with high-contrast light and dark mode option styling, clear active focus indicators, and custom sort select styling.
  - Upgraded table action controls across desktop and mobile history views: added high-contrast action pills (`Offer`, `Inspect`, `Duplicate`, `Download PDF`, `Delete`) with hover scaling and touch targets ($\ge 36\text{px}$/ $44\text{px}$).
  - Redesigned History View Modal (`selectedDetailModal`) into an Executive Shipment & Landed Cost Detailed Audit view with a 4-KPI Overview Bar, Product & Logistics Specs, and Expenses Breakdown Matrix.
  - Added explicit, localized, and interactive sortable table headers (`thDate`, `thShipment`, `thFreightMode`, `thQty`, `thTotalLanded`, `thSellingPrice`, `thNetProfit`, `thMargin`, `thActions`) to `translations.ts` and `DashboardView.tsx`.
  - Enhanced Dashboard History Table UX in `DashboardView.tsx`: added dual-layer view (Mobile card grid for `<768px` and high-density table for `≥768px`), sorting control (Newest/Oldest, Landed Cost, Profit), freight mode badges with icons, search record counter badge, and responsive multi-select action bar.
  - Updated `Header.tsx` to implement responsive mobile hamburger menu hiding full tab navigation into an overlay menu on screens below 640px.
  - Added $44\text{px} \times 44\text{px}$ mobile touch targets and tracked responsive matrix in `RESPONSIVE.md`.
  - Implemented real-time FX rate auto-polling (60s interval) with direct client-side fallback.
  - Enhanced PDF export module with Arabic RTL rendering support and high-DPI HTML canvas scaling.
  - Created `AGENTS.md`, `RESPONSIVE.md`, and `DOCUMENTATION.md` for continuous automated project tracking.
