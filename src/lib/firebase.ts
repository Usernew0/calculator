import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { CalculationResult, UserProfile } from "../types";
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
} from "./supabase";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore targeting the specific provisioned database instance ID
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Ensure anonymous or persistent authentication before performing Firestore queries
export async function ensureAuth(): Promise<void> {
  if (auth.currentUser) return;
  try {
    await signInAnonymously(auth);
  } catch (err: any) {
    console.info("Firebase anonymous auth status:", err?.message || err);
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
 * Save user profile schema to Firestore database and Supabase
 */
export async function saveUserProfileToFirestore(profile: UserProfile): Promise<void> {
  // Save to Supabase
  try {
    await saveUserProfileToSupabase(profile);
  } catch (err) {
    console.warn("Supabase user save notice:", err);
  }

  // Save to Firestore (for Auth & Status checks)
  try {
    await ensureAuth();
    const docKey = (profile.username || profile.userId).toLowerCase().trim();
    const docRef = doc(db, USERS_COLLECTION, docKey);
    await setDoc(
      docRef,
      {
        ...profile,
        userId: profile.userId || docKey,
        username: profile.username || docKey,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
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
          data.userId?.toLowerCase() === docKey
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
  const usersMap = new Map<string, UserProfile>();

  // Fetch from Supabase
  try {
    const supabaseUsers = await getAllUsersFromSupabase();
    supabaseUsers.forEach((u) => {
      if (u.username || u.userId) {
        usersMap.set((u.username || u.userId).toLowerCase(), u);
      }
    });
  } catch (err) {
    console.warn("Supabase fetch all users notice:", err);
  }

  // Fetch from Firestore
  try {
    await ensureAuth();
    const qSnap = await getDocs(query(collection(db, USERS_COLLECTION)));
    qSnap.forEach((docSnap) => {
      const u = docSnap.data() as UserProfile;
      const key = (u.username || u.userId || docSnap.id).toLowerCase();
      if (!usersMap.has(key)) {
        usersMap.set(key, u);
      }
    });
  } catch (error: any) {
    console.info("Firestore fetch users notice:", error?.message || error);
  }

  return Array.from(usersMap.values());
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
 * Subscribe to real-time updates from Supabase and Firestore calculations collection
 * Supports per-user data privacy filtering via filterUserId
 */
export function subscribeToCalculations(
  onUpdate: (data: CalculationResult[]) => void,
  filterUserId?: string | null,
  onError?: (error: unknown) => void
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
    }, filterUserId);
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
              const data = docSnap.data() as CalculationResult;
              if (
                !filterUserId ||
                data.userId === filterUserId ||
                data.userId?.toLowerCase() === filterUserId.toLowerCase()
              ) {
                results.push(data);
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
 * Subscribe to real-time updates from Supabase and Firestore users collection
 */
export function subscribeToUsers(
  onUpdate: (data: UserProfile[]) => void,
  onError?: (error: unknown) => void
) {
  // Subscribe to Supabase real-time
  const unsubSupabase = subscribeToUsersSupabase((supabaseUsers) => {
    if (supabaseUsers && supabaseUsers.length > 0) {
      onUpdate(supabaseUsers);
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
            onUpdate(results);
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
