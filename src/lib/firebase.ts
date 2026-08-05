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
 * Save user profile schema to Firestore database under users collection
 */
export async function saveUserProfileToFirestore(profile: UserProfile): Promise<void> {
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
 * Fetch user profile schema from Firestore database by Username
 */
export async function getUserProfileFromFirestore(username: string): Promise<UserProfile | null> {
  try {
    await ensureAuth();
    const docKey = username.toLowerCase().trim();
    const docRef = doc(db, USERS_COLLECTION, docKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const qSnap = await getDocs(query(collection(db, USERS_COLLECTION)));
    let found: UserProfile | null = null;
    qSnap.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      if (
        docSnap.id === docKey ||
        data.username?.toLowerCase() === docKey ||
        data.userId?.toLowerCase() === docKey
      ) {
        found = data;
      }
    });
    if (found) return found;
  } catch (error: any) {
    console.info("Firestore user fetch notice:", error?.message || error);
  }

  return null;
}

/**
 * Fetch all user profile schemas from Firestore database
 */
export async function getAllUsersFromFirestore(): Promise<UserProfile[]> {
  try {
    await ensureAuth();
    const qSnap = await getDocs(query(collection(db, USERS_COLLECTION)));
    const users: UserProfile[] = [];
    qSnap.forEach((docSnap) => {
      users.push(docSnap.data() as UserProfile);
    });
    return users;
  } catch (error: any) {
    console.info("Firestore fetch users notice:", error?.message || error);
  }

  return [];
}

/**
 * Delete a user profile schema from Firestore database
 */
export async function deleteUserFromFirestore(key: string): Promise<void> {
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
 * Subscribe to real-time updates from Firestore calculations collection
 * Supports per-user data privacy filtering via filterUserId
 */
export function subscribeToCalculations(
  onUpdate: (data: CalculationResult[]) => void,
  filterUserId?: string | null,
  onError?: (error: unknown) => void
) {
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  const initSubscription = async () => {
    await ensureAuth();
    if (isCancelled) return;

    const createListener = (useOrderBy: boolean) => {
      try {
        const q = useOrderBy
          ? query(collection(db, CALCULATIONS_COLLECTION), orderBy("createdAt", "desc"))
          : query(collection(db, CALCULATIONS_COLLECTION));

        unsub = onSnapshot(
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
            onUpdate(results);
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
              // Fallback to empty array on permission/connection limit
              onUpdate([]);
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
    if (unsub) unsub();
  };
}

/**
 * Save or update a calculation record in Firestore
 */
export async function saveCalculationToFirestore(calc: CalculationResult): Promise<void> {
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
 * Delete a single calculation record from Firestore
 */
export async function deleteCalculationFromFirestore(id: string): Promise<void> {
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
 * Subscribe to real-time updates from Firestore users collection
 */
export function subscribeToUsers(
  onUpdate: (data: UserProfile[]) => void,
  onError?: (error: unknown) => void
) {
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  const initSubscription = async () => {
    await ensureAuth();
    if (isCancelled) return;

    try {
      const q = query(collection(db, USERS_COLLECTION));
      unsub = onSnapshot(
        q,
        (snapshot) => {
          const results: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            results.push(docSnap.data() as UserProfile);
          });
          onUpdate(results);
        },
        (error) => {
          console.info("Firestore users real-time subscription status:", error?.message || error);
          onUpdate([]);
          if (onError) onError(error);
        }
      );
    } catch (err) {
      onUpdate([]);
      if (onError) onError(err);
    }
  };

  initSubscription();

  return () => {
    isCancelled = true;
    if (unsub) unsub();
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
 * Clear calculation records from Firestore for a specific user (or all if omitted)
 */
export async function clearAllCalculationsFromFirestore(filterUserId?: string | null): Promise<void> {
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
