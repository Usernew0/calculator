import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { CalculationResult } from "../types";

// User's provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABt2YMc22wjgnoYU8hbjY__DDRLAhTIqc",
  authDomain: "calculation-9a789.firebaseapp.com",
  projectId: "calculation-9a789",
  storageBucket: "calculation-9a789.firebasestorage.app",
  messagingSenderId: "874347273424",
  appId: "1:874347273424:web:96b7f755aff8c44ff792d5",
  measurementId: "G-K7730ZCLV4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Attempt anonymous auth if enabled on user's project
signInAnonymously(auth).catch((err) => {
  // Silent fail if anonymous auth is not enabled in Firebase console
  console.info("Firebase anonymous auth status:", err?.message || err);
});

const CALCULATIONS_COLLECTION = "calculations";

/**
 * Subscribe to real-time updates from Firestore calculations collection with graceful fallback
 */
export function subscribeToCalculations(
  onUpdate: (data: CalculationResult[]) => void,
  onError?: (error: unknown) => void
) {
  try {
    const q = query(collection(db, CALCULATIONS_COLLECTION), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        const results: CalculationResult[] = [];
        snapshot.forEach((docSnap) => {
          results.push(docSnap.data() as CalculationResult);
        });
        onUpdate(results);
      },
      (error) => {
        console.warn("Firestore access restriction or permissions notice:", error?.message || error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn("Firestore subscription unavailable:", err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save or update a calculation record in Firestore
 */
export async function saveCalculationToFirestore(calc: CalculationResult): Promise<void> {
  try {
    const docRef = doc(db, CALCULATIONS_COLLECTION, calc.id);
    await setDoc(docRef, calc, { merge: true });
  } catch (error) {
    console.warn("Firestore save fallback to local storage due to permissions:", error);
    throw error;
  }
}

/**
 * Delete a single calculation record from Firestore
 */
export async function deleteCalculationFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, CALCULATIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn("Firestore delete fallback to local storage due to permissions:", error);
    throw error;
  }
}

/**
 * Clear all calculation records from Firestore
 */
export async function clearAllCalculationsFromFirestore(): Promise<void> {
  try {
    const querySnapshot = await getDocs(collection(db, CALCULATIONS_COLLECTION));
    const batch = writeBatch(db);
    querySnapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (error) {
    console.warn("Firestore clear fallback to local storage due to permissions:", error);
    throw error;
  }
}

