/**
 * Google OAuth Manager via Firebase Auth & Google Identity Services (GSI)
 * Seamless 1-Click Multi-User Google Authentication for all teachers & schools.
 */
import firebaseConfig from "../../firebase-applet-config.json";
import { auth, loginWithGoogle as firebaseLogin, logoutUser as firebaseLogout } from "./firebase.js";
import { onAuthStateChanged, type User } from "firebase/auth";

declare global {
  interface Window {
    google?: any;
  }
}

const SCOPES = [
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email"
];

const TOKEN_KEY = "soal_guru_google_access_token";
const TOKEN_EXPIRY_KEY = "soal_guru_google_token_expiry";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
}

interface AuthState {
  token: string | null;
  expiresAt: number | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  uid: string | null;
}

// Restore saved token from storage if still valid
let initialToken: string | null = null;
let initialExpiry: number | null = null;
try {
  const savedToken = localStorage.getItem(TOKEN_KEY);
  const savedExp = Number(localStorage.getItem(TOKEN_EXPIRY_KEY));
  if (savedToken && savedExp && savedExp > Date.now()) {
    initialToken = savedToken;
    initialExpiry = savedExp;
  }
} catch {
  // Ignore localStorage read errors
}

let authState: AuthState = {
  token: initialToken,
  expiresAt: initialExpiry,
  email: null,
  displayName: null,
  photoURL: null,
  uid: null,
};

// Listeners for auth state changes
export type AuthListener = (isConnected: boolean, email?: string | null, profile?: UserProfile | null) => void;
const listeners: Set<AuthListener> = new Set();

function notifyListeners() {
  const connected = isGoogleConnected();
  const profile = getUserProfile();
  listeners.forEach((listener) => listener(connected, authState.email, profile));
}

// Track Firebase Auth state change in real-time
onAuthStateChanged(auth, (user: User | null) => {
  if (user) {
    authState.email = user.email || null;
    authState.displayName = user.displayName || user.email?.split("@")[0] || "Guru";
    authState.photoURL = user.photoURL || null;
    authState.uid = user.uid;

    // If we have a valid token stored, keep it; otherwise if none, mark expiry for user presence
    if (!authState.expiresAt || authState.expiresAt < Date.now()) {
      // If we don't have OAuth token yet, still remember user is logged in
      authState.expiresAt = Date.now() + 3600 * 1000;
    }
  } else {
    authState.email = null;
    authState.displayName = null;
    authState.photoURL = null;
    authState.uid = null;
    authState.token = null;
    authState.expiresAt = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch {}
  }
  notifyListeners();
});

export function subscribeGoogleAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  // Trigger initial state
  listener(isGoogleConnected(), authState.email, getUserProfile());
  return () => {
    listeners.delete(listener);
  };
}

export function isGoogleConnected(): boolean {
  // Connected if Firebase user is authenticated OR token is valid
  if (authState.uid) return true;
  if (!authState.token || !authState.expiresAt) return false;
  return Date.now() < authState.expiresAt - 30000;
}

export function getUserProfile(): UserProfile | null {
  if (!authState.uid && !authState.email) return null;
  return {
    uid: authState.uid || "local_user",
    email: authState.email || "",
    displayName: authState.displayName || authState.email?.split("@")[0] || "Guru",
    photoURL: authState.photoURL || null,
  };
}

export function getCachedToken(): string | null {
  if (authState.token && authState.expiresAt && Date.now() < authState.expiresAt - 30000) {
    return authState.token;
  }
  return null;
}

export function getGoogleEmail(): string | null {
  return authState.email;
}

/**
 * 1-Click Google Sign-In as Primary Login Engine
 * Supports ALL Google accounts (@gmail.com, @belajar.id, Google Workspace)
 */
export async function loginWithGooglePopup(): Promise<UserProfile | null> {
  try {
    const res = await firebaseLogin();
    if (!res) {
      // User closed popup or cancelled
      return null;
    }
    const { user, accessToken } = res;
    
    authState.uid = user.uid;
    authState.email = user.email || null;
    authState.displayName = user.displayName || user.email?.split("@")[0] || "Guru";
    authState.photoURL = user.photoURL || null;

    if (accessToken) {
      const expiry = Date.now() + 3600 * 1000;
      authState.token = accessToken;
      authState.expiresAt = expiry;
      try {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
      } catch {}
    }

    notifyListeners();

    return {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "Guru",
      photoURL: user.photoURL || null,
    };
  } catch (err: any) {
    if (err?.code === "auth/popup-closed-by-user" || err?.message?.includes("ditutup") || err?.message?.includes("dibatalkan")) {
      return null;
    }
    console.warn("Login with Google notice:", err?.message || err);
    throw err;
  }
}

/**
 * Disconnect and Sign Out
 */
export async function disconnectGoogle(): Promise<void> {
  try {
    if (authState.token && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(authState.token, () => {});
      } catch (e) {
        console.warn("Revoke error:", e);
      }
    }
    await firebaseLogout();
  } catch (err) {
    console.warn("Disconnect error:", err);
  } finally {
    authState = {
      token: null,
      expiresAt: null,
      email: null,
      displayName: null,
      photoURL: null,
      uid: null,
    };
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch {}
    notifyListeners();
  }
}

export function getCustomGoogleClientId(): string {
  try {
    return localStorage.getItem("soal_guru_google_client_id") || "";
  } catch {
    return "";
  }
}

export function setCustomGoogleClientId(id: string): void {
  try {
    if (!id || !id.trim()) {
      localStorage.removeItem("soal_guru_google_client_id");
    } else {
      localStorage.setItem("soal_guru_google_client_id", id.trim());
    }
  } catch (e) {
    console.warn("Failed to persist custom Google Client ID:", e);
  }
}

/**
 * Resolves the Google OAuth Client ID with multi-layer fallback:
 * 1. User-configured Custom Client ID in LocalStorage/Settings
 * 2. Client-side Vite environment variable (VITE_GOOGLE_CLIENT_ID)
 * 3. firebase-applet-config.json
 * 4. Server API endpoint /api/auth/config
 */
export async function getOAuthClientId(): Promise<string> {
  // Layer 1: Custom Client ID set by user in Settings
  const customCid = getCustomGoogleClientId();
  if (customCid && customCid.trim()) {
    return customCid.trim();
  }

  // Layer 2: Client-side Vite environment variable
  const envCid = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  if (envCid && typeof envCid === "string" && envCid.trim()) {
    return envCid.trim();
  }

  // Layer 3: Directly from firebase-applet-config.json
  if (firebaseConfig && (firebaseConfig as any).oAuthClientId) {
    const cid = (firebaseConfig as any).oAuthClientId.trim();
    if (cid) return cid;
  }

  // Layer 4: Server endpoint /api/auth/config
  try {
    const res = await fetch("/api/auth/config");
    if (res.ok) {
      const data = await res.json();
      if (data.clientId && typeof data.clientId === "string" && data.clientId.trim()) {
        return data.clientId.trim();
      }
    }
  } catch (err) {
    console.warn("Failed to fetch /api/auth/config:", err);
  }

  // Fallback default client id if configured
  return "581301441227-uin3mmskms1dfs68eak645qn1g2fvnrq.apps.googleusercontent.com";
}

/**
 * Ensures Google Identity Services client script is loaded on the page
 */
function ensureGsiLoaded(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Gagal memuat script Google Identity Services. Pastikan koneksi internet aktif."));
      document.head.appendChild(script);
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        } else if (attempts > 50) {
          clearInterval(interval);
          reject(new Error("Timeout memuat script Google Identity Services."));
        }
      }, 100);
    }
  });
}

/**
 * Request Google Access Token using Google Identity Services (GSI)
 */
export async function requestGoogleAccessToken(promptConsent: boolean = false): Promise<string> {
  // If already connected and valid Forms API token exists, return it immediately
  if (authState.token && authState.expiresAt && Date.now() < authState.expiresAt - 30000 && !promptConsent) {
    return authState.token;
  }

  await ensureGsiLoaded();
  const clientId = await getOAuthClientId();

  if (!clientId) {
    throw new Error("Client ID Google OAuth tidak ditemukan di firebase-applet-config.json.");
  }

  return new Promise((resolve, reject) => {
    try {
      const existingEmail = authState.email || getUserProfile()?.email || undefined;
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(" "),
        prompt: promptConsent ? "consent" : (existingEmail ? "" : "select_account"),
        hint: existingEmail,
        callback: async (response: any) => {
          if (response.error) {
            const errStr = String(response.error || "").toLowerCase();
            const errDesc = String(response.error_description || "").toLowerCase();

            if (errStr === "popup_closed_by_user") {
              reject(new Error("Login Google dibatalkan oleh pengguna."));
              return;
            }

            console.warn("Google OAuth response notice:", response);

            if (errStr === "invalid_client") {
              reject(
                new Error(
                  `Google OAuth Client ID tidak valid atau domain "${window.location.origin}" belum terdaftar di Authorized JavaScript Origins Google Cloud Console.`
                )
              );
            } else if (
              errStr.includes("origin") ||
              errDesc.includes("origin") ||
              errStr === "idpiframe_initialization_failed"
            ) {
              reject(
                new Error(
                  `Domain "${window.location.origin}" belum terdaftar di "Authorized JavaScript origins" Google Cloud Console (Error 400: origin_mismatch). Silakan tambahkan domain ini di Google Cloud Console.`
                )
              );
            } else if (errStr === "access_denied") {
              reject(
                new Error(
                  "Izin akses Google Forms ditolak. Pastikan Anda menyetujui izin pembuatan Google Forms saat jendela login muncul."
                )
              );
            } else {
              reject(new Error(response.error_description || response.error || "Gagal otorisasi Google."));
            }
            return;
          }

          if (response.access_token) {
            const expiresIn = Number(response.expires_in) || 3599;
            authState.token = response.access_token;
            authState.expiresAt = Date.now() + expiresIn * 1000;

            // Fetch user profile email
            try {
              const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              if (profileRes.ok) {
                const profile = await profileRes.json();
                authState.email = profile.email || profile.name || null;
              }
            } catch (err) {
              console.warn("Could not fetch user profile info:", err);
            }

            notifyListeners();
            resolve(response.access_token);
          } else {
            reject(new Error("Tidak menerima token akses dari Google."));
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch (err: any) {
      console.error("GSI token client initialization error:", err);
      const msg = String(err?.message || err).toLowerCase();
      if (msg.includes("origin") || msg.includes("not allowed")) {
        reject(
          new Error(
            `Domain "${window.location.origin}" belum terdaftar di Google Cloud. Silakan gunakan tab "Script Instan 1-Klik" di menu Google Form untuk ekspor langsung dengan akun Google apa pun tanpa perlu setup!`
          )
        );
      } else {
        reject(new Error(err.message || "Gagal menginisialisasi popup login Google."));
      }
    }
  });
}
