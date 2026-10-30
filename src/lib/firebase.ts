import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User
} from "firebase/auth";
import {
  getFirestore,
  setLogLevel,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Suppress benign internal Firestore warnings (e.g. database not found or offline mode)
try {
  setLogLevel("silent");
} catch {
  // Ignore if already set or unsupported
}

// Track whether Firestore database is active and reachable
let firestoreReachable = true;

export function isFirestoreAvailable(): boolean {
  return firestoreReachable;
}

export function resetFirestoreAvailability(): void {
  firestoreReachable = true;
}

export function disableFirestore(): void {
  firestoreReachable = false;
}

/**
 * Executes a promise with an enforced timeout so UI is never blocked by hanging network connections
 */
export async function withFirestoreTimeout<T>(promise: Promise<T>, timeoutMs = 2000, fallbackVal?: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Firestore timeout"));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.message === "Firestore timeout" || err?.code === "not-found" || String(err).includes("NOT_FOUND")) {
      firestoreReachable = false;
    }
    if (fallbackVal !== undefined) {
      return fallbackVal;
    }
    throw err;
  }
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configure Google Auth Provider for user authentication and Google Forms creation
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/forms.body");
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleProvider.setCustomParameters({
  prompt: "select_account"
});

/**
 * Trigger 1-Click Google Sign-In via Firebase Popup
 * Works for any Google account (@gmail.com, @belajar.id, Google Workspace)
 */
export async function loginWithGoogle(): Promise<{ user: User; accessToken: string | null } | null> {
  try {
    resetFirestoreAvailability();
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;

    // Save profile to Firestore if database is available
    if (isFirestoreAvailable()) {
      try {
        const userRef = doc(db, "users", result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          displayName: result.user.displayName || "Guru Pengampu",
          email: result.user.email || "",
          photoURL: result.user.photoURL || "",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (fsErr: any) {
        const msg = String(fsErr?.message || fsErr || "");
        if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
          disableFirestore();
        }
      }
    }

    return { user: result.user, accessToken };
  } catch (error: any) {
    // Gracefully handle user cancelling or closing the popup - this is normal behavior
    if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
      return null;
    }
    if (error?.code === "auth/popup-blocked") {
      console.warn("Google login popup was blocked by browser.");
      throw new Error("Jendela login Google terblokir oleh browser. Harap izinkan popup di browser Anda.");
    }
    if (error?.code === "auth/configuration-not-found") {
      const projId = firebaseConfig.projectId || "proyek Anda";
      throw new Error(
        `Firebase Authentication belum diaktifkan atau penyedia "Google" belum di-enable pada proyek "${projId}".\n\nLangkah mudah mengatasinya:\n1. Buka Firebase Console: https://console.firebase.google.com/project/${projId}/authentication/providers\n2. Klik "Get started" (jika baru pertama kali), lalu pada tab "Sign-in method" pilih "Google".\n3. Aktifkan toggle "Enable", pilih Project support email Anda, lalu klik "Save".\n4. Buka tab "Settings" > "Authorized domains" dan pastikan domain web ini sudah ditambahkan.`
      );
    }
    if (error?.code === "auth/operation-not-allowed") {
      const projId = firebaseConfig.projectId || "proyek Anda";
      throw new Error(
        `Login Google belum diizinkan di Firebase Console proyek "${projId}". Silakan buka menu Authentication > Sign-in method di Firebase Console dan aktifkan penyedia "Google".`
      );
    }
    if (error?.code === "auth/unauthorized-domain") {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "domain ini";
      throw new Error(
        `Domain "${hostname}" belum didaftarkan di Authorized Domains Firebase Console. Buka Firebase Console > Authentication > Settings > Authorized domains, lalu tambahkan "${hostname}". Semua fitur pembuatan soal tetap aktif tanpa login!`
      );
    }
    console.warn("Firebase Google Sign-In notice:", error?.message || error);
    throw new Error(error?.message || "Gagal masuk dengan Google.");
  }
}

/**
 * Logout current active user
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export type { User };
