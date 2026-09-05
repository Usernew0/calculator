import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  writeBatch,
  setLogLevel
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { CalculationResult, UserProfile, FlightConsignment } from "../types";
import firebaseConfig from "../../firebase-applet-config.json";
import {
  saveUserProfileToSupabase,
  getUserProfileFromSupabase,
  getAllUsersFromSupabase,
  deleteUserFromSupabase,
  saveCalculationToSupabase,
  deleteCalculationFromSupabase,
  clearAllCalculationsFromSupabase,
  getCalculationsFromSupabase,
  subscribeToCalculationsSupabase,
  subscribeToUsersSupabase,
  saveFlightConsignmentToSupabase,
  getFlightConsignmentsFromSupabase,
  deleteFlightConsignmentFromSupabase,
  subscribeToFlightConsignmentsSupabase,
} from "./supabase";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore targeting the specific provisioned database instance ID
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Suppress non-fatal Firestore WebChannel transport reconnect stream warnings
setLogLevel('error');

export const auth = getAuth(app);

let isAuthAttemptInProgress = false;
let isAnonymousAuthDisabled = false;

// Ensure anonymous or persistent authentication before performing Firestore queries
export async function ensureAuth(): Promise<void> {
  if (auth.currentUser || isAnonymousAuthDisabled) return;
  if (isAuthAttemptInProgress) return;

  isAuthAttemptInProgress = true;
  try {
    await signInAnonymously(auth);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('admin-restricted-operation') || msg.includes('operation-not-allowed')) {
      // Anonymous authentication is not enabled in Firebase Console; operate in standard unauthenticated mode
      isAnonymousAuthDisabled = true;
    } else {
      console.info("Firebase auth status:", msg);
    }
  } finally {
    isAuthAttemptInProgress = false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.info('Firestore Operation Info:', errInfo.operationType, errInfo.path, errInfo.error);
  return errInfo;
}

const CALCULATIONS_COLLECTION = "calculations";
const USERS_COLLECTION = "users";

/**
 * Initializes Firestore connection.
 */
export async function seedDefaultDataToFirestore(): Promise<void> {
  try {
    await ensureAuth();
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, "auto-seed");
  }
}

/**
 * Deduplicate users by unique userId and username so accounts are never duplicated in state or UI.
 */
export function deduplicateUsers(usersList: UserProfile[]): UserProfile[] {
  const usersMap = new Map<string, UserProfile>();
  const seenUsernames = new Map<string, string>(); // lowercase username -> canonical key

  usersList.forEach((u) => {
    if (!u) return;
    const usernameNorm = (u.username || '').toLowerCase().trim();
    const userIdNorm = (u.userId || '').toLowerCase().trim();
    const primaryKey = usernameNorm || userIdNorm;
    if (!primaryKey) return;

    // Check if we've already recorded this user by username or userId
    let existingKey = seenUsernames.get(usernameNorm) || (userIdNorm ? seenUsernames.get(userIdNorm) : undefined);

    if (existingKey && usersMap.has(existingKey)) {
      const existing = usersMap.get(existingKey)!;
      const canonicalUserId =
        (existing.userId && existing.userId.startsWith('USR-'))
          ? existing.userId
          : ((u.userId && u.userId.startsWith('USR-')) ? u.userId : (existing.userId || u.userId || (usernameNorm ? `USR-${usernameNorm.toUpperCase()}` : '')));

      usersMap.set(existingKey, {
        ...existing,
        ...u,
        username: existing.username || u.username,
        userId: canonicalUserId,
        password: u.password || existing.password || '',
        createdAt: existing.createdAt || u.createdAt,
        // Crucial: preserve 2FA configuration if either instance has it
        twoFactorEnabled: u.twoFactorEnabled !== undefined ? u.twoFactorEnabled : existing.twoFactorEnabled,
        twoFactorSecret: u.twoFactorSecret || existing.twoFactorSecret,
        twoFactorBackupCodes: (Array.isArray(u.twoFactorBackupCodes) && u.twoFactorBackupCodes.length > 0)
          ? u.twoFactorBackupCodes
          : (existing.twoFactorBackupCodes || []),
        twoFactorConfirmedAt: u.twoFactorConfirmedAt || existing.twoFactorConfirmedAt,
      });
    } else {
      const stableU: UserProfile = {
        ...u,
        userId: (u.userId && u.userId.startsWith('USR-'))
          ? u.userId
          : (u.userId || (usernameNorm ? `USR-${usernameNorm.toUpperCase()}` : primaryKey)),
      };
      usersMap.set(primaryKey, stableU);
      if (usernameNorm) seenUsernames.set(usernameNorm, primaryKey);
      if (userIdNorm) seenUsernames.set(userIdNorm, primaryKey);
    }
  });

  return Array.from(usersMap.values());
}

/**
 * Save user profile schema to Firestore database and Supabase.
 * If oldUsername is provided and differs from the new username, purges the old user document/row.
 */
export async function saveUserProfileToFirestore(
  profile: UserProfile,
  oldUsername?: string
): Promise<void> {
  const newUsernameKey = (profile.username || profile.userId).toLowerCase().trim();

  // If oldUsername is supplied and differs from newUsernameKey, clean up the old document/row
  if (oldUsername && oldUsername.toLowerCase().trim() !== newUsernameKey) {
    try {
      await deleteUserFromFirestore(oldUsername.toLowerCase().trim());
    } catch (err) {
      console.warn("Notice: Cleaning up old user document key failed:", err);
    }
  }

  // Save to Supabase
  try {
    await saveUserProfileToSupabase(profile, oldUsername);
  } catch (err) {
    console.warn("Supabase user save notice:", err);
  }

  // Save to Firestore (for Auth & Status checks)
  try {
    await ensureAuth();
    const docKey = newUsernameKey;
    const docRef = doc(db, USERS_COLLECTION, docKey);

    // Build clean Firestore payload without undefined values
    const firestorePayload: Record<string, any> = {
      userId: profile.userId || docKey,
      username: profile.username || docKey,
      name: profile.name ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      company: profile.company ?? '',
      role: profile.role ?? 'user',
      status: profile.status ?? 'active',
      createdAt: profile.createdAt || new Date().toISOString(),
      lastLoginAt: profile.lastLoginAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // CRITICAL: NEVER overwrite or wipe an existing password if the incoming profile does not specify a non-empty password.
    // Client-side profiles, sanitized responses, and status/2FA updates intentionally omit passwords for security.
    if (profile.password && String(profile.password).trim().length > 0) {
      firestorePayload.password = String(profile.password).trim();
    }

    if (profile.twoFactorEnabled !== undefined) {
      firestorePayload.twoFactorEnabled = Boolean(profile.twoFactorEnabled);
    }

    if (profile.twoFactorEnabled) {
      if (profile.twoFactorSecret) {
        firestorePayload.twoFactorSecret = profile.twoFactorSecret;
      }
      if (profile.twoFactorConfirmedAt) {
        firestorePayload.twoFactorConfirmedAt = profile.twoFactorConfirmedAt;
      } else {
        firestorePayload.twoFactorConfirmedAt = new Date().toISOString();
      }
      if (Array.isArray(profile.twoFactorBackupCodes) && profile.twoFactorBackupCodes.length > 0) {
        firestorePayload.twoFactorBackupCodes = profile.twoFactorBackupCodes;
      }
    } else if (profile.twoFactorEnabled === false && (profile.twoFactorSecret === null || profile.twoFactorSecret === '')) {
      // Explicitly remove/delete 2FA secret and backup codes ONLY when 2FA is explicitly disabled or reset
      firestorePayload.twoFactorSecret = deleteField();
      firestorePayload.twoFactorConfirmedAt = deleteField();
      firestorePayload.twoFactorBackupCodes = [];
    }

    await setDoc(docRef, firestorePayload, { merge: true });
    console.info("User profile saved to Firestore collection successfully:", docKey);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, USERS_COLLECTION);
  }
}

/**
 * Fetch user profile schema from Firestore (for auth/status) or Supabase
 */
export async function getUserProfileFromFirestore(username: string): Promise<UserProfile | null> {
  let profile: UserProfile | null = null;

  // Try Firestore first (Auth & Status verification)
  try {
    await ensureAuth();
    const docKey = username.toLowerCase().trim();
    const docRef = doc(db, USERS_COLLECTION, docKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      profile = snap.data() as UserProfile;
    } else {
      const qSnap = await getDocs(query(collection(db, USERS_COLLECTION)));
      qSnap.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        if (
          docSnap.id === docKey ||
          data.username?.toLowerCase() === docKey ||
          data.userId?.toLowerCase() === docKey ||
          data.email?.toLowerCase() === docKey
        ) {
          profile = data;
        }
      });
    }
  } catch (error: any) {
    console.info("Firestore user fetch notice:", error?.message || error);
  }

  // Fallback / merge from Supabase if needed
  if (!profile) {
    try {
      profile = await getUserProfileFromSupabase(username);
    } catch (err) {
      console.warn("Supabase user fetch fallback notice:", err);
    }
  }

  return profile;
}

/**
 * Fetch all user profile schemas from Firestore & Supabase
 */
export async function getAllUsersFromFirestore(): Promise<UserProfile[]> {
  const allUsers: UserProfile[] = [];

  // Fetch from Supabase
  try {
    const supabaseUsers = await getAllUsersFromSupabase();
    if (Array.isArray(supabaseUsers)) {
      allUsers.push(...supabaseUsers);
    }
  } catch (err) {
    console.warn("Supabase fetch all users notice:", err);
  }

  // Fetch from Firestore
  try {
    await ensureAuth();
    const qSnap = await getDocs(query(collection(db, USERS_COLLECTION)));
    qSnap.forEach((docSnap) => {
      const u = docSnap.data() as UserProfile;
      if (u) {
        allUsers.push(u);
      }
    });
  } catch (error: any) {
    console.info("Firestore fetch users notice:", error?.message || error);
  }

  return deduplicateUsers(allUsers);
}

/**
 * Delete a user profile schema from Firestore & Supabase
 */
export async function deleteUserFromFirestore(key: string): Promise<void> {
  // Delete from Supabase
  try {
    await deleteUserFromSupabase(key);
  } catch (err) {
    console.warn("Supabase delete user notice:", err);
  }

  // Delete from Firestore
  try {
    await ensureAuth();
    const docKey = key.toLowerCase().trim();
    const docRef = doc(db, USERS_COLLECTION, docKey);
    await deleteDoc(docRef);
    console.info("User deleted from Firestore database:", docKey);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, USERS_COLLECTION);
  }
}

/**
 * Subscribe to real-time account status & credential changes for the active session user
 */
export function subscribeToUserSessionStatus(
  username: string,
  currentPassword: string | undefined,
  onStatusChange: (change: {
    status: 'ok' | 'suspended' | 'deleted' | 'credentials_changed';
    user?: UserProfile | null;
  }) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;
  let isCancelled = false;

  const init = async () => {
    try {
      await ensureAuth();
      if (isCancelled) return;
      const cleanKey = username.toLowerCase().trim();
      const docRef = doc(db, USERS_COLLECTION, cleanKey);

      unsubFirestore = onSnapshot(
        docRef,
        (docSnap) => {
          if (!docSnap.exists()) {
            onStatusChange({ status: 'deleted' });
            return;
          }
          const data = docSnap.data() as UserProfile;
          if (data.status === 'suspended') {
            onStatusChange({ status: 'suspended', user: data });
            return;
          }

          // Real-time password / credential change detection
          if (
            currentPassword &&
            data.password &&
            data.password !== currentPassword
          ) {
            onStatusChange({ status: 'credentials_changed', user: data });
            return;
          }

          onStatusChange({ status: 'ok', user: data });
        },
        (err) => {
          console.info('User session status listener notice:', err?.message || err);
        }
      );
    } catch (e) {
      console.warn('Unable to subscribe to user session status:', e);
    }
  };

  init();

  return () => {
    isCancelled = true;
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Helper to test whether a calculation document matches a user identifier or list of aliases
 */
export function matchCalculationToUser(
  item: any,
  filterUserId?: string | null,
  userAliases?: string[]
): boolean {
  if (!filterUserId && (!userAliases || userAliases.length === 0)) return true;

  const targetTokens = [
    filterUserId,
    ...(userAliases || []),
  ]
    .filter(Boolean)
    .map((t) => String(t).toLowerCase().trim());

  if (targetTokens.length === 0) return true;

  const itemTokens = [
    item.userId,
    item.user_id,
    item.createdBy,
    item.created_by,
    item.author,
    item.traderId,
    item.username,
    item.input?.userId,
    item.input?.author,
    item.input?.username,
  ]
    .filter(Boolean)
    .map((t) => String(t).toLowerCase().trim());

  return itemTokens.some((token) => targetTokens.includes(token));
}

/**
 * Subscribe to real-time updates from Supabase and Firestore calculations collection
 * Supports per-user data privacy filtering via filterUserId and userAliases
 */
export function subscribeToCalculations(
  onUpdate: (data: CalculationResult[]) => void,
  filterUserId?: string | null,
  onError?: (error: unknown) => void,
  userAliases?: string[]
) {
  let unsubFirestore: (() => void) | null = null;
  let unsubSupabase: (() => void) | null = null;
  let isCancelled = false;

  // Subscribe to Supabase real-time
  try {
    unsubSupabase = subscribeToCalculationsSupabase((supabaseData) => {
      if (supabaseData && supabaseData.length > 0) {
        onUpdate(supabaseData);
      }
    }, filterUserId, userAliases);
  } catch (err) {
    console.warn("Supabase calculations subscription notice:", err);
  }

  const initSubscription = async () => {
    await ensureAuth();
    if (isCancelled) return;

    const createListener = (useOrderBy: boolean) => {
      try {
        const q = useOrderBy
          ? query(collection(db, CALCULATIONS_COLLECTION), orderBy("createdAt", "desc"))
          : query(collection(db, CALCULATIONS_COLLECTION));

        unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            const results: CalculationResult[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as any;
              if (matchCalculationToUser(data, filterUserId, userAliases)) {
                // Normalize userId field
                const normalizedItem: CalculationResult = {
                  ...data,
                  userId: data.userId || data.user_id || filterUserId || '',
                };
                results.push(normalizedItem);
              }
            });
            // Ensure client-side sorting by date desc
            results.sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            if (results.length > 0) {
              onUpdate(results);
            }
          },
          (error) => {
            console.info(
              `Firestore calculations subscription listener (${useOrderBy ? "ordered" : "unordered"}) status:`,
              error?.message || error
            );
            if (useOrderBy && !isCancelled) {
              // Retry with basic query if orderBy fails due to missing index or permission constraints
              createListener(false);
            } else {
              if (onError) onError(error);
            }
          }
        );
      } catch (err) {
        if (useOrderBy && !isCancelled) {
          createListener(false);
        } else {
          if (onError) onError(err);
        }
      }
    };

    createListener(true);
  };

  initSubscription();

  return () => {
    isCancelled = true;
    if (unsubFirestore) unsubFirestore();
    if (unsubSupabase) unsubSupabase();
  };
}

/**
 * Save or update a calculation record in Supabase and Firestore
 */
export async function saveCalculationToFirestore(calc: CalculationResult): Promise<void> {
  // Save to Supabase
  try {
    await saveCalculationToSupabase(calc);
  } catch (err) {
    console.warn("Supabase calculation save notice:", err);
  }

  // Save to Firestore
  try {
    await ensureAuth();
    const docRef = doc(db, CALCULATIONS_COLLECTION, calc.id);
    await setDoc(docRef, calc, { merge: true });
    console.info("Calculation saved to Firestore successfully:", calc.id);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, CALCULATIONS_COLLECTION);
  }
}

/**
 * Delete a single calculation record from Supabase and Firestore
 */
export async function deleteCalculationFromFirestore(id: string): Promise<void> {
  // Delete from Supabase
  try {
    await deleteCalculationFromSupabase(id);
  } catch (err) {
    console.warn("Supabase calculation delete notice:", err);
  }

  // Delete from Firestore
  try {
    await ensureAuth();
    const docRef = doc(db, CALCULATIONS_COLLECTION, id);
    await deleteDoc(docRef);
    console.info("Calculation deleted from Firestore:", id);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, CALCULATIONS_COLLECTION);
  }
}

/**
 * Fetch calculation records from Firestore (with Supabase fallback)
 */
export async function getCalculationsFromFirestore(filterUserId?: string, userAliases?: string[]): Promise<CalculationResult[]> {
  const list: CalculationResult[] = [];
  try {
    await ensureAuth();
    const qSnap = await getDocs(query(collection(db, CALCULATIONS_COLLECTION)));
    qSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      if (matchCalculationToUser(data, filterUserId, userAliases)) {
        const normalizedItem: CalculationResult = {
          ...data,
          userId: data.userId || data.user_id || filterUserId || '',
        };
        list.push(normalizedItem);
      }
    });
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (error: any) {
    console.info("Firestore get calculations notice:", error?.message || error);
  }

  if (list.length === 0) {
    try {
      const supaList = await getCalculationsFromSupabase(filterUserId, userAliases);
      if (supaList && supaList.length > 0) return supaList;
    } catch {}
  }

  return list;
}

/**
 * Subscribe to real-time updates from Supabase and Firestore users collection
 */
export function subscribeToUsers(
  onUpdate: (data: UserProfile[]) => void,
  onError?: (error: unknown) => void
) {
  // Subscribe to Supabase real-time
  const unsubSupabase = subscribeToUsersSupabase((supabaseUsers) => {
    if (supabaseUsers && supabaseUsers.length > 0) {
      onUpdate(deduplicateUsers(supabaseUsers));
    }
  });

  let unsubFirestore: (() => void) | null = null;
  let isCancelled = false;

  const initSubscription = async () => {
    await ensureAuth();
    if (isCancelled) return;

    try {
      const q = query(collection(db, USERS_COLLECTION));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const results: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            results.push(docSnap.data() as UserProfile);
          });
          if (results.length > 0) {
            onUpdate(deduplicateUsers(results));
          }
        },
        (error) => {
          console.info("Firestore users real-time subscription status:", error?.message || error);
          if (onError) onError(error);
        }
      );
    } catch (err) {
      if (onError) onError(err);
    }
  };

  initSubscription();

  return () => {
    isCancelled = true;
    if (unsubSupabase) unsubSupabase();
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Force a full bidirectional push and pull synchronization between local state and Firestore database.
 */
export async function syncAllDataWithFirestore(): Promise<{
  users: UserProfile[];
  calculations: CalculationResult[];
  syncedAt: Date;
}> {
  await ensureAuth();
  // 1. Ensure seed records exist on Firestore
  await seedDefaultDataToFirestore();

  // 2. Fetch fresh Users
  const users = await getAllUsersFromFirestore();

  // 3. Fetch fresh Calculations
  let calculations: CalculationResult[] = [];
  try {
    const calcsSnap = await getDocs(query(collection(db, CALCULATIONS_COLLECTION)));
    calcsSnap.forEach((docSnap) => {
      calculations.push(docSnap.data() as CalculationResult);
    });
    calculations.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  } catch (err) {
    console.info("Firestore sync calculations pull fallback:", err);
  }

  return {
    users,
    calculations,
    syncedAt: new Date(),
  };
}

const SETTINGS_COLLECTION = "site_settings";

/**
 * Save session inactivity timeout in minutes to Firestore site_settings collection
 */
export async function saveSessionTimeoutToFirestore(
  timeoutMinutes: number,
  updatedBy?: string
): Promise<void> {
  const cleanMinutes = Math.max(1, Math.min(180, Number(timeoutMinutes) || 15));
  try {
    await ensureAuth();
    const securityDocRef = doc(db, SETTINGS_COLLECTION, "security");
    await setDoc(
      securityDocRef,
      {
        inactivityTimeoutMinutes: cleanMinutes,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || "admin",
      },
      { merge: true }
    );

    // Also mirror to session_timeout document for multiple key compatibility
    const timeoutDocRef = doc(db, SETTINGS_COLLECTION, "session_timeout");
    await setDoc(
      timeoutDocRef,
      {
        inactivityTimeoutMinutes: cleanMinutes,
        timeoutMinutes: cleanMinutes,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Update local cache
    try {
      localStorage.setItem("cargo_inactivity_timeout_minutes", String(cleanMinutes));
      window.dispatchEvent(new CustomEvent("cargo_timeout_updated", { detail: cleanMinutes }));
    } catch {}

    console.info(`Session inactivity timeout (${cleanMinutes}m) saved to Firestore site_settings.`);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `${SETTINGS_COLLECTION}/security`);
  }
}

/**
 * Fetch saved session inactivity timeout in minutes from Firestore site_settings
 */
export async function getSessionTimeoutFromFirestore(): Promise<number | null> {
  try {
    await ensureAuth();
    // 1. Try site_settings/security
    const secDocRef = doc(db, SETTINGS_COLLECTION, "security");
    const secSnap = await getDoc(secDocRef);
    if (secSnap.exists()) {
      const data = secSnap.data();
      const mins = Number(data?.inactivityTimeoutMinutes || data?.timeoutMinutes);
      if (mins && mins > 0) return mins;
    }

    // 2. Try site_settings/session_timeout fallback
    const timeoutDocRef = doc(db, SETTINGS_COLLECTION, "session_timeout");
    const timeoutSnap = await getDoc(timeoutDocRef);
    if (timeoutSnap.exists()) {
      const data = timeoutSnap.data();
      const mins = Number(data?.inactivityTimeoutMinutes || data?.timeoutMinutes);
      if (mins && mins > 0) return mins;
    }
  } catch (error: any) {
    console.info("Firestore session timeout fetch notice:", error?.message || error);
  }
  return null;
}

/**
 * Real-time subscription to session inactivity timeout changes in Firestore site_settings
 */
export function subscribeToSessionTimeout(callback: (timeoutMinutes: number) => void): () => void {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "security");
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const mins = Number(data?.inactivityTimeoutMinutes || data?.timeoutMinutes);
          if (mins && mins > 0) {
            callback(mins);
          }
        }
      },
      (error) => {
        console.info("Notice: Session timeout subscription status:", error?.message || error);
      }
    );
  } catch (err) {
    console.info("Realtime session timeout subscription notice:", err);
    return () => {};
  }
}

/**
 * Save site favicon URL / Data-URI to Firestore and local cache
 */
export async function saveSiteFaviconToFirestore(faviconUrl: string): Promise<void> {
  if (!faviconUrl) return;
  try {
    await ensureAuth();
    const docRef = doc(db, SETTINGS_COLLECTION, "branding");
    await setDoc(
      docRef,
      {
        faviconUrl,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.info("Site favicon saved to Firestore site_settings/branding document.");
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `${SETTINGS_COLLECTION}/branding`);
  }
}

/**
 * Fetch saved site favicon from Firestore
 */
export async function getSiteFaviconFromFirestore(): Promise<string | null> {
  try {
    await ensureAuth();
    const docRef = doc(db, SETTINGS_COLLECTION, "branding");
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.faviconUrl) {
      return snap.data().faviconUrl as string;
    }
  } catch (error: any) {
    console.info("Firestore site favicon fetch notice:", error?.message || error);
  }
  return null;
}

/**
 * Real-time subscription to site favicon / branding changes
 */
export function subscribeToSiteFavicon(callback: (faviconUrl: string) => void): () => void {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "branding");
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.faviconUrl) {
          callback(snapshot.data().faviconUrl as string);
        }
      },
      (error) => {
        console.info("Notice: Site favicon subscription status:", error?.message || error);
      }
    );
  } catch (err) {
    console.info("Realtime site favicon setup notice:", err);
    return () => {};
  }
}

/**
 * Save Gemini AI Key to Firestore site_settings/ai_config
 */
export async function saveAiKeyToFirestore(apiKey: string): Promise<void> {
  try {
    await ensureAuth();
    const docRef = doc(db, SETTINGS_COLLECTION, "ai_config");
    await setDoc(
      docRef,
      {
        apiKey: apiKey.trim(),
        configured: Boolean(apiKey.trim()),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    console.info("Gemini AI key saved to Firestore site_settings/ai_config.");
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `${SETTINGS_COLLECTION}/ai_config`);
  }
}

/**
 * Fetch saved Gemini AI Key from Firestore site_settings/ai_config
 */
export async function getAiKeyFromFirestore(): Promise<string | null> {
  try {
    await ensureAuth();
    const docRef = doc(db, SETTINGS_COLLECTION, "ai_config");
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.apiKey) {
      return snap.data().apiKey as string;
    }
  } catch (error: any) {
    console.info("Firestore AI key fetch notice:", error?.message || error);
  }
  return null;
}

/**
 * Real-time subscription to AI Key configuration changes
 */
export function subscribeToAiKey(callback: (apiKey: string) => void): () => void {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "ai_config");
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists() && snapshot.data()?.apiKey) {
          callback(snapshot.data().apiKey as string);
        }
      },
      (error) => {
        console.info("Notice: AI key subscription status:", error?.message || error);
      }
    );
  } catch (err) {
    console.info("Realtime AI key setup notice:", err);
    return () => {};
  }
}

/**
 * Clear calculation records from Supabase and Firestore for a specific user (or all if omitted)
 */
export async function clearAllCalculationsFromFirestore(filterUserId?: string | null): Promise<void> {
  // Clear from Supabase
  try {
    await clearAllCalculationsFromSupabase(filterUserId);
  } catch (err) {
    console.warn("Supabase clear calculations notice:", err);
  }

  // Clear from Firestore
  try {
    await ensureAuth();
    const querySnapshot = await getDocs(collection(db, CALCULATIONS_COLLECTION));
    const batch = writeBatch(db);
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as CalculationResult;
      if (
        !filterUserId ||
        data.userId === filterUserId ||
        data.userId?.toLowerCase() === filterUserId.toLowerCase()
      ) {
        batch.delete(docSnap.ref);
      }
    });
    await batch.commit();
    console.info(filterUserId ? `Cleared calculations for user ${filterUserId} from Firestore.` : "Cleared all calculations from Firestore.");
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, CALCULATIONS_COLLECTION);
  }
}

export const FLIGHTS_COLLECTION = 'flight_consignments';

/**
 * Save Flight Consignment to Supabase and Firestore
 */
export async function saveFlightConsignmentToFirestore(flight: FlightConsignment): Promise<void> {
  // 1. Dual-write to Supabase
  try {
    await saveFlightConsignmentToSupabase(flight);
  } catch (err) {
    console.warn("Supabase save flight warning:", err);
  }

  // 2. Dual-write to Firestore
  try {
    await ensureAuth();
    const docRef = doc(db, FLIGHTS_COLLECTION, flight.id);
    await setDoc(docRef, flight, { merge: true });
    console.info("Flight consignment saved to Firestore:", flight.id);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `${FLIGHTS_COLLECTION}/${flight.id}`);
  }
}

/**
 * Fetch all Flight Consignments from Supabase with Firestore fallback
 */
export async function getFlightConsignmentsFromFirestore(filterUserId?: string | null): Promise<FlightConsignment[]> {
  // 1. Try Supabase first
  try {
    const supabaseFlights = await getFlightConsignmentsFromSupabase(filterUserId || undefined);
    if (supabaseFlights && supabaseFlights.length > 0) {
      return supabaseFlights;
    }
  } catch (err) {
    console.info("Supabase flight fetch notice, switching to Firestore fallback:", err);
  }

  // 2. Firestore fallback
  try {
    await ensureAuth();
    const q = query(collection(db, FLIGHTS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const flights: FlightConsignment[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as FlightConsignment;
      if (
        !filterUserId ||
        filterUserId === 'admin' ||
        data.userId === filterUserId ||
        data.userId?.toLowerCase() === filterUserId.toLowerCase()
      ) {
        flights.push({ ...data, id: docSnap.id });
      }
    });
    return flights;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, FLIGHTS_COLLECTION);
    return [];
  }
}

/**
 * Delete Flight Consignment from Supabase and Firestore
 */
export async function deleteFlightConsignmentFromFirestore(id: string): Promise<void> {
  // Delete from Supabase
  try {
    await deleteFlightConsignmentFromSupabase(id);
  } catch (err) {
    console.warn("Supabase delete flight warning:", err);
  }

  // Delete from Firestore
  try {
    await ensureAuth();
    const docRef = doc(db, FLIGHTS_COLLECTION, id);
    await deleteDoc(docRef);
    console.info("Flight consignment deleted from Firestore:", id);
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, `${FLIGHTS_COLLECTION}/${id}`);
  }
}

/**
 * Subscribe to Flight Consignments real-time changes
 * Supabase Postgres Realtime is prioritized for live flight & ticket manifest updates, with Firestore fallback
 */
export function subscribeToFlightConsignments(
  callback: (flights: FlightConsignment[]) => void,
  filterUserId?: string | null
): () => void {
  let unsubFirestore: (() => void) | null = null;
  let unsubSupabase: (() => void) | null = null;
  let isCancelled = false;

  // 1. Subscribe to Supabase real-time channel
  try {
    unsubSupabase = subscribeToFlightConsignmentsSupabase((supabaseFlights) => {
      if (supabaseFlights && supabaseFlights.length > 0) {
        callback(supabaseFlights);
      }
    }, filterUserId);
  } catch (err) {
    console.warn("Supabase flights subscription notice:", err);
  }

  // 2. Subscribe to Firestore onSnapshot
  const initSubscription = async () => {
    await ensureAuth();
    if (isCancelled) return;

    try {
      const q = query(collection(db, FLIGHTS_COLLECTION), orderBy('createdAt', 'desc'));
      unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
          const flights: FlightConsignment[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as FlightConsignment;
            if (
              !filterUserId ||
              filterUserId === 'admin' ||
              data.userId === filterUserId ||
              data.userId?.toLowerCase() === filterUserId.toLowerCase()
            ) {
              flights.push({ ...data, id: docSnap.id });
            }
          });
          if (flights.length > 0) {
            callback(flights);
          }
        },
        (error) => {
          console.info("Notice: Flight real-time subscription status:", error?.message || error);
        }
      );
    } catch (err) {
      console.info("Realtime flights subscription setup notice:", err);
    }
  };

  initSubscription();

  return () => {
    isCancelled = true;
    if (unsubSupabase) {
      try {
        unsubSupabase();
      } catch {}
    }
    if (unsubFirestore) {
      try {
        unsubFirestore();
      } catch {}
    }
  };
}

