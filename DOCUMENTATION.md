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

## 🛡️ Database & Persistent Storage Architecture

Elegant FX implements a dual-engine persistent storage architecture separating concerns between identity security and analytical data:

1. **Google Cloud Firestore (Auth, Identity & Security Hub)**:
   - **User Accounts & Credentials (`users` collection)**: Secure password hash signatures, user roles (`admin` / `user`), account statuses (`active` / `suspended`), and metadata.
   - **Real-Time Session Invalidation**: Sub-second snapshot listeners (`subscribeToUserSessionStatus`) to instantly terminate compromised or modified sessions across clients.
   - **Site Settings & Inactivity Policy (`site_settings` collection)**: Global session inactivity timeout configuration (`site_settings/security` & `site_settings/session_timeout`) and custom branding favicon assets.

2. **Supabase PostgreSQL (Calculations, Relational Financials & Media Store)**:
   - **Trade Calculations (`calculations` table)**: Structured relational landed cost calculations, currency rates, itemized freight breakdown, customs duties, and pricing strategies.
   - **Product & Cargo Gallery Media (`gallery_images` table)**: Product images, invoice captures, and media assets linked via foreign key `calculation_id` to calculations, indexed by `user_id`, `sku`, and `created_at`.
   - **Row Level Security (RLS)**: Fine-grained access control on all relational tables with instant health verification endpoints.

---

## 🔐 TOTP Two-Factor Authentication (2FA) Architecture

Elegant FX incorporates an enterprise-grade **Time-Based One-Time Password (TOTP, RFC 6238)** two-factor authentication engine securing user logins, admin access, and credential modifications.

### 1. Architectural Highlights & Security Protocol
- **RFC 6238 Standard Compliance**: Supports all standard authenticator applications (Google Authenticator, Microsoft Authenticator, Authy, 1Password, Apple Passwords).
- **HMAC-SHA1 & Base32 Engine (`src/lib/totp.ts`)**: Generates 160-bit cryptographically secure Base32 secrets (`JBSWY3DPEHPK3PXP...`), computes HMAC-SHA1 30-second time-step windows, and verifies 6-digit one-time codes with $\pm 1$ time-step ($\pm 30\text{s}$) clock drift tolerance.
- **Visual QR Code Setup**: Automatically renders client-ready QR codes via the `qrcode` library using standard `otpauth://totp/ElegantFX:user@company.com?secret=...&issuer=ElegantFX&algorithm=SHA1&digits=6&period=30` URIs.
- **Single-Use Emergency Backup Recovery Codes**: Generates 8 cryptographic 8-character single-use alphanumeric backup codes (`XXXX-XXXX`) allowing account recovery if an authentication device is unavailable or lost.
- **Two-Step Login Handshake (`LoginScreen.tsx`, `server.ts`)**:
  1. **Step 1 (Credential Validation)**: Submits `Username OR Email` and password. If credentials match and 2FA is enabled, the backend creates a temporary pending challenge token (`challengeId`) valid for 5 minutes and returns `{ requires2FA: true, challengeId, userMasked }`.
  2. **Step 2 (TOTP Verification)**: The client presents the dedicated `TwoFactorAuthStep` screen where the user enters their 6-digit TOTP code or an 8-character emergency backup recovery code. The backend validates the code and issues the full authentication session.
- **Admin Self-Service 2FA Management (`AdminPanel.tsx`)**:
  - **Quick Header 2FA Status & Action**: Live badge in the admin navigation header displaying the admin account's current 2FA status with 1-click toggle action to configure or disable 2FA.
  - **Dedicated Admin Security & 2FA Card**: Comprehensive control card in the Admin Panel explaining security benefits, showing active status, offering 1-click enable/disable, and reconfiguring QR codes.
  - **Multi-Tab 2FA Setup Modal**: Seamless 3-tab modal for administrators with dynamic QR code scanning, manual Base32 key copying, and emergency recovery codes backup.
- **User Profile Management (`LoginModal.tsx`)**: Logged-in users can view their 2FA protection status, initiate 2FA activation (scan QR code, copy secret, verify test code), regenerate emergency recovery codes, or disable 2FA.
- **Administrator Safety Override (`AdminPanel.tsx`)**: System administrators can view 2FA status across all accounts in the User Management table and execute a secure "Reset 2FA" action to assist locked-out employees.

---

## 📝 Modification & Update Log (Auto-Updated)

- **2026-08-24**:
  - **Streamlined 2FA Management in Admin Panel (`AdminPanel.tsx`)**:
    - Removed the redundant Admin 2FA Security card to eliminate visual clutter and ensure unified workflow.
    - Full 2FA lifecycle (enable, QR code setup, manual key, backup codes, disable, reset) is streamlined directly from the **User Accounts Table** for all accounts (both admin and users) and via the top-bar status toggle.
  - **Consolidated Session Inactivity Timeout Control (`AdminPanel.tsx`)**:
    - Unified duplicate session timeout cards into a single comprehensive **Session Inactivity & Auto-Logout Security Policy** control card in the Admin Panel.
    - Features 5 recommended preset chips (5m High Security, 15m Default, 30m Standard, 60m 1-Hour, 120m 2-Hours), an interactive slider and numeric duration input up to 180 minutes, and direct Firestore `site_settings` synchronization.
  - **Administrator 2FA Self-Service Management & Security Card (`AdminPanel.tsx`, `server.ts`, `Header.tsx`)**:
    - Built comprehensive **Admin 2FA Enable/Disable & Security Suite** directly in `AdminPanel.tsx`:
      - **Header 2FA Quick Status Button**: Visual indicator with 1-click trigger to manage or toggle 2FA.
      - **Admin Security & 2FA Management Card**: Dedicated control module showcasing active protection status, universal TOTP RFC 6238 compatibility, and 1-click setup / disable buttons.
      - **Interactive 2FA Modal**: Features QR Code scanning, manual Base32 key copying, and 6 single-use emergency backup recovery codes with 1-click clipboard actions.
      - **Table Action Enhancements**: 2FA column in the user table allows the admin to configure or reset 2FA directly per row.
    - Updated `/api/auth/2fa/disable` endpoint in `server.ts` to allow active authenticated sessions to disable their own 2FA cleanly without re-prompting.
  - **Dual Identifier Login (`Username OR Email + Password`)**:
    - Updated `LoginScreen.tsx`, `translations.ts`, and `/api/auth/login` to seamlessly accept either username or email address across Supabase and Firestore repositories.
    - Zero session premature granting: authentications with 2FA enabled require successful TOTP code or backup code verification before JWT token issuance.

- **2026-08-23**:
  - **TOTP Two-Factor Authentication (2FA) Enterprise Engine (`totp.ts`, `server.ts`, `api.ts`, `LoginScreen.tsx`, `TwoFactorAuthStep.tsx`, `LoginModal.tsx`, `AdminPanel.tsx`, `translations.ts`)**:
    - Implemented full RFC 6238 TOTP cryptographic suite (`generateTotpSecret`, `generateTotpCode`, `verifyTotpCode`, `generateOtpAuthUri`, `generateQrCodeDataUrl`, `generateBackupCodes`).
    - Added Express backend 2FA endpoints (`/api/auth/2fa/setup`, `/api/auth/2fa/enable`, `/api/auth/2fa/verify`, `/api/auth/2fa/disable`, `/api/auth/2fa/regenerate-backup`) with in-memory challenge store (`twoFactorPendingStore`) and Firestore synchronization.
    - Built dedicated `TwoFactorAuthStep` UI component featuring 6-digit segmented inputs, backup recovery code mode, QR code setup for first-time activation, secret copying, and error state transitions.
    - Integrated 2FA activation, QR code scanning, and emergency backup codes generator into `LoginModal.tsx` for self-service profile security management.
    - Added 2FA status badge and "Reset & Disable 2FA" administrative action to the User Management table in `AdminPanel.tsx`.
    - Added `sec_totp_2fa` diagnostic test module to the Automated System Test Suite in `AdminPanel.tsx`.
  - **Comprehensive Weight Column Integration & PDF Export Upgrades (`DashboardView.tsx`, `pdfExport.ts`, `quotePdfExport.ts`, `translations.ts`)**:
    - Added dedicated Weight column to the desktop history table (`colWeight`, `thWeight`) and a 5-metric grid to mobile calculation cards displaying exact gross weight in kg and unit specifications.
    - Added weight sorting (`weight_desc` and `weight_asc`) in the history table filter toolbar.
    - Added "Gross Weight (kg)" and "Chargeable Weight (kg)" to exported CSV columns.
    - Updated `exportSingleCalculationPDF`, `exportHistoricalSummaryPDF`, `exportFlightManifestPDF`, and `exportQuotationPDF` with total gross weight, chargeable weight, and volumetric CBM.

- **2026-08-21**:
  - **Air Freight & Flight Consignment Manifest Management System (`FlightConsignmentModal.tsx` & `DashboardView.tsx`)**:
    - Introduced a dedicated **Flight Consignments (Air Manifests)** subsystem enabling logistics traders to group multiple historical calculation records under specific flight numbers, dates, airlines, and Master Air Waybills (MAWB).
    - **Dual Subtab Architecture**: Added toggleable subtabs ("Calculation Records" vs. "Flight Consignments") in `DashboardView.tsx` with dedicated KPI cards for Total Flights, Total Gross Weight, Total Volume (CBM), Total Landed Cost, and Combined Projected Profit.
    - **Flight-to-Calculation Linking**: Added reactive flight badges across calculation record cards and tables for instant origin-to-destination route visibility (e.g., `✈️ MS-789 (CAN → CAI)`).
    - **Official Air Cargo Manifest PDF Export**: Created high-resolution branded Air Manifest PDF compilation via `exportFlightManifestPDF` complete with carrier details, flight route, itemized cargo manifest table, weights, CBM, and financial totals.
    - **Gemini 2.5 AI Flight Manifest PDF Extraction & Fallback Parser**:
      - Backend endpoint `POST /api/parse-flight-manifest` leverages Gemini 2.5 Flash with structured JSON schema extraction to parse flight numbers, airline carriers, origin/destination airports, AWB numbers, gross weights, volumes, and freight rates directly from uploaded PDF manifests or air waybills.
      - Seamless UI fallback in `FlightConsignmentModal.tsx` allowing freight managers to either upload a PDF for automated 1-click parsing or manually type/modify all flight manifest fields with live consolidation metrics.
  - **Dynamic Automated Test Suite Categories Engine in Admin Panel (`AdminPanel.tsx`)**:
    - Replaced hardcoded category counts with dynamic real-time computation directly derived from the `testSuite` state array.
    - Added reactive category filtering tabs and badges (`All Tests`, `Math & Formulas`, `Database & Sync`, `UI & Modals`, `Security & Session`, `Flight & Cargo`, `AI & Intelligence`) that automatically update counts and labels whenever tests are executed or dynamically loaded.
  - **Consolidated Multi-History Financial & Profit Analysis Engine (`MultiHistoryAnalysisModal.tsx` & `DashboardView.tsx`)**:
    - Built a comprehensive multi-item selection and financial aggregation engine allowing users to select multiple historical calculation records (both Import and Export) and analyze combined financials in depth.
    - Added a live **Mini Financial Preview Strip** in the multi-select action bar of `DashboardView.tsx` displaying real-time Total Landed Cost, Combined Net Profit, Weighted Margin %, and Import vs. Export count distribution.
    - **Reshaped, Crystal-Clear Multi-History Analysis Modal (`MultiHistoryAnalysisModal.tsx`)**:
      - **Plain-Language Executive Summary Box**: Human-readable narrative detailing total shipment count, gross landed cost, projected revenue, net profit, margin %, and ROI % in simple Arabic and English terms.
      - **4 Executive High-Contrast KPI Cards**: Total Landed Cost, Gross Projected Sales, Combined Net Profit (with ROI on cost), and Weighted Margin %.
      - **Step-by-Step Financial Equation Flow**: Interactive 6-step money flow pipeline: `FOB Purchase` + `Freight` + `Customs & Taxes` + `Handling & Fees` = `Landed Cost` ➔ `Net Profit`.
      - **Side-by-Side Trade Direction Comparisons**: Isolated Import Operations vs. Export Operations cards.
      - **Multi-Currency Real-Time Unification**: Instant matrix conversion to USD, EGP, EUR, SAR, AED, RMB.
      - **Cost Breakdown & Interactive Recharts Visualizations**: Donut chart for expense distribution, grouped bar chart for sales vs. cost vs. profit, and logistics freight method breakdown.
      - **Smart Insights & Profitability Health**: Automatic margin health classification (Excellent / Healthy / Low Margin alert), star performer identifier (top margin product), customs duty impact metric, and actionable logistics optimization tips.
      - **Itemized Audit Table & Search**: Searchable table with SKU, trade direction, freight method, volume, unit cost, revenue, profit, margin %, and 1-click "Inspect" and "Load in Calculator" actions.
      - **Consolidated Exports**: 1-click PDF summary compilation, CSV spreadsheet export, and unified commercial Client Offer generation.
  - **Automated Calculation Invoice Image Synchronization in Supabase SQL Schema**:
    - Enhanced `/schema.sql` and `src/lib/supabase.ts` with a dedicated PostgreSQL Trigger `trg_sync_calculation_invoice_image` and function `sync_calculation_invoice_image()`.
    - Automatically extracts `invoiceImage`, product title, supplier SKU, trade category, and trade direction directly from the calculation's JSONB document upon INSERT/UPDATE and syncs into `gallery_images`.
    - Configured `calculation_id TEXT REFERENCES public.calculations(id) ON DELETE CASCADE` ensuring zero-maintenance cascading cleanup when calculations are deleted.
    - Added the relational PostgreSQL view `v_calculation_gallery_images` providing a virtual real-time projection of all calculations containing cargo invoice images.
  - **Dual Engine Architecture Realization (Firestore + Supabase)**:
    - Formalized strict architectural separation: **Firestore** handles authentication, security credentials, real-time session invalidation, and site settings; **Supabase** handles calculation records, landed cost data, and the `gallery_images` media store.
    - Updated `/schema.sql` and `SUPABASE_REQUIRED_DDL_SQL` in `src/lib/supabase.ts` with the new `gallery_images` table, indexes on `calculation_id`, `user_id`, and `sku`, and RLS policies.
    - Added gallery image synchronization and REST API endpoints (`GET /api/gallery`, `POST /api/gallery`, `DELETE /api/gallery/:id`) in `server.ts` and client helper functions in `src/lib/api.ts` & `src/lib/supabase.ts`.
    - Integrated gallery image count and health verification in `/api/supabase-health` and updated the Admin Panel Database diagnostic card in `AdminPanel.tsx`.
  - **Session Inactivity Timeout in Firestore `site_settings` Collection**:
    - Centralized and persisted the session inactivity timeout setting in the `site_settings` collection (`site_settings/security` & `site_settings/session_timeout` documents) in Firestore, replacing isolated browser local storage.
    - Implemented Firestore helpers `saveSessionTimeoutToFirestore`, `getSessionTimeoutFromFirestore`, and `subscribeToSessionTimeout` in `src/lib/firebase.ts`.
    - Added backend API endpoints `GET /api/settings/session-timeout` and `POST /api/settings/session-timeout` (Admin-only) with validation in `server.ts` and API helpers in `src/lib/api.ts`.
    - Created a dedicated, interactive "Session Inactivity & Auto-Logout Security Policy" card in `src/components/AdminPanel.tsx` with preset durations (5m, 15m, 30m, 60m, 120m), range slider, numeric input, and real-time Firestore persistence.
    - Added real-time subscription in `src/App.tsx` via `subscribeToSessionTimeout` to update active session inactivity timers across all client sessions without requiring a page refresh.
    - Added comprehensive unit and integration test suite (`tests/suite.test.ts`) covering session inactivity timeout APIs, authorization checks, range validation, and Admin updates.
  - **Instant Real-Time Password Change Auto-Logout Enforcer**:
    - **Firestore Real-Time Snapshot Listener (`src/lib/firebase.ts`)**: Upgraded `subscribeToUserSessionStatus` to monitor active session password signatures and changes in real time. If an administrator modifies a user's password in the database or Admin Panel, the Firestore real-time snapshot fires within milliseconds and broadcasts `credentials_changed`.
    - **Proactive Multi-Tier Invalidation Guard (`src/App.tsx`)**: Wired `CREDENTIALS_CHANGED` event handler into the active session manager, a 5-second periodic database heartbeat, and window visibility/focus hooks. When a user's credentials diverge from the database, the user session is terminated immediately.
    - **Bilingual Notification Banner (`src/components/LoginScreen.tsx`)**: Clears the session, resets state, and redirects the user to the login screen with an informative banner in Arabic ("تم تحديث كلمة المرور من قبل مدير النظام. يرجى تسجيل الدخول بكلمة المرور الجديدة") and English ("Your password was updated by the administrator. Please log in with your new password").
  - **Production Deployment & Serverless Platform Compatibility (Vercel / Cloud Run)**:
    - **Vercel Serverless Function Entry Point (`/api/index.ts` & `vercel.json`)**: Configured Vercel routing rules and serverless function exporter so that all `/api/*` endpoints (Exchange Rates, Authentication, User Management, Calculations, and Site Branding) are handled seamlessly by serverless functions on Vercel deployments.
    - **Resilient Multi-Tier API Fallbacks (`src/lib/api.ts`)**: Enhanced client-side API helper with automatic fallback to Firestore and Supabase direct connections if server routes return 404 or are temporarily unreachable, ensuring 100% feature availability across all deployment targets.
    - **Firebase Anonymous Auth Guarding (`src/lib/firebase.ts`)**: Resolved `auth/admin-restricted-operation` 400 Bad Request error by adding an authentication attempt guard. If Anonymous Auth is disabled in the Firebase project console, the system cleanly operates in unauthenticated Firestore mode without spamming Google Identity API or blocking database subscriptions.
    - **Static Favicon & Public Assets (`/public/favicon.ico` & `/public/favicon.svg`)**: Created public favicon assets in `/public` directory resolving 404 Not Found asset requests across browser tabs and production URLs.
  - **Real-Time Active Session Credential & Account Status Synchronization**:
    - **Password Signature Hashing (`pv`) in JWT Payload**: Added SHA-256 password hash signatures into issued JWT tokens. If an administrator modifies a user's password in the database or Admin Panel, the stored signature diverges from the token payload, rendering existing tokens invalid immediately.
    - **Active Session Gatekeeping (`requireAuth` Middleware in `server.ts`)**: Every authenticated API request validates the user's status (`active` vs `suspended`), existence in the database, and cryptographic password signature. Returns `401 Unauthorized` with `code: 'CREDENTIALS_CHANGED'` or `403 Forbidden` with `code: 'ACCOUNT_SUSPENDED'`.
    - **Client-Side Invalidation Interceptor (`src/lib/api.ts` & `src/lib/session.ts`)**: Built an API interceptor and pub/sub event broadcaster (`onSessionInvalidated` / `triggerSessionInvalidation`) that automatically logs out users, clears stored tokens, and stores bilingual security notices whenever credential invalidation is detected.
    - **Real-Time Firestore Listener & Auto-Refresh Heartbeat (`src/App.tsx` & `src/lib/firebase.ts`)**: Added `subscribeToUserSessionStatus` for sub-second push notifications of account suspension/deletion, a 10-second periodic heartbeat (`fetchCurrentAuthUserApi()`), and window focus/visibility listeners to immediately detect and enforce administrator edits.
    - **User-Facing Security Banners (`src/components/LoginScreen.tsx`)**: Displays contextual security notices explaining to the user in Arabic and English why their previous session ended (e.g. password changed by admin or account suspended), prompting them to log in with their updated credentials.
  - **Session Token & User Profile Persistence Separation (`src/lib/session.ts`)**:
    - **Isolated Storage Keys**: Separated the authentication session token (`cargo_session_token`) from user profile metadata (`cargo_user_profile`) in `localStorage` and `sessionStorage`.
    - **Admin Session Protection**: Guaranteed that editing, creating, toggling, or deleting other user accounts in the Admin Panel (`AdminPanel.tsx`) never overwrites or mutates the administrator's active session token or profile credentials.
    - **Safe Active User Detection (`isCurrentActiveUser`)**: Implemented deterministic user identity comparison (`userId`, `username`, `email`) ensuring only edits to the current logged-in user modify active session storage.
    - **Centralized Session Helpers**: Built `src/lib/session.ts` exporting `getSessionToken()`, `setSessionToken()`, `getStoredUserProfile()`, `setStoredUserProfile()`, `saveFullSession()`, `clearFullSession()`, and `updateActiveUserProfileIfCurrent()`.
    - **Integrated Across Application Lifecycle**: Updated `App.tsx`, `LoginScreen.tsx`, `LoginModal.tsx`, `api.ts`, and `AdminPanel.tsx` to route all session initialization, login, profile updates, and logouts through `session.ts`.
    - **Automated Verification**: Added comprehensive unit tests in `tests/suite.test.ts` (Section 6) and Admin Panel System Diagnostic Suite (`db_localstorage` & `sec_session_isolation`) verifying 100% session token isolation and admin credential protection.

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

- **2026-08-23**:
  - **Flight Consignment & Calculation P&L Aggregation Engine**:
    - **Bulk History Actions**: Enabled the "Consolidate Flight / ربط برحلة" action in the multi-select bulk toolbar of `DashboardView.tsx`. Selecting any number of product calculations and clicking the button opens the `FlightConsignmentModal` pre-populated with those items.
    - **Single-Item Flight Linking**: Added direct flight linking/inspection buttons (`Plane` / `Link2` icons) across both desktop history table rows and mobile cards.
    - **Flight Profit & Loss (P&L) Aggregation**:
      - Automatically computes cumulative Total Landed Cost (EGP), Total Revenue (EGP), and Total Net Profit/Loss (EGP) across all products linked to a flight.
      - Displays a high-contrast P&L status badge on each flight card with Profit Margin % and ROI %.
      - Highlights profitable flights in emerald (`+ Net Profit`) and deficit flights in rose (`- Net Loss`).
    - **Interactive Itemized Cargo Accordion & Inline Unlinking**:
      - Added expandable accordion drawer on each flight card showing all linked products with images, quantities, landed costs, revenues, and individual profit contributions.
      - Implemented instant **Unlink (`handleUnlinkItemFromFlight`)** action that removes a product from the flight, clears its flight ID, and dynamically recalculates the flight's gross weight, landed cost, revenue, and P&L totals in real time across Firestore and Supabase.
      - Added "+ Add Cargo" modal flow to quickly attach additional history items to an existing flight.
    - **AI Flight Manifest & Air Waybill PDF Parser**: Seamlessly maps parsed manifest line items or linked calculation IDs into unified flight consignments with dual-persistence.

- **2026-08-23**:
  - **Comprehensive Weight Column Integration & PDF Export Upgrades (`DashboardView.tsx`, `pdfExport.ts`, `quotePdfExport.ts`, `translations.ts`)**:
    - **History Table & Mobile Cards**: Added dedicated Weight column to the desktop history table (`colWeight`, `thWeight`) and a 5-metric grid to mobile calculation cards displaying exact gross weight in kg and unit specifications.
    - **Weight Sorting**: Added sorting by weight (`weight_desc` and `weight_asc`) in the history table filter toolbar.
    - **CSV Export**: Added "Gross Weight (kg)" and "Chargeable Weight (kg)" to the exported CSV columns.
    - **Audit & Consignment Modals**: Updated the executive audit modal and flight consignment modal to display gross weight, chargeable weight, and volumetric CBM.
    - **PDF Exports**:
      - `exportSingleCalculationPDF`: Updated to display total gross weight (with per-unit weight indicator), chargeable weight, and volumetric CBM.
      - `exportHistoricalSummaryPDF`: Added dedicated "Weight (kg)" column to the tabular breakdown and added a new "Combined Total Gross Weight" KPI card.
      - `exportFlightManifestPDF`: Updated the KPI summary card to show both Gross Weight and Chargeable Weight side-by-side with itemized line item weights.
      - `exportQuotationPDF`: Added Weight (kg) column to client quotation items.
  - **Standardized Flight Cargo & Weight Calculation Engine (`calculator.ts`, `FlightConsignmentModal.tsx`, `DashboardView.tsx`, `pdfExport.ts`)**:
    - Centralized physical weight, volumetric CBM, piece count, landed cost, revenue, and profit aggregation functions in `src/utils/calculator.ts` (`getCalculationGrossWeightKg`, `getCalculationChargeableWeightKg`, `getCalculationVolumeCBM`, `getCalculationPieces`, `getCalculationLandedCost`, `getCalculationRevenue`, `getCalculationProfit`).
    - Standardized unit weight normalizations across `kg`, `g`, `lb`, and `ton` ensuring exact gross weight and chargeable weight sums when linking calculations to flights.
    - Updated `FlightConsignmentModal.tsx` to automatically calculate and persist `totalWeightKg`, `totalChargeableWeightKg`, `totalVolumeCbm`, `totalPieces`, and full P&L financial metrics on both new flight creation and linking to existing flights.
    - Updated `DashboardView.tsx` flight cards and KPI overview metrics with dynamic fallbacks to linked calculation items so flights immediately display accurate gross weights, packages, and P&L even with historical records.
    - Added Weight (KG) column and chargeable weight indicators to the itemized cargo breakdown table inside flight cards.
    - Standardized `pdfExport.ts` flight manifest PDF generation using the unified calculation helpers.

- **2026-08-21**:
  - **Google Gemini AI API Key Management Panel (`AdminPanel.tsx`)**:
    - Built an administrative interface to enter, view (with reveal toggle), test, and persist custom Google Gemini API Keys.
    - Implemented live connectivity diagnostics testing with real-time latency measurement and visual success/error callouts against Gemini 3.7 Flash (`gemini-3.7-flash`).
    - Added dual-write synchronization across the Express server in-memory state (`serverGeminiApiKey`), Supabase `site_settings` table, and Firestore `site_settings/ai_config` document with real-time snapshot subscription (`subscribeToAiKey`).
    - Integrated backend endpoints (`GET /api/admin/ai-key-status`, `POST /api/admin/ai-key`, `POST /api/admin/test-ai-key`, `DELETE /api/admin/ai-key`).
    - Integrated `ai_key_config` diagnostic test module in the Automated System Test Suite to verify key validity and endpoint readiness.
    - Upgraded AI Flight Manifest parser and Commercial Invoice OCR to prioritize the active admin-configured key with automatic fallback to environment variables.

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
