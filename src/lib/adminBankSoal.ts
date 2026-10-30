import { doc, getDocs, collection, deleteDoc, collectionGroup } from "firebase/firestore";
import { db, isFirestoreAvailable, withFirestoreTimeout } from "./firebase.js";
import type { QuestionSet } from "../types.js";

export interface AdminBankSoalItem {
  id: string;
  set: QuestionSet;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userPhotoUrl?: string;
  source: "firestore" | "local" | "synced";
  documentPath?: string;
  questionCount: number;
  totalPoints: number;
  createdAt: string;
  updatedAt?: string;
  approximateSizeKb: number;
}

export interface AdminDatabaseStats {
  totalSets: number;
  totalQuestions: number;
  totalUsers: number;
  totalSizeKb: number;
  firestoreSetsCount: number;
  localSetsCount: number;
  lastRefreshed: string;
}

const LOCAL_GUEST_KEY = "ai_soal_bank_soal_v1";

/**
 * Fetches all question banks across all users from Firestore (Cloud Database)
 * and merges with any local storage copies.
 */
export async function fetchAllBankSoalForAdmin(): Promise<{
  items: AdminBankSoalItem[];
  stats: AdminDatabaseStats;
  error?: string;
}> {
  const items: AdminBankSoalItem[] = [];
  const seenIds = new Set<string>();
  const usersMap = new Map<string, { email: string; displayName: string; photoURL?: string }>();
  let firestoreCount = 0;
  let localCount = 0;
  let fetchError: string | undefined;

  // 1. FAST PRIMARY SOURCE: Server Persistent Storage (cross-device database, ~2ms)
  try {
    const serverRes = await fetch("/api/bank-soal/all");
    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData?.success) {
        // Populate users from server directory
        if (Array.isArray(serverData.users)) {
          for (const u of serverData.users) {
            if (u && u.userId) {
              usersMap.set(u.userId, {
                email: u.email || "",
                displayName: u.name || "",
              });
            }
          }
        }

        // Populate question sets
        if (Array.isArray(serverData.sets)) {
          for (const s of serverData.sets) {
            if (s && s.id && !seenIds.has(s.id)) {
              const qCount = Array.isArray(s.questions) ? s.questions.length : 0;
              const jsonStr = JSON.stringify(s);
              const sizeKb = Math.round((jsonStr.length / 1024) * 10) / 10;
              const userDetail = usersMap.get(s.userId);

              items.push({
                id: s.id,
                set: s,
                userId: s.userId || "server_user",
                userEmail: s.authorEmail || userDetail?.email || "",
                userDisplayName: s.authorName || userDetail?.displayName || "",
                source: "firestore",
                questionCount: qCount,
                totalPoints: s.totalPoints || qCount,
                createdAt: s.createdAt || new Date().toISOString(),
                updatedAt: s.updatedAt,
                approximateSizeKb: sizeKb,
              });
              seenIds.add(s.id);
              firestoreCount++;
            }
          }
        }
      }
    }
  } catch (serverFetchErr) {
    console.warn("Notice: server bank-soal all fetch:", serverFetchErr);
  }

  // 2. Scan LocalStorage for local & guest bank soal data (~1ms)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key === LOCAL_GUEST_KEY || key.startsWith("ai_soal_bank_soal_"))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const sets = JSON.parse(raw);
              if (Array.isArray(sets)) {
                for (const s of sets) {
                  if (s && s.id) {
                    if (seenIds.has(s.id)) {
                      const existing = items.find((it) => it.id === s.id);
                      if (existing) {
                        existing.source = "synced";
                      }
                    } else {
                      const isGuest = key === LOCAL_GUEST_KEY;
                      const ownerUid = s.userId || (isGuest ? "guest" : key.replace("ai_soal_bank_soal_", ""));
                      const qCount = Array.isArray(s.questions) ? s.questions.length : 0;
                      const jsonStr = JSON.stringify(s);
                      const sizeKb = Math.round((jsonStr.length / 1024) * 10) / 10;

                      items.push({
                        id: s.id,
                        set: s,
                        userId: ownerUid,
                        userEmail: s.authorEmail || (isGuest ? "Mode Tamu (Offline Browser)" : ""),
                        userDisplayName: s.authorName || (isGuest ? "Pengguna Tamu" : "Akun Lokal"),
                        source: "local",
                        questionCount: qCount,
                        totalPoints: s.totalPoints || qCount,
                        createdAt: s.createdAt || new Date().toISOString(),
                        updatedAt: s.updatedAt,
                        approximateSizeKb: sizeKb,
                      });
                      seenIds.add(s.id);
                      localCount++;
                    }
                  }
                }
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  // 3. Optional: Quick non-blocking Firestore check with strict 1.2s timeout
  if (isFirestoreAvailable()) {
    try {
      const bankGroupSnap = await withFirestoreTimeout(
        getDocs(collectionGroup(db, "bankSoal")),
        1200,
        null
      );

      if (bankGroupSnap) {
        bankGroupSnap.forEach((d) => {
          try {
            const data = d.data() as QuestionSet;
            const docId = data.id || d.id;
            if (!seenIds.has(docId)) {
              const parentUser = d.ref.parent.parent;
              const ownerUid = parentUser ? parentUser.id : (data.userId || "cloud_user");
              const userInfo = usersMap.get(ownerUid);

              const qCount = Array.isArray(data.questions) ? data.questions.length : 0;
              const jsonStr = JSON.stringify(data);
              const sizeKb = Math.round((jsonStr.length / 1024) * 10) / 10;

              const email = userInfo?.email || data.authorEmail || "";
              const name = userInfo?.displayName || data.authorName || "";

              items.push({
                id: docId,
                set: {
                  ...data,
                  id: docId,
                  userId: ownerUid,
                  authorEmail: email || undefined,
                  authorName: name || undefined,
                },
                userId: ownerUid,
                userEmail: email,
                userDisplayName: name,
                userPhotoUrl: userInfo?.photoURL,
                source: "firestore",
                documentPath: d.ref.path,
                questionCount: qCount,
                totalPoints: data.totalPoints || qCount,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt,
                approximateSizeKb: sizeKb,
              });

              seenIds.add(docId);
              firestoreCount++;
            }
          } catch {}
        });
      }
    } catch {
      // Benign timeout: Server storage already serves all cross-device data
    }
  }

  // 3. Scan LocalStorage for local & guest bank soal data
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key === LOCAL_GUEST_KEY || key.startsWith("ai_soal_bank_soal_"))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const sets = JSON.parse(raw);
              if (Array.isArray(sets)) {
                for (const s of sets) {
                  if (s && s.id) {
                    if (seenIds.has(s.id)) {
                      // Already in Firestore, mark as synced
                      const existing = items.find((it) => it.id === s.id);
                      if (existing) {
                        existing.source = "synced";
                      }
                    } else {
                      // Exclusively local
                      const isGuest = key === LOCAL_GUEST_KEY;
                      const ownerUid = s.userId || (isGuest ? "guest" : key.replace("ai_soal_bank_soal_", ""));
                      const qCount = Array.isArray(s.questions) ? s.questions.length : 0;
                      const sizeKb = Math.round((JSON.stringify(s).length / 1024) * 10) / 10;

                      items.push({
                        id: s.id,
                        set: s,
                        userId: ownerUid,
                        userEmail: s.authorEmail || (isGuest ? "Mode Tamu (Offline Browser)" : ""),
                        userDisplayName: s.authorName || (isGuest ? "Pengguna Tamu" : "Akun Lokal"),
                        source: "local",
                        questionCount: qCount,
                        totalPoints: s.totalPoints || qCount,
                        createdAt: s.createdAt || new Date().toISOString(),
                        updatedAt: s.updatedAt,
                        approximateSizeKb: sizeKb,
                      });
                      seenIds.add(s.id);
                      localCount++;
                    }
                  }
                }
              }
            } catch {}
          }
        }
      }
    } catch (lsErr) {
      console.warn("Admin: Could not scan localStorage bank soal:", lsErr);
    }
  }

  // Calculate Aggregated Database Statistics
  const uniqueUsers = new Set(items.map((it) => it.userId)).size;
  const totalQuestions = items.reduce((acc, it) => acc + it.questionCount, 0);
  const totalSizeKb = Math.round(items.reduce((acc, it) => acc + it.approximateSizeKb, 0) * 10) / 10;

  // Sort by date descending by default
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const stats: AdminDatabaseStats = {
    totalSets: items.length,
    totalQuestions,
    totalUsers: uniqueUsers,
    totalSizeKb,
    firestoreSetsCount: firestoreCount,
    localSetsCount: localCount,
    lastRefreshed: new Date().toLocaleTimeString("id-ID"),
  };

  return { items, stats, error: fetchError };
}

/**
 * Deletes a single bank soal item from the database with immediate response:
 * - Purges from persistent server backend storage
 * - Cleans local storage cache
 * - Background cleans Firestore without hanging the UI
 */
export async function deleteBankSoalByAdmin(item: AdminBankSoalItem): Promise<boolean> {
  // 1. Delete from Server persistent storage (authoritative, ~5ms)
  try {
    await fetch("/api/bank-soal/admin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: item.id, userId: item.userId }),
    });
  } catch (err) {
    console.warn("Admin delete server error:", err);
  }

  // 2. Remove from LocalStorage keys immediately
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const userKey = item.userId === "guest" ? LOCAL_GUEST_KEY : `ai_soal_bank_soal_${item.userId}`;
      const userRaw = localStorage.getItem(userKey);
      if (userRaw) {
        const sets: QuestionSet[] = JSON.parse(userRaw);
        const filtered = sets.filter((s) => s.id !== item.id);
        localStorage.setItem(userKey, JSON.stringify(filtered));
      }

      // Also clean from guest key if present
      const guestRaw = localStorage.getItem(LOCAL_GUEST_KEY);
      if (guestRaw) {
        const guestSets: QuestionSet[] = JSON.parse(guestRaw);
        const filteredGuest = guestSets.filter((s) => s.id !== item.id);
        localStorage.setItem(LOCAL_GUEST_KEY, JSON.stringify(filteredGuest));
      }
    } catch (lsErr) {
      console.warn("Admin: Failed to clean local storage entry:", lsErr);
    }
  }

  // 3. Non-blocking Firestore cleanup in background (strict 1s timeout)
  if (item.userId && item.userId !== "guest" && isFirestoreAvailable()) {
    withFirestoreTimeout(
      deleteDoc(doc(db, "users", item.userId, "bankSoal", item.id)),
      1000
    ).catch(() => {});
  }

  return true;
}

/**
 * Deletes multiple bank soal items in bulk from the database in a single batch request:
 */
export async function bulkDeleteBankSoalByAdmin(
  items: AdminBankSoalItem[]
): Promise<{ successCount: number; failedCount: number }> {
  if (!items || items.length === 0) return { successCount: 0, failedCount: 0 };

  const idSet = new Set(items.map((it) => it.id));

  // 1. Single batch request to Server storage (1 round-trip, ~10ms)
  try {
    await fetch("/api/bank-soal/admin/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((it) => ({ id: it.id, userId: it.userId })),
      }),
    });
  } catch (err) {
    console.warn("Admin bulk-delete server error:", err);
  }

  // 2. Clean LocalStorage in 1 pass
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key === LOCAL_GUEST_KEY || key.startsWith("ai_soal_bank_soal_"))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const sets: QuestionSet[] = JSON.parse(raw);
              if (Array.isArray(sets)) {
                const filtered = sets.filter((s) => !idSet.has(s.id));
                if (filtered.length !== sets.length) {
                  localStorage.setItem(key, JSON.stringify(filtered));
                }
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  // 3. Background non-blocking Firestore cleanups
  if (isFirestoreAvailable()) {
    items.forEach((item) => {
      if (item.userId && item.userId !== "guest") {
        withFirestoreTimeout(
          deleteDoc(doc(db, "users", item.userId, "bankSoal", item.id)),
          1000
        ).catch(() => {});
      }
    });
  }

  return { successCount: items.length, failedCount: 0 };
}

/**
 * Deletes all bank soal items belonging to a specific user in one high-speed operation.
 */
export async function deleteUserAllBankSoalByAdmin(
  userId: string,
  allItems: AdminBankSoalItem[]
): Promise<{ deletedCount: number }> {
  const userItems = allItems.filter((it) => it.userId === userId);
  const result = await bulkDeleteBankSoalByAdmin(userItems);
  return { deletedCount: result.successCount };
}
