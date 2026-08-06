# Elegant FX — System Documentation & Technical Specification

> **Latest Revision**: 2026-08-05  
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

- **2026-08-06**:
  - Fixed account edit logic in `AdminPanel.tsx` and `src/lib/firebase.ts`: Editing an account's username now preserves the unique account ID (`userId`) and purges the old username key document/row from Firestore and Supabase, preventing duplicate user accounts.
  - Added `deduplicateUsers` utility in `src/lib/firebase.ts` to guarantee unique user account mapping across real-time subscriptions and database fetches.

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
