import { UserProfile, CalculationResult } from '../types';
import { getSessionToken, setSessionToken } from './session';

/**
 * Client-Side API Helper for Secure Backend Operations
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
    throw new Error(data?.error || `API request failed with status ${res.status}`);
  }

  return data;
}

// Auth API
export async function loginUserApi(username: string, password: string): Promise<{ token: string; user: UserProfile }> {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (data.token) {
    setSessionToken(data.token);
  }
  return data;
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
    return data.users || [];
  } catch {
    return [];
  }
}

export async function saveUserApi(user: UserProfile, oldUsername?: string): Promise<UserProfile> {
  const data = await apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ ...user, oldUsername }),
  });
  return data.user;
}

export async function deleteUserApi(username: string): Promise<boolean> {
  try {
    await apiFetch(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
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

// Site Settings & Branding API
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
