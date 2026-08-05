# AGENTS.md — Persistent Instructions & Conventions for AI Coding Agent

## 📌 Project Architecture & Responsiveness Rules

1. **Mobile & Responsive First Design**:
   - Every view, card, form, modal, table, and header component MUST be fully responsive and tested for all device widths (Mobile `<640px`, Tablet `640px-1024px`, Desktop `>1024px`, Ultra-Wide `>1440px`).
   - Use touch-friendly input targets (minimum `44px` height on mobile controls).
   - Use flexible grid systems (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`).
   - Ensure tables use horizontal scrolling wrappers (`overflow-x-auto no-scrollbar`) to avoid overflow on narrow viewports.

2. **Bilingual RTL & LTR Support**:
   - Maintain seamless support for Arabic (`ar`, RTL) and English (`en`, LTR).
   - Ensure dynamic direction handling (`dir="rtl"` vs `dir="ltr"`), text alignment, and font family fallback (`Cairo, Tajawal, system-ui`).

3. **Auto-Updated Documentation Standard**:
   - On **every code modification** or feature addition, update the corresponding `.md` documentation files (`DOCUMENTATION.md` & `README.md`) to keep all architecture changes, APIs, and version logs 100% current and in sync with the codebase.

4. **Persistence & Realtime Sync**:
   - Database subscriptions and local storage fallbacks must be non-blocking and fail-safe.

5. **SQL Schema Synchronization**:
   - On any database schema change, column modification, or new table requirement, ALWAYS update both `/schema.sql` at the project root and `SUPABASE_REQUIRED_DDL_SQL` in `src/lib/supabase.ts` so they remain 100% synchronized and up-to-date.
