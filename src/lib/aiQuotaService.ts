/**
 * aiQuotaService.ts
 * 
 * Layanan manajemen kuota harian pembuatan soal AI untuk guru,
 * mencatat batas pembuatan harian per pengguna/perangkat,
 * mendeteksi pemblokiran kuota Gemini API (HTTP 429 / RESOURCE_EXHAUSTED),
 * dan menghitung sisa waktu mundur presisi hingga reset tengah malam (pukul 00:00).
 */

export interface AiQuotaState {
  date: string; // Format: YYYY-MM-DD (waktu lokal)
  count: number; // Jumlah pembuatan soal yang telah dilakukan hari ini
  limit: number; // Batas kuota harian (default: 20 paket soal/hari)
  isApiBlocked: boolean; // True jika terkena 429 atau batasan resmi Gemini
  blockedUntil?: number; // Timestamp epoch ms batas pemblokiran
  lastErrorReason?: string;
}

export interface CountdownTime {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  formatted: string;
  resetTimeString: string; // contoh: "Pukul 00:00"
}

export const DEFAULT_DAILY_LIMIT = 20;
const STORAGE_PREFIX = "ai_soal_quota_v1_";
const QUOTA_EVENT_NAME = "ai_soal_quota_changed";

/**
 * Mendapatkan string tanggal hari ini berdasarkan zona waktu lokal perangkat (YYYY-MM-DD)
 */
export function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Mendapatkan timestamp epoch ms untuk tengah malam berikutnya (00:00:00 esok hari)
 */
export function getNextMidnightTimestamp(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * Menghitung hitung mundur (countdown) waktu menuju tengah malam (00:00)
 */
export function calculateCountdownToMidnight(overrideTargetMs?: number): CountdownTime {
  const now = Date.now();
  const target = overrideTargetMs && overrideTargetMs > now
    ? overrideTargetMs
    : getNextMidnightTimestamp();

  const diffMs = Math.max(0, target - now);
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(hours).padStart(2, "0")} Jam ${String(minutes).padStart(2, "0")} Menit ${String(seconds).padStart(2, "0")} Detik`;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    formatted,
    resetTimeString: "Pukul 00:00 (Waktu Lokal)",
  };
}

function getStorageKey(userId?: string | null): string {
  const uid = userId ? userId.trim() : "guest";
  return `${STORAGE_PREFIX}${uid}`;
}

/**
 * Mengambil status kuota AI saat ini untuk pengguna
 */
export function getAiQuotaState(userId?: string | null): AiQuotaState {
  const key = getStorageKey(userId);
  const today = getLocalDateString();
  const defaultState: AiQuotaState = {
    date: today,
    count: 0,
    limit: DEFAULT_DAILY_LIMIT,
    isApiBlocked: false,
  };

  if (typeof window === "undefined" || !window.localStorage) {
    return defaultState;
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<AiQuotaState>;

    // Jika sudah berganti hari (tanggal berbeda), kuota otomatis di-reset ke 0!
    if (parsed.date !== today) {
      const resetState: AiQuotaState = {
        date: today,
        count: 0,
        limit: parsed.limit && parsed.limit > 0 ? parsed.limit : DEFAULT_DAILY_LIMIT,
        isApiBlocked: false,
      };
      saveAiQuotaState(resetState, userId);
      return resetState;
    }

    // Jika terblokir namun waktu blokir sudah lewat
    if (parsed.isApiBlocked && parsed.blockedUntil && parsed.blockedUntil <= Date.now()) {
      parsed.isApiBlocked = false;
      parsed.blockedUntil = undefined;
      parsed.lastErrorReason = undefined;
      saveAiQuotaState(parsed as AiQuotaState, userId);
    }

    return {
      date: parsed.date || today,
      count: Number(parsed.count) || 0,
      limit: Number(parsed.limit) || DEFAULT_DAILY_LIMIT,
      isApiBlocked: Boolean(parsed.isApiBlocked),
      blockedUntil: parsed.blockedUntil,
      lastErrorReason: parsed.lastErrorReason,
    };
  } catch (err) {
    console.warn("Gagal membaca kuota AI dari localStorage:", err);
    return defaultState;
  }
}

/**
 * Menyimpan status kuota ke localStorage dan menyiarkan event pembaruan
 */
export function saveAiQuotaState(state: AiQuotaState, userId?: string | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const key = getStorageKey(userId);
  try {
    localStorage.setItem(key, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(QUOTA_EVENT_NAME, { detail: state }));
  } catch (err) {
    console.warn("Gagal menyimpan kuota AI ke localStorage:", err);
  }
}

/**
 * Memeriksa apakah pengguna saat ini diperbolehkan membuat soal dengan AI
 */
export function checkCanGenerate(userId?: string | null): {
  allowed: boolean;
  reason?: "DAILY_LIMIT_REACHED" | "API_RATE_LIMITED";
  message?: string;
  countdown: CountdownTime;
  state: AiQuotaState;
} {
  const state = getAiQuotaState(userId);
  const countdown = calculateCountdownToMidnight(state.blockedUntil);

  if (state.isApiBlocked) {
    return {
      allowed: false,
      reason: "API_RATE_LIMITED",
      message: state.lastErrorReason || "Batas kuota Gemini API sedang mencapai limit.",
      countdown,
      state,
    };
  }

  if (state.count >= state.limit) {
    return {
      allowed: false,
      reason: "DAILY_LIMIT_REACHED",
      message: `Kuota pembuatan soal harian Anda (${state.limit} paket) telah habis hari ini.`,
      countdown,
      state,
    };
  }

  return {
    allowed: true,
    countdown,
    state,
  };
}

/**
 * Mencatat bahwa satu generasi soal AI berhasil dilakukan
 */
export function recordGenerationSuccess(userId?: string | null): AiQuotaState {
  const current = getAiQuotaState(userId);
  const updated: AiQuotaState = {
    ...current,
    count: current.count + 1,
  };
  saveAiQuotaState(updated, userId);
  return updated;
}

/**
 * Mencatat bahwa Gemini API mengembalikan error kuota (429 atau RESOURCE_EXHAUSTED)
 */
export function recordApiQuotaExceeded(
  userId?: string | null,
  reason?: string,
  blockedDurationSeconds?: number
): AiQuotaState {
  const current = getAiQuotaState(userId);
  const blockedUntil = blockedDurationSeconds && blockedDurationSeconds > 0
    ? Date.now() + blockedDurationSeconds * 1000
    : getNextMidnightTimestamp();

  const updated: AiQuotaState = {
    ...current,
    isApiBlocked: true,
    blockedUntil,
    lastErrorReason: reason || "Batas kuota atau kecepatan Gemini API tercapai.",
  };
  saveAiQuotaState(updated, userId);
  return updated;
}

/**
 * Reset kuota (misal untuk testing atau bantuan pengajar)
 */
export function resetDailyQuota(userId?: string | null): AiQuotaState {
  const today = getLocalDateString();
  const resetState: AiQuotaState = {
    date: today,
    count: 0,
    limit: DEFAULT_DAILY_LIMIT,
    isApiBlocked: false,
  };
  saveAiQuotaState(resetState, userId);
  return resetState;
}

/**
 * Berlangganan event perubahan kuota
 */
export function subscribeToQuotaChanges(callback: (state: AiQuotaState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const customEvt = event as CustomEvent<AiQuotaState>;
    if (customEvt.detail) {
      callback(customEvt.detail);
    }
  };
  window.addEventListener(QUOTA_EVENT_NAME, handler);
  return () => {
    window.removeEventListener(QUOTA_EVENT_NAME, handler);
  };
}
