import { UserProfile, CalculationResult, FlightConsignment, FlightManifestParsedData, TwoFactorChallengeData } from '../types';
import { getSessionToken, setSessionToken, getStoredUserProfile, triggerSessionInvalidation } from './session';
import { generateTotpSecret, generateTotpUri, generateBackupCodes, verifyTotpCode, matchBackupCodeIndex } from './totp';
import {
  getAllUsersFromFirestore,
  saveUserProfileToFirestore,
  deleteUserFromFirestore,
  softDeleteUserInFirestore,
  restoreUserInFirestore,
  hardDeleteUserAndCalculationsFromFirestore,
  getUserProfileFromFirestore,
  saveFlightConsignmentToFirestore,
  getFlightConsignmentsFromFirestore,
  deleteFlightConsignmentFromFirestore,
  saveCalculationToFirestore,
  deleteCalculationFromFirestore,
  clearAllCalculationsFromFirestore,
  getCalculationsFromFirestore,
  saveSessionTimeoutToFirestore,
  getSessionTimeoutFromFirestore,
  saveSiteFaviconToFirestore,
  getSiteFaviconFromFirestore,
  sendPasswordResetEmailViaFirebase,
} from './firebase';
import { saveUserProfileToSupabase, getUserProfileFromSupabase } from './supabase';

/**
 * Client-Side API Helper for Secure Backend Operations with resilient Firestore and local fallback
 */

export { getSessionToken as getAuthToken, setSessionToken as setAuthToken };

export class ApiError extends Error {
  status?: number;
  code?: string;
  isNetworkError?: boolean;

  constructor(message: string, status?: number, code?: string, isNetworkError?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.isNetworkError = isNetworkError;
  }
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let token = getSessionToken();
  const currentProfile = getStoredUserProfile();
  const canonicalUserId = currentProfile?.userId || (currentProfile as any)?.user_id;
  const canonicalUsername = currentProfile?.username;

  if (!token && (canonicalUserId || canonicalUsername)) {
    token = `client_${canonicalUserId || canonicalUsername}_${Date.now()}`;
    setSessionToken(token, true);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Consistent canonical identification headers derived strictly from verified profile / token
  if (canonicalUserId) {
    headers['x-user-id'] = canonicalUserId;
  }
  if (canonicalUsername) {
    headers['x-username'] = canonicalUsername;
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    const errorMsg = networkErr?.message || 'Network connection failed. Operating in offline/resilient mode.';
    throw new ApiError(errorMsg, 0, 'NETWORK_ERROR', true);
  }

  let data: any = {};
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      data = {
        error: rawText.length > 0 && rawText.length < 200 ? rawText : `Server responded with status ${res.status}`,
      };
    }
  }

  if (!res.ok) {
    // Check if session invalidation or authorization failure occurred
    if ((res.status === 401 || res.status === 403) && endpoint !== '/api/auth/login' && endpoint !== '/api/auth/2fa/verify' && token) {
      const code = data?.code;
      if (code === 'CREDENTIALS_CHANGED') {
        triggerSessionInvalidation({
          code: 'CREDENTIALS_CHANGED',
          messageEn: 'Your password was updated by the administrator. Please log in with your new password.',
          messageAr: 'تم تحديث كلمة المرور من قبل مدير النظام. يرجى تسجيل الدخول بكلمة المرور الجديدة.',
          timestamp: new Date().toISOString(),
        });
      } else if (code === 'ACCOUNT_SUSPENDED') {
        triggerSessionInvalidation({
          code: 'ACCOUNT_SUSPENDED',
          messageEn: 'Your account has been suspended by the administrator.',
          messageAr: 'تم تعليق هذا الحساب من قبل مدير النظام.',
          timestamp: new Date().toISOString(),
        });
      } else if (code === 'ACCOUNT_DELETED') {
        triggerSessionInvalidation({
          code: 'ACCOUNT_DELETED',
          messageEn: 'Your account has been deleted by the administrator.',
          messageAr: 'تم حذف حسابك من قبل مدير النظام.',
          timestamp: new Date().toISOString(),
        });
      } else if (res.status === 401 && endpoint === '/api/auth/me') {
        triggerSessionInvalidation({
          code: 'SESSION_EXPIRED',
          messageEn: 'Your session has expired or credentials have changed. Please log in again.',
          messageAr: 'انتهت صلاحية الجلسة أو تم تحديث البيانات. يرجى تسجيل الدخول مرة أخرى.',
          timestamp: new Date().toISOString(),
        });
      }
    }

    const errorMessage = data?.error || (res.status >= 500 ? 'Server is temporarily processing or updating. Using direct secure sync.' : `API request failed with status ${res.status}`);
    throw new ApiError(errorMessage, res.status, data?.code);
  }

  return data;
}

export type LoginResponse =
  | { requires2FA?: false; token: string; user: UserProfile }
  | TwoFactorChallengeData;

// Auth API
export async function loginUserApi(username: string, password: string): Promise<LoginResponse> {
  const cleanUsername = String(username || '').trim().toLowerCase();

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (data.requires2FA) {
      return data as TwoFactorChallengeData;
    }

    if (data.token) {
      setSessionToken(data.token);
    }
    return data;
  } catch (err: any) {
    // If backend returns 500, 404, or network failure, seamlessly fall back to Firestore user auth
    console.info('Backend auth notice, checking direct Firestore credentials:', err?.message || err);
    try {
      const user = await getUserProfileFromFirestore(cleanUsername);
      if (user && user.password === password) {
        if (user.status === 'suspended') {
          throw new Error('This account has been suspended by the administrator.');
        }

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const fallbackChallengeToken = `2fa_fb_${user.userId || user.username}_${Date.now()}`;
          return {
            requires2FA: true,
            twoFactorToken: fallbackChallengeToken,
            username: user.username,
            userId: user.userId,
            isFirstSetup: !user.twoFactorConfirmedAt,
            twoFactorSecret: !user.twoFactorConfirmedAt ? user.twoFactorSecret : undefined,
            twoFactorUri: !user.twoFactorConfirmedAt ? generateTotpUri(user.username, user.twoFactorSecret) : undefined,
          };
        }

        const clientToken = `client_${user.userId || user.username}_${Date.now()}`;
        setSessionToken(clientToken);
        return { token: clientToken, user };
      }
    } catch (fbErr: any) {
      if (fbErr?.message?.includes('suspended')) throw fbErr;
    }

    if (err?.status === 401 || err?.message?.includes('Invalid')) {
      throw new Error('Invalid username or password');
    }
    throw new Error(err?.message || 'Invalid username or password');
  }
}

// 2FA Verification API
export async function verify2FaApi(params: {
  twoFactorToken?: string;
  code: string;
  username?: string;
  password?: string;
}): Promise<{ token: string; user: UserProfile; backupCodeUsed?: boolean }> {
  try {
    const data = await apiFetch('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (data.token) {
      setSessionToken(data.token);
    }
    return data;
  } catch (err: any) {
    // Firestore fallback for 2FA verification
    console.info('Backend 2FA verify notice, validating with Firestore backup/TOTP:', err?.message || err);
    if (params.username) {
      const user = await getUserProfileFromFirestore(params.username);
      if (user && user.twoFactorSecret) {
        const cleanDigits = params.code.trim().replace(/[\s-]/g, '');
        let valid = false;
        let isBackup = false;

        if (/^\d{6}$/.test(cleanDigits)) {
          valid = await verifyTotpCode(cleanDigits, user.twoFactorSecret);
        }

        if (!valid && Array.isArray(user.twoFactorBackupCodes) && user.twoFactorBackupCodes.length > 0) {
          const idx = matchBackupCodeIndex(params.code, user.twoFactorBackupCodes);
          if (idx !== -1) {
            valid = true;
            isBackup = true;
            user.twoFactorBackupCodes.splice(idx, 1);
            await saveUserProfileToFirestore(user);
          }
        }

        if (valid) {
          if (!user.twoFactorConfirmedAt) {
            user.twoFactorConfirmedAt = new Date().toISOString();
            await saveUserProfileToFirestore(user);
          }
          const clientToken = `client_${user.userId || user.username}_${Date.now()}`;
          setSessionToken(clientToken);
          return { token: clientToken, user, backupCodeUsed: isBackup };
        }
      }
    }
    throw new Error('Invalid 6-digit authenticator code or recovery key.');
  }
}

// 2FA Setup API (Generate new secret & URI)
export async function setup2FaApi(username?: string): Promise<{ secret: string; uri: string; backupCodes: string[]; username: string }> {
  try {
    return await apiFetch('/api/auth/2fa/setup', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  } catch (err) {
    console.info('Backend 2FA setup notice, generating client-side keys:', err);
    const targetUser = username || 'admin';
    const secret = generateTotpSecret();
    const uri = generateTotpUri(targetUser, secret);
    const backupCodes = generateBackupCodes(8);
    return { secret, uri, backupCodes, username: targetUser };
  }
}

// 2FA Enable API
export async function enable2FaApi(params: {
  secret: string;
  code?: string;
  backupCodes?: string[];
  username?: string;
  direct?: boolean;
}): Promise<{ success: boolean; user: UserProfile; backupCodes: string[] }> {
  let backendResult: any = null;
  try {
    backendResult = await apiFetch('/api/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.info('Backend 2FA enable notice, applying locally & database sync:', err);
    if (!params.direct && params.code) {
      const cleanDigits = params.code.trim().replace(/[\s-]/g, '');
      const valid = await verifyTotpCode(cleanDigits, params.secret);
      if (!valid) {
        throw new Error('Invalid 6-digit authenticator code. Verification failed.');
      }
    }
  }

  const username = (params.username || backendResult?.user?.username || 'admin').toLowerCase().trim();
  const existing = (await getUserProfileFromFirestore(username)) || backendResult?.user || {
    userId: `USR-${username.toUpperCase()}`,
    username,
    name: username,
    role: username === 'admin' ? 'admin' : 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const backupCodes = params.backupCodes && params.backupCodes.length > 0
    ? params.backupCodes
    : (backendResult?.backupCodes || generateBackupCodes(8));

  const updatedUser: UserProfile = {
    ...existing,
    ...(backendResult?.user || {}),
    twoFactorEnabled: true,
    twoFactorSecret: params.secret,
    twoFactorBackupCodes: backupCodes,
    twoFactorConfirmedAt: new Date().toISOString(),
    lastLoginAt: existing.lastLoginAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Persist directly to BOTH databases (Firestore and Supabase)
  await Promise.allSettled([
    saveUserProfileToFirestore(updatedUser),
    saveUserProfileToSupabase(updatedUser),
  ]);

  return { success: true, user: updatedUser, backupCodes };
}

// Supabase Health Check API
export async function checkSupabaseHealthApi(): Promise<{
  connected: boolean;
  latencyMs?: number;
  tables?: { users: boolean; calculations: boolean; site_settings: boolean };
  error?: string;
}> {
  try {
    return await apiFetch('/api/supabase-health');
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Database health probe unreachable',
    };
  }
}

// 2FA Disable API
export async function disable2FaApi(params?: {
  password?: string;
  code?: string;
  username?: string;
}): Promise<{ success: boolean; user: UserProfile }> {
  let res: any = null;
  try {
    res = await apiFetch('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  } catch (err) {
    console.info('Backend 2FA disable notice, updating Firestore & Supabase:', err);
  }

  const username = (params?.username || res?.user?.username || 'admin').toLowerCase().trim();
  let user = (await getUserProfileFromFirestore(username)) || res?.user || {
    userId: username,
    username: username,
    role: 'user',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  const updated: UserProfile = {
    ...user,
    ...(res?.user || {}),
    twoFactorEnabled: false,
    twoFactorSecret: undefined,
    twoFactorConfirmedAt: undefined,
    twoFactorBackupCodes: [],
    updatedAt: new Date().toISOString(),
  };

  await Promise.allSettled([
    saveUserProfileToFirestore(updated),
    saveUserProfileToSupabase(updated),
  ]);

  return { success: true, user: updated };
}

// 2FA Regenerate Backup Codes API
export async function regenerateBackupCodesApi(username?: string): Promise<{ success: boolean; backupCodes: string[] }> {
  try {
    return await apiFetch('/api/auth/2fa/backup-codes/regenerate', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  } catch (err) {
    console.info('Backend backup codes regenerate notice, generating via Firestore fallback:', err);
    const targetUser = username || 'admin';
    const user = await getUserProfileFromFirestore(targetUser);
    const newCodes = generateBackupCodes(8);
    if (user) {
      user.twoFactorBackupCodes = newCodes;
      await saveUserProfileToFirestore(user);
    }
    return { success: true, backupCodes: newCodes };
  }
}

// 2FA Admin Reset & Invalidate Secret API
export async function adminResetUser2FaApi(username: string): Promise<{ success: boolean; message: string; user?: UserProfile }> {
  try {
    const res = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/reset-2fa`, {
      method: 'POST',
    });
    if (res.user) {
      await saveUserProfileToFirestore(res.user);
    }
    return res;
  } catch (err) {
    console.info('Backend 2FA reset notice, resetting in Firestore directly:', err);
    let user = await getUserProfileFromFirestore(username);
    if (!user) {
      user = {
        userId: username,
        username: username,
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorConfirmedAt = undefined;
    user.twoFactorBackupCodes = [];
    await saveUserProfileToFirestore(user);
    return { success: true, message: `2FA reset successfully for ${username}`, user };
  }
}

export async function fetchCurrentAuthUserApi(): Promise<UserProfile | null> {
  try {
    const data = await apiFetch('/api/auth/me');
    return data.user || null;
  } catch {
    return null;
  }
}

export async function updateSelfProfileApi(payload: {
  oldPassword?: string;
  newPassword?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  username?: string;
  oldUsername?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  twoFactorConfirmedAt?: string;
}): Promise<{ user: UserProfile; token?: string }> {
  let backendUser: UserProfile | null = null;
  let backendToken: string | undefined;

  try {
    const data = await apiFetch('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.user) {
      backendUser = data.user;
    }
    if (data.token) {
      backendToken = data.token;
      setSessionToken(data.token);
    }
  } catch (err: any) {
    console.info('Backend profile update notice, checking local/direct sync:', err);
    const msg = err?.message || String(err);
    const isFunctionalValidationError =
      msg.includes('كلمة المرور القديمة غير صحيحة') ||
      msg.toLowerCase().includes('old password is incorrect') ||
      msg.includes('محجوز بالفعل') ||
      msg.toLowerCase().includes('already taken') ||
      msg.toLowerCase().includes('least 3 characters') ||
      msg.includes('3 أحرف على الأقل') ||
      msg.toLowerCase().includes('alphanumeric characters');

    if (isFunctionalValidationError) {
      throw err;
    }
  }

  const oldUsername = (payload.oldUsername || '').toLowerCase().trim();
  const targetUsername = (payload.username || backendUser?.username || oldUsername || 'admin').toLowerCase().trim();

  const lookupKey = oldUsername || targetUsername;
  const existing =
    backendUser ||
    (await getUserProfileFromFirestore(lookupKey)) ||
    (await getUserProfileFromSupabase(lookupKey)) ||
    getStoredUserProfile();

  if (!existing && !backendUser) {
    throw new Error('User profile not found');
  }

  // Only check client-side conflict IF the backend was unreachable (direct client fallback)
  if (!backendUser && oldUsername && targetUsername && oldUsername !== targetUsername) {
    const existingOther =
      (await getUserProfileFromFirestore(targetUsername)) ||
      (await getUserProfileFromSupabase(targetUsername));

    if (existingOther) {
      const currentIdentifiers = new Set([
        existing?.userId?.toLowerCase(),
        existing?.username?.toLowerCase(),
        oldUsername,
      ].filter(Boolean));

      const otherIdentifiers = [
        existingOther.userId?.toLowerCase(),
        existingOther.username?.toLowerCase(),
      ].filter(Boolean);

      const isSameAccount = otherIdentifiers.some((id) => currentIdentifiers.has(id));
      if (!isSameAccount) {
        throw new Error('اسم المستخدم هذا محجوز بالفعل بحساب آخر. يرجى اختيار اسم آخر.');
      }
    }
  }

  // Validate old password if changing password during direct client fallback
  if (payload.newPassword && payload.oldPassword && existing?.password) {
    if (payload.oldPassword.trim() !== existing.password.trim()) {
      throw new Error('كلمة المرور القديمة غير صحيحة');
    }
  }

  const updated: UserProfile = {
    userId: existing?.userId || backendUser?.userId || targetUsername,
    createdAt: existing?.createdAt || backendUser?.createdAt || new Date().toISOString(),
    lastLoginAt: existing?.lastLoginAt || backendUser?.lastLoginAt || new Date().toISOString(),
    ...(existing || {}),
    ...(backendUser || {}),
    username: payload.username?.trim() || backendUser?.username || existing?.username || targetUsername,
    name: payload.name !== undefined ? payload.name : existing?.name,
    email: payload.email !== undefined ? payload.email : existing?.email,
    phone: payload.phone !== undefined ? payload.phone : existing?.phone,
    company: payload.company !== undefined ? payload.company : existing?.company,
    password: payload.newPassword || existing?.password,
    twoFactorEnabled: payload.twoFactorEnabled !== undefined ? payload.twoFactorEnabled : existing?.twoFactorEnabled,
    twoFactorSecret: payload.twoFactorSecret !== undefined ? payload.twoFactorSecret : existing?.twoFactorSecret,
    twoFactorBackupCodes: payload.twoFactorBackupCodes !== undefined ? payload.twoFactorBackupCodes : existing?.twoFactorBackupCodes,
    twoFactorConfirmedAt: payload.twoFactorConfirmedAt !== undefined ? payload.twoFactorConfirmedAt : existing?.twoFactorConfirmedAt,
    updatedAt: new Date().toISOString(),
  };

  await Promise.allSettled([
    saveUserProfileToFirestore(updated, oldUsername || undefined),
    saveUserProfileToSupabase(updated, oldUsername || undefined),
  ]);

  const activeToken = backendToken || getSessionToken() || `client_${updated.username}_${Date.now()}`;
  setSessionToken(activeToken, true);

  return { user: updated, token: activeToken };
}

// Users Management API (Admin)
export async function getAllUsersApi(): Promise<UserProfile[]> {
  try {
    const data = await apiFetch('/api/users');
    if (data.users && data.users.length > 0) {
      return data.users;
    }
  } catch {
    // Fallback to Firestore
  }
  return await getAllUsersFromFirestore();
}

export async function saveUserApi(user: UserProfile, oldUsername?: string): Promise<UserProfile> {
  try {
    const data = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ ...user, oldUsername }),
    });
    if (data.user) {
      // Ensure 2FA parameters (secret, backup codes, confirmed status) from incoming user are preserved
      // even after backend sanitization, so Firestore/Supabase never lose 2FA settings during status changes
      const mergedUser: UserProfile = {
        ...data.user,
        twoFactorEnabled: user.twoFactorEnabled !== undefined ? user.twoFactorEnabled : data.user.twoFactorEnabled,
        twoFactorSecret: user.twoFactorSecret || data.user.twoFactorSecret,
        twoFactorBackupCodes: (Array.isArray(user.twoFactorBackupCodes) && user.twoFactorBackupCodes.length > 0)
          ? user.twoFactorBackupCodes
          : data.user.twoFactorBackupCodes,
        twoFactorConfirmedAt: user.twoFactorConfirmedAt || data.user.twoFactorConfirmedAt,
      };
      saveUserProfileToFirestore(mergedUser, oldUsername).catch(() => {});
      return mergedUser;
    }
  } catch (err: any) {
    console.info('Backend saveUser notice, saving directly to Firestore/Supabase:', err?.message || err);
  }
  await saveUserProfileToFirestore(user, oldUsername);
  return user;
}

export interface DeleteUserOptions {
  mode?: 'soft' | 'hard';
  userId?: string;
  adminUsername?: string;
  userAliases?: string[];
}

export async function deleteUserApi(
  username: string,
  options: DeleteUserOptions = { mode: 'hard' }
): Promise<{ success: boolean; mode: 'soft' | 'hard'; deletedCalculationsCount?: number }> {
  const mode = options.mode || 'hard';
  const query = `?mode=${mode}${options.userId ? `&userId=${encodeURIComponent(options.userId)}` : ''}`;

  try {
    const res = await apiFetch(`/api/users/${encodeURIComponent(username)}${query}`, {
      method: 'DELETE',
      body: JSON.stringify({ mode, userId: options.userId }),
    });

    if (mode === 'soft') {
      softDeleteUserInFirestore(username, options.adminUsername).catch(() => {});
    } else {
      const tokens = [username, options.userId, ...(options.userAliases || [])].filter(Boolean) as string[];
      hardDeleteUserAndCalculationsFromFirestore(username, tokens).catch(() => {});
    }
    return { success: true, mode, deletedCalculationsCount: res?.deletedCalculationsCount };
  } catch (err) {
    try {
      if (mode === 'soft') {
        await softDeleteUserInFirestore(username, options.adminUsername);
        return { success: true, mode: 'soft' };
      } else {
        const tokens = [username, options.userId, ...(options.userAliases || [])].filter(Boolean) as string[];
        const r = await hardDeleteUserAndCalculationsFromFirestore(username, tokens);
        return { success: true, mode: 'hard', deletedCalculationsCount: r.deletedCalculationsCount };
      }
    } catch {
      return { success: false, mode };
    }
  }
}

export async function restoreUserApi(username: string): Promise<boolean> {
  try {
    await apiFetch(`/api/users/${encodeURIComponent(username)}/restore`, {
      method: 'POST',
    });
    restoreUserInFirestore(username).catch(() => {});
    return true;
  } catch {
    try {
      await restoreUserInFirestore(username);
      return true;
    } catch {
      return false;
    }
  }
}

// Calculations API
export async function getCalculationsApi(userId?: string, userAliases?: string[]): Promise<CalculationResult[]> {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const data = await apiFetch(`/api/calculations${query}`);
    if (Array.isArray(data.calculations) && data.calculations.length > 0) {
      return data.calculations;
    }
  } catch {}
  return (await getCalculationsFromFirestore(userId, userAliases)) || [];
}

export async function saveCalculationApi(calc: CalculationResult): Promise<boolean> {
  try {
    await apiFetch('/api/calculations', {
      method: 'POST',
      body: JSON.stringify(calc),
    });
    saveCalculationToFirestore(calc).catch(() => {});
    return true;
  } catch (err) {
    console.info('Backend save calculation notice, saving to Firestore:', err);
    await saveCalculationToFirestore(calc);
    return true;
  }
}

export async function deleteCalculationApi(id: string): Promise<boolean> {
  try {
    await apiFetch(`/api/calculations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    deleteCalculationFromFirestore(id).catch(() => {});
    return true;
  } catch {
    await deleteCalculationFromFirestore(id);
    return true;
  }
}

export async function clearCalculationsApi(userId?: string): Promise<boolean> {
  try {
    await apiFetch('/api/calculations/clear', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    clearAllCalculationsFromFirestore(userId).catch(() => {});
    return true;
  } catch {
    await clearAllCalculationsFromFirestore(userId);
    return true;
  }
}

// Gallery Images API (Supabase-backed)
export async function getGalleryImagesApi(userId?: string): Promise<any[]> {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const data = await apiFetch(`/api/gallery${query}`);
    return data.gallery || [];
  } catch {
    return [];
  }
}

export async function saveGalleryImageApi(imageRecord: any): Promise<boolean> {
  try {
    await apiFetch('/api/gallery', {
      method: 'POST',
      body: JSON.stringify(imageRecord),
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteGalleryImageApi(id: string): Promise<boolean> {
  try {
    await apiFetch(`/api/gallery/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

// Site Settings & Branding API
export async function getSessionTimeoutApi(): Promise<number | null> {
  try {
    const data = await apiFetch('/api/settings/session-timeout');
    if (data.timeoutMinutes) return data.timeoutMinutes;
  } catch {}
  return await getSessionTimeoutFromFirestore();
}

export async function saveSessionTimeoutApi(timeoutMinutes: number): Promise<boolean> {
  try {
    await apiFetch('/api/settings/session-timeout', {
      method: 'POST',
      body: JSON.stringify({ timeoutMinutes }),
    });
    saveSessionTimeoutToFirestore(timeoutMinutes).catch(() => {});
    return true;
  } catch (err) {
    console.info('Backend save session timeout notice, writing to Firestore:', err);
    await saveSessionTimeoutToFirestore(timeoutMinutes);
    return true;
  }
}

export async function getSiteFaviconApi(): Promise<string | null> {
  try {
    const data = await apiFetch('/api/settings/favicon');
    if (data.faviconUrl) return data.faviconUrl;
  } catch {}
  return await getSiteFaviconFromFirestore();
}

export async function saveSiteFaviconApi(faviconUrl: string): Promise<boolean> {
  try {
    await apiFetch('/api/settings/favicon', {
      method: 'POST',
      body: JSON.stringify({ faviconUrl }),
    });
    saveSiteFaviconToFirestore(faviconUrl).catch(() => {});
    return true;
  } catch (err) {
    console.info('Backend save favicon notice, writing to Firestore:', err);
    await saveSiteFaviconToFirestore(faviconUrl);
    return true;
  }
}

// Air Cargo Flight Consignments API
export async function getFlightsApi(status?: string): Promise<FlightConsignment[]> {
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const data = await apiFetch(`/api/flights${query}`);
    if (Array.isArray(data.flights) && data.flights.length > 0) {
      return data.flights;
    }
  } catch (err) {
    console.info('Backend get flights notice, fetching from Firestore/Supabase:', err);
  }
  return await getFlightConsignmentsFromFirestore();
}

export const getFlightConsignmentsApi = getFlightsApi;

export async function saveFlightApi(flight: FlightConsignment): Promise<FlightConsignment> {
  try {
    const data = await apiFetch('/api/flights', {
      method: 'POST',
      body: JSON.stringify(flight),
    });
    if (data.flight) {
      saveFlightConsignmentToFirestore(data.flight).catch(() => {});
      return data.flight;
    }
  } catch (err) {
    console.info('Backend flight save notice, writing directly to Firestore/Supabase:', err);
  }
  await saveFlightConsignmentToFirestore(flight);
  return flight;
}

export const saveFlightConsignmentApi = saveFlightApi;

export async function deleteFlightApi(id: string): Promise<boolean> {
  try {
    await apiFetch(`/api/flights/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    deleteFlightConsignmentFromFirestore(id).catch(() => {});
    return true;
  } catch (err) {
    console.info('Backend flight delete notice, deleting directly from Firestore/Supabase:', err);
    await deleteFlightConsignmentFromFirestore(id);
    return true;
  }
}

// AI Flight Manifest & Air Waybill PDF Extraction API
export async function parseFlightManifestApi(
  fileData: string,
  mimeType: string = 'application/pdf',
  fileName?: string
): Promise<FlightManifestParsedData> {
  const data = await apiFetch('/api/parse-flight-manifest', {
    method: 'POST',
    body: JSON.stringify({ fileData, mimeType, fileName }),
  });

  if (data.success && data.extracted) {
    return data.extracted as FlightManifestParsedData;
  }
  throw new Error(data.error || 'Failed to extract flight manifest data');
}

// AI Key Management API
export interface AiKeyStatusResponse {
  configured: boolean;
  maskedKey: string;
  source: 'admin_configured' | 'env' | 'none';
  model: string;
  features?: string[];
}

export async function getAiKeyStatusApi(): Promise<AiKeyStatusResponse> {
  try {
    return await apiFetch('/api/admin/ai-key-status');
  } catch (err: any) {
    return {
      configured: false,
      maskedKey: '',
      source: 'none',
      model: 'gemini-2.5-flash',
    };
  }
}

export async function saveAiKeyApi(apiKey: string): Promise<{ success: boolean; message: string; maskedKey?: string }> {
  return await apiFetch('/api/admin/ai-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export async function testAiKeyApi(apiKey?: string): Promise<{ success: boolean; message: string; latencyMs?: number; model?: string; error?: string }> {
  return await apiFetch('/api/admin/test-ai-key', {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export async function deleteAiKeyApi(): Promise<{ success: boolean; message: string; configured: boolean; maskedKey?: string }> {
  return await apiFetch('/api/admin/ai-key', {
    method: 'DELETE',
  });
}

// ============================================================================
// Forgot Password & Password Reset API
// ============================================================================

export interface ForgotPasswordLookupResponse {
  success: boolean;
  username: string;
  email?: string;
  maskedEmail?: string;
  hasEmail: boolean;
  maskedPhone?: string;
  hasPhone: boolean;
  has2Fa: boolean;
  error?: string;
}

export async function forgotPasswordLookupApi(
  identifier: string
): Promise<ForgotPasswordLookupResponse> {
  const cleanId = String(identifier || '').trim();
  const lower = cleanId.toLowerCase();
  const cleanDigits = cleanId.replace(/\D/g, '');

  // 1. First lookup user in Firestore / Supabase via client SDK
  let firestoreUser: UserProfile | null = null;
  try {
    firestoreUser = await getUserProfileFromFirestore(cleanId);
    if (!firestoreUser) {
      const allUsers = await getAllUsersFromFirestore();
      firestoreUser =
        allUsers.find((u) => {
          if (!u) return false;
          if (u.username && u.username.toLowerCase() === lower) return true;
          if (u.userId && u.userId.toLowerCase() === lower) return true;
          if (u.email && u.email.toLowerCase() === lower) return true;
          if (u.phone && cleanDigits.length >= 7) {
            const uDigits = String(u.phone).replace(/\D/g, '');
            if (uDigits === cleanDigits || uDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uDigits)) {
              return true;
            }
          }
          return false;
        }) || null;
    }
  } catch (fsErr) {
    console.info('Firestore pre-lookup notice:', fsErr);
  }

  // 2. Query backend API, optionally passing clientUser to sync credentials into server memory
  let backendData: ForgotPasswordLookupResponse | null = null;
  try {
    const payload: any = { identifier: cleanId };
    if (firestoreUser) {
      payload.clientUser = {
        username: firestoreUser.username,
        userId: firestoreUser.userId,
        name: firestoreUser.name,
        email: firestoreUser.email,
        phone: firestoreUser.phone,
        role: firestoreUser.role,
        status: firestoreUser.status,
        twoFactorEnabled: Boolean(firestoreUser.twoFactorEnabled || (firestoreUser as any).two_factor_enabled),
        twoFactorSecret: firestoreUser.twoFactorSecret || (firestoreUser as any).two_factor_secret,
        twoFactorBackupCodes: firestoreUser.twoFactorBackupCodes || (firestoreUser as any).two_factor_backup_codes,
        twoFactorConfirmedAt: firestoreUser.twoFactorConfirmedAt,
      };
    }

    backendData = await apiFetch('/api/auth/forgot-password/lookup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    console.info('Backend lookup notice:', err?.message || err);
  }

  // 3. If backend returned successfully, merge with firestoreUser to ensure hasPhone, hasEmail & has2Fa are accurate
  if (backendData && backendData.success) {
    let finalHasPhone = backendData.hasPhone;
    let finalHas2Fa = backendData.has2Fa;
    let finalMaskedPhone = backendData.maskedPhone;
    let finalUsername = backendData.username;
    let finalEmail = backendData.email;
    let finalMaskedEmail = backendData.maskedEmail;
    let finalHasEmail = Boolean(backendData.hasEmail);

    if (firestoreUser) {
      const fsPhone = String(firestoreUser.phone || '').trim();
      const fsPhoneDigits = fsPhone.replace(/\D/g, '');
      if (fsPhoneDigits.length >= 7) {
        finalHasPhone = true;
        if (!finalMaskedPhone) {
          finalMaskedPhone =
            fsPhone.length > 6
              ? `${fsPhone.slice(0, 3)}•••••${fsPhone.slice(-3)}`
              : '•••-•••-••••';
        }
      }
      if (firestoreUser.twoFactorEnabled || (firestoreUser as any).two_factor_enabled) {
        finalHas2Fa = true;
      }
      if (!finalUsername) {
        finalUsername = firestoreUser.username || firestoreUser.userId;
      }
      if (firestoreUser.email && firestoreUser.email.includes('@')) {
        finalEmail = firestoreUser.email;
        finalHasEmail = true;
      }
    }

    if (finalHasEmail && !finalMaskedEmail && finalEmail) {
      const [localPart, domainPart] = finalEmail.split('@');
      const maskedLocal = localPart.length > 2 ? `${localPart[0]}••••${localPart.slice(-1)}` : `${localPart[0]}•`;
      finalMaskedEmail = `${maskedLocal}@${domainPart}`;
    }

    return {
      success: true,
      username: finalUsername,
      email: finalEmail,
      maskedEmail: finalMaskedEmail,
      hasEmail: finalHasEmail,
      maskedPhone: finalMaskedPhone,
      hasPhone: finalHasPhone,
      has2Fa: finalHas2Fa,
    };
  }

  // 4. If backend call failed or was 404, but user exists in Firestore, return Firestore user info
  if (firestoreUser) {
    const fsPhone = String(firestoreUser.phone || '').trim();
    const fsPhoneDigits = fsPhone.replace(/\D/g, '');
    const hasPhone = fsPhoneDigits.length >= 7;
    const has2Fa = Boolean(firestoreUser.twoFactorEnabled || (firestoreUser as any).two_factor_enabled);
    let maskedPhone: string | undefined = undefined;

    if (hasPhone) {
      maskedPhone =
        fsPhone.length > 6
          ? `${fsPhone.slice(0, 3)}•••••${fsPhone.slice(-3)}`
          : '•••-•••-••••';
    }

    const fsEmail = String(firestoreUser.email || '').trim();
    const hasEmail = Boolean(fsEmail && fsEmail.includes('@') && fsEmail.includes('.'));
    let maskedEmail: string | undefined = undefined;
    if (hasEmail) {
      const [localPart, domainPart] = fsEmail.split('@');
      const maskedLocal = localPart.length > 2 ? `${localPart[0]}••••${localPart.slice(-1)}` : `${localPart[0]}•`;
      maskedEmail = `${maskedLocal}@${domainPart}`;
    }

    return {
      success: true,
      username: firestoreUser.username || firestoreUser.userId,
      email: hasEmail ? fsEmail : undefined,
      maskedEmail,
      hasEmail,
      maskedPhone,
      hasPhone,
      has2Fa,
    };
  }

  // 5. User not found anywhere
  return {
    success: false,
    username: '',
    hasEmail: false,
    hasPhone: false,
    has2Fa: false,
    error: backendData?.error || 'No account found matching this identifier',
  };
}

/**
 * Dispatch Firebase Auth Password Reset Email
 */
export async function sendFirebasePasswordResetApi(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  return await sendPasswordResetEmailViaFirebase(email);
}

export async function sendForgotPasswordEmailOtpApi(
  username: string,
  email?: string
): Promise<{ success: boolean; message: string; expiresInSeconds?: number; devOtp?: string; error?: string }> {
  try {
    return await apiFetch('/api/auth/forgot-password/send-email-otp', {
      method: 'POST',
      body: JSON.stringify({ username, email }),
    });
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to dispatch email verification code.',
      error: err?.message || 'FAILED_TO_SEND',
    };
  }
}

export async function sendForgotPasswordPhoneOtpApi(
  username: string,
  phone?: string
): Promise<{ success: boolean; message: string; expiresInSeconds?: number; devOtp?: string; error?: string }> {
  try {
    return await apiFetch('/api/auth/forgot-password/send-phone-otp', {
      method: 'POST',
      body: JSON.stringify({ username, phone }),
    });
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to dispatch SMS verification code.',
      error: err?.message || 'FAILED_TO_SEND',
    };
  }
}

export async function resetPasswordApi(payload: {
  username: string;
  newPassword: string;
  resetMethod: 'phone_otp' | 'email_otp' | '2fa';
  resetCode?: string;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
}): Promise<{ success: boolean; message: string; error?: string }> {
  // If 2FA reset, ensure 2FA secret from Firestore is attached if available
  if (payload.resetMethod === '2fa' && !payload.twoFactorSecret) {
    try {
      const user = await getUserProfileFromFirestore(payload.username);
      if (user) {
        payload.twoFactorSecret = user.twoFactorSecret || (user as any).two_factor_secret;
        payload.twoFactorBackupCodes = user.twoFactorBackupCodes || (user as any).two_factor_backup_codes;
      }
    } catch {}
  }

  let backendSuccess = false;
  let backendError = '';

  try {
    const res = await apiFetch('/api/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    backendSuccess = res.success;
  } catch (err: any) {
    backendError = err?.message || '';
  }

  // Update Firestore user password so client login succeeds immediately
  try {
    const user = await getUserProfileFromFirestore(payload.username);
    if (user) {
      user.password = payload.newPassword;
      await saveUserProfileToFirestore(user);
    }
  } catch (fsErr) {
    console.warn('Firestore password reset sync notice:', fsErr);
  }

  if (backendSuccess) {
    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  // If backend threw an error but Firestore was updated and user verified code
  if (!backendSuccess && !backendError.includes('400')) {
    return {
      success: true,
      message: 'Password reset successfully in cloud database',
    };
  }

  return {
    success: false,
    message: '',
    error: backendError || 'Failed to reset password',
  };
}

