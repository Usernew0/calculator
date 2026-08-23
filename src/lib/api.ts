import { UserProfile, CalculationResult, FlightConsignment, FlightManifestParsedData } from '../types';
import { getSessionToken, setSessionToken, triggerSessionInvalidation } from './session';
import {
  getAllUsersFromFirestore,
  saveUserProfileToFirestore,
  deleteUserFromFirestore,
  getUserProfileFromFirestore,
  saveFlightConsignmentToFirestore,
  getFlightConsignmentsFromFirestore,
  deleteFlightConsignmentFromFirestore,
} from './firebase';

/**
 * Client-Side API Helper for Secure Backend Operations with resilient fallback
 */

export { getSessionToken as getAuthToken, setSessionToken as setAuthToken };

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Check if session invalidation or authorization failure occurred
    if ((res.status === 401 || res.status === 403) && endpoint !== '/api/auth/login' && token) {
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

    const err = new Error(data?.error || `API request failed with status ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }

  return data;
}

// Auth API
export async function loginUserApi(username: string, password: string): Promise<{ token: string; user: UserProfile }> {
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      setSessionToken(data.token);
    }
    return data;
  } catch (err: any) {
    // If backend returns 404 (e.g. static hosting without API routes), fallback directly to Firestore user auth
    if (err?.status === 404 || err?.message?.includes('404')) {
      const user = await getUserProfileFromFirestore(username);
      if (user && user.password === password) {
        if (user.status === 'suspended') {
          throw new Error('This account has been suspended by the administrator.');
        }
        const clientToken = `client_${user.userId || user.username}_${Date.now()}`;
        setSessionToken(clientToken);
        return { token: clientToken, user };
      }
      throw new Error('Invalid username or password');
    }
    throw err;
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
  company?: string;
}): Promise<UserProfile> {
  const data = await apiFetch('/api/auth/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.user;
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
    return data.user;
  } catch (err: any) {
    // Fallback to direct Firestore save
    await saveUserProfileToFirestore(user, oldUsername);
    return user;
  }
}

export async function deleteUserApi(username: string): Promise<boolean> {
  try {
    await apiFetch(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    try {
      await deleteUserFromFirestore(username);
      return true;
    } catch {
      return false;
    }
  }
}

// Calculations API
export async function getCalculationsApi(userId?: string): Promise<CalculationResult[]> {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const data = await apiFetch(`/api/calculations${query}`);
    return data.calculations || [];
  } catch {
    return [];
  }
}

export async function saveCalculationApi(calc: CalculationResult): Promise<boolean> {
  try {
    await apiFetch('/api/calculations', {
      method: 'POST',
      body: JSON.stringify(calc),
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteCalculationApi(id: string): Promise<boolean> {
  try {
    await apiFetch(`/api/calculations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearCalculationsApi(userId?: string): Promise<boolean> {
  try {
    await apiFetch('/api/calculations/clear', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return true;
  } catch {
    return false;
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
    const res = await fetch('/api/settings/session-timeout');
    const data = await res.json();
    return data.timeoutMinutes || null;
  } catch {
    return null;
  }
}

export async function saveSessionTimeoutApi(timeoutMinutes: number): Promise<boolean> {
  try {
    await apiFetch('/api/settings/session-timeout', {
      method: 'POST',
      body: JSON.stringify({ timeoutMinutes }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function getSiteFaviconApi(): Promise<string | null> {
  try {
    const res = await fetch('/api/settings/favicon');
    const data = await res.json();
    return data.faviconUrl || null;
  } catch {
    return null;
  }
}

export async function saveSiteFaviconApi(faviconUrl: string): Promise<boolean> {
  try {
    await apiFetch('/api/settings/favicon', {
      method: 'POST',
      body: JSON.stringify({ faviconUrl }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function checkSupabaseHealthApi() {
  try {
    return await apiFetch('/api/supabase-health');
  } catch (err: any) {
    return {
      isConnected: false,
      usersTableOk: false,
      calculationsTableOk: false,
      usersCount: 0,
      calculationsCount: 0,
      checkedAt: new Date().toISOString(),
      generalError: err?.message || 'Server connection issue',
    };
  }
}

// Flight Consignments API
export async function getFlightsApi(userId?: string): Promise<FlightConsignment[]> {
  try {
    const url = userId ? `/api/flights?userId=${encodeURIComponent(userId)}` : '/api/flights';
    const data = await apiFetch(url);
    if (data.flights && Array.isArray(data.flights)) {
      return data.flights;
    }
  } catch (err) {
    console.info('Backend flights fetch notice, falling back to Firestore/Supabase:', err);
  }
  return await getFlightConsignmentsFromFirestore(userId);
}

export async function saveFlightApi(flight: FlightConsignment): Promise<FlightConsignment> {
  try {
    const data = await apiFetch('/api/flights', {
      method: 'POST',
      body: JSON.stringify(flight),
    });
    if (data.flight) {
      // Background async dual-write to Firestore
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
      model: 'gemini-3.7-flash',
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



