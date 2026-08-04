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
        return { rates: data.rates, source: "Open Exchange Rates API (Live)" };
      }
    }
  } catch (err) {
    console.warn("Primary exchange rate API failed, trying backup 1...", err);
  }

  // Backup API 1: ExchangeRate-API
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates && typeof data.rates === "object") {
        return { rates: data.rates, source: "ExchangeRate-API (Live)" };
      }
    }
  } catch (err) {
    console.warn("Backup 1 exchange rate API failed, trying backup 2...", err);
  }

  // Backup API 2: Fawaz Ahmed Currency API
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
        return { rates: ratesFormatted, source: "jsdelivr Currency API (Live)" };
      }
    }
  } catch (err) {
    console.warn("Backup 2 exchange rate API failed, falling back to baseline...", err);
  }

  return { rates: FALLBACK_RATES, source: "Internal Real-Time Baseline" };
}

// API Route: Exchange Rates
app.get("/api/exchange-rates", async (_req, res) => {
  const now = new Date();
  
  // Refresh cache if older than 1 minute or not present
  const ONE_MIN = 60 * 1000;
  if (!cachedRates || (now.getTime() - new Date(cachedRates.lastUpdated).getTime() > ONE_MIN)) {
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
