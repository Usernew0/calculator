import { UserProfile } from '../types';

/**
 * Enhanced Session & User Profile Persistence Manager
 *
 * Implements clean architectural separation between:
 * 1. 'Session Token' storage (cargo_session_token / cargo_auth_token)
 * 2. 'User Profile' metadata storage (cargo_user_profile)
 *
 * Provides safety guards to prevent admin session credentials from being
 * overwritten when modifying user records.
 */

export const STORAGE_KEYS = {
  SESSION_TOKEN: 'cargo_session_token',
  AUTH_TOKEN_LEGACY: 'cargo_auth_token',
  USER_PROFILE: 'cargo_user_profile',
  REMEMBER_ME: 'cargo_remember_me',
  REMEMBER_USERNAME: 'cargo_remember_username',
  SESSION_ACTIVE: 'cargo_session_active',
  INACTIVITY_TIMEOUT: 'cargo_inactivity_timeout_minutes',
} as const;

/**
 * Retrieve Session Token from localStorage or sessionStorage
 */
export function getSessionToken(): string | null {
  try {
    return (
      localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) ||
      sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN) ||
      localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY) ||
      sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY) ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Save Session Token independently from User Profile
 */
export function setSessionToken(token: string | null, rememberMe = true): void {
  try {
    if (!token) {
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY);
      sessionStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY);
      return;
    }

    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY, token);
      sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
      sessionStorage.setItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY, token);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
      sessionStorage.setItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY, token);
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN_LEGACY);
    }
  } catch (err) {
    console.warn('Unable to persist session token:', err);
  }
}

/**
 * Retrieve User Profile data independently from Session Token
 */
export function getStoredUserProfile(): UserProfile | null {
  try {
    const isRemembered = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) !== 'false';
    const isSessionActive = sessionStorage.getItem(STORAGE_KEYS.SESSION_ACTIVE) === 'true';

    // If neither remember-me is active nor current browser tab session is active, discard
    if (!isRemembered && !isSessionActive) {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      return null;
    }

    const saved = localStorage.getItem(STORAGE_KEYS.USER_PROFILE) || sessionStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      // Ensure admin role integrity for built-in admin identifiers
      if (
        (parsed.username?.toLowerCase() === 'admin' || parsed.userId === 'USR-ADMIN-001') &&
        parsed.role !== 'admin'
      ) {
        parsed.role = 'admin';
        parsed.status = 'active';
        setStoredUserProfile(parsed, isRemembered);
      }
      return parsed as UserProfile;
    }
  } catch (err) {
    console.warn('Unable to read user profile from storage:', err);
  }
  return null;
}

/**
 * Save User Profile metadata independently from Session Token
 */
export function setStoredUserProfile(profile: UserProfile | null, rememberMe = true): void {
  try {
    if (!profile) {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      sessionStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      return;
    }

    const serialized = JSON.stringify(profile);
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, serialized);
      sessionStorage.setItem(STORAGE_KEYS.USER_PROFILE, serialized);
    } else {
      sessionStorage.setItem(STORAGE_KEYS.USER_PROFILE, serialized);
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, serialized);
    }
  } catch (err) {
    console.warn('Unable to persist user profile:', err);
  }
}

/**
 * Atomically initialize full user session on successful login
 */
export function saveFullSession(token: string | null, profile: UserProfile, rememberMe = true): void {
  try {
    // 1. Persist Session Token in dedicated token slot
    setSessionToken(token, rememberMe);

    // 2. Persist User Profile in dedicated profile slot
    setStoredUserProfile(profile, rememberMe);

    // 3. Persist Remember Me & Session Active flags
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
      localStorage.setItem(STORAGE_KEYS.REMEMBER_USERNAME, profile.username.toLowerCase().trim());
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ACTIVE, 'true');
    } else {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'false');
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_USERNAME);
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ACTIVE, 'true');
    }
  } catch (err) {
    console.warn('Unable to save full session:', err);
  }
}

/**
 * Clears active session credentials and profile data on logout
 */
export function clearFullSession(): void {
  try {
    setSessionToken(null);
    setStoredUserProfile(null);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_ACTIVE);
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    sessionStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
  } catch (err) {
    console.warn('Unable to clear full session:', err);
  }
}

/**
 * Checks if a given profile or username matches the currently authenticated session user.
 * Essential for admin guards so editing other users never alters the admin's active credentials.
 */
export function isCurrentActiveUser(
  currentUser: UserProfile | null | undefined,
  targetUserOrUsername: UserProfile | string | null | undefined
): boolean {
  if (!currentUser || !targetUserOrUsername) return false;

  const currentUsername = (currentUser.username || '').toLowerCase().trim();
  const currentUserId = (currentUser.userId || '').toLowerCase().trim();

  if (typeof targetUserOrUsername === 'string') {
    const target = targetUserOrUsername.toLowerCase().trim();
    return target === currentUsername || target === currentUserId;
  }

  const targetUsername = (targetUserOrUsername.username || '').toLowerCase().trim();
  const targetUserId = (targetUserOrUsername.userId || '').toLowerCase().trim();

  return (
    (currentUsername !== '' && currentUsername === targetUsername) ||
    (currentUserId !== '' && currentUserId === targetUserId)
  );
}

/**
 * Safely updates active user profile if and only if the updated profile belongs to the current session user.
 * Preserves the active Session Token completely untouched.
 */
export function updateActiveUserProfileIfCurrent(
  currentUser: UserProfile | null | undefined,
  updatedProfile: UserProfile
): boolean {
  if (!isCurrentActiveUser(currentUser, updatedProfile)) {
    // Target is another user record (e.g. edited by admin) — DO NOT touch current admin session
    return false;
  }

  // Target is the current active user — update profile data only, keep session token intact
  const isRemembered = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) !== 'false';
  setStoredUserProfile(updatedProfile, isRemembered);
  return true;
}
