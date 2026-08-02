import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory cache for exchange rates
let cachedRates: {
  rates: Record<string, number>;
  lastUpdated: string;
  source: string;
} | null = null;

// Fallback baseline exchange rates (relative to 1 USD)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 154.5,
  CAD: 1.38,
  AUD: 1.52,
  CNY: 7.24,
  AED: 3.67,
  SAR: 3.75,
  INR: 83.9,
  EGP: 48.6,
  BRL: 5.65,
  CHF: 0.88,
  SGD: 1.35,
  HKD: 7.81,
  MXN: 18.5,
  KRW: 1375.0,
  TRY: 33.2,
  ZAR: 18.2,
  NZD: 1.66,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 6.86,
  PLN: 3.95,
  THB: 35.8,
  MYR: 4.68,
  IDR: 16200.0,
  VND: 25400.0,
  PHP: 58.5,
  PKR: 278.0,
};

async function fetchLiveExchangeRates(): Promise<{ rates: Record<string, number>; source: string }> {
  // Try Open ER API first
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === "object") {
        return { rates: data.rates, source: "Open Exchange Rates API" };
      }
    }
  } catch (err) {
    console.warn("Primary exchange rate API failed, trying backup...", err);
  }

  // Backup API: Fawaz Ahmed Currency API
  try {
    const res = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json");
    if (res.ok) {
      const data = await res.json();
      if (data && data.usd) {
        const ratesFormatted: Record<string, number> = { USD: 1.0 };
        for (const [key, val] of Object.entries(data.usd)) {
          if (typeof val === "number") {
            ratesFormatted[key.toUpperCase()] = val;
          }
        }
        return { rates: ratesFormatted, source: "jsdelivr Currency API" };
      }
    }
  } catch (err) {
    console.warn("Backup exchange rate API failed, falling back to cached/baseline...", err);
  }

  return { rates: FALLBACK_RATES, source: "Internal Baseline Rates" };
}

// API Route: Exchange Rates
app.get("/api/exchange-rates", async (_req, res) => {
  const now = new Date();
  
  // Refresh cache if older than 10 minutes or not present
  const TEN_MINS = 10 * 60 * 1000;
  if (!cachedRates || (now.getTime() - new Date(cachedRates.lastUpdated).getTime() > TEN_MINS)) {
    const liveData = await fetchLiveExchangeRates();
    cachedRates = {
      rates: { ...FALLBACK_RATES, ...liveData.rates },
      lastUpdated: now.toISOString(),
      source: liveData.source
    };
  }

  res.json({
    base: "USD",
    rates: cachedRates.rates,
    lastUpdated: cachedRates.lastUpdated,
    source: cachedRates.source,
  });
});

// Force refresh endpoint
app.post("/api/exchange-rates/refresh", async (_req, res) => {
  const liveData = await fetchLiveExchangeRates();
  cachedRates = {
    rates: { ...FALLBACK_RATES, ...liveData.rates },
    lastUpdated: new Date().toISOString(),
    source: liveData.source,
  };
  res.json({
    base: "USD",
    rates: cachedRates.rates,
    lastUpdated: cachedRates.lastUpdated,
    source: cachedRates.source,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
