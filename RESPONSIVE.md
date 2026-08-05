# Responsive Design Specifications & Mobile Navigation Matrix — CargoProfit FX

> **Last Updated**: 2026-08-05  
> **Target Viewports**: Mobile (< 640px), Tablet (640px - 1024px), Desktop (> 1024px)

---

## 📱 Mobile (< 640px) Navigation & Layout Enhancements

### 1. Mobile Hamburger Overlay Menu (`Header.tsx`)
- **Responsive Threshold**: Below `640px` (`sm:` breakpoint), the full horizontal tab navigation bar and desktop buttons are hidden into a collapsible mobile drawer menu.
- **Hamburger Toggle**:
  - Accessible touch target ($\ge 44\text{px} \times 44\text{px}$) with standard `aria-label="Toggle navigation menu"`.
  - Icon dynamically switches between `<Menu />` (open drawer) and `<X />` (close drawer).
- **Mobile Drawer Overlay**:
  - Displays a 2-column grid containing all primary app views: **Calculator**, **FX Rates**, **Dashboard** (with dynamic history count badge), and **Admin Panel** (for admin users).
  - Integrates User Profile credentials, Profile Edit modal toggle, Logout, and Arabic/English PDF Export action buttons.
  - Automatically collapses upon tab or action selection to maintain viewport space.

### 2. Dashboard History Cards & Table Matrix (`DashboardView.tsx`)
- **Mobile Cards View (< 768px / `md:hidden`)**:
  - Replaces wide horizontal tables with touch-optimized mobile cards.
  - Card Header: Checkbox selector, item title, SKU/Supplier badge, and date stamp.
  - Freight Mode Badge: Styled pill with freight mode icon (Airplane, Ship, Truck).
  - 4-Tile Micro KPI Grid: Displays Quantity, Total Landed Cost, Selling Price, and Profit + Margin %.
  - Touch Action Bar: $44\text{px}$ touch targets for Client Offer, Duplicate, View Details, PDF Download, and Delete.
- **Desktop High-Density Table (≥ 768px / `hidden md:block`)**:
  - Sticky header with sorting options (Date, Landed Cost, Profit).
  - Hover highlights, multi-select action banner, and RTL text alignment support.

### 3. Touch Target & Accessibility Standards
- All interactive controls (buttons, inputs, language/theme toggles, menu items) enforce a minimum touch target size of **$44\text{px}$** on mobile viewports.
- Inputs and select fields feature `text-base` / `text-sm` font scaling on mobile to eliminate accidental auto-zooming on mobile Safari/Chrome browsers.

### 4. Responsive Breakpoint Mapping

| Viewport Category | Screen Width (`px`) | Navigation Layout Strategy | Form & History Card Layout |
| :--- | :--- | :--- | :--- |
| **Mobile** | `< 640px` | Responsive Hamburger Toggle (`sm:hidden`) + Slide-down Drawer Overlay | Single-column stacked forms & Mobile History Cards Grid (`md:hidden`) |
| **Tablet** | `640px - 1024px` | Inline horizontal tab bar (`hidden sm:flex`) | 2-column input grid & High-density Desktop Table (`hidden md:block`) |
| **Desktop** | `> 1024px` | Full navigation header with inline trader profile & FX rate ticker | Multi-column grid system with sticky results sidecard & analytics dashboard |

---

## 🔄 Automated Log of Responsive Changes

- **2026-08-05**:
  - Upgraded table action buttons and detail view modal in `DashboardView.tsx` with $44\text{px}$ touch targets on mobile and $36\text{px}$ high-density action pills on desktop.
  - Enhanced sort controls and filter select menus with high-contrast light and dark mode styling.
  - Redesigned Inspect Detail Modal (`selectedDetailModal`) into an Executive Shipment Audit view with responsive scrollable container and touch-friendly close button.
  - Enhanced table headers with bilingual Arabic/English labels and interactive column header sorting (Date, Total Landed Cost, Net Profit) with visual sort indicators in `DashboardView.tsx`.
  - Implemented mobile responsive card list for History Table in `DashboardView.tsx` (`md:hidden`), replacing wide scrollable table on mobile devices with touch-friendly 4-metric cards and action toolbar.
  - Added multi-criteria sorting control (Date, Landed Cost, Profit) and freight mode icon badges.
  - Updated `Header.tsx` to hide full navigation tabs on mobile screens below `640px` (`sm:` breakpoint) into a collapsible drawer menu.
  - Added $44\text{px} \times 44\text{px}$ touch targets for mobile theme, language, and hamburger toggles.
  - Created `RESPONSIVE.md` to track mobile navigation and layout matrix rules.
