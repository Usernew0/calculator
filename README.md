# Elegant FX — Global Landed Cost & Profit Calculator

Elegant FX is a full-stack, enterprise-grade Freight Landed Cost & Profit Margin Analysis web application designed for global trade, importers, exporters, and logistics managers.

---

## 🌟 Key Features

### 1. Landed Cost & Profit Calculator
- **Trade Operation Selection**: Choose between **Import** (استيراد) and **Export** (تصدير) shipment operations with saved history, filtering, and report badging.
- **Dual-Mode Input Synchronization (Unit vs. Total)**:
  - **Purchase Price**: Input Unit FOB Cost (per piece) OR Total Batch Purchase Cost.
  - **Cargo Weight**: Input Gross Weight per Piece OR Total Gross Batch Weight with auto-conversion for `kg`, `g`, `lbs`, and `tonnes`.
  - **Target Selling Price & Revenue**: Input Target Unit Selling Price OR Total Expected Revenue turnover.
  - Changing any unit or total parameter dynamically calculates the other in real-time based on quantity.
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
- **Consolidated Multi-History Financial & Profit Analysis Engine**:
  - **Multi-Selection Across Trade Types**: Select multiple historical calculation records (both Import and Export) and analyze their aggregated financials in depth.
  - **Live Mini Financial Preview Strip**: Shows real-time Total Landed Cost, Combined Net Profit, Weighted Margin %, and Import vs. Export counts directly in the multi-select bar.
  - **Reshaped, Crystal-Clear Multi-History Analysis Modal (`MultiHistoryAnalysisModal.tsx`)**:
    - **Plain-Language Executive Summary Box**: Human-readable narrative detailing total shipment count, gross landed cost, projected revenue, net profit, margin %, and ROI % in simple terms.
    - **4 Executive KPI Metrics**: Combined Total Landed Cost, Total Projected Revenue, Total Net Profit, and Weighted Profit Margin (%) with ROI on Cost (%).
    - **Step-by-Step Financial Equation Flow**: Interactive 6-step money flow pipeline: `FOB Purchase` + `Freight` + `Customs & Taxes` + `Handling & Fees` = `Landed Cost` ➔ `Net Profit`.
    - **Comparative Trade Direction Analytics**: Side-by-side breakdown comparing Import Operations vs. Export Operations (Landed Cost, Duties/Tax, Freight, Revenue, Net Profit, Average Margins).
    - **Multi-Currency Real-Time Unification**: Select any target display currency (USD, EGP, EUR, SAR, AED, RMB) with real-time rate matrix conversions.
    - **Interactive Recharts Visualizations**: Donut/Pie Chart for consolidated cost composition, grouped Bar Chart comparing Landed Cost, Revenue, and Net Profit, and logistics mode breakdown.
    - **Smart Insights & Profitability Health**: Automatic margin health classification (Excellent / Healthy / Low Margin alert), star performer identifier, customs duty impact metric, and actionable logistics optimization tips.
    - **Itemized Selected Records Table & Search**: Detailed listing with instant title/SKU search, Trade Direction badges, Freight Mode, Quantities, Landed Cost, Revenue, Net Profit, Margin %, and direct "Load in Calculator" / "Inspect Detail" actions.
    - **Consolidated Exports**: 1-click compilation to Multi-Shipment Summary PDF (`exportHistoricalSummaryPDF`), structured CSV spreadsheet, and unified commercial Client Quote (`ClientQuoteModal`).
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

### 4. Air Freight & Flight Consignment Manifest Management (With P&L Analysis & AI PDF Parser)
- **Air Freight & Flight Consignment Manifest Management (With P&L Analysis & AI PDF Parser)**:
  - **Round-Trip (Departure & Return) Flight Routing**: Full support for both **One-Way** (`one_way`) and **Round-Trip** (`round_trip`) flights, storing departure origin/destination airports and return origin/destination airports, flight numbers, and dates.
  - **Flight Ticket Price vs. Cargo Freight Distinction**: Explicitly supports entering and recording **Flight Passenger Ticket Price** (`flightTicketPrice` and `flightTicketCurrency`) separately from cargo handling and air freight logistics fees, providing crystal-clear transparency for business travelers, couriers, and cargo consolidations.
  - **Flight Consignment Manifest Subsystem (`FlightConsignmentModal.tsx` & `DashboardView.tsx`)**: Group multiple historical calculation records under specific flight numbers, dates, airlines, and Master Air Waybills (MAWB).
  - **Physical Weight & Cargo Consolidation Engine (`calculator.ts`)**:
    - Automatically calculates and sums **Gross Weight (KG)**, **Chargeable Weight (KG)**, **Volumetric CBM**, and **Total Packages/Pieces** across all linked products with unit normalizations (`kg`, `g`, `lb`, `ton`).
    - Flight cards, KPI overview summary cards, itemized cargo tables, and PDF manifest exports derive weights seamlessly with intelligent fallback for both new and existing flight records.
  - **Flight Profit & Loss (P&L) Engine**:
    - Automatically consolidates total landed cost, total projected revenue, and net profit/loss for all products linked to a flight.
    - Highlights profitable flights with emerald badges (`+ Net Profit`) and deficit flights with rose badges (`- Net Loss`), complete with margin % and ROI %.
    - Expandable **Itemized Cargo Breakdown Accordion** displays product images, quantities, individual item weights (KG), landed costs, revenues, individual profit contributions, and an instant **Unlink** button with real-time recalculation.
  - **Bulk Action & Single-Row Linking**:
    - Select multiple items in the History Table and click "Consolidate Flight" in the bulk toolbar.
    - Click the flight icon on any individual table row or mobile card to link or inspect its flight consignment.
  - **Dual Subtab Dashboard**: Switch seamlessly between "Calculation Records" and "Flight Consignments (Air Manifests)" with real-time KPI metrics (Total Flights, Gross Weight in KG, Volume in CBM, Landed Cost in EGP, and Combined Projected Profit).
  - **Flight Route & Manifest Badges**: Calculation records display dynamic flight badges (e.g. `✈️ MS-789 (CAN ⇄ CAI)`) linking each product calculation directly to its flight manifest.
  - **Gemini AI Flight Manifest & Ticket PDF Extraction (`/api/parse-flight-manifest`)**:
    - Automatically parses round-trip flight itineraries, return flight numbers, return dates, passenger ticket fares, carrier airlines, origin & destination airports/countries, Master AWB numbers, gross weights, volumes, and freight rates directly from uploaded PDF documents using Google Gemini multimodal intelligence with resilient fallback models.
    - **Manual Entry Fallback**: If an AI key is not configured or if manual entry is preferred, users can type or adjust all flight manifest fields manually with live consolidated metrics.
  - **Official Air Cargo Manifest PDF Export (`exportFlightManifestPDF`)**: Export high-resolution branded Air Cargo Manifest documents for airlines and customs authorities with comprehensive product line items, weights, commercial metrics, and ticket fare data.

---

### 5. Product & Cargo Image Gallery & Edit Controls
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

### 4. Trade Gallery & Invoice Media Assets
- **Automatic Invoice Image Extraction**: Cargo invoice images uploaded during calculation input (`invoiceImage`) are automatically indexed and synchronized to the `gallery_images` table via PostgreSQL triggers and foreign keys (`ON DELETE CASCADE`).
- **Dynamic Relational SQL View**: `v_calculation_gallery_images` provides real-time virtual projection of all calculations containing invoice images without manual duplicate writes.
- **Interactive Cargo Media Viewer**: Filter images by SKU, supplier, trade direction, and category with zoom preview, high-res download, and linked calculation inspection.

---

### 5. Session Security & Real-Time Credential Synchronization
- **Session Inactivity Timeout in Firestore `site_settings`**: Inactivity timeout settings (5m, 15m, 30m, 60m, 120m) are centralized and persisted directly in Firestore (`site_settings/security` & `site_settings/session_timeout`), ensuring unified timeout security across devices. Changes propagate to all active client sessions in real time via Firestore snapshot listeners without requiring page reloads.
- **Real-Time Active Session Credential Auto-Refresh**: User sessions continuously synchronize with the database. If an administrator edits a user's status (`active` vs `suspended`) or updates their password, the user's active session is invalidated immediately in real-time, prompting them to re-authenticate with their new credentials.
- **Cryptographic Password Signatures (`pv`) in JWT**: Every JWT token embeds a SHA-256 password signature. Password changes instantly cause the signature to mismatch on the backend gatekeeper (`requireAuth`), rejecting previous tokens with `CREDENTIALS_CHANGED`.
- **Sub-Second Push Invalidation**: Firestore real-time snapshots (`subscribeToUserSessionStatus`) and periodic auto-refresh heartbeats guarantee immediate session termination across all tabs and devices when an administrator updates or deletes an account.
- **Session Token & User Profile Isolation**: Full architectural separation between session token persistence (`cargo_session_token`) and user metadata (`cargo_user_profile`), guaranteeing admin credentials are never overwritten when editing user accounts.
- **Bilingual Security Notice Banners**: Informative Arabic and English security alerts on the login screen explaining precisely why a session ended and guiding the user to sign in with updated credentials.

---

### 6. Admin Control Panel & Website Settings
- **Deterministic & Permanent User IDs**:
  - **Zero-Mutation User ID Stability**: User identifiers (`userId`, e.g. `USR-EBRAHIM` or permanent sequence IDs) are strictly immutable and protected against regeneration. Opening the edit modal or updating account status (including suspension or reactivation) preserves the user's canonical ID without re-rolling random numbers.
- **Zero-Wipe Password Preservation**:
  - **Strict Credential Protection on 2FA & Status Toggles**: User passwords are never overwritten, wiped, or replaced with empty strings during 2FA activation, 2FA reset, or account status updates (active ↔ suspended). Database write layers in Firestore and Supabase guard against empty password payloads, retaining existing hashes securely.
- **User Profile Settings & Username Migration Engine**:
  - **Comprehensive Form Inputs**: Authenticated users can modify their Username, Full Name, Email Address, Phone Number, Company Name, and Passwords with immediate feedback.
  - **Atomic Username Key Migration**: Changing the username validates uniqueness, purges the old record from Supabase and Firestore, creates the new record, migrates linked calculations to the new username, updates the in-memory cache, and re-issues a signed session token.
  - **Dual Database Persistence**: All profile inputs save simultaneously to Supabase and Firestore with resilient local fallback.
  - **Non-Disruptive Session Updating**: Seamlessly updates active browser session tokens and stored profiles without logging the user out.
- **TOTP 2FA Enterprise Protection & Self-Profile Enablement**:
  - **Zero-Reset 2FA Preservation on Suspension & Updates**: Suspending, activating, or modifying any user account attributes strictly preserves the user's Two-Factor Authentication secret, confirmation status, and emergency backup recovery codes across all database tiers.
  - **User Profile 2FA Enablement**: Users can enable TOTP Two-Factor Authentication directly from their Profile Settings modal (`LoginModal.tsx`) using QR code scanning, 6-digit TOTP verification, or 1-click instant activation with emergency backup recovery codes.
  - **Dual Database Persistence**: 2FA status and credentials write simultaneously to Supabase (`users.two_factor_enabled` column & `profile_data` JSONB) and Firestore (`twoFactorEnabled`, `twoFactorSecret`, `twoFactorBackupCodes`, `twoFactorConfirmedAt`), ensuring full cross-device synchronization and zero data loss on profile edits.
  - **Quick Header 2FA Status & Action**: Live badge in the admin navigation header displaying the admin account's current 2FA status with 1-click toggle action to configure or disable 2FA.
  - **User & Admin Table 2FA Actions**: Manage, enable (with QR code and manual key setup), disable, or reset 2FA directly per user/admin row in the User Accounts table.
  - **Interactive 2FA Modal**: Features QR Code scanning, manual Base32 key copying, and 6 single-use emergency backup recovery codes with 1-click clipboard actions.
- **Dual Identifier Authentication (`Username OR Email + Password`)**:
  - Seamless login using either username or email address across Supabase and Firestore repositories.
  - Hardened authentication flow ensuring zero session issuance before successful 6-digit TOTP verification if 2FA is active.
- **Session Inactivity & Security Policy Card**: Administrators can configure and customize the global inactivity timeout with preset duration chips (5m High Security, 15m Default, 30m Standard, 60m 1-Hour, 120m 2-Hours) and custom numeric/slider inputs, saving directly to Firestore `site_settings`.
- **Website Favicon & Branding Management**: System administrators can set and publish custom website favicons (`favicon.ico` / `<link rel="icon">`) that display in browser tabs, mobile web shortcuts, and bookmarks for all site visitors.
- **5 High-Resolution SVG Presets**: Built-in SVG favicon presets (Golden Freight Ship, Global Trade Network, Emerald Logistics Box, Express Lightning Trade, Gold Shield Security).
- **Custom Image Upload**: Support uploading `.ico`, `.png`, `.svg`, `.jpg`, `.webp` images with auto HTML5 canvas downscaling to 64x64 Data-URIs.
- **External URL Input & Live Mockup**: Enter custom image URLs and preview the tab icon in a simulated live browser header mockup before publishing.
- **Firestore & Supabase Real-Time Sync**: Favicon updates publish instantly to Firestore (`site_settings/branding`), Supabase (`site_settings`), and `localStorage`.
- **User Account Management**: Full management of user accounts, password resets, role permissions, and dual database diagnostics (Firestore & Supabase).
- **Google Gemini AI API Key Management**: Administrative controls to input, test, and activate custom Gemini API keys for AI Flight Manifest extraction, Commercial Invoice OCR, and HS Code recommendation with live latency testing and dual-write persistence.

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

## 🔒 Security Architecture (Vite Frontend → Express API Backend → Database)

The application implements a secure 3-tier full-stack architecture:

1. **Client Tier (Vite Single Page App)**:
   - Zero database credentials or private service keys exposed in client bundles.
   - **Self-Service Password Reset**: Recover account credentials right from the login screen via **SMS Phone OTP** (with real-time countdown & resend) or **2FA Security Codes** (TOTP Authenticator & Backup Codes).
   - **Two-Factor Authentication (TOTP - RFC 6238)**: Two-step authentication handshake with segmented 6-digit TOTP input, QR code scanning, single-use emergency backup recovery codes, and profile security management.
   - **Isolated Storage Keys & Self-Healing Tokens (`src/lib/session.ts`)**: Session token (`cargo_session_token`) is stored in a dedicated key separate from the user profile metadata (`cargo_user_profile`), with automatic client fallback token restoration for continuous authenticated profile edits and username migrations.
   - **Admin Session Isolation**: Modifying, creating, or toggling user accounts in the Admin Panel strictly safeguards the active administrator's session credentials.
   - All authenticated requests pass JWT tokens in `Authorization: Bearer <token>` headers.
   - Communicates exclusively through secure `/api/*` endpoints.

2. **API Backend Tier (Express Server - `server.ts`)**:
   - Centralized authentication & authorization with HMAC-SHA256 JWT tokens (7-day duration, supports client fallback tokens), PBKDF2 password hashing with salt, and TOTP verification (`/api/auth/2fa/*`).
   - Global Express error handling middleware and safe request body parsing to catch all potential unhandled exceptions and prevent raw 500 HTML responses.
   - Resilient database fallbacks: automatically returns server-side in-memory data if external relational services experience transient connectivity issues.
   - Temporary in-memory pending challenge store (`twoFactorPendingStore`) with 5-minute expiry window for 2FA validation handshakes.
   - Security Headers via Middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`.
   - Rate Limiting: General API rate limit (500 req/1min) and generous login rate limit (60 req/1min).
   - Server-side input validation and parameter sanitization to mitigate SQL/NoSQL Injection & XSS.

3. **Database Tier (Multi-Cloud Real-Time Separation: Cloud Firestore + Supabase PostgreSQL)**:
   - **Google Cloud Firestore (Real-Time)**:
     - **Active Sessions & User Security**: Streams live session heartbeats (`subscribeToUserSessionStatus`) and real-time inactivity timeout policy (`subscribeToSessionTimeout`).
     - **Branding & Site Favicon**: Dynamic real-time favicon & visual branding synchronization (`subscribeToSiteFavicon`).
     - **AI Configuration**: Live Gemini API key and prompt config distribution (`subscribeToAiKey`).
     - **Two-Factor Authentication (2FA)**: High-security TOTP secrets, single-use emergency backup codes, and pairing states.
     - **User Accounts & Roles**: Real-time user directory, credentials, roles, and status enforcement (`subscribeToUsers`).
   - **Supabase PostgreSQL (Real-Time)**:
     - **Calculations**: Real-time landed cost calculation records (`calculations` table), margin breakdowns, and multi-history analytics streamed via Postgres Realtime channels (`subscribeToCalculationsSupabase`).
     - **Flight Consignments & Tickets**: Real-time flight manifests, one-way/round-trip itineraries, passenger ticket fares (`flightTicketPrice` and `flightTicketCurrency`), MAWBs, and cargo links streamed via Postgres Realtime channels (`subscribeToFlightConsignmentsSupabase`).
     - **Cargo Media & Gallery**: Relational media asset storage (`gallery_images` table) with automated triggers on invoice photo uploads.
     - **Quotes & Transactional Data**: Client quotes, exports, and batch data.

---

## 🛠️ Getting Started & Production Deployment

### Prerequisites
- Node.js 18+
- Environment variables configured in `.env` (refer to `.env.example`)

### Environment Setup
Create a `.env` file from `.env.example`:
```env
JWT_SECRET="YOUR_SECURE_RANDOM_SECRET_KEY"
SUPABASE_URL="https://YOUR_SUPABASE_PROJECT_ID.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
```

### Installation & Build Commands
```bash
# Install dependencies
npm install

# Start development server (Express + Vite on Port 3000)
npm run dev

# Run TypeScript Lint & Type Verification
npm run lint

# Build for production (Vite client + esbuild CommonJS server bundle)
npm run build

# Run production server
npm start
```

---

## 🛡️ Edge-Case & Full-System Reliability Matrix

| Scenario | Local & Development | Live Production | Fail-Safe Behavior |
| :--- | :--- | :--- | :--- |
| **Backend Express Offline / Cold-Start** | Auto-detected by `apiFetch` in `src/lib/api.ts` | Gracefully falls back to direct client-side Firestore Web SDK | Zero user disruption; profile updates and 2FA changes save directly to Firestore |
| **Firestore Disconnected / Offline** | Fallback to `localStorage` | Fallback to `localStorage` + in-memory state | User can calculate landed costs, plan pricing, and export PDFs offline |
| **2FA Verification with Clock Drift** | Validates $\pm 30\text{s}$ time window | Validates $\pm 30\text{s}$ time window | Logins succeed even if mobile phone clock has slight drift |
| **Emergency Backup Recovery Codes** | Sanitized via `normalizeSecurityCode` (`[\s\-_—–]`) | Multi-source lookup across challenge store, Supabase, and Firestore | Ignores hyphens, spaces, and case differences; consumes code on use |
| **2FA Disable / Reset Engine** | Atomic `deleteField()` in Firestore & Supabase nullify | Synchronized across in-memory store and database rows | Eliminates `undefined` payload errors and refreshes UI state immediately |
| **Backup Code Regeneration** | Instant client-side & API `/api/auth/2fa/backup-codes/regenerate` | Real-time dual write to Supabase & Firestore | Produces 8 fresh alphanumeric keys with 1-click clipboard copy |
| **Iframe Preview Sandbox** | Replaces native `window.confirm` with in-app React modals | Full screen or embedded iframe compatible | Buttons and actions trigger reliably without browser security suppression |
| **High-Resolution Camera Uploads** | Compressed via HTML5 Canvas | Compressed via HTML5 Canvas | Downscales 15MB+ camera photos to ~150KB JPEGs to prevent storage quota limits |
| **Profile Update & Username Conflicts** | Cross-checks multi-identifier sets (`userId`, `username`, `id`, `oldUsername`) | Dual verification in `/api/auth/profile` and client fallback | Eliminates false-positive collision alerts; cleanly purges old aliases on actual rename |
| **Vercel Production CORS & Preflight (`/api/*`)** | Handles cross-origin requests & preflight OPTIONS | Returns 204 with complete CORS access headers | Eliminates 405/401 CORS blocking on production serverless endpoints |
| **Multi-Format Client Tokens (`client_USR-*` / `client_username_*`)** | Auto-detected & parsed in `requireAuth` | Resolves via `fetchUserFromStoreOrDb` | Guarantees seamless session continuity even if user ID or username is used as token identifier |

---

*Elegant FX — Empowering global trade with precise landed cost insights and secure cloud infrastructure.*
