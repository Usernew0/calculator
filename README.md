# CargoProfit FX — Global Landed Cost & Profit Calculator

CargoProfit FX is a full-stack, enterprise-grade Freight Landed Cost & Profit Margin Analysis web application designed for global trade, importers, exporters, and logistics managers.

---

## 🌟 Key Features

### 1. Landed Cost & Profit Calculator
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
- **Live FX Rate Feed**: Automatically fetches real-time market exchange rates with backend fallback.
- **Auto-Refresh Ticker**: Periodic auto-refresh timer (30s, 1m, 5m, or manual) with animated countdown progress indicator.
- **Quick Currency Converter**: Instant conversion widget between any currency pair.
- **Dynamic Rates Matrix**: Interactive matrix search and base currency switcher.

---

### 3. Historical Dashboard & Analytics
- **Saved Calculation History**: Store landed cost calculations in browser persistent storage (`localStorage`).
- **Financial Analytics Charts**: Visual trend breakdown (Landed Cost vs Net Profit) using Recharts.
- **Cost Composition Pie Chart**: Itemized expense structure distribution (Product, Freight, Duty, Insurance, Handling).
- **PDF Report Generation**: Download official PDF reports for individual calculations or complete historical summaries using `jspdf` and `jspdf-autotable`.
- **CSV Data Export**: Export saved historical records to CSV for Excel and Google Sheets analysis.

---

### 4. UI & Accessibility Design
- **Responsive Web & Mobile Layout**:
  - **Desktop**: Multi-column layout with sticky calculation result sidecards and side-by-side analytics.
  - **Mobile**: Touch-friendly inputs (min 44px height), stacked vertical forms, icon-collapsible navigation, and horizontally scrollable tables/tickers (`no-scrollbar`).
- **Light & Dark Theme Toggle**: Built-in toggle supporting dark and light themes with preference persistence.
- **Enhanced Custom Scrollbars**: Modern, sleek scrollbars across webkit browsers and Firefox with theme adaptation.

---

## 🚀 Technical Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS v4, Lucide React Icons
- **Charts**: Recharts
- **PDF Export**: jsPDF & jsPDF-AutoTable
- **Backend Server**: Express (Node.js) with live FX rate proxy endpoint (`/api/exchange-rates`)

---

## 💻 Responsive Breakpoints

| Device | Screen Width | Layout Strategy |
| :--- | :--- | :--- |
| **Mobile** | `< 640px` | Single-column stacked layout, icon-only header tabs, horizontal scroll for tables |
| **Tablet** | `640px – 1024px` | 2-column grids for inputs, touch-optimized controls |
| **Desktop** | `> 1024px` | 12-column grid system with sticky results panel and full analytics charts |

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

*CargoProfit FX — Empowering global trade with precise landed cost insights.*
