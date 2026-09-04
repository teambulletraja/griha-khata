import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDbBR6f8f2jjVMuhcP9ntMrqEOQ6nKgo1U",
  authDomain: "griha-khata.firebaseapp.com",
  projectId: "griha-khata",
  storageBucket: "griha-khata.firebasestorage.app",
  messagingSenderId: "1085353523009",
  appId: "1:1085353523009:web:f15a7067aa914519cb53c0",
  measurementId: "G-RWT1YX2LH2",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLLECTION = "griha_khata";

/**
 * Fetch a document's value, reliably distinguishing three cases:
 * - "ok": document exists, value returned
 * - "missing": document genuinely does not exist (safe to seed/initialize)
 * - "error": fetch failed (network, permissions, etc.) — caller must NOT
 *    treat this as "missing", to avoid overwriting real data with a fresh seed.
 */
export async function fbGetStatus(key) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, key));
    if (!snap.exists()) return { status: "missing" };
    return { status: "ok", value: snap.data().value };
  } catch (e) {
    console.error("Firestore get failed", key, e);
    return { status: "error", error: e };
  }
}

/** Convenience wrapper: returns value, or fallback for both "missing" and "error". */
export async function fbGet(key, fallback) {
  const res = await fbGetStatus(key);
  return res.status === "ok" ? res.value : fallback;
}

export async function fbSet(key, value) {
  try {
    await setDoc(doc(db, COLLECTION, key), { value, updatedAt: Date.now() });
    return true;
  } catch (e) {
    console.error("Firestore set failed", key, e);
    return false;
  }
}
