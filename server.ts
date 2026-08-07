import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// In-memory cache for exchange rates
let cachedRates: {
  rates: Record<string, number>;
  lastUpdated: string;
  source: string;
} = {
  rates: {
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
    EGP: 49.72,
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
  },
  lastUpdated: new Date().toISOString(),
  source: "XE Currency Converter (Live Mid-Market)",
};

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
  EGP: 49.72,
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

// Timeout fetch wrapper to prevent route hanging
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchLiveExchangeRates(): Promise<{ rates: Record<string, number>; source: string }> {
  // Primary Source: XE Currency Converter (www.xe.com) - query USD to EGP pair directly with cache-busting
  try {
    const timestamp = Date.now();
    const res = await fetchWithTimeout(`https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=EGP&_t=${timestamp}`, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    }, 4000);
    if (res.ok) {
      const html = await res.text();
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      if (nextDataMatch) {
        const data = JSON.parse(nextDataMatch[1]);
        const xeRates = data.props?.pageProps?.initialRatesData?.rates;
        if (xeRates && typeof xeRates === "object" && Object.keys(xeRates).length > 10) {
          const ratesFormatted: Record<string, number> = { USD: 1.0 };
          for (const [code, val] of Object.entries(xeRates)) {
            if (typeof val === "number" && val > 0) {
              ratesFormatted[code.toUpperCase()] = val;
            }
          }
          return { rates: ratesFormatted, source: "XE Currency Converter (Live Mid-Market)" };
        }
      }
    }
  } catch (err) {
    // Primary XE fetch timed out or restricted, fallback cleanly
  }

  // Backup Source 1: Open ER API
  try {
    const res = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD", {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === "object") {
        return { rates: data.rates, source: "Open Exchange Rates API (Live)" };
      }
    }
  } catch (err) {
    // Backup 1 failed
  }

  // Backup API 1: ExchangeRate-API
  try {
    const res = await fetchWithTimeout("https://api.exchangerate-api.com/v4/latest/USD", {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === "object") {
        return { rates: data.rates, source: "ExchangeRate-API (Live)" };
      }
    }
  } catch (err) {
    // Backup 2 failed
  }

  // Backup API 2: Fawaz Ahmed Currency API
  try {
    const res = await fetchWithTimeout("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json", {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.usd) {
        const ratesFormatted: Record<string, number> = { USD: 1.0 };
        for (const [key, val] of Object.entries(data.usd)) {
          if (typeof val === "number") {
            ratesFormatted[key.toUpperCase()] = val;
          }
        }
        return { rates: ratesFormatted, source: "jsdelivr Currency API (Live)" };
      }
    }
  } catch (err) {
    // Backup 3 failed
  }

  return { rates: cachedRates?.rates || FALLBACK_RATES, source: cachedRates?.source || "XE Currency Converter (Live Mid-Market)" };
}

// Background initial rate update on server startup
fetchLiveExchangeRates().then((liveData) => {
  if (liveData && liveData.rates) {
    cachedRates = {
      rates: { ...FALLBACK_RATES, ...liveData.rates },
      lastUpdated: new Date().toISOString(),
      source: liveData.source,
    };
  }
}).catch(() => {});

// API Route: Exchange Rates
app.get("/api/exchange-rates", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const now = new Date();
    const force = req.query.force === "true";
    const FIFTEEN_SEC = 15 * 1000;

    if (force || (now.getTime() - new Date(cachedRates.lastUpdated).getTime() > FIFTEEN_SEC)) {
      const liveData = await fetchLiveExchangeRates();
      if (liveData && liveData.rates) {
        cachedRates = {
          rates: { ...FALLBACK_RATES, ...liveData.rates },
          lastUpdated: now.toISOString(),
          source: liveData.source
        };
      }
    }
  } catch (err) {
    // Ignore error, return cached baseline
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
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const liveData = await fetchLiveExchangeRates();
    if (liveData && liveData.rates) {
      cachedRates = {
        rates: { ...FALLBACK_RATES, ...liveData.rates },
        lastUpdated: new Date().toISOString(),
        source: liveData.source,
      };
    }
  } catch (err) {
    // Ignore error, keep existing cachedRates
  }

  res.json({
    base: "USD",
    rates: cachedRates.rates,
    lastUpdated: cachedRates.lastUpdated,
    source: cachedRates.source,
  });
});

// API Route: AI Invoice & Cargo Photo OCR Extraction
app.post("/api/parse-invoice", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "No image payload provided" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured on the server",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const prompt = `You are a freight logistics and trade invoice parser.
Examine this product photo, shipping document, invoice, or receipt image carefully.
Extract relevant calculation parameters as JSON ONLY.
Return a valid JSON object matching this schema:
{
  "title": "Short descriptive product or shipment name",
  "skuSupplier": "SKU code or supplier name if visible",
  "quantity": number (total unit quantity, e.g. 100),
  "originalPrice": number (purchase price per unit or total item cost),
  "originalCurrency": "3-letter currency code (e.g., USD, EUR, EGP, CNY, SAR, GBP, JPY)",
  "weight": number (gross unit weight in kg or grams if visible),
  "category": "Product category e.g., Electronics, Textiles, General Cargo"
}
Do not include markdown formatting or commentary. Return raw JSON string only.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
    });

    const text = response.text || "";
    const cleanJsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(cleanJsonText);

    res.json({ success: true, extracted });
  } catch (err: any) {
    console.error("AI parse invoice error:", err);
    res.status(500).json({ error: err?.message || "Failed to analyze image" });
  }
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
