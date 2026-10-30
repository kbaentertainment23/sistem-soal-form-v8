import type { QuestionSet, GoogleFormHistoryItem } from "../types.js";
import { auth, db, isFirestoreAvailable, disableFirestore, resetFirestoreAvailability, withFirestoreTimeout } from "./firebase.js";
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";

const BANK_SOAL_KEY = "ai_soal_bank_soal_v1";
const FORM_HISTORY_KEY = "ai_soal_form_history_v1";
const SETTINGS_KEY = "ai_soal_settings_v1";

/**
 * Recursively strips all undefined fields from an object or array.
 * Firestore strictly rejects undefined values with:
 * "Unsupported field value: undefined"
 */
export function cleanFirestoreData<T>(val: T): T {
  if (val === null || val === undefined) {
    return null as any;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof val === "object") {
    if (val instanceof Date) {
      return val.toISOString() as any;
    }
    const cleanObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, any>)) {
      if (v !== undefined) {
        cleanObj[k] = cleanFirestoreData(v);
      }
    }
    return cleanObj as any;
  }
  return val;
}

let currentActiveUserId: string | null = null;

export function setActiveUserId(uid: string | null) {
  currentActiveUserId = uid;
}

export function getActiveUserId(): string | null {
  return currentActiveUserId || (auth.currentUser ? auth.currentUser.uid : null);
}

export function resolveUserId(userId?: string | null): string | null {
  if (userId !== undefined && userId !== null) return userId;
  if (currentActiveUserId) return currentActiveUserId;
  if (auth.currentUser) return auth.currentUser.uid;
  return null;
}

function getBankKey(userId?: string | null): string {
  const uid = resolveUserId(userId);
  return uid ? `ai_soal_bank_soal_${uid}` : BANK_SOAL_KEY;
}

function getFormHistoryKey(userId?: string | null): string {
  const uid = resolveUserId(userId);
  return uid ? `ai_soal_form_history_${uid}` : FORM_HISTORY_KEY;
}

export interface AppSettings {
  schoolName: string;
  schoolCity?: string;
  teacherName?: string;
  teacherNip?: string;
  principalName?: string;
  principalNip?: string;
  academicYear?: string;
  defaultOptionsCount: 4 | 5;
  defaultPointsPerQuestion: number;
  shuffleOptionsDefault: boolean;
  includeIdentitySectionDefault?: boolean;
  classList: string[];
  enableSignatures?: boolean;
  customGoogleClientId?: string;
  appLogoUrl?: string;
  adminPassword?: string;
}

export const DEFAULT_CLASSES: string[] = [];

const defaultSettings: AppSettings = {
  schoolName: "SMP / SMA Negeri Nusantara",
  schoolCity: "Jakarta",
  teacherName: "Guru Pengampu, S.Pd.",
  teacherNip: "19880315 201502 1 003",
  principalName: "Kepala Sekolah, M.Pd.",
  principalNip: "19750810 199903 1 002",
  academicYear: "2024/2025",
  defaultOptionsCount: 4,
  defaultPointsPerQuestion: 1,
  shuffleOptionsDefault: false,
  includeIdentitySectionDefault: true,
  classList: [],
  enableSignatures: false,
  customGoogleClientId: "",
  appLogoUrl: "",
  adminPassword: "admin123",
};

// Initial sample questions in Bank Soal for immediate rich experience
const initialBankSoal: QuestionSet[] = [
  {
    id: "sample_set_1",
    title: "Ulangan Harian Informatika: Jaringan Komputer & Internet",
    subject: "Informatika",
    grade: "VIII",
    semester: "1",
    material: "Jaringan Komputer dan Topologi Jaringan",
    learningObjective: "Siswa mampu memahami konsep jaringan komputer, perangkat keras jaringan, dan topologi dasar.",
    difficultyType: "Campuran",
    questionType: "Pilihan Ganda",
    onlyFromMaterial: false,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    totalPoints: 5,
    questions: [
      {
        id: "q_sample_1",
        number: 1,
        question: "Perangkat jaringan yang berfungsi menghubungkan beberapa jaringan komputer yang berbeda segmen IP dan menentukan rute terbaik pengiriman data adalah...",
        options: [
          { label: "A", text: "Router" },
          { label: "B", text: "Switch" },
          { label: "C", text: "Hub" },
          { label: "D", text: "Repeater" },
        ],
        correctAnswer: "A",
        explanation: "Router bertugas menghubungkan dua atau lebih jaringan yang berbeda (misalnya LAN ke WAN) dan merutekan paket data berdasarkan alamat IP.",
        difficulty: "Sedang",
        cognitiveLevel: "C2",
        indicator: "Siswa mampu menjelaskan fungsi router pada jaringan.",
        points: 1,
      },
      {
        id: "q_sample_2",
        number: 2,
        question: "Topologi jaringan di mana setiap node terhubung ke satu perangkat pusat (hub/switch) dinamakan topologi...",
        options: [
          { label: "A", text: "Bus" },
          { label: "B", text: "Ring" },
          { label: "C", text: "Star" },
          { label: "D", text: "Mesh" },
        ],
        correctAnswer: "C",
        explanation: "Topologi Star menghubungkan semua kabel perangkat ke sebuah titik konsentrator sentral (switch/hub).",
        difficulty: "Mudah",
        cognitiveLevel: "C1",
        indicator: "Siswa mampu mengidentifikasi topologi star.",
        points: 1,
      },
      {
        id: "q_sample_3",
        number: 3,
        question: "Jika salah satu komputer pada topologi Bus mengalami kerusakan fisik pada kabel utama, dampak yang terjadi pada seluruh jaringan adalah...",
        options: [
          { label: "A", text: "Hanya komputer tersebut yang terputus" },
          { label: "B", text: "Seluruh komunikasi dalam jaringan akan terganggu/lumpuh" },
          { label: "C", text: "Kecepatan jaringan menjadi dua kali lebih cepat" },
          { label: "D", text: "Koneksi beralih secara otomatis ke nirkabel" },
        ],
        correctAnswer: "B",
        explanation: "Pada topologi Bus, kabel utama (backbone) menjadi jalur tunggal. Jika backbone putus, sinyal tidak dapat memantul dengan benar sehingga seluruh jaringan mati.",
        difficulty: "Sulit",
        cognitiveLevel: "C4",
        indicator: "Siswa mampu menganalisis kelemahan topologi bus.",
        points: 1,
      },
      {
        id: "q_sample_4",
        number: 4,
        question: "Protokol standar yang digunakan untuk mengamankan komunikasi data di situs web dengan enkripsi adalah...",
        options: [
          { label: "A", text: "HTTP" },
          { label: "B", text: "HTTPS" },
          { label: "C", text: "FTP" },
          { label: "D", text: "SMTP" },
        ],
        correctAnswer: "B",
        explanation: "HTTPS (Hypertext Transfer Protocol Secure) menggunakan SSL/TLS untuk mengenkripsi data antara peramban dan server web.",
        difficulty: "Sedang",
        cognitiveLevel: "C2",
        indicator: "Siswa memahami protokol HTTPS.",
        points: 1,
      },
      {
        id: "q_sample_5",
        number: 5,
        question: "Ukuran bandwidth internet sering diukur dalam satuan...",
        options: [
          { label: "A", text: "Mbps (Megabits per second)" },
          { label: "B", text: "Mhz (Megahertz)" },
          { label: "C", text: "DPI (Dots per inch)" },
          { label: "D", text: "Voltase (Volt)" },
        ],
        correctAnswer: "A",
        explanation: "Kecepatan transfer data dan lebar pita jaringan dinyatakan dalam satuan bps (bits per second) atau Mbps.",
        difficulty: "Mudah",
        cognitiveLevel: "C1",
        indicator: "Siswa mengetahui satuan kecepatan bandwidth internet.",
        points: 1,
      },
    ],
  },
];

// --- BANK SOAL METHODS (MULTI-USER ISOLATED & CLOUD SYNCED) ---
export function getBankSoal(userId?: string | null): QuestionSet[] {
  try {
    const uid = resolveUserId(userId);
    const key = getBankKey(uid);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // If guest user without account, supply sample initial bank soal for testing
      // If logged in user account, start fresh with user's own sets
      if (!uid) {
        localStorage.setItem(key, JSON.stringify(initialBankSoal));
        return initialBankSoal;
      }
      return [];
    }
    const parsed: QuestionSet[] = JSON.parse(raw);
    if (uid && Array.isArray(parsed)) {
      // Return sets belonging to this specific user or sets in user's personal store
      return parsed
        .filter((item) => !item.userId || item.userId === uid)
        .map((item) => ({ ...item, userId: uid }));
    }
    if (!uid && Array.isArray(parsed)) {
      // Guest mode: only items without any assigned userId
      return parsed.filter((item) => !item.userId);
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error reading Bank Soal from storage:", e);
    return [];
  }
}

export function saveToBankSoal(questionSet: QuestionSet, userId?: string | null): void {
  try {
    const uid = resolveUserId(userId);
    const key = getBankKey(uid);
    const sets = getBankSoal(uid);

    // Stamped strictly with active user's ID and identity
    const activeUser = auth.currentUser;
    const setWithUser: QuestionSet = {
      ...questionSet,
      userId: uid || undefined,
      authorEmail: questionSet.authorEmail || activeUser?.email || undefined,
      authorName: questionSet.authorName || activeUser?.displayName || undefined,
    };

    const existingIndex = sets.findIndex((s) => s.id === setWithUser.id);
    if (existingIndex >= 0) {
      sets[existingIndex] = setWithUser;
    } else {
      sets.unshift(setWithUser);
    }
    localStorage.setItem(key, JSON.stringify(sets));

    // 1. Cloud sync to persistent server storage (guarantees cross-device sync even if Firestore isn't provisioned yet)
    if (uid) {
      fetch("/api/bank-soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionSet: setWithUser,
          userId: uid,
          userEmail: setWithUser.authorEmail || activeUser?.email,
          userName: setWithUser.authorName || activeUser?.displayName,
        }),
      }).catch(() => {});
    }

    // 2. Cloud sync to Firestore in user's personal collection if authenticated
    if (uid && isFirestoreAvailable()) {
      const docRef = doc(db, "users", uid, "bankSoal", setWithUser.id);
      const cleanData = cleanFirestoreData({
        ...setWithUser,
        userId: uid,
        updatedAt: new Date().toISOString()
      });
      setDoc(docRef, cleanData, { merge: true }).catch(() => {
        // Silent background sync fallback
      });
    }
  } catch (e) {
    console.error("Error saving to Bank Soal:", e);
  }
}

export async function saveToBankSoalAsync(questionSet: QuestionSet, userId?: string | null): Promise<void> {
  saveToBankSoal(questionSet, userId);
  const uid = resolveUserId(userId);
  if (uid && isFirestoreAvailable()) {
    try {
      const docRef = doc(db, "users", uid, "bankSoal", questionSet.id);
      const cleanData = cleanFirestoreData({
        ...questionSet,
        userId: uid,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(docRef, cleanData, { merge: true });
    } catch {
      // Graceful offline fallback
    }
  }
}

/**
 * Migrates questions created while in Guest mode (unauthenticated) into the user's Google Account.
 * Uploads them immediately to Firestore so they are visible across all devices.
 */
export async function migrateGuestQuestionsToUser(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const guestRaw = localStorage.getItem(BANK_SOAL_KEY);
    if (!guestRaw) return 0;
    const guestSets: QuestionSet[] = JSON.parse(guestRaw);
    if (!Array.isArray(guestSets) || guestSets.length === 0) return 0;

    // Filter out sample questions so only teacher-created sets are migrated
    const realSets = guestSets.filter((s) => s.id && s.id !== "sample_set_1");
    if (realSets.length === 0) return 0;

    const userSets = getBankSoal(userId);
    const existingIds = new Set(userSets.map((s) => s.id));
    let count = 0;

    for (const set of realSets) {
      if (!existingIds.has(set.id)) {
        const migrated: QuestionSet = {
          ...set,
          userId,
          updatedAt: new Date().toISOString(),
        };
        userSets.unshift(migrated);
        count++;

        if (isFirestoreAvailable()) {
          try {
            const docRef = doc(db, "users", userId, "bankSoal", migrated.id);
            const cleanData = cleanFirestoreData(migrated);
            await setDoc(docRef, cleanData, { merge: true });
          } catch (e) {
            console.warn("Could not push migrated set to Firestore:", e);
          }
        }
      }
    }

    if (count > 0) {
      localStorage.setItem(getBankKey(userId), JSON.stringify(userSets));
    }
    return count;
  } catch (e) {
    console.error("Error migrating guest questions to user:", e);
    return 0;
  }
}

/**
 * Exports user's Bank Soal into formatted JSON for offline backup / transfer.
 */
export function exportBankSoalToJSON(userId?: string | null): string {
  const sets = getBankSoal(userId);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "SOAL GURU AI",
      version: "1.0",
      totalSets: sets.length,
      questionSets: sets,
    },
    null,
    2
  );
}

/**
 * Imports question sets from a JSON backup and persists them to local storage and Firestore.
 */
export async function importBankSoalFromJSON(
  jsonString: string,
  userId?: string | null
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    const incomingSets: QuestionSet[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questionSets)
      ? parsed.questionSets
      : Array.isArray(parsed?.questions)
      ? [
          {
            id: parsed.id || `set_${Date.now()}`,
            title: parsed.title || "Paket Soal Impor",
            subject: parsed.subject || "Umum",
            grade: parsed.grade || "X",
            semester: parsed.semester || "1",
            material: parsed.material || "",
            questions: parsed.questions,
            totalPoints: parsed.totalPoints || parsed.questions.reduce((a: number, q: any) => a + (q.points || 1), 0),
            createdAt: parsed.createdAt || new Date().toISOString(),
            onlyFromMaterial: parsed.onlyFromMaterial ?? true,
          } as QuestionSet,
        ]
      : [];

    if (incomingSets.length === 0) {
      return { success: false, count: 0, message: "File JSON tidak berisi data bank soal yang valid." };
    }

    const uid = resolveUserId(userId);
    const currentSets = getBankSoal(uid);
    const currentIds = new Set(currentSets.map((s) => s.id));
    let addedCount = 0;

    for (const rawSet of incomingSets) {
      if (!rawSet.questions || !Array.isArray(rawSet.questions) || rawSet.questions.length === 0) {
        continue;
      }
      const setId = rawSet.id && !currentIds.has(rawSet.id) ? rawSet.id : `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newSet: QuestionSet = {
        ...rawSet,
        id: setId,
        userId: uid || undefined,
        updatedAt: new Date().toISOString(),
      };
      currentSets.unshift(newSet);
      currentIds.add(setId);
      addedCount++;

      if (uid && isFirestoreAvailable()) {
        try {
          const docRef = doc(db, "users", uid, "bankSoal", setId);
          const cleanData = cleanFirestoreData(newSet);
          await setDoc(docRef, cleanData, { merge: true });
        } catch (e) {
          console.warn("Firestore sync during import warning:", e);
        }
      }
    }

    localStorage.setItem(getBankKey(uid), JSON.stringify(currentSets));
    return {
      success: true,
      count: addedCount,
      message: `Berhasil mengimpor ${addedCount} paket soal ke Bank Soal!`,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      message: `Gagal membaca file JSON: ${err?.message || "Format tidak valid"}`,
    };
  }
}

export function deleteFromBankSoal(id: string, userId?: string | null): void {
  try {
    const uid = resolveUserId(userId);
    const key = getBankKey(uid);
    const sets = getBankSoal(uid).filter((s) => s.id !== id);
    localStorage.setItem(key, JSON.stringify(sets));

    // 1. Delete from persistent server storage
    if (uid) {
      fetch("/api/bank-soal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId: uid }),
      }).catch(() => {});
    }

    // 2. Delete from Firestore user collection if authenticated
    if (uid && isFirestoreAvailable()) {
      const docRef = doc(db, "users", uid, "bankSoal", id);
      deleteDoc(docRef).catch((err: any) => {
        console.warn("Notice: Firestore delete set:", err?.message || err);
      });
    }
  } catch (e) {
    console.error("Error deleting from Bank Soal:", e);
  }
}

// --- REALTIME SYNC SUBSCRIPTIONS VIA FIRESTORE ---

/**
 * Real-time subscription to user's Bank Soal on Firestore.
 * Listens to collection `users/{userId}/bankSoal` and updates the app in real time
 * whenever questions are created, updated, or deleted on any device.
 */
export function subscribeUserBankSoal(
  userId: string,
  onUpdate: (sets: QuestionSet[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  if (!userId) {
    onUpdate(getBankSoal(userId));
    return () => {};
  }

  // Ensure Firestore availability is checked and attempted
  try {
    const colRef = collection(db, "users", userId, "bankSoal");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const cloudSets: QuestionSet[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as QuestionSet;
          if (data && (!data.userId || data.userId === userId)) {
            cloudSets.push({
              ...data,
              id: docSnap.id || data.id,
              userId,
            });
          }
        });

        // Check if there are local sets saved for this user not yet present in cloud
        const localSets = getBankSoal(userId);
        const cloudIds = new Set(cloudSets.map((s) => s.id));
        const unsyncedLocal = localSets.filter((s) => s.id && !cloudIds.has(s.id));

        // Auto-upload any unsynced local sets to user's personal Firestore
        if (unsyncedLocal.length > 0) {
          for (const s of unsyncedLocal) {
            try {
              const docRef = doc(db, "users", userId, "bankSoal", s.id);
              const cleanData = cleanFirestoreData({
                ...s,
                userId,
                updatedAt: new Date().toISOString(),
              });
              setDoc(docRef, cleanData, { merge: true }).catch(() => {});
            } catch {}
          }
        }

        const mergedSets = [...cloudSets, ...unsyncedLocal];
        mergedSets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Update user-specific local storage cache
        localStorage.setItem(getBankKey(userId), JSON.stringify(mergedSets));
        onUpdate(mergedSets);
      },
      (error) => {
        if (onError) onError(error);
        // Fallback to local cache for this specific user
        onUpdate(getBankSoal(userId));
      }
    );

    return unsubscribe;
  } catch {
    onUpdate(getBankSoal(userId));
    return () => {};
  }
}

/**
 * Real-time subscription to user's Form History on Firestore.
 * Listens to collection `users/{userId}/formHistory` and updates state in real time.
 */
export function subscribeUserFormHistory(
  userId: string,
  onUpdate: (items: GoogleFormHistoryItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  if (!userId) {
    onUpdate(getFormHistory(userId));
    return () => {};
  }

  try {
    const colRef = collection(db, "users", userId, "formHistory");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const cloudItems: GoogleFormHistoryItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as GoogleFormHistoryItem;
          if (data && (!data.userId || data.userId === userId)) {
            cloudItems.push({
              ...data,
              id: docSnap.id || data.id,
              userId,
            });
          }
        });

        // Check if there are local forms saved for this user not yet in cloud
        const localItems = getFormHistory(userId);
        const cloudIds = new Set(cloudItems.map((i) => i.id));
        const unsyncedLocal = localItems.filter((i) => i.id && !cloudIds.has(i.id));

        // Auto-upload unsynced local form records to Firestore
        if (unsyncedLocal.length > 0) {
          for (const item of unsyncedLocal) {
            try {
              const docRef = doc(db, "users", userId, "formHistory", item.id);
              const cleanData = cleanFirestoreData({
                ...item,
                userId,
                updatedAt: new Date().toISOString(),
              });
              setDoc(docRef, cleanData, { merge: true }).catch(() => {});
            } catch {}
          }
        }

        const mergedItems = [...cloudItems, ...unsyncedLocal];
        mergedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        localStorage.setItem(getFormHistoryKey(userId), JSON.stringify(mergedItems));
        onUpdate(mergedItems);
      },
      (error) => {
        if (onError) onError(error);
        onUpdate(getFormHistory(userId));
      }
    );

    return unsubscribe;
  } catch {
    onUpdate(getFormHistory(userId));
    return () => {};
  }
}

// --- SELECTED QUESTIONS PERSISTENCE HELPERS ---
export function saveSelectedQuestions(setId: string, selectedNumbers: number[]): void {
  try {
    localStorage.setItem(`ai_soal_selected_${setId}`, JSON.stringify(selectedNumbers));
  } catch (e) {
    console.warn("Could not save selected questions to local storage:", e);
  }
}

export function getSavedSelectedQuestions(setId: string): number[] | null {
  try {
    const raw = localStorage.getItem(`ai_soal_selected_${setId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return null;
}

// --- FORM HISTORY METHODS (MULTI-USER ISOLATED) ---
export function getFormHistory(userId?: string | null): GoogleFormHistoryItem[] {
  try {
    const uid = resolveUserId(userId);
    const key = getFormHistoryKey(uid);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: GoogleFormHistoryItem[] = JSON.parse(raw);
    if (uid && Array.isArray(parsed)) {
      // Strict multi-account isolation: only forms created by this specific user
      return parsed.filter((item) => item.userId === uid);
    }
    if (!uid && Array.isArray(parsed)) {
      // Guest mode: only items without any assigned userId
      return parsed.filter((item) => !item.userId);
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error reading Form History:", e);
    return [];
  }
}

export function saveFormHistoryItem(item: GoogleFormHistoryItem, userId?: string | null): void {
  try {
    const uid = resolveUserId(userId);
    const key = getFormHistoryKey(uid);
    const history = getFormHistory(uid);
    const itemWithUser: GoogleFormHistoryItem = {
      ...item,
      userId: uid || undefined,
    };
    const existingIndex = history.findIndex((h) => h.id === itemWithUser.id);
    if (existingIndex >= 0) {
      history[existingIndex] = itemWithUser;
    } else {
      history.unshift(itemWithUser);
    }
    localStorage.setItem(key, JSON.stringify(history));

    // Cloud sync to Firestore if teacher is authenticated and Firestore is active
    if (uid && isFirestoreAvailable()) {
      const docRef = doc(db, "users", uid, "formHistory", itemWithUser.id);
      const cleanData = cleanFirestoreData({
        ...itemWithUser,
        userId: uid,
        updatedAt: new Date().toISOString()
      });
      setDoc(docRef, cleanData, { merge: true }).catch((err: any) => {
        const msg = String(err?.message || err || "");
        if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
          disableFirestore();
        }
      });
    }
  } catch (e) {
    console.error("Error saving Form History:", e);
  }
}

export function deleteFormHistoryItem(id: string, userId?: string | null): void {
  try {
    const uid = resolveUserId(userId);
    const key = getFormHistoryKey(uid);
    const history = getFormHistory(uid).filter((h) => h.id !== id);
    localStorage.setItem(key, JSON.stringify(history));

    if (uid && isFirestoreAvailable()) {
      const docRef = doc(db, "users", uid, "formHistory", id);
      deleteDoc(docRef).catch((err: any) => {
        console.warn("Notice: Firestore delete formHistory:", err?.message || err);
      });
    }
  } catch (e) {
    console.error("Error deleting Form History:", e);
  }
}

/**
 * Synchronize user's personal questions & Google Forms from Firestore.
 * Seamless cross-device experience for teachers changing devices (laptop/HP).
 */
export async function syncUserDataFromCloud(userId: string): Promise<{
  bankSoal: QuestionSet[];
  formHistory: GoogleFormHistoryItem[];
}> {
  if (!userId) {
    return { bankSoal: getBankSoal(userId), formHistory: getFormHistory(userId) };
  }

  const activeEmail = auth.currentUser?.email || "";
  const activeName = auth.currentUser?.displayName || "";
  const localBank = getBankSoal(userId);
  const cloudBankMap = new Map<string, QuestionSet>();

  // 1. Fetch user's Bank Soal from Server Persistent Storage
  try {
    const serverRes = await fetch(
      `/api/bank-soal?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(activeEmail)}`
    );
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData?.success && Array.isArray(serverData.bankSoal)) {
        serverData.bankSoal.forEach((s: QuestionSet) => {
          if (s && s.id) {
            cloudBankMap.set(s.id, {
              ...s,
              userId,
              authorEmail: s.authorEmail || activeEmail || undefined,
              authorName: s.authorName || activeName || undefined,
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn("Notice: server bank-soal fetch:", e);
  }

  // 2. Fetch user's Bank Soal from Cloud Firestore (if available & provisioned)
  if (isFirestoreAvailable()) {
    try {
      const bankSnap = await getDocs(collection(db, "users", userId, "bankSoal"));
      bankSnap.forEach((docSnap) => {
        const data = docSnap.data() as QuestionSet;
        if (data && (!data.userId || data.userId === userId)) {
          const setId = docSnap.id || data.id;
          const existing = cloudBankMap.get(setId);
          if (!existing) {
            cloudBankMap.set(setId, {
              ...data,
              id: setId,
              userId,
              authorEmail: data.authorEmail || activeEmail || undefined,
              authorName: data.authorName || activeName || undefined,
            });
          }
        }
      });
    } catch (firestoreErr) {
      // Benign fallback: Firestore database may not have been created in console yet.
      // Server storage already successfully handles cross-device syncing.
    }
  }

  // 3. Merge with local storage sets
  localBank.forEach((s) => {
    if (s && s.id) {
      const existing = cloudBankMap.get(s.id);
      if (!existing) {
        cloudBankMap.set(s.id, {
          ...s,
          userId,
          authorEmail: s.authorEmail || activeEmail || undefined,
          authorName: s.authorName || activeName || undefined,
        });
      }
    }
  });

  // Also check guest mode questions from this browser
  try {
    const guestRaw = localStorage.getItem(BANK_SOAL_KEY);
    if (guestRaw) {
      const guestSets: QuestionSet[] = JSON.parse(guestRaw);
      if (Array.isArray(guestSets)) {
        for (const gs of guestSets) {
          if (gs.id && gs.id !== "sample_set_1" && !cloudBankMap.has(gs.id)) {
            cloudBankMap.set(gs.id, {
              ...gs,
              userId,
              authorEmail: activeEmail || undefined,
              authorName: activeName || undefined,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  } catch {}

  const mergedBank = Array.from(cloudBankMap.values());
  mergedBank.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Save merged result to local storage cache immediately
  try {
    localStorage.setItem(getBankKey(userId), JSON.stringify(mergedBank));
  } catch {}

  // 4. Push merged bank back to Server Storage and Firestore
  if (mergedBank.length > 0) {
    // Push to server
    fetch("/api/bank-soal/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        userEmail: activeEmail,
        userName: activeName,
        bankSoal: mergedBank,
      }),
    }).catch(() => {});

    // Push to Firestore if available
    if (isFirestoreAvailable()) {
      for (const s of mergedBank) {
        try {
          const docRef = doc(db, "users", userId, "bankSoal", s.id);
          const cleanData = cleanFirestoreData({
            ...s,
            userId,
            updatedAt: new Date().toISOString(),
          });
          setDoc(docRef, cleanData, { merge: true }).catch(() => {});
        } catch {}
      }
    }
  }

  // 5. Fetch user's Form History from Firestore
  let mergedHistory: GoogleFormHistoryItem[] = getFormHistory(userId);
  if (isFirestoreAvailable()) {
    try {
      const historySnap = await getDocs(collection(db, "users", userId, "formHistory"));
      const cloudHistory: GoogleFormHistoryItem[] = [];
      historySnap.forEach((docSnap) => {
        const data = docSnap.data() as GoogleFormHistoryItem;
        if (data && (!data.userId || data.userId === userId)) {
          cloudHistory.push({
            ...data,
            id: docSnap.id || data.id,
            userId,
          });
        }
      });

      const historyCloudIds = new Set(cloudHistory.map((h) => h.id));
      const unsyncedHistory = mergedHistory.filter((h) => h.id && !historyCloudIds.has(h.id));
      for (const h of unsyncedHistory) {
        try {
          const docRef = doc(db, "users", userId, "formHistory", h.id);
          const cleanData = cleanFirestoreData({ ...h, userId, updatedAt: new Date().toISOString() });
          setDoc(docRef, cleanData, { merge: true }).catch(() => {});
        } catch {}
      }

      mergedHistory = [...cloudHistory, ...unsyncedHistory];
      mergedHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem(getFormHistoryKey(userId), JSON.stringify(mergedHistory));
    } catch {
      // Graceful fallback to local history
    }
  }

  return { bankSoal: mergedBank, formHistory: mergedHistory };
}

// --- APP SETTINGS ---
export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    
    // Purge previous dummy class lists (VII A, VII B, VIII A, etc.)
    let classList = Array.isArray(parsed.classList) ? parsed.classList : [];
    const hasOldDummyClasses = 
      classList.length >= 8 &&
      classList.includes("VII A") &&
      classList.includes("VIII A") &&
      classList.includes("IX A");
    
    if (hasOldDummyClasses) {
      classList = [];
      const updated = { ...defaultSettings, ...parsed, classList: [] };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    }

    const enableSignatures = parsed.enableSignatures === true;

    return { ...defaultSettings, ...parsed, classList, enableSignatures };
  } catch (e) {
    return defaultSettings;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  // 1. Safe Local Storage Cache
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Notice: LocalStorage quota reached while caching settings:", e);
  }

  // 2. Broadcast to other open tabs on this machine (0ms)
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel("soal_guru_logo_channel");
      bc.postMessage({
        appLogoUrl: settings.appLogoUrl || "",
        timestamp: Date.now()
      });
      setTimeout(() => bc.close(), 100);
    } catch {}
  }

  // 3. Persist to server backend (durable on disk / container across all sessions)
  fetch("/api/system-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).catch(() => {});

  if (typeof settings.appLogoUrl === "string") {
    fetch("/api/system-settings/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appLogoUrl: settings.appLogoUrl }),
    }).catch(() => {});
  }

  // 4. Persist to Firestore cloud database (real-time cross-device sync)
  if (isFirestoreAvailable()) {
    try {
      const sysDocRef = doc(db, "system", "settings");
      const cleanData = cleanFirestoreData({
        ...settings,
        updatedAt: new Date().toISOString(),
      });
      withFirestoreTimeout(setDoc(sysDocRef, cleanData, { merge: true }), 1500).catch(() => {});

      if (typeof settings.appLogoUrl === "string") {
        const logoDocRef = doc(db, "system", "logo");
        withFirestoreTimeout(
          setDoc(logoDocRef, { appLogoUrl: settings.appLogoUrl, updatedAt: new Date().toISOString() }, { merge: true }),
          1500
        ).catch(() => {});
      }
    } catch {}
  }
}

/**
 * Saves the institutional logo to persistent server storage and cloud database.
 * Stored persistently in the database until replaced by another logo or reset.
 */
export async function saveAppLogo(logoUrl: string): Promise<boolean> {
  const cleanUrl = typeof logoUrl === "string" ? logoUrl.trim() : "";

  // 1. Update local storage cache safely
  try {
    const current = getAppSettings();
    const updated: AppSettings = { ...current, appLogoUrl: cleanUrl };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (lsErr) {
    console.warn("Notice: LocalStorage quota reached while caching logo:", lsErr);
  }

  // 2. Broadcast to all open tabs on this browser immediately (0ms sync)
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel("soal_guru_logo_channel");
      bc.postMessage({ appLogoUrl: cleanUrl, timestamp: Date.now() });
      setTimeout(() => bc.close(), 100);
    } catch {}
  }

  // 3. Persist to authoritative server backend database endpoint
  let serverSaved = false;
  try {
    const res = await fetch("/api/system-settings/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appLogoUrl: cleanUrl }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.success) {
        serverSaved = true;
      }
    }
  } catch (netErr) {
    console.warn("Notice: /api/system-settings/logo fetch error:", netErr);
  }

  // Also update /api/system-settings for complete backwards compatibility
  try {
    fetch("/api/system-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appLogoUrl: cleanUrl }),
    }).catch(() => {});
  } catch {}

  // 4. Persist to Firestore cloud database (with strict 1.5s non-blocking timeout)
  if (isFirestoreAvailable()) {
    try {
      const logoDocRef = doc(db, "system", "logo");
      const sysDocRef = doc(db, "system", "settings");
      const payload = {
        appLogoUrl: cleanUrl,
        updatedAt: new Date().toISOString(),
      };
      withFirestoreTimeout(setDoc(logoDocRef, payload, { merge: true }), 1500).catch(() => {});
      withFirestoreTimeout(setDoc(sysDocRef, payload, { merge: true }), 1500).catch(() => {});
    } catch {}
  }

  return serverSaved;
}

/**
 * Fetches the currently active logo from server database or cloud storage.
 * Ensures any newly opened device immediately receives the active logo.
 */
export async function fetchActiveLogo(): Promise<string | null> {
  // 1. Try server persistent storage endpoint first (authoritative database, ~5ms)
  try {
    const res = await fetch("/api/system-settings/logo", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json?.success && typeof json.appLogoUrl === "string") {
        return json.appLogoUrl;
      }
    }
  } catch {}

  // 2. Fallback: check Firestore if online
  if (isFirestoreAvailable()) {
    try {
      const logoDocRef = doc(db, "system", "logo");
      const snap = await withFirestoreTimeout(getDoc(logoDocRef), 1200, null);
      if (snap && "exists" in snap && snap.exists()) {
        const data = snap.data();
        if (data && typeof data.appLogoUrl === "string") {
          return data.appLogoUrl;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Fetches global system settings (including school logo and institutional branding)
 * from both the backend server and Firestore database to ensure seamless cross-device persistence.
 */
export async function fetchSystemSettingsFromDatabase(): Promise<AppSettings | null> {
  let remoteServerSettings: Partial<AppSettings> | null = null;
  let remoteFirestoreSettings: Partial<AppSettings> | null = null;
  let remoteLogoUrl: string | null = null;

  // 1. Fetch from server-side persistent endpoint and dedicated logo endpoint
  try {
    const [settingsRes, logoRes] = await Promise.allSettled([
      fetch("/api/system-settings", { cache: "no-store" }),
      fetch("/api/system-settings/logo", { cache: "no-store" }),
    ]);

    if (settingsRes.status === "fulfilled" && settingsRes.value.ok) {
      const json = await settingsRes.value.json();
      if (json?.success && json?.settings && typeof json.settings === "object") {
        remoteServerSettings = json.settings;
      }
    }

    if (logoRes.status === "fulfilled" && logoRes.value.ok) {
      const json = await logoRes.value.json();
      if (json?.success && typeof json.appLogoUrl === "string") {
        remoteLogoUrl = json.appLogoUrl;
      }
    }
  } catch (e) {
    // Graceful fallback for offline mode
  }

  // 2. Fetch from Firestore global system document (if online & accessible)
  if (isFirestoreAvailable()) {
    try {
      const sysDocRef = doc(db, "system", "settings");
      const snap = await withFirestoreTimeout(getDoc(sysDocRef), 1200, null);
      if (snap && "exists" in snap && snap.exists()) {
        remoteFirestoreSettings = snap.data() as Partial<AppSettings>;
      }
    } catch {}
  }

  // If neither remote source has data, return current local settings
  if (!remoteServerSettings && !remoteFirestoreSettings && remoteLogoUrl === null) {
    return null;
  }

  const currentLocal = getAppSettings();
  const merged: AppSettings = {
    ...currentLocal,
    ...(remoteServerSettings || {}),
    ...(remoteFirestoreSettings || {}),
  };

  // Ensure explicit logo string preference from server database
  if (remoteLogoUrl !== null) {
    merged.appLogoUrl = remoteLogoUrl;
  } else if (remoteFirestoreSettings && typeof remoteFirestoreSettings.appLogoUrl === "string") {
    merged.appLogoUrl = remoteFirestoreSettings.appLogoUrl;
  } else if (remoteServerSettings && typeof remoteServerSettings.appLogoUrl === "string") {
    merged.appLogoUrl = remoteServerSettings.appLogoUrl;
  }

  // Cache updated settings locally
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch {}

  return merged;
}

/**
 * Real-time listener and cross-device synchronization for system settings and active logo.
 * Combines server version polling, Firestore onSnapshot, and BroadcastChannel
 * to ensure that changes on Device A immediately reflect on Device B in real-time.
 */
export function subscribeSystemSettings(onUpdate: (settings: AppSettings) => void): (() => void) {
  let isCleanedUp = false;
  let lastServerVersion = -1;

  // 1. BroadcastChannel for 0ms cross-tab sync on same machine
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel("soal_guru_logo_channel");
      bc.onmessage = (ev) => {
        if (isCleanedUp) return;
        if (ev.data && typeof ev.data.appLogoUrl === "string") {
          const current = getAppSettings();
          if (current.appLogoUrl !== ev.data.appLogoUrl) {
            const updated = { ...current, appLogoUrl: ev.data.appLogoUrl };
            try {
              localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
            } catch {}
            onUpdate(updated);
          }
        }
      };
    } catch {}
  }

  // 2. Server polling check (detects changes across different devices A and B within ~3 seconds)
  const checkServerSync = async () => {
    if (isCleanedUp) return;
    try {
      const res = await fetch("/api/system-settings/version", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && typeof json.version === "number") {
          if (lastServerVersion !== -1 && json.version !== lastServerVersion) {
            // New version detected on server! Fetch the updated logo & settings
            lastServerVersion = json.version;
            const logoRes = await fetch("/api/system-settings/logo", { cache: "no-store" });
            if (logoRes.ok) {
              const logoJson = await logoRes.json();
              if (logoJson?.success && typeof logoJson.appLogoUrl === "string") {
                const current = getAppSettings();
                if (current.appLogoUrl !== logoJson.appLogoUrl) {
                  const updated = { ...current, appLogoUrl: logoJson.appLogoUrl };
                  try {
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
                  } catch {}
                  onUpdate(updated);
                }
              }
            }
          } else if (lastServerVersion === -1) {
            lastServerVersion = json.version;
          }
        }
      }
    } catch {}
  };

  // Run initial server check after slight tick
  setTimeout(checkServerSync, 200);

  // Poll every 3.5 seconds
  const pollInterval = setInterval(checkServerSync, 3500);

  // Immediate sync check on tab focus or visibility change
  const onFocusOrVisible = () => {
    if (document.visibilityState === "visible") {
      checkServerSync();
    }
  };
  window.addEventListener("focus", onFocusOrVisible);
  document.addEventListener("visibilitychange", onFocusOrVisible);

  // 3. Firestore onSnapshot real-time listener (if available)
  let unsubscribeFirestore: (() => void) | null = null;
  if (isFirestoreAvailable()) {
    try {
      const logoDocRef = doc(db, "system", "logo");
      unsubscribeFirestore = onSnapshot(
        logoDocRef,
        (snapshot) => {
          if (isCleanedUp) return;
          if (snapshot.exists()) {
            const remoteData = snapshot.data();
            if (remoteData && typeof remoteData.appLogoUrl === "string") {
              const current = getAppSettings();
              if (current.appLogoUrl !== remoteData.appLogoUrl) {
                const updated = { ...current, appLogoUrl: remoteData.appLogoUrl };
                try {
                  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
                } catch {}
                onUpdate(updated);
              }
            }
          }
        },
        () => {}
      );
    } catch {}
  }

  return () => {
    isCleanedUp = true;
    clearInterval(pollInterval);
    window.removeEventListener("focus", onFocusOrVisible);
    document.removeEventListener("visibilitychange", onFocusOrVisible);
    if (bc) bc.close();
    if (unsubscribeFirestore) unsubscribeFirestore();
  };
}

// --- ADMIN SYSTEM & CACHE MANAGEMENT ---

export interface StorageStats {
  bankSoalCount: number;
  totalQuestionsCount: number;
  formHistoryCount: number;
  approxStorageBytes: number;
  approxStorageKB: number;
  localStorageKeysCount: number;
  hasCustomLogo: boolean;
  sampleSetsCount: number;
}

export function getStorageStats(userId?: string | null): StorageStats {
  try {
    const bank = getBankSoal(userId);
    const history = getFormHistory(userId);
    const settings = getAppSettings();
    
    let totalQuestions = 0;
    let sampleSetsCount = 0;
    bank.forEach((set) => {
      if (Array.isArray(set.questions)) {
        totalQuestions += set.questions.length;
      }
      if (set.id.startsWith("sample_set")) {
        sampleSetsCount++;
      }
    });

    let totalBytes = 0;
    let keysCount = 0;
    if (typeof window !== "undefined" && window.localStorage) {
      keysCount = localStorage.length;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key) || "";
          totalBytes += (key.length + val.length) * 2; // UTF-16 approx 2 bytes per char
        }
      }
    }

    return {
      bankSoalCount: bank.length,
      totalQuestionsCount: totalQuestions,
      formHistoryCount: history.length,
      approxStorageBytes: totalBytes,
      approxStorageKB: Math.round(totalBytes / 1024),
      localStorageKeysCount: keysCount,
      hasCustomLogo: Boolean(settings.appLogoUrl && settings.appLogoUrl.trim().length > 0),
      sampleSetsCount,
    };
  } catch (e) {
    return {
      bankSoalCount: 0,
      totalQuestionsCount: 0,
      formHistoryCount: 0,
      approxStorageBytes: 0,
      approxStorageKB: 0,
      localStorageKeysCount: 0,
      hasCustomLogo: false,
      sampleSetsCount: 0,
    };
  }
}

/**
 * Cleans temporary caches, drafts, extraction residues, and session data
 * without touching real saved Bank Soal.
 */
export function clearTemporaryCaches(): { freedKeys: number } {
  let freedCount = 0;
  try {
    if (typeof window !== "undefined") {
      // Clear sessionStorage temporary items
      if (window.sessionStorage) {
        sessionStorage.removeItem("ai_soal_temp_extracted");
        sessionStorage.removeItem("ai_soal_current_draft");
        sessionStorage.removeItem("ai_soal_parse_cache");
      }

      // Check localStorage for temporary keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith("temp_") ||
          key.startsWith("cache_") ||
          key.includes("_temp_") ||
          key.includes("_draft_") ||
          key.includes("parse_result_")
        )) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((k) => {
        localStorage.removeItem(k);
        freedCount++;
      });
    }
  } catch (e) {
    console.warn("Error clearing temporary caches:", e);
  }
  return { freedKeys: freedCount };
}

/**
 * Clears form generation history.
 */
export function clearAllFormHistory(userId?: string | null): void {
  try {
    const key = getFormHistoryKey(userId);
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Error clearing form history:", e);
  }
}

/**
 * Removes default sample question sets from bank soal to save space.
 */
export function removeSampleQuestionSets(userId?: string | null): number {
  try {
    const bank = getBankSoal(userId);
    const filtered = bank.filter((s) => !s.id.startsWith("sample_set"));
    const removedCount = bank.length - filtered.length;
    if (removedCount > 0) {
      localStorage.setItem(getBankKey(userId), JSON.stringify(filtered));
    }
    return removedCount;
  } catch (e) {
    return 0;
  }
}

/**
 * Defrags and cleans unrecognized corrupted keys in localStorage.
 */
export function optimizeStorage(userId?: string | null): { freedBytes: number; purgedKeys: number } {
  let purgedCount = 0;
  let freedBytes = 0;
  try {
    const knownPrefixes = [
      "ai_soal_",
      BANK_SOAL_KEY,
      FORM_HISTORY_KEY,
      SETTINGS_KEY,
    ];

    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key) || "";
        // Check if corrupt or temporary
        if (
          key.startsWith("ai_soal_selected_") ||
          key.startsWith("temp_") ||
          key.startsWith("tmp_")
        ) {
          keysToDelete.push(key);
          freedBytes += (key.length + val.length) * 2;
        }
      }
    }

    keysToDelete.forEach((k) => {
      localStorage.removeItem(k);
      purgedCount++;
    });

    // Re-pack bank soal to strip empty fields
    const bank = getBankSoal(userId);
    const cleaned = cleanFirestoreData(bank);
    localStorage.setItem(getBankKey(userId), JSON.stringify(cleaned));
  } catch (e) {
    console.warn("Error optimizing storage:", e);
  }
  return { freedBytes, purgedKeys: purgedCount };
}

/**
 * Clears all bank soal for user.
 */
export function clearAllBankSoalData(userId?: string | null): void {
  try {
    localStorage.setItem(getBankKey(userId), JSON.stringify([]));
  } catch (e) {
    console.error("Error clearing bank soal:", e);
  }
}

// --- QUESTION FORM DRAFT PERSISTENCE ---
const FORM_DRAFT_KEY = "ai_soal_creator_form_draft_v2";

export interface QuestionFormDraft {
  level: string;
  subject: string;
  customSubject: string;
  isCustomSubject: boolean;
  grade: string;
  semester: "1" | "2";
  examType: string;
  questionCount: number;
  optionsCount: 4 | 5;
  cognitiveFocus: "HOTS" | "LOTS" | "BALANCED";
  includeImages: boolean;
  imageFrequency: "none" | "some" | "all";
  diffEasy: number;
  diffMedium: number;
  diffHard: number;
  sourceMode: "manual" | "upload" | "docx-format";
  materialText: string;
  onlyFromMaterial: boolean;
  customPrompt: string;
  moduleFocusTopic: string;
  uploadedFileName?: string | null;
  savedAt: string;
}

export function saveQuestionFormDraft(draft: Partial<QuestionFormDraft>): void {
  try {
    const dataToSave = {
      ...draft,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(dataToSave));
    localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(dataToSave));
  } catch {}
}

export function getQuestionFormDraft(): Partial<QuestionFormDraft> | null {
  try {
    const raw = sessionStorage.getItem(FORM_DRAFT_KEY) || localStorage.getItem(FORM_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearQuestionFormDraft(): void {
  try {
    sessionStorage.removeItem(FORM_DRAFT_KEY);
    localStorage.removeItem(FORM_DRAFT_KEY);
  } catch {}
}


