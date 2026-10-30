import fs from "fs";
import path from "path";
import type { QuestionSet } from "../src/types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const USER_BANKS_DIR = path.join(DATA_DIR, "user_banks");

interface UserBankRecord {
  userId: string;
  userEmail?: string;
  userName?: string;
  updatedAt: string;
  bankSoal: QuestionSet[];
}

interface UserDirectoryEntry {
  userId: string;
  email: string;
  name: string;
  updatedAt: string;
  setCount: number;
}

function ensureDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USER_BANKS_DIR)) {
    fs.mkdirSync(USER_BANKS_DIR, { recursive: true });
  }
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getUserFilePath(userId: string): string {
  ensureDirExists();
  return path.join(USER_BANKS_DIR, `${sanitizeId(userId)}.json`);
}

function getIndexFilePath(): string {
  ensureDirExists();
  return path.join(USER_BANKS_DIR, "__users_index.json");
}

function readIndex(): Record<string, UserDirectoryEntry> {
  try {
    const file = getIndexFilePath();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("Notice reading users index:", e);
  }
  return {};
}

function writeIndex(index: Record<string, UserDirectoryEntry>) {
  try {
    const file = getIndexFilePath();
    fs.writeFileSync(file, JSON.stringify(index, null, 2), "utf-8");
  } catch (e) {
    console.warn("Notice writing users index:", e);
  }
}

export function getUserBankSoal(userId: string, email?: string): QuestionSet[] {
  ensureDirExists();
  if (!userId && !email) return [];

  // Try direct userId file
  const directPath = getUserFilePath(userId);
  if (fs.existsSync(directPath)) {
    try {
      const record: UserBankRecord = JSON.parse(fs.readFileSync(directPath, "utf-8"));
      return Array.isArray(record.bankSoal) ? record.bankSoal : [];
    } catch (e) {
      console.warn("Notice parsing user bank file:", e);
    }
  }

  // If not found and email is provided, check index for matching email
  if (email) {
    const index = readIndex();
    for (const entry of Object.values(index)) {
      if (entry.email && entry.email.toLowerCase() === email.toLowerCase()) {
        const altPath = getUserFilePath(entry.userId);
        if (fs.existsSync(altPath)) {
          try {
            const record: UserBankRecord = JSON.parse(fs.readFileSync(altPath, "utf-8"));
            return Array.isArray(record.bankSoal) ? record.bankSoal : [];
          } catch {}
        }
      }
    }
  }

  return [];
}

export function saveUserBankSoal(
  userId: string,
  questionSet: QuestionSet,
  email?: string,
  name?: string
): QuestionSet[] {
  ensureDirExists();
  if (!userId) return [];

  const currentSets = getUserBankSoal(userId, email);
  const updatedSet: QuestionSet = {
    ...questionSet,
    userId,
    authorEmail: email || questionSet.authorEmail,
    authorName: name || questionSet.authorName,
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = currentSets.findIndex((s) => s.id === questionSet.id);
  if (existingIdx >= 0) {
    currentSets[existingIdx] = updatedSet;
  } else {
    currentSets.unshift(updatedSet);
  }

  // Save to user file
  const record: UserBankRecord = {
    userId,
    userEmail: email,
    userName: name,
    updatedAt: new Date().toISOString(),
    bankSoal: currentSets,
  };

  fs.writeFileSync(getUserFilePath(userId), JSON.stringify(record, null, 2), "utf-8");

  // Update index
  const index = readIndex();
  index[userId] = {
    userId,
    email: email || index[userId]?.email || "",
    name: name || index[userId]?.name || "",
    updatedAt: new Date().toISOString(),
    setCount: currentSets.length,
  };
  writeIndex(index);

  return currentSets;
}

export function syncUserBankSoal(
  userId: string,
  incomingSets: QuestionSet[],
  email?: string,
  name?: string
): QuestionSet[] {
  ensureDirExists();
  if (!userId) return [];

  const existingSets = getUserBankSoal(userId, email);
  const existingMap = new Map<string, QuestionSet>();

  existingSets.forEach((s) => {
    if (s.id) existingMap.set(s.id, s);
  });

  // Merge incoming sets
  if (Array.isArray(incomingSets)) {
    for (const set of incomingSets) {
      if (!set || !set.id) continue;
      const existing = existingMap.get(set.id);
      if (!existing) {
        existingMap.set(set.id, {
          ...set,
          userId,
          authorEmail: email || set.authorEmail,
          authorName: name || set.authorName,
        });
      } else {
        // Prefer newer updatedAt or keep existing
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const incomingTime = set.updatedAt ? new Date(set.updatedAt).getTime() : 0;
        if (incomingTime >= existingTime) {
          existingMap.set(set.id, {
            ...set,
            userId,
            authorEmail: email || set.authorEmail || existing.authorEmail,
            authorName: name || set.authorName || existing.authorName,
          });
        }
      }
    }
  }

  const mergedSets = Array.from(existingMap.values());
  mergedSets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const record: UserBankRecord = {
    userId,
    userEmail: email,
    userName: name,
    updatedAt: new Date().toISOString(),
    bankSoal: mergedSets,
  };

  fs.writeFileSync(getUserFilePath(userId), JSON.stringify(record, null, 2), "utf-8");

  // Update index
  const index = readIndex();
  index[userId] = {
    userId,
    email: email || index[userId]?.email || "",
    name: name || index[userId]?.name || "",
    updatedAt: new Date().toISOString(),
    setCount: mergedSets.length,
  };
  writeIndex(index);

  return mergedSets;
}

export function deleteUserBankSoal(userId: string, setId: string): QuestionSet[] {
  ensureDirExists();
  const sets = getUserBankSoal(userId);
  const filtered = sets.filter((s) => s.id !== setId);

  const directPath = getUserFilePath(userId);
  if (fs.existsSync(directPath)) {
    try {
      const record: UserBankRecord = JSON.parse(fs.readFileSync(directPath, "utf-8"));
      record.bankSoal = filtered;
      record.updatedAt = new Date().toISOString();
      fs.writeFileSync(directPath, JSON.stringify(record, null, 2), "utf-8");
    } catch {}
  }

  const index = readIndex();
  if (index[userId]) {
    index[userId].setCount = filtered.length;
    index[userId].updatedAt = new Date().toISOString();
    writeIndex(index);
  }

  return filtered;
}

export function getAllBankSoalForAdmin(): {
  sets: (QuestionSet & { authorEmail?: string; authorName?: string })[];
  users: UserDirectoryEntry[];
} {
  ensureDirExists();
  const allSets: (QuestionSet & { authorEmail?: string; authorName?: string })[] = [];
  const index = readIndex();
  const usersList: UserDirectoryEntry[] = Object.values(index);

  try {
    const files = fs.readdirSync(USER_BANKS_DIR);
    for (const file of files) {
      if (file.endsWith(".json") && file !== "__users_index.json") {
        try {
          const filePath = path.join(USER_BANKS_DIR, file);
          const record: UserBankRecord = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          if (Array.isArray(record.bankSoal)) {
            for (const s of record.bankSoal) {
              allSets.push({
                ...s,
                authorEmail: record.userEmail || s.authorEmail,
                authorName: record.userName || s.authorName,
                userId: record.userId || s.userId,
              });
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    console.warn("Notice reading all bank files:", e);
  }

  allSets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { sets: allSets, users: usersList };
}

export function bulkDeleteBankSoalByAdmin(items: { id: string; userId?: string }[]): number {
  ensureDirExists();
  if (!Array.isArray(items) || items.length === 0) return 0;

  const idSet = new Set(items.map((it) => it.id));
  let deletedCount = 0;

  try {
    const files = fs.readdirSync(USER_BANKS_DIR);
    const index = readIndex();
    let indexModified = false;

    for (const file of files) {
      if (file.endsWith(".json") && file !== "__users_index.json") {
        const filePath = path.join(USER_BANKS_DIR, file);
        try {
          const record: UserBankRecord = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          if (Array.isArray(record.bankSoal)) {
            const initialCount = record.bankSoal.length;
            const remaining = record.bankSoal.filter((s) => !idSet.has(s.id));
            if (remaining.length < initialCount) {
              const diff = initialCount - remaining.length;
              deletedCount += diff;
              record.bankSoal = remaining;
              record.updatedAt = new Date().toISOString();
              fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");

              if (record.userId && index[record.userId]) {
                index[record.userId].setCount = remaining.length;
                index[record.userId].updatedAt = new Date().toISOString();
                indexModified = true;
              }
            }
          }
        } catch {}
      }
    }

    if (indexModified) {
      writeIndex(index);
    }
  } catch (e) {
    console.warn("Notice in bulkDeleteBankSoalByAdmin:", e);
  }

  return deletedCount;
}

export function deleteBankSoalByAdmin(setId: string, userId?: string): boolean {
  if (userId) {
    deleteUserBankSoal(userId, setId);
    return true;
  }
  const count = bulkDeleteBankSoalByAdmin([{ id: setId, userId }]);
  return count > 0;
}
