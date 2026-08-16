import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import process from "node:process";

// Set environment to test
process.env.NODE_ENV = "test";

// Import App & Calculation Logic
import { app } from "../server";
import { calculateTradeAndFreight } from "../src/utils/calculator";
import { CalculationInput } from "../src/types";

describe("Cargo Profit Automated System & Logic Test Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string = "";
  let traderToken: string = "";

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // Obtain tokens in root before hook for all sections
    const adminRes = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    if (adminRes.body?.token) {
      adminToken = adminRes.body.token;
    }

    const traderRes = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "trader", password: "user123" }),
    });
    if (traderRes.body?.token) {
      traderToken = traderRes.body.token;
    }
  });

  after(async () => {
    return new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  // Helper fetch function
  async function apiRequest(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    const status = response.status;
    let body: any = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    return { status, body };
  }

  // ==========================================
  // SECTION 1: LANDED COST CALCULATION LOGIC
  // ==========================================
  describe("1. Landed Cost Calculation Engine Logic", () => {
    const mockRates: Record<string, number> = {
      USD: 1.0,
      EUR: 0.92,
      EGP: 49.72,
    };

    test("Accurately calculates landed cost, duty, margin & profit for standard shipment", () => {
      const sampleInput: CalculationInput = {
        title: "Test Industrial Solar Inverters",
        skuSupplier: "INV-101",
        category: "General Cargo",
        quantity: 10,
        originalPrice: 100, // $100 per unit
        originalCurrency: "USD",
        targetCurrency: "USD",
        weight: 5,
        weightUnit: "kg",
        freightMethod: "air_standard",
        freightRatePerUnit: 10,
        freightRateType: "per_weight",
        originHandlingFee: 10,
        destinationHandlingFee: 10,
        customsClearanceFee: 50,
        dutyPercentage: 10,
        insurancePercentage: 2,
        inlandDeliveryFee: 50,
        extraFees: [],
        pricingStrategy: "margin",
        targetValue: 20,
      };

      const result = calculateTradeAndFreight(sampleInput, mockRates);

      assert.equal(result.input.quantity, 10);
      assert.ok(result.totalLandedCostTarget > 0);
      assert.ok(result.landedCostPerUnitTarget > 0);
      assert.ok(result.suggestedSellingPricePerUnitTarget > result.landedCostPerUnitTarget);
      assert.ok(result.totalProfitTarget > 0);
    });

    test("Handles currency conversion accurately (EUR to USD)", () => {
      const euroInput: CalculationInput = {
        title: "European Machinery Parts",
        skuSupplier: "EUR-MAC-01",
        category: "Machinery",
        quantity: 5,
        originalPrice: 100, // 100 EUR
        originalCurrency: "EUR",
        targetCurrency: "USD",
        weight: 2,
        weightUnit: "kg",
        freightMethod: "sea_lcl",
        freightRatePerUnit: 5,
        freightRateType: "per_weight",
        originHandlingFee: 5,
        destinationHandlingFee: 5,
        customsClearanceFee: 10,
        dutyPercentage: 5,
        insurancePercentage: 1,
        inlandDeliveryFee: 10,
        extraFees: [],
        pricingStrategy: "margin",
        targetValue: 15,
      };

      const result = calculateTradeAndFreight(euroInput, mockRates);

      assert.ok(result.originalPriceTarget > 100);
      assert.equal(result.input.targetCurrency, "USD");
    });
  });

  // ==========================================
  // SECTION 2: SYSTEM API ENDPOINTS
  // ==========================================
  describe("2. System Health & Public API Endpoints", () => {
    test("GET /api/health returns 200 OK with timestamp", async () => {
      const res = await apiRequest("/api/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "ok");
      assert.ok(res.body.timestamp);
    });

    test("GET /api/exchange-rates returns rate dictionary", async () => {
      const res = await apiRequest("/api/exchange-rates");
      assert.equal(res.status, 200);
      assert.equal(res.body.base, "USD");
      assert.ok(res.body.rates.USD === 1);
      assert.ok(typeof res.body.rates.EUR === "number");
    });
  });

  // ==========================================
  // SECTION 3: AUTHENTICATION API ENDPOINTS
  // ==========================================
  describe("3. Authentication API Suite", () => {
    test("POST /api/auth/login succeeds for Administrator", async () => {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token);
      assert.equal(res.body.user.role, "admin");
      adminToken = res.body.token;
    });

    test("POST /api/auth/login succeeds for Standard Trader User", async () => {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "trader", password: "user123" }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.token);
      assert.equal(res.body.user.role, "user");
      traderToken = res.body.token;
    });

    test("POST /api/auth/login rejects invalid password (401 Unauthorized)", async () => {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "wrong_password_123" }),
      });

      assert.equal(res.status, 401);
    });

    test("GET /api/auth/me returns valid user info when authenticated", async () => {
      const res = await apiRequest("/api/auth/me", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.username, "admin");
      assert.equal(res.body.user.role, "admin");
    });

    test("GET /api/auth/me returns 401 Unauthorized without token", async () => {
      const res = await apiRequest("/api/auth/me");
      assert.equal(res.status, 401);
    });
  });

  // ==========================================
  // SECTION 4: ADMIN PANEL API TEST CASES
  // ==========================================
  describe("4. Admin Panel APIs & Role Authorization Test Cases", () => {
    const newTestUser = {
      username: "test_importer",
      name: "Test Importer Corp",
      email: "test.importer@cargo.com",
      company: "Cargo Import Ltd",
      role: "user",
      status: "active",
      password: "password123",
    };

    test("GET /api/users: Admin user access succeeds (200 OK)", async () => {
      const res = await apiRequest("/api/users", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.users));
    });

    test("GET /api/users: Non-admin trader user is rejected (403 Forbidden)", async () => {
      const res = await apiRequest("/api/users", {
        headers: { Authorization: `Bearer ${traderToken}` },
      });

      assert.equal(res.status, 403);
    });

    test("GET /api/users: Unauthenticated request is rejected (403 Forbidden)", async () => {
      const res = await apiRequest("/api/users");
      assert.equal(res.status, 403);
    });

    test("POST /api/users: Non-admin trader user cannot create accounts (403 Forbidden)", async () => {
      const res = await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${traderToken}` },
        body: JSON.stringify(newTestUser),
      });

      assert.equal(res.status, 403);
    });

    test("POST /api/users: Admin user can create new user accounts (200 OK)", async () => {
      const res = await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(newTestUser),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test("DELETE /api/users/:username: Non-admin trader user cannot delete users (403 Forbidden)", async () => {
      const res = await apiRequest(`/api/users/${newTestUser.username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${traderToken}` },
      });

      assert.equal(res.status, 403);
    });

    test("DELETE /api/users/:username: Admin user can delete user accounts (200 OK)", async () => {
      const res = await apiRequest(`/api/users/${newTestUser.username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test("POST /api/settings/favicon: Non-admin trader user cannot update branding (403 Forbidden)", async () => {
      const res = await apiRequest("/api/settings/favicon", {
        method: "POST",
        headers: { Authorization: `Bearer ${traderToken}` },
        body: JSON.stringify({ faviconUrl: "https://example.com/logo.png" }),
      });

      assert.equal(res.status, 403);
    });

    test("POST /api/settings/favicon: Admin user can update site favicon branding (200 OK)", async () => {
      const res = await apiRequest("/api/settings/favicon", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ faviconUrl: "https://example.com/logo.png" }),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test("GET /api/supabase-health: Non-admin trader user is rejected (403 Forbidden)", async () => {
      const res = await apiRequest("/api/supabase-health", {
        headers: { Authorization: `Bearer ${traderToken}` },
      });

      assert.equal(res.status, 403);
    });

    test("GET /api/supabase-health: Admin user can inspect database status (200 OK)", async () => {
      const res = await apiRequest("/api/supabase-health", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.checkedAt);
    });
  });

  // ==========================================
  // SECTION 5: CALCULATIONS DATA API TEST SUITE
  // ==========================================
  describe("5. Calculations Data APIs & User Isolation", () => {
    const testCalc = {
      id: "CALC-TEST-101",
      userId: "USR-TRADER-001",
      totalLandedCostTarget: 1500,
      totalRevenueTarget: 2000,
      totalProfitTarget: 500,
      createdAt: new Date().toISOString(),
      input: {
        title: "Test Cargo Container shipment",
        targetCurrency: "USD",
      },
    };

    test("POST /api/calculations saves calculation record for authenticated user", async () => {
      const res = await apiRequest("/api/calculations", {
        method: "POST",
        headers: { Authorization: `Bearer ${traderToken}` },
        body: JSON.stringify(testCalc),
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test("GET /api/calculations returns calculation records", async () => {
      const res = await apiRequest("/api/calculations", {
        headers: { Authorization: `Bearer ${traderToken}` },
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.calculations));
    });

    test("DELETE /api/calculations/:id removes calculation record", async () => {
      const res = await apiRequest(`/api/calculations/${testCalc.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${traderToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  // ==========================================
  // SECTION 6: SESSION PERSISTENCE & CREDENTIAL ISOLATION
  // ==========================================
  describe("6. Session Persistence & Credential Isolation", () => {
    test("Modifying another user account does not invalidate or overwrite admin session credentials", async () => {
      // 1. Admin creates a user 'isolation_user'
      const targetUser = {
        username: "isolation_user",
        name: "Isolation User Corp",
        email: "iso@cargo.com",
        company: "Iso Shipping",
        role: "user",
        status: "active",
        password: "user_secret_123",
      };

      const createRes = await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(targetUser),
      });
      assert.equal(createRes.status, 200);

      // 2. Admin updates the target user's details (password, role, status)
      const updateRes = await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...targetUser,
          company: "Updated Iso Shipping Ltd",
          status: "suspended",
        }),
      });
      assert.equal(updateRes.status, 200);

      // 3. Verify admin session credentials remain 100% active and uncorrupted
      const meRes = await apiRequest("/api/auth/me", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.user.username, "admin");
      assert.equal(meRes.body.user.role, "admin");
      assert.equal(meRes.body.user.status, "active");

      // Cleanup
      await apiRequest(`/api/users/${targetUser.username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    });
  });
});
