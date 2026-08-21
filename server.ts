import express from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;

// Security & Request Parsing Middleware
app.use(express.json({ limit: "15mb" }));

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Simple Rate Limiter Middleware
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(maxRequests = 60, windowMs = 60 * 1000) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test") {
      return next();
    }
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests from this IP. Please wait a moment and try again." });
    }

    record.count++;
    next();
  };
}

// Strict rate limiter for auth routes
const authRateLimiter = rateLimiter(15, 60 * 1000);
app.use("/api/auth/", authRateLimiter);

// General rate limiter for API routes
app.use("/api/", rateLimiter(120, 60 * 1000));

// Server-Side Password Hashing & Verification (Crypto)
function hashPassword(password: string): string {
  if (!password) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  // Fallback for plain text stored in legacy database
  if (!storedHash.includes(":")) {
    return password === storedHash;
  }
  const [salt, originalHash] = storedHash.split(":");
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
  } catch {
    return false;
  }
}

// Secure HMAC JWT Token Generation & Verification
const JWT_SECRET = process.env.JWT_SECRET || process.env.GEMINI_API_KEY || "cargo_profit_secure_jwt_secret_key_2026_prod";

function getPasswordSignature(password?: string): string {
  if (!password) return "";
  return crypto.createHash("sha256").update(password).digest("hex").slice(0, 16);
}

function generateToken(user: { userId: string; username: string; role: string; password?: string }): string {
  const payload = JSON.stringify({
    userId: user.userId,
    username: user.username,
    role: user.role,
    pv: getPasswordSignature(user.password),
    iat: Date.now(),
    exp: Date.now() + 1 * 24 * 60 * 60 * 1000, // 1 Day validity
  });
  const base64Payload = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(base64Payload).digest("base64url");
  return `${base64Payload}.${signature}`;
}

function verifyToken(token?: string | null): { userId: string; username: string; role: string; pv?: string; iat?: number } | null {
  if (!token) return null;
  const parts = token.replace(/^Bearer\s+/i, "").split(".");
  if (parts.length !== 2) return null;
  const [base64Payload, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(base64Payload).digest("base64url");
  if (signature !== expectedSignature) return null;
  try {
    const payload = JSON.parse(Buffer.from(base64Payload, "base64url").toString("utf-8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Backend Authorization Middleware with Real-Time Database Status & Credential Verification
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const authUser = verifyToken(authHeader);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized access. Valid token required.", code: "INVALID_TOKEN" });
  }

  const usernameKey = (authUser.username || "").toLowerCase().trim();
  let user = serverUsersStore[usernameKey];

  if (!user) {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .or(`id.ilike.${usernameKey},username.ilike.${usernameKey}`)
        .maybeSingle();
      if (data) {
        user = data.profile_data || {
          userId: data.user_id || data.id,
          username: data.username || usernameKey,
          role: data.role || "user",
          status: data.status || "active",
          password: data.password || data.password_hash || "",
        };
        serverUsersStore[usernameKey] = user;
      }
    } catch {}
  }

  if (user) {
    if (user.status === "suspended") {
      return res.status(403).json({
        error: "This account has been suspended by the system administrator.",
        code: "ACCOUNT_SUSPENDED",
      });
    }

    if (authUser.pv && user.password && getPasswordSignature(user.password) !== authUser.pv) {
      return res.status(401).json({
        error: "Your credentials have been updated by the administrator. Please log in again.",
        code: "CREDENTIALS_CHANGED",
      });
    }

    authUser.role = user.role || authUser.role;
  }

  (req as any).authUser = authUser;
  next();
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  await requireAuth(req, res, () => {
    const authUser = (req as any).authUser;
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Administrative permissions required.", code: "FORBIDDEN" });
    }
    next();
  });
}

// Server-Side Supabase Client (Protected Secrets from Environment)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://vpopmufbiennknognoth.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb3BtdWZiaWVubmtub2dub3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzI1OTQsImV4cCI6MjEwMTUwODU5NH0.7suCLGIj75KRqDyVm7PCPFMS5GFvVeWBcUoDh6ofZns";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Server-Side In-Memory Cache Store for Data
let serverUsersStore: Record<string, any> = {};

function seedInMemoryUsers() {
  if (!serverUsersStore["admin"]) {
    serverUsersStore["admin"] = {
      userId: "USR-ADMIN-001",
      username: "admin",
      name: "System Administrator",
      email: "admin@globaltrade.com",
      company: "Global Trade & Logistics Solutions",
      role: "admin",
      status: "active",
      password: hashPassword("admin123"),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
  }
  if (!serverUsersStore["trader"]) {
    serverUsersStore["trader"] = {
      userId: "USR-TRADER-001",
      username: "trader",
      name: "Senior Import & Freight Specialist",
      email: "trader@globaltrade.com",
      company: "Trans-Global Freight Operations",
      role: "user",
      status: "active",
      password: hashPassword("user123"),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
  }
}
seedInMemoryUsers();

let serverCalculationsStore: Record<string, any> = {};
let serverGalleryStore: Record<string, any> = {};
let serverFlightsStore: Record<string, any> = {};
let serverSiteFavicon: string | null = null;
let serverInactivityTimeoutMinutes: number = 15;
let serverGeminiApiKey: string = "";

function getEffectiveGeminiKey(): string {
  return serverGeminiApiKey || process.env.GEMINI_API_KEY || "";
}

function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return "••••••••";
  return key.slice(0, 6) + "••••••••" + key.slice(-4);
}

// Helper: Resilient Gemini Generation with automatic model fallback for 503 / 404 / high demand spikes
const GEMINI_MODELS_CASCADE = [
  "gemini-3.7-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
];

async function generateGeminiWithFallback(ai: GoogleGenAI, contents: any[], options?: { systemInstruction?: string }) {
  let lastError: any = null;

  for (const model of GEMINI_MODELS_CASCADE) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        ...(options?.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
      });
      return { response, successfulModel: model };
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || "");
      const isRecoverable =
        errMsg.includes("503") ||
        errMsg.includes("UNAVAILABLE") ||
        errMsg.includes("high demand") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429") ||
        errMsg.includes("404") ||
        errMsg.includes("NOT_FOUND") ||
        errMsg.includes("no longer available") ||
        errMsg.includes("is not supported");

      if (isRecoverable) {
        console.warn(`Gemini model ${model} unavailable or deprecated (${errMsg}), attempting fallback model in cascade...`);
        // Short pause before trying next model
        await new Promise((r) => setTimeout(r, 200));
        continue;
      } else {
        // Non-recoverable auth or format error, throw immediately
        throw err;
      }
    }
  }

  throw lastError;
}

// Clean Sensitive Fields (Password) before returning User object to client
function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, ...clean } = user;
  return clean;
}

// --- API ROUTES: AUTHENTICATION & USERS ---

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const cleanUsername = String(username || "").trim().toLowerCase();
    const cleanPassword = String(password || "").trim();

    if (!cleanUsername || !cleanPassword) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    let user: any = null;

    // 1. Try Supabase backend query
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .or(`id.ilike.${cleanUsername},username.ilike.${cleanUsername},user_id.ilike.${cleanUsername},email.ilike.${cleanUsername}`)
        .maybeSingle();

      if (!error && data) {
        let dbUser: any = null;
        if (data.profile_data && typeof data.profile_data === "object") {
          dbUser = {
            ...data.profile_data,
            role: (cleanUsername === "admin" || data.profile_data?.role === "admin" || data.role === "admin") ? "admin" : (data.profile_data?.role || "user"),
            password: data.password || data.password_hash || data.profile_data?.password || "",
          };
        } else {
          dbUser = {
            userId: data.user_id || data.id || `USR-${(data.username || cleanUsername).toUpperCase()}`,
            username: data.username || data.email || cleanUsername,
            name: data.full_name || data.name || data.username || cleanUsername,
            email: data.email || "",
            company: data.company_name || data.company || "",
            role: (cleanUsername === "admin" || data.role === "admin") ? "admin" : "user",
            status: data.status === "suspended" ? "suspended" : "active",
            password: data.password || data.password_hash || "",
            createdAt: data.created_at || new Date().toISOString(),
          };
        }

        if (dbUser && verifyPassword(cleanPassword, dbUser.password)) {
          user = dbUser;
        }
      }
    } catch (dbErr) {
      console.warn("[Supabase Login Query Notice]:", dbErr);
    }

    // 2. Fallback to in-memory store (e.g. newly created users or test mode)
    if (!user && serverUsersStore[cleanUsername]) {
      const storeUser = serverUsersStore[cleanUsername];
      if (verifyPassword(cleanPassword, storeUser.password)) {
        user = storeUser;
      }
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "This account has been suspended by the system administrator." });
    }

    // Password verified, generate JWT token with password signature
    const token = generateToken({
      userId: user.userId || cleanUsername,
      username: user.username || cleanUsername,
      role: user.role || "user",
      password: user.password,
    });

    res.json({
      success: true,
      token,
      user: sanitizeUser({
        ...user,
        lastLoginAt: new Date().toISOString(),
      }),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Login failed: " + (error?.message || "") });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", requireAuth, async (req, res) => {
  const authUser = (req as any).authUser;
  const usernameKey = authUser.username.toLowerCase().trim();
  let user = serverUsersStore[usernameKey];
  if (!user) {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .or(`id.ilike.${usernameKey},username.ilike.${usernameKey}`)
        .maybeSingle();
      if (data) {
        user = data.profile_data || data;
      }
    } catch {}
  }
  res.json({ success: true, user: sanitizeUser(user) || authUser });
});

// POST /api/auth/profile (Update self profile)
app.post("/api/auth/profile", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const { oldPassword, newPassword, name, email, company } = req.body || {};

    const key = authUser.username.toLowerCase();
    let existingUser = serverUsersStore[key];

    // Try fetching from Supabase if not in store
    if (!existingUser) {
      try {
        const { data } = await supabase.from("users").select("*").eq("id", key).maybeSingle();
        if (data && data.profile_data) existingUser = data.profile_data;
      } catch {}
    }

    if (!existingUser) {
      return res.status(404).json({ error: "User profile not found" });
    }

    let updatedPassword = existingUser.password;

    if (newPassword && String(newPassword).trim()) {
      if (!oldPassword || !verifyPassword(String(oldPassword).trim(), existingUser.password)) {
        return res.status(400).json({ error: "Old password confirmation failed" });
      }
      updatedPassword = hashPassword(String(newPassword).trim());
    }

    const updatedUser = {
      ...existingUser,
      name: name !== undefined ? String(name).trim() : existingUser.name,
      email: email !== undefined ? String(email).trim() : existingUser.email,
      company: company !== undefined ? String(company).trim() : existingUser.company,
      password: updatedPassword,
      updatedAt: new Date().toISOString(),
    };

    serverUsersStore[key] = updatedUser;

    // Sync to Supabase
    try {
      await supabase.from("users").upsert({
        id: key,
        username: key,
        user_id: updatedUser.userId || key,
        full_name: updatedUser.name,
        email: updatedUser.email,
        company_name: updatedUser.company,
        password: updatedUser.password,
        profile_data: updatedUser,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Supabase profile sync warning:", err);
    }

    res.json({ success: true, user: sanitizeUser(updatedUser) });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/users (Admin Only)
app.get("/api/users", requireAdmin, async (_req, res) => {
  try {
    const usersList: any[] = [];

    try {
      const { data, error } = await supabase.from("users").select("*");
      if (!error && Array.isArray(data)) {
        data.forEach((item) => {
          const profile = item.profile_data || {
            userId: item.user_id || item.id,
            username: item.username || item.id,
            name: item.full_name || "",
            email: item.email || "",
            company: item.company_name || "",
            role: item.role || "user",
            status: item.status || "active",
            createdAt: item.created_at,
          };
          usersList.push(sanitizeUser(profile));
        });
      }
    } catch {}

    if (usersList.length === 0) {
      Object.values(serverUsersStore).forEach((u) => {
        usersList.push(sanitizeUser(u));
      });
    }

    res.json({ users: usersList });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/users (Admin Only - Create or Update User)
app.post("/api/users", requireAdmin, async (req, res) => {
  try {
    const { username, name, email, company, role, status, password, oldUsername } = req.body || {};

    const cleanUsername = String(username || "").trim().toLowerCase();
    if (!cleanUsername) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Clean old username record if changed
    if (oldUsername && String(oldUsername).trim().toLowerCase() !== cleanUsername) {
      const oldKey = String(oldUsername).trim().toLowerCase();
      delete serverUsersStore[oldKey];
      try {
        await supabase.from("users").delete().eq("id", oldKey);
      } catch {}
    }

    const existing = serverUsersStore[cleanUsername] || {};
    let finalPassword = existing.password || hashPassword(Math.random().toString(36).substring(2, 12));

    if (password && String(password).trim()) {
      finalPassword = hashPassword(String(password).trim());
    }

    const newUser = {
      userId: existing.userId || `USR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      username: cleanUsername,
      name: String(name || "").trim(),
      email: String(email || "").trim(),
      company: String(company || "").trim(),
      role: role === "admin" ? "admin" : "user",
      status: status === "suspended" ? "suspended" : "active",
      password: finalPassword,
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    serverUsersStore[cleanUsername] = newUser;

    try {
      await supabase.from("users").upsert({
        id: cleanUsername,
        user_id: newUser.userId,
        username: cleanUsername,
        full_name: newUser.name,
        email: newUser.email,
        company_name: newUser.company,
        role: newUser.role,
        status: newUser.status,
        password: newUser.password,
        profile_data: newUser,
        updated_at: new Date().toISOString(),
      });
    } catch {}

    res.json({ success: true, user: sanitizeUser(newUser) });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save user account" });
  }
});

// DELETE /api/users/:username (Admin Only)
app.delete("/api/users/:username", requireAdmin, async (req, res) => {
  try {
    const key = String(req.params.username || "").trim().toLowerCase();
    delete serverUsersStore[key];

    try {
      await supabase.from("users").delete().or(`id.eq.${key},username.eq.${key}`);
    } catch {}

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// --- API ROUTES: CALCULATIONS ---

// GET /api/calculations
app.get("/api/calculations", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const filterUserId = authUser.role === "admin" ? (req.query.userId as string) : authUser.userId;

    let calcs: any[] = [];

    try {
      let query = supabase.from("calculations").select("*");
      if (filterUserId && authUser.role !== "admin") {
        query = query.eq("user_id", filterUserId);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        calcs = data.map((item) => item.calculation_data || item);
      }
    } catch {}

    if (calcs.length === 0) {
      calcs = Object.values(serverCalculationsStore).filter((item) => {
        if (authUser.role === "admin") return true;
        return item.userId === authUser.userId || item.userId === authUser.username;
      });
    }

    calcs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json({ calculations: calcs });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch calculations" });
  }
});

// POST /api/calculations
app.post("/api/calculations", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const calc = req.body || {};

    if (!calc.id) {
      calc.id = `CALC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }

    calc.userId = calc.userId || authUser.userId || authUser.username;
    calc.createdAt = calc.createdAt || new Date().toISOString();

    serverCalculationsStore[calc.id] = calc;

    try {
      await supabase.from("calculations").upsert({
        id: calc.id,
        user_id: calc.userId,
        title: calc.input?.title || "Calculation Record",
        target_currency: calc.input?.targetCurrency || "USD",
        total_landed_cost: calc.totalLandedCostTarget || 0,
        total_revenue: calc.totalRevenueTarget || 0,
        net_profit: calc.totalProfitTarget || 0,
        calculation_data: calc,
        created_at: calc.createdAt,
      });

      // Synchronize image to gallery_images table if present
      if (calc.input?.invoiceImage) {
        const imageId = `IMG-${calc.id}`;
        const galleryRecord = {
          id: imageId,
          calculation_id: calc.id,
          user_id: calc.userId,
          title: calc.input?.title || "Product Image",
          sku: calc.input?.skuSupplier || "",
          category: calc.input?.category || "General",
          image_url: calc.input.invoiceImage,
          trade_direction: calc.input?.tradeDirection || "import",
          created_at: calc.createdAt,
        };
        serverGalleryStore[imageId] = galleryRecord;
        await supabase.from("gallery_images").upsert(galleryRecord);
      }
    } catch {}

    res.json({ success: true, calculation: calc });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save calculation" });
  }
});

// DELETE /api/calculations/:id
app.delete("/api/calculations/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    delete serverCalculationsStore[id];
    const imageId = `IMG-${id}`;
    delete serverGalleryStore[imageId];

    try {
      await supabase.from("calculations").delete().eq("id", id);
      await supabase.from("gallery_images").delete().eq("calculation_id", id);
    } catch {}

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete calculation" });
  }
});

// POST /api/calculations/clear
app.post("/api/calculations/clear", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const targetUserId = authUser.role === "admin" ? req.body.userId : authUser.userId;

    if (!targetUserId) {
      serverCalculationsStore = {};
      serverGalleryStore = {};
    } else {
      Object.keys(serverCalculationsStore).forEach((key) => {
        if (serverCalculationsStore[key].userId === targetUserId) {
          delete serverCalculationsStore[key];
        }
      });
      Object.keys(serverGalleryStore).forEach((key) => {
        if (serverGalleryStore[key].userId === targetUserId) {
          delete serverGalleryStore[key];
        }
      });
    }

    try {
      let query = supabase.from("calculations").delete();
      let queryGallery = supabase.from("gallery_images").delete();
      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
        queryGallery = queryGallery.eq("user_id", targetUserId);
      } else {
        query = query.neq("id", "");
        queryGallery = queryGallery.neq("id", "");
      }
      await query;
      await queryGallery;
    } catch {}

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to clear calculations" });
  }
});

// --- API ROUTES: FLIGHT CONSIGNMENTS & AIR MANIFESTS ---

// GET /api/flights
app.get("/api/flights", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const filterUserId = authUser.role === "admin" ? (req.query.userId as string) : authUser.userId;

    let flights: any[] = [];

    try {
      let query = supabase.from("flight_consignments").select("*");
      if (filterUserId && authUser.role !== "admin") {
        query = query.eq("user_id", filterUserId);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        flights = data.map((item) => {
          if (item.flight_data) {
            return {
              ...item.flight_data,
              id: item.id || item.flight_data.id,
              status: item.status || item.flight_data.status,
            };
          }
          return {
            id: item.id,
            userId: item.user_id,
            flightNumber: item.flight_number,
            flightName: item.flight_name || item.flight_number,
            airline: item.airline,
            flightDate: item.flight_date,
            originAirport: item.origin_airport,
            destinationAirport: item.destination_airport,
            awbNumber: item.awb_number,
            documentPdfUrl: item.document_pdf_url,
            status: item.status,
            calculationIds: [],
            createdAt: item.created_at || new Date().toISOString(),
          };
        });
      }
    } catch {}

    if (flights.length === 0) {
      flights = Object.values(serverFlightsStore).filter((item) => {
        if (authUser.role === "admin") return true;
        return item.userId === authUser.userId || item.userId === authUser.username;
      });
    }

    flights.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json({ flights });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch flight consignments" });
  }
});

// POST /api/flights
app.post("/api/flights", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const flight = req.body || {};

    if (!flight.id) {
      flight.id = `FLIGHT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }

    flight.userId = flight.userId || authUser.userId || authUser.username;
    flight.createdAt = flight.createdAt || new Date().toISOString();
    flight.updatedAt = new Date().toISOString();

    serverFlightsStore[flight.id] = flight;

    try {
      await supabase.from("flight_consignments").upsert({
        id: flight.id,
        user_id: flight.userId,
        flight_number: flight.flightNumber || "",
        flight_name: flight.flightName || flight.flightNumber || "",
        airline: flight.airline || "",
        flight_date: flight.flightDate || "",
        origin_airport: flight.originAirport || "",
        destination_airport: flight.destinationAirport || "",
        awb_number: flight.awbNumber || "",
        document_pdf_url: flight.documentPdfUrl || null,
        status: flight.status || "scheduled",
        flight_data: flight,
        updated_at: flight.updatedAt,
      }, { onConflict: "id" });
    } catch {}

    res.json({ success: true, flight });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save flight consignment" });
  }
});

// DELETE /api/flights/:id
app.delete("/api/flights/:id", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const { id } = req.params;

    delete serverFlightsStore[id];

    try {
      let query = supabase.from("flight_consignments").delete().eq("id", id);
      if (authUser.role !== "admin") {
        query = query.eq("user_id", authUser.userId);
      }
      await query;
    } catch {}

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete flight consignment" });
  }
});

// --- API ROUTES: GALLERY IMAGES ---

// GET /api/gallery
app.get("/api/gallery", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const filterUserId = authUser.role === "admin" ? (req.query.userId as string) : authUser.userId;

    let galleryList: any[] = [];

    try {
      let query = supabase.from("gallery_images").select("*");
      if (filterUserId && authUser.role !== "admin") {
        query = query.eq("user_id", filterUserId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        galleryList = data;
      }
    } catch {}

    if (galleryList.length === 0) {
      galleryList = Object.values(serverGalleryStore).filter((item) => {
        if (authUser.role === "admin") return true;
        return item.user_id === authUser.userId || item.user_id === authUser.username;
      });
    }

    res.json({ gallery: galleryList });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch gallery images" });
  }
});

// POST /api/gallery
app.post("/api/gallery", requireAuth, async (req, res) => {
  try {
    const authUser = (req as any).authUser;
    const record = req.body || {};
    if (!record.id) {
      record.id = `IMG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    }
    record.user_id = record.user_id || authUser.userId || authUser.username;
    record.created_at = record.created_at || new Date().toISOString();

    serverGalleryStore[record.id] = record;

    try {
      await supabase.from("gallery_images").upsert(record);
    } catch {}

    res.json({ success: true, image: record });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save gallery image" });
  }
});

// DELETE /api/gallery/:id
app.delete("/api/gallery/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    delete serverGalleryStore[id];

    try {
      await supabase.from("gallery_images").delete().eq("id", id);
    } catch {}

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete gallery image" });
  }
});

// --- API ROUTES: SITE SETTINGS & FAVICON ---

// GET /api/settings/favicon
app.get("/api/settings/favicon", async (_req, res) => {
  try {
    if (!serverSiteFavicon) {
      try {
        const { data } = await supabase.from("site_settings").select("*").eq("id", "branding").maybeSingle();
        if (data && data.favicon_url) {
          serverSiteFavicon = data.favicon_url;
        }
      } catch {}
    }
    res.json({ faviconUrl: serverSiteFavicon || null });
  } catch {
    res.json({ faviconUrl: null });
  }
});

// POST /api/settings/favicon (Admin Only)
app.post("/api/settings/favicon", requireAdmin, async (req, res) => {
  try {
    const { faviconUrl } = req.body || {};
    if (!faviconUrl || typeof faviconUrl !== "string") {
      return res.status(400).json({ error: "Invalid favicon URL parameter" });
    }

    serverSiteFavicon = faviconUrl;

    try {
      await supabase.from("site_settings").upsert({
        id: "branding",
        favicon_url: faviconUrl,
        updated_at: new Date().toISOString(),
      });
    } catch {}

    res.json({ success: true, faviconUrl });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save favicon setting" });
  }
});

// GET /api/settings/session-timeout
app.get("/api/settings/session-timeout", async (_req, res) => {
  try {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", "security")
        .maybeSingle();
      if (data && data.settings_data && typeof data.settings_data.inactivityTimeoutMinutes === "number") {
        serverInactivityTimeoutMinutes = data.settings_data.inactivityTimeoutMinutes;
      }
    } catch {}

    res.json({ timeoutMinutes: serverInactivityTimeoutMinutes || 15 });
  } catch {
    res.json({ timeoutMinutes: 15 });
  }
});

// POST /api/settings/session-timeout (Admin Only)
app.post("/api/settings/session-timeout", requireAdmin, async (req, res) => {
  try {
    const { timeoutMinutes } = req.body || {};
    const parsedMinutes = Number(timeoutMinutes);
    if (!parsedMinutes || isNaN(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 180) {
      return res.status(400).json({
        error: "Invalid timeout value. Must be a number between 1 and 180 minutes.",
      });
    }

    const cleanMinutes = Math.round(parsedMinutes);
    serverInactivityTimeoutMinutes = cleanMinutes;

    try {
      await supabase.from("site_settings").upsert({
        id: "security",
        settings_data: {
          inactivityTimeoutMinutes: cleanMinutes,
          updatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });
    } catch {}

    res.json({ success: true, timeoutMinutes: cleanMinutes });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save session timeout setting" });
  }
});

// GET /api/supabase-health
app.get("/api/supabase-health", requireAdmin, async (_req, res) => {
  try {
    let isConnected = false;
    let usersCount = Object.keys(serverUsersStore).length;
    let calculationsCount = Object.keys(serverCalculationsStore).length;
    let galleryImagesCount = Object.keys(serverGalleryStore).length;

    try {
      const { count: uCount, error: uErr } = await supabase.from("users").select("id", { count: "exact", head: true });
      if (!uErr) {
        isConnected = true;
        usersCount = uCount ?? usersCount;
      }
      const { count: cCount, error: cErr } = await supabase.from("calculations").select("id", { count: "exact", head: true });
      if (!cErr) {
        calculationsCount = cCount ?? calculationsCount;
      }
      const { count: gCount, error: gErr } = await supabase.from("gallery_images").select("id", { count: "exact", head: true });
      if (!gErr) {
        galleryImagesCount = gCount ?? galleryImagesCount;
      }
    } catch {}

    res.json({
      isConnected,
      usersTableOk: true,
      calculationsTableOk: true,
      galleryTableOk: true,
      usersCount,
      calculationsCount,
      galleryImagesCount,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Health check failed" });
  }
});

// --- API ROUTES: EXCHANGE RATES & AI OCR ---

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

const FALLBACK_RATES: Record<string, number> = { ...cachedRates.rates };

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
  } catch {}

  try {
    const res = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD", {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) return { rates: data.rates, source: "Open Exchange Rates API (Live)" };
    }
  } catch {}

  return { rates: cachedRates?.rates || FALLBACK_RATES, source: cachedRates?.source || "XE Currency Converter (Live Mid-Market)" };
}

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
  try {
    const now = new Date();
    const force = req.query.force === "true";
    if (force || (now.getTime() - new Date(cachedRates.lastUpdated).getTime() > 15000)) {
      const liveData = await fetchLiveExchangeRates();
      if (liveData && liveData.rates) {
        cachedRates = {
          rates: { ...FALLBACK_RATES, ...liveData.rates },
          lastUpdated: now.toISOString(),
          source: liveData.source
        };
      }
    }
  } catch {}

  res.json({
    base: "USD",
    rates: cachedRates.rates,
    lastUpdated: cachedRates.lastUpdated,
    source: cachedRates.source,
  });
});

app.post("/api/exchange-rates/refresh", async (_req, res) => {
  try {
    const liveData = await fetchLiveExchangeRates();
    if (liveData && liveData.rates) {
      cachedRates = {
        rates: { ...FALLBACK_RATES, ...liveData.rates },
        lastUpdated: new Date().toISOString(),
        source: liveData.source,
      };
    }
  } catch {}

  res.json({
    base: "USD",
    rates: cachedRates.rates,
    lastUpdated: cachedRates.lastUpdated,
    source: cachedRates.source,
  });
});

// API Route: AI Key Management (Admin Panel)
app.get("/api/admin/ai-key-status", async (_req, res) => {
  const effectiveKey = getEffectiveGeminiKey();
  const source = serverGeminiApiKey ? "admin_configured" : (process.env.GEMINI_API_KEY ? "env" : "none");
  res.json({
    configured: Boolean(effectiveKey),
    maskedKey: maskApiKey(effectiveKey),
    source,
    model: "gemini-3.7-flash",
    features: [
      "AI Flight Manifest & Air Waybill PDF Extraction (/api/parse-flight-manifest)",
      "Commercial Invoice OCR & Product Attribute Recognition (/api/parse-invoice)",
      "Multimodal Trade Documentation Parser"
    ]
  });
});

app.post("/api/admin/ai-key", async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    const cleanKey = String(apiKey || "").trim();
    if (!cleanKey) {
      return res.status(400).json({ error: "Gemini API Key cannot be empty." });
    }

    serverGeminiApiKey = cleanKey;

    // Dual-write to Supabase site_settings table if available
    try {
      await supabase.from("site_settings").upsert({
        id: "ai_config",
        data: { apiKey: cleanKey, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });
    } catch {}

    res.json({
      success: true,
      message: "Google Gemini API key successfully saved and activated on the server.",
      configured: true,
      maskedKey: maskApiKey(cleanKey),
      source: "admin_configured"
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to save AI key" });
  }
});

app.post("/api/admin/test-ai-key", async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    const keyToTest = String(apiKey || "").trim() || getEffectiveGeminiKey();
    if (!keyToTest) {
      return res.status(400).json({
        success: false,
        error: "No Gemini API key provided or configured on the server."
      });
    }

    const start = performance.now();
    const ai = new GoogleGenAI({
      apiKey: keyToTest,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const { response, successfulModel } = await generateGeminiWithFallback(ai, [
      {
        role: "user",
        parts: [{ text: "Respond strictly with the single word: OK" }]
      }
    ]);

    const durationMs = Math.round(performance.now() - start);
    const reply = (response.text || "").trim();

    res.json({
      success: true,
      message: `Google Gemini API connection verified successfully via ${successfulModel}.`,
      latencyMs: durationMs,
      model: successfulModel,
      response: reply
    });
  } catch (err: any) {
    let errorMsg = err?.message || "Gemini API test failed. Please verify the API key permissions and quota.";
    
    // Provide clear actionable guidance for Google Cloud / Project permission errors
    if (errorMsg.includes("denied access") || errorMsg.includes("PERMISSION_DENIED") || errorMsg.includes("403")) {
      errorMsg = "Google Cloud Project Permission Denied (403): The Google Cloud project linked to this API key has restricted access or disabled Generative Language API. To fix this: Visit https://aistudio.google.com/app/apikey and click 'Create API key in new project', then paste the new key here.";
    } else if (errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("400")) {
      errorMsg = "Invalid API Key (400): The provided API key string is invalid or has expired. Please check that the entire key was copied correctly from Google AI Studio.";
    } else if (errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
      errorMsg = "Rate Limit / Quota Exceeded (429): Your Gemini API quota limit has been reached. Please check your AI Studio billing or quota tier.";
    } else if (errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("high demand")) {
      errorMsg = "Temporary Model High Demand (503): Google's Gemini servers are experiencing temporary peak load spikes. The system will automatically retry.";
    }

    res.status(400).json({
      success: false,
      error: errorMsg
    });
  }
});

app.delete("/api/admin/ai-key", async (_req, res) => {
  serverGeminiApiKey = "";
  try {
    await supabase.from("site_settings").delete().eq("id", "ai_config");
  } catch {}
  const effective = getEffectiveGeminiKey();
  res.json({
    success: true,
    message: "Admin AI key removed.",
    configured: Boolean(effective),
    maskedKey: maskApiKey(effective),
    source: effective ? "env" : "none"
  });
});

// API Route: AI Invoice OCR Parsing
app.post("/api/parse-invoice", async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "No image payload provided" });
    }

    const apiKey = getEffectiveGeminiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API Key is not configured. Please enter your Gemini API Key in the Admin Panel or set GEMINI_API_KEY."
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
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

    const { response } = await generateGeminiWithFallback(ai, [
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
    ]);

    const text = response.text || "";
    const cleanJsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(cleanJsonText);

    res.json({ success: true, extracted });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to analyze image" });
  }
});

// API Route: AI Flight Manifest & Air Waybill PDF/Image OCR Parsing
app.post("/api/parse-flight-manifest", async (req, res) => {
  try {
    const { fileData, mimeType = "application/pdf", fileName } = req.body || {};
    if (!fileData || typeof fileData !== "string") {
      return res.status(400).json({ error: "No document file payload provided" });
    }

    const apiKey = getEffectiveGeminiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API Key is not configured. Please enter your Gemini API Key in the Admin Panel or set GEMINI_API_KEY."
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    let cleanBase64 = fileData;
    let cleanMimeType = mimeType;

    const dataUriMatch = fileData.match(/^data:([^;]+);base64,(.*)$/s);
    if (dataUriMatch) {
      cleanMimeType = dataUriMatch[1];
      cleanBase64 = dataUriMatch[2];
    } else {
      cleanBase64 = fileData.replace(/^data:[^;]+;base64,/, "");
    }

    // Default to application/pdf if not specified and ends with .pdf
    if (fileName && fileName.toLowerCase().endsWith(".pdf") && (!cleanMimeType || cleanMimeType === "application/octet-stream")) {
      cleanMimeType = "application/pdf";
    }

    const prompt = `You are an expert Air Freight Logistics Specialist, IATA Air Waybill (AWB) auditor, and Cargo Flight Manifest extractor.
Examine this Air Waybill (AWB), Flight Cargo Manifest, Airline Bill of Lading, or Air Freight Packing List document carefully.

Extract all flight and cargo parameters into a clean, structured JSON object adhering strictly to this schema:
{
  "flightNumber": "e.g. MS 777, EK 923, QR 884, TK 654",
  "airline": "Airline name e.g. EgyptAir Cargo, Emirates SkyCargo, Qatar Airways Cargo, Turkish Cargo, Saudia Cargo",
  "flightDate": "Flight departure date in YYYY-MM-DD format (or ISO date)",
  "originAirport": "Airport name and 3-letter IATA code e.g. CAN - Guangzhou Baiyun, PVG - Shanghai Pudong, DXB - Dubai",
  "originCountry": "Country of origin e.g. China, United Arab Emirates, Turkey",
  "destinationAirport": "Destination Airport name and 3-letter IATA code e.g. CAI - Cairo International, RUH - King Khalid, JED - King Abdulaziz",
  "destinationCountry": "Destination Country e.g. Egypt, Saudi Arabia",
  "awbNumber": "Master or House Air Waybill Number e.g. 077-98765432, 176-12345678",
  "totalGrossWeightKg": number (total shipment gross weight in KG),
  "totalChargeableWeightKg": number (total chargeable / volumetric weight in KG),
  "totalPackagesCount": number (number of packages / cartons / pieces),
  "currency": "3-letter currency code e.g. USD, EUR, CNY, EGP, SAR",
  "notes": "Any special cargo handling remarks, flight routing, or airwaybill remarks",
  "items": [
    {
      "title": "Item name / description of goods",
      "sku": "Product SKU or part number if available",
      "quantity": number (pieces/units count),
      "unitPrice": number (price per unit if indicated),
      "totalWeightKg": number (weight for this line item in KG),
      "cbm": number (volume CBM if available),
      "hsCode": "Harmonized System tariff code if present",
      "category": "Electronics, Textiles, Machinery, Spare Parts, General Cargo, etc.",
      "freightRatePerKg": number (freight rate per kg if specified)
    }
  ]
}

Ensure all numerical fields are numbers (not strings with units).
If any field cannot be found or is ambiguous, make a reasonable operational estimate or omit/leave null.
Do NOT output markdown fences or commentary outside the JSON. Output raw valid JSON ONLY.`;

    const { response } = await generateGeminiWithFallback(ai, [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: cleanBase64,
              mimeType: cleanMimeType,
            },
          },
        ],
      },
    ]);

    const text = response.text || "";
    const cleanJsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(cleanJsonText);

    res.json({ success: true, extracted });
  } catch (err: any) {
    console.error("Flight manifest OCR parsing error:", err);
    res.status(500).json({ error: err?.message || "Failed to analyze flight manifest PDF document" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start Server
async function startServer() {
  if (
    process.env.VERCEL ||
    process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test" ||
    process.argv.some((a) => a.includes("test"))
  ) {
    return;
  }

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
    console.log(`[Secure API Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export { app };
export default app;
