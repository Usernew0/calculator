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

    // Forgot Password Flow Tests
    test("POST /api/auth/forgot-password/lookup rejects empty identifier (400)", async () => {
      const res = await apiRequest("/api/auth/forgot-password/lookup", {
        method: "POST",
        body: JSON.stringify({ identifier: "" }),
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test("POST /api/auth/forgot-password/lookup returns 404 for unknown user", async () => {
      const res = await apiRequest("/api/auth/forgot-password/lookup", {
        method: "POST",
        body: JSON.stringify({ identifier: "non_existent_account_xyz" }),
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    test("POST /api/auth/forgot-password/lookup finds user by username (200 OK)", async () => {
      const res = await apiRequest("/api/auth/forgot-password/lookup", {
        method: "POST",
        body: JSON.stringify({ identifier: "admin" }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.username, "admin");
      assert.equal(res.body.hasPhone, true);
      assert.ok(res.body.maskedPhone);
    });

    test("POST /api/auth/forgot-password/lookup finds user by phone number (200 OK)", async () => {
      const res = await apiRequest("/api/auth/forgot-password/lookup", {
        method: "POST",
        body: JSON.stringify({ identifier: "+201001234567" }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.username, "admin");
    });

    test("POST /api/auth/forgot-password/lookup finds user by email address (200 OK)", async () => {
      const res = await apiRequest("/api/auth/forgot-password/lookup", {
        method: "POST",
        body: JSON.stringify({ identifier: "admin@globaltrade.com" }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.username, "admin");
    });

    let generatedOtp = "";

    test("POST /api/auth/forgot-password/send-phone-otp dispatches OTP (200 OK)", async () => {
      const res = await apiRequest("/api/auth/forgot-password/send-phone-otp", {
        method: "POST",
        body: JSON.stringify({ username: "trader" }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.devOtp);
      assert.equal(res.body.devOtp.length, 6);
      generatedOtp = res.body.devOtp;
    });

    test("POST /api/auth/forgot-password/reset rejects invalid OTP (400 Bad Request)", async () => {
      const res = await apiRequest("/api/auth/forgot-password/reset", {
        method: "POST",
        body: JSON.stringify({
          username: "trader",
          newPassword: "newpassword123",
          resetMethod: "phone_otp",
          resetCode: "000000",
        }),
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test("POST /api/auth/forgot-password/reset succeeds with valid OTP and allows login", async () => {
      const resetRes = await apiRequest("/api/auth/forgot-password/reset", {
        method: "POST",
        body: JSON.stringify({
          username: "trader",
          newPassword: "UpdatedTraderPass999!",
          resetMethod: "phone_otp",
          resetCode: generatedOtp,
        }),
      });
      assert.equal(resetRes.status, 200);
      assert.equal(resetRes.body.success, true);

      // Verify login with new password works
      const loginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: "trader",
          password: "UpdatedTraderPass999!",
        }),
      });
      assert.equal(loginRes.status, 200);
      assert.ok(loginRes.body.token);

      // Restore trader password so subsequent tests don't break
      await apiRequest("/api/auth/forgot-password/send-phone-otp", {
        method: "POST",
        body: JSON.stringify({ username: "trader" }),
      }).then(async (r) => {
        if (r.body?.devOtp) {
          await apiRequest("/api/auth/forgot-password/reset", {
            method: "POST",
            body: JSON.stringify({
              username: "trader",
              newPassword: "user123",
              resetMethod: "phone_otp",
              resetCode: r.body.devOtp,
            }),
          });
        }
      });

      // Refresh traderToken with newly restored credentials
      const reloginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: "trader",
          password: "user123",
        }),
      });
      traderToken = reloginRes.body.token;
    });

    test("POST /api/auth/forgot-password/send-email-otp and reset via email_otp", async () => {
      const emailOtpRes = await apiRequest("/api/auth/forgot-password/send-email-otp", {
        method: "POST",
        body: JSON.stringify({ username: "trader" }),
      });
      assert.equal(emailOtpRes.status, 200);
      assert.equal(emailOtpRes.body.success, true);
      assert.ok(emailOtpRes.body.devOtp);
      assert.equal(emailOtpRes.body.devOtp.length, 6);

      const emailResetRes = await apiRequest("/api/auth/forgot-password/reset", {
        method: "POST",
        body: JSON.stringify({
          username: "trader",
          newPassword: "user123",
          resetMethod: "email_otp",
          resetCode: emailOtpRes.body.devOtp,
        }),
      });
      assert.equal(emailResetRes.status, 200);
      assert.equal(emailResetRes.body.success, true);

      // Re-login to update traderToken
      const reloginRes2 = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: "trader",
          password: "user123",
        }),
      });
      traderToken = reloginRes2.body.token;
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

    test("GET /api/users: Unauthenticated request is rejected (401 Unauthorized)", async () => {
      const res = await apiRequest("/api/users");
      assert.ok(res.status === 401 || res.status === 403);
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

    test("SOFT DELETE vs. HARD DELETE: Soft delete suspends user and preserves calculations, Hard delete purges both", async () => {
      // 1. Create a dedicated user for soft/hard delete lifecycle test
      const testLifecycleUser = {
        userId: "USR-LIFECYCLE-99",
        username: "lifecycle_user",
        password: "PassWord123!",
        name: "Lifecycle User",
        role: "user",
      };

      const createRes = await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(testLifecycleUser),
      });
      assert.equal(createRes.status, 200);

      // 2. Login as this user
      const loginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: testLifecycleUser.username,
          password: testLifecycleUser.password,
        }),
      });
      assert.equal(loginRes.status, 200);
      const userToken = loginRes.body.token;

      // 3. User saves a calculation
      const calcPayload = {
        id: "CALC-LIFECYCLE-001",
        userId: testLifecycleUser.userId,
        username: testLifecycleUser.username,
        totalLandedCostTarget: 2500,
        totalRevenueTarget: 3200,
        totalProfitTarget: 700,
        createdAt: new Date().toISOString(),
        input: {
          title: "Lifecycle Freight Shipment",
          targetCurrency: "USD",
        },
      };

      const saveCalcRes = await apiRequest("/api/calculations", {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
        body: JSON.stringify(calcPayload),
      });
      assert.equal(saveCalcRes.status, 200);

      // 4. Admin performs SOFT DELETE
      const softDelRes = await apiRequest(`/api/users/${testLifecycleUser.username}?mode=soft`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(softDelRes.status, 200);
      assert.equal(softDelRes.body.mode, "soft");
      assert.equal(softDelRes.body.user?.status, "suspended");
      assert.equal(softDelRes.body.user?.isDeleted, true);

      // 5. Verify user's session token is invalidated / rejected
      const meRes = await apiRequest("/api/auth/me", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.ok(meRes.status === 401 || meRes.status === 403, "User session token must be rejected upon soft delete");

      // 6. Verify calculation STILL EXISTS in database (calculations preserved!)
      const calcsRes = await apiRequest(`/api/calculations?userId=${testLifecycleUser.userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(calcsRes.status, 200);
      const hasCalc = calcsRes.body.calculations?.some((c: any) => c.id === "CALC-LIFECYCLE-001");
      assert.ok(hasCalc, "Calculation must be preserved when soft delete is performed");

      // 7. Admin restores the soft-deleted user
      const restoreRes = await apiRequest(`/api/users/${testLifecycleUser.username}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.body.user?.status, "active");
      assert.equal(restoreRes.body.user?.isDeleted, false);

      // 8. Admin performs HARD DELETE on the user
      const hardDelRes = await apiRequest(`/api/users/${testLifecycleUser.username}?mode=hard`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(hardDelRes.status, 200);
      assert.equal(hardDelRes.body.mode, "hard");

      // 9. Verify calculation has been PURGED from database
      const calcsAfterHardRes = await apiRequest(`/api/calculations?userId=${testLifecycleUser.userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const stillHasCalc = calcsAfterHardRes.body.calculations?.some((c: any) => c.id === "CALC-LIFECYCLE-001");
      assert.ok(!stillHasCalc, "Calculation must be purged when hard delete is performed");
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

    test("Admin changing user password invalidates user session token immediately with CREDENTIALS_CHANGED", async () => {
      const testUser = {
        username: "refresh_test_user",
        name: "Refresh Test",
        email: "refresh@cargo.com",
        company: "Refresh Co",
        role: "user",
        status: "active",
        password: "initial_password_123",
      };

      // 1. Admin creates user
      await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(testUser),
      });

      // 2. User logs in and obtains active session token
      const loginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: testUser.username, password: testUser.password }),
      });
      assert.equal(loginRes.status, 200);
      const userToken = loginRes.body.token;
      assert.ok(userToken);

      // 3. Verify user token works for authenticated request
      const checkRes1 = await apiRequest("/api/auth/me", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(checkRes1.status, 200);

      // 4. Admin edits user's password in database
      const changePassRes = await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...testUser,
          password: "new_changed_password_456",
        }),
      });
      assert.equal(changePassRes.status, 200);

      // 5. User's old active session token MUST now be rejected with 401 and CREDENTIALS_CHANGED
      const checkRes2 = await apiRequest("/api/auth/me", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(checkRes2.status, 401);
      assert.equal(checkRes2.body.code, "CREDENTIALS_CHANGED");

      // 6. User logs in with new password and gets a valid new session token
      const reLoginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: testUser.username, password: "new_changed_password_456" }),
      });
      assert.equal(reLoginRes.status, 200);
      const newUserToken = reLoginRes.body.token;
      assert.ok(newUserToken);

      // 7. Verify new token works
      const checkRes3 = await apiRequest("/api/auth/me", {
        headers: { Authorization: `Bearer ${newUserToken}` },
      });
      assert.equal(checkRes3.status, 200);

      // Cleanup
      await apiRequest(`/api/users/${testUser.username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    });

    test("Admin suspending user invalidates user session token immediately with ACCOUNT_SUSPENDED", async () => {
      const testUser = {
        username: "suspend_test_user",
        name: "Suspend Test",
        email: "suspend@cargo.com",
        company: "Suspend Co",
        role: "user",
        status: "active",
        password: "suspend_pass_123",
      };

      // 1. Admin creates user
      await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(testUser),
      });

      // 2. User logs in
      const loginRes = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: testUser.username, password: testUser.password }),
      });
      assert.equal(loginRes.status, 200);
      const userToken = loginRes.body.token;

      // 3. Admin suspends the user account
      const suspendRes = await apiRequest("/api/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...testUser,
          status: "suspended",
        }),
      });
      assert.equal(suspendRes.status, 200);

      // 4. User's active session is rejected with 403 and ACCOUNT_SUSPENDED
      const checkRes = await apiRequest("/api/auth/me", {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(checkRes.status, 403);
      assert.equal(checkRes.body.code, "ACCOUNT_SUSPENDED");

      // Cleanup
      await apiRequest(`/api/users/${testUser.username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    });
  });

  // ==========================================
  // SECTION 7: SITE SETTINGS & SESSION INACTIVITY TIMEOUT
  // ==========================================
  describe("7. Site Settings & Session Inactivity Timeout Policy", () => {
    test("GET /api/settings/session-timeout returns active timeout number", async () => {
      const res = await apiRequest("/api/settings/session-timeout");
      assert.equal(res.status, 200);
      assert.ok(typeof res.body.timeoutMinutes === "number");
      assert.ok(res.body.timeoutMinutes > 0);
    });

    test("POST /api/settings/session-timeout is rejected for non-admin user", async () => {
      const res = await apiRequest("/api/settings/session-timeout", {
        method: "POST",
        headers: { Authorization: `Bearer ${traderToken}` },
        body: JSON.stringify({ timeoutMinutes: 45 }),
      });
      assert.equal(res.status, 403);
    });

    test("POST /api/settings/session-timeout rejects invalid timeout values", async () => {
      const res1 = await apiRequest("/api/settings/session-timeout", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ timeoutMinutes: 0 }),
      });
      assert.equal(res1.status, 400);

      const res2 = await apiRequest("/api/settings/session-timeout", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ timeoutMinutes: 9999 }),
      });
      assert.equal(res2.status, 400);
    });

    test("POST /api/settings/session-timeout succeeds for admin and updates global timeout", async () => {
      const targetTimeout = 45;
      const res = await apiRequest("/api/settings/session-timeout", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ timeoutMinutes: targetTimeout }),
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.timeoutMinutes, targetTimeout);

      // Verify GET returns updated timeout
      const getRes = await apiRequest("/api/settings/session-timeout");
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.timeoutMinutes, targetTimeout);
    });
  });

  // ==========================================
  // SECTION 8: SUPABASE DUAL ENGINE & GALLERY IMAGES
  // ==========================================
  describe("8. Supabase Calculations & Gallery Images Media Engine", () => {
    test("POST /api/calculations with invoiceImage automatically creates gallery record", async () => {
      const calcPayload = {
        id: `CALC-TEST-${Date.now()}`,
        userId: "trader",
        input: {
          title: "Solar Inverter Pro 5000",
          skuSupplier: "SOL-5000-X",
          category: "Electronics",
          invoiceImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          tradeDirection: "import",
          targetCurrency: "USD",
        },
        totalLandedCostTarget: 1250,
        totalRevenueTarget: 1800,
        totalProfitTarget: 550,
        createdAt: new Date().toISOString(),
      };

      const saveRes = await apiRequest("/api/calculations", {
        method: "POST",
        headers: { Authorization: `Bearer ${traderToken}` },
        body: JSON.stringify(calcPayload),
      });
      assert.equal(saveRes.status, 200);
      assert.equal(saveRes.body.success, true);

      // Verify gallery images list contains the image
      const galleryRes = await apiRequest("/api/gallery", {
        headers: { Authorization: `Bearer ${traderToken}` },
      });
      assert.equal(galleryRes.status, 200);
      assert.ok(Array.isArray(galleryRes.body.gallery));
      const found = galleryRes.body.gallery.find((item: any) => item.calculation_id === calcPayload.id);
      assert.ok(found, "Gallery record should be synchronized from calculation");
      assert.equal(found.sku, "SOL-5000-X");

      // Cleanup
      await apiRequest(`/api/calculations/${calcPayload.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${traderToken}` },
      });
    });

    test("GET /api/supabase-health reports all tables including gallery_images", async () => {
      const healthRes = await apiRequest("/api/supabase-health", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.body.calculationsTableOk, true);
      assert.equal(healthRes.body.galleryTableOk, true);
      assert.ok(typeof healthRes.body.galleryImagesCount === "number");
    });
  });
});
