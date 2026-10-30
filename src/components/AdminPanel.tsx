import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Image as ImageIcon,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Database,
  Check,
  HardDrive,
  FileJson,
  RotateCcw,
  Info,
  GraduationCap,
  Sparkles,
  Layers,
  AlertTriangle,
  Zap,
  Clock,
  Hourglass
} from "lucide-react";
import type { AppSettings, StorageStats } from "../lib/storage.js";
import {
  getStorageStats,
  clearTemporaryCaches,
  clearAllFormHistory,
  removeSampleQuestionSets,
  optimizeStorage,
  clearAllBankSoalData,
  getBankSoal,
  saveToBankSoal,
  saveAppLogo
} from "../lib/storage.js";
import { downloadFile } from "../lib/exportUtils.js";
import { AdminBankSoalManager } from "./AdminBankSoalManager.js";
import {
  getAiQuotaState,
  saveAiQuotaState,
  resetDailyQuota,
  calculateCountdownToMidnight,
  subscribeToQuotaChanges,
  type AiQuotaState,
  type CountdownTime
} from "../lib/aiQuotaService.js";
import { QuotaExceededModal } from "./QuotaExceededModal.js";

interface AdminPanelProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  userId?: string | null;
  onReloadBank: () => void;
  onReloadHistory: () => void;
}

const ADMIN_SESSION_KEY = "ai_soal_admin_session_auth_v1";

export const AdminPanel: React.FC<AdminPanelProps> = ({
  settings,
  onSaveSettings,
  userId,
  onReloadBank,
  onReloadHistory,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
    }
    return false;
  });

  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Admin Sub-tab
  const [adminTab, setAdminTab] = useState<"all_banks" | "quota" | "logo" | "cache" | "backup" | "security">("all_banks");

  // AI Daily Quota Monitoring & Control State
  const [quotaState, setQuotaState] = useState<AiQuotaState>(() => getAiQuotaState(userId));
  const [countdown, setCountdown] = useState<CountdownTime>(() => 
    calculateCountdownToMidnight(quotaState.blockedUntil)
  );
  const [customQuotaLimitInput, setCustomQuotaLimitInput] = useState<number>(quotaState.limit || 20);
  const [quotaActionMessage, setQuotaActionMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isQuotaPreviewModalOpen, setIsQuotaPreviewModalOpen] = useState(false);

  useEffect(() => {
    setQuotaState(getAiQuotaState(userId));
    setCustomQuotaLimitInput(getAiQuotaState(userId).limit || 20);
    const unsubscribe = subscribeToQuotaChanges((updated) => {
      setQuotaState(updated);
      setCustomQuotaLimitInput(updated.limit || 20);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(calculateCountdownToMidnight(quotaState.blockedUntil));
    }, 1000);
    return () => clearInterval(timer);
  }, [quotaState.blockedUntil]);

  // Reset Quota Action (Admin Only)
  const handleResetQuota = () => {
    if (confirm("Reset kuota pembuatan soal AI hari ini? Penggunaan kuota akan kembali ke 0.")) {
      const reset = resetDailyQuota(userId);
      setQuotaState(reset);
      setQuotaActionMessage({
        type: "success",
        text: `Kuota AI berhasil di-reset! Sisa kuota kini: ${reset.limit} paket soal.`,
      });
      setTimeout(() => setQuotaActionMessage(null), 4000);
    }
  };

  // Save Custom Quota Limit (Admin Only)
  const handleSaveCustomLimit = (e: React.FormEvent) => {
    e.preventDefault();
    const newLimit = Math.max(1, Math.min(500, Number(customQuotaLimitInput) || 20));
    const current = getAiQuotaState(userId);
    const updated: AiQuotaState = {
      ...current,
      limit: newLimit,
    };
    saveAiQuotaState(updated, userId);
    setQuotaState(updated);
    setQuotaActionMessage({
      type: "success",
      text: `Batas kuota harian berhasil diubah menjadi ${newLimit} paket per hari.`,
    });
    setTimeout(() => setQuotaActionMessage(null), 4000);
  };

  // Logo State
  const [logoPreview, setLogoPreview] = useState<string>(settings.appLogoUrl || "");
  const [logoUrlInput, setLogoUrlInput] = useState<string>("");
  const [logoMessage, setLogoMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize logo preview whenever global settings change (e.g. from real-time sync across devices)
  useEffect(() => {
    if (settings.appLogoUrl !== undefined) {
      setLogoPreview(settings.appLogoUrl || "");
    }
  }, [settings.appLogoUrl]);

  // Storage Stats State
  const [storageStats, setStorageStats] = useState<StorageStats>(() => getStorageStats(userId));
  const [cacheActionMessage, setCacheActionMessage] = useState<{ type: "success" | "info" | "error"; text: string } | null>(null);

  // Backup & Restore State
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Security (Change Password) State
  const [currentPassInput, setCurrentPassInput] = useState("");
  const [newPassInput, setNewPassInput] = useState("");
  const [confirmPassInput, setConfirmPassInput] = useState("");
  const [passMessage, setPassMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dangerous Wipe Confirmation Modal
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");

  const adminPassword = settings.adminPassword || "admin123";

  // Refresh stats when component mounts or tab changes
  useEffect(() => {
    if (isAuthenticated) {
      setStorageStats(getStorageStats(userId));
    }
  }, [isAuthenticated, adminTab, userId]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === adminPassword) {
      setIsAuthenticated(true);
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      }
      setAuthError(null);
      setPasswordInput("");
    } else {
      setAuthError("Kata sandi salah. Silakan masukkan kata sandi yang benar.");
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
    setPasswordInput("");
    setAuthError(null);
  };

  // Handle Image File Upload for Logo
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLogoMessage({ type: "error", text: "Berkas harus berupa gambar (.png, .jpg, .svg, atau .webp)." });
      return;
    }

    // Limit to 4MB input
    if (file.size > 4 * 1024 * 1024) {
      setLogoMessage({ type: "error", text: "Ukuran gambar terlalu besar. Maksimal 4 MB." });
      return;
    }

    setIsProcessingLogo(true);
    setLogoMessage(null);

    // If SVG, handle as raw vector DataURL to preserve infinite crispness
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const svgDataUrl = ev.target?.result as string;
        setLogoPreview(svgDataUrl);
        setIsProcessingLogo(false);
        setLogoMessage({
          type: "info",
          text: "Berkas SVG siap. Klik 'Terapkan Logo Sekarang' untuk menyimpan ke database sistem."
        });
      };
      reader.onerror = () => {
        setIsProcessingLogo(false);
        setLogoMessage({ type: "error", text: "Gagal membaca berkas SVG." });
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      // Optimize image by resizing onto a max 384x384 canvas
      const img = new Image();
      img.onload = () => {
        const maxDim = 384;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          let optimizedDataUrl = "";
          try {
            optimizedDataUrl = canvas.toDataURL("image/webp", 0.92);
            if (!optimizedDataUrl.startsWith("data:image/webp")) {
              optimizedDataUrl = canvas.toDataURL("image/png");
            }
          } catch {
            optimizedDataUrl = canvas.toDataURL("image/png");
          }
          setLogoPreview(optimizedDataUrl);
          setIsProcessingLogo(false);
          setLogoMessage({
            type: "info",
            text: "Gambar berhasil dioptimalkan. Klik 'Terapkan Logo Sekarang' untuk menyimpan ke database sistem."
          });
        } else {
          setLogoPreview(dataUrl);
          setIsProcessingLogo(false);
        }
      };
      img.onerror = () => {
        setLogoPreview(dataUrl);
        setIsProcessingLogo(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setIsProcessingLogo(false);
      setLogoMessage({ type: "error", text: "Gagal membaca berkas gambar." });
    };
    reader.readAsDataURL(file);
  };

  // Save Logo to Database and AppSettings
  const handleSaveLogo = async (logoToSave?: string) => {
    const targetLogo = logoToSave !== undefined ? logoToSave : (logoUrlInput.trim() || logoPreview);
    setIsSavingLogo(true);
    setLogoMessage(null);

    try {
      // 1. Direct authoritative API and storage persist
      await saveAppLogo(targetLogo);

      const updated = {
        ...settings,
        appLogoUrl: targetLogo,
      };
      onSaveSettings(updated);
      setLogoPreview(targetLogo);
      setLogoUrlInput("");
      setLogoMessage({
        type: "success",
        text: targetLogo
          ? "Logo berhasil disimpan di database sistem dan langsung disinkronkan ke seluruh perangkat!"
          : "Logo dikembalikan ke lambang default dan diperbarui di database sistem.",
      });
      setStorageStats(getStorageStats(userId));
    } catch (err: any) {
      console.error("Error in handleSaveLogo:", err);
      setLogoMessage({
        type: "error",
        text: `Gagal menyimpan logo ke database: ${err?.message || "Kesalahan koneksi"}`,
      });
    } finally {
      setIsSavingLogo(false);
      setTimeout(() => setLogoMessage(null), 5000);
    }
  };

  // Reset to Default Logo
  const handleResetLogo = async () => {
    setLogoPreview("");
    setLogoUrlInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    await handleSaveLogo("");
  };

  // Cache & Database Actions
  const handleClearTempCache = () => {
    const result = clearTemporaryCaches();
    setStorageStats(getStorageStats(userId));
    setCacheActionMessage({
      type: "success",
      text: `Cache sementara berhasil dibersihkan. Membebaskan ${result.freedKeys} kunci cache/draf.`,
    });
    setTimeout(() => setCacheActionMessage(null), 4000);
  };

  const handleClearFormHistory = () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh log riwayat Google Form? Soal di Bank Soal tidak akan terhapus.")) {
      clearAllFormHistory(userId);
      onReloadHistory();
      setStorageStats(getStorageStats(userId));
      setCacheActionMessage({
        type: "success",
        text: "Seluruh riwayat pembuatan Google Form berhasil dibersihkan dari basis data.",
      });
      setTimeout(() => setCacheActionMessage(null), 4000);
    }
  };

  const handleRemoveSampleSets = () => {
    const count = removeSampleQuestionSets(userId);
    onReloadBank();
    setStorageStats(getStorageStats(userId));
    if (count > 0) {
      setCacheActionMessage({
        type: "success",
        text: `Berhasil menghapus ${count} paket soal sampel bawaan sistem.`,
      });
    } else {
      setCacheActionMessage({
        type: "info",
        text: "Tidak ditemukan paket soal sampel bawaan di Bank Soal.",
      });
    }
    setTimeout(() => setCacheActionMessage(null), 4000);
  };

  const handleOptimizeStorage = () => {
    const result = optimizeStorage(userId);
    setStorageStats(getStorageStats(userId));
    setCacheActionMessage({
      type: "success",
      text: `Optimasi database selesai. Membebaskan ruang sekitar ${Math.round(result.freedBytes / 1024)} KB.`,
    });
    setTimeout(() => setCacheActionMessage(null), 4000);
  };

  const handleExecuteWipe = () => {
    if (wipeConfirmText.trim().toUpperCase() !== "HAPUS") {
      alert("Ketik kata 'HAPUS' dengan benar untuk konfirmasi.");
      return;
    }
    clearAllBankSoalData(userId);
    clearAllFormHistory(userId);
    clearTemporaryCaches();
    onReloadBank();
    onReloadHistory();
    setStorageStats(getStorageStats(userId));
    setShowWipeModal(false);
    setWipeConfirmText("");
    setCacheActionMessage({
      type: "success",
      text: "Seluruh data Bank Soal dan riwayat form berhasil dikosongkan.",
    });
    setTimeout(() => setCacheActionMessage(null), 4000);
  };

  // Backup & Export Handlers
  const handleExportBankSoal = () => {
    const data = getBankSoal(userId);
    const jsonStr = JSON.stringify(data, null, 2);
    downloadFile(`Backup_Bank_Soal_${new Date().toISOString().slice(0, 10)}.json`, jsonStr, "application/json");
  };

  const handleExportFullSystem = () => {
    const data = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      bankSoal: getBankSoal(userId),
      settings: settings,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    downloadFile(`Backup_Lengkap_Sistem_${new Date().toISOString().slice(0, 10)}.json`, jsonStr, "application/json");
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const parsed = JSON.parse(raw);

        let itemsToImport: any[] = [];
        if (Array.isArray(parsed)) {
          itemsToImport = parsed;
        } else if (parsed && Array.isArray(parsed.bankSoal)) {
          itemsToImport = parsed.bankSoal;
          if (parsed.settings) {
            onSaveSettings({ ...settings, ...parsed.settings });
          }
        }

        if (itemsToImport.length > 0) {
          itemsToImport.forEach((item) => {
            saveToBankSoal(
              {
                ...item,
                userId: userId || undefined,
              },
              userId
            );
          });
          setImportStatus({
            type: "success",
            text: `Berhasil memulihkan ${itemsToImport.length} paket soal ke dalam Bank Soal.`,
          });
          onReloadBank();
          setStorageStats(getStorageStats(userId));
        } else {
          setImportStatus({
            type: "error",
            text: "Format berkas cadangan JSON tidak valid atau tidak berisi data paket soal.",
          });
        }
      } catch (err) {
        setImportStatus({
          type: "error",
          text: "Gagal membaca berkas JSON cadangan. Pastikan berkas tidak rusak.",
        });
      }
    };
    reader.readAsText(file);
  };

  // Change Admin Password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPassInput !== adminPassword) {
      setPassMessage({ type: "error", text: "Kata sandi lama yang Anda masukkan tidak sesuai." });
      return;
    }
    if (newPassInput.length < 5) {
      setPassMessage({ type: "error", text: "Kata sandi baru minimal 5 karakter." });
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setPassMessage({ type: "error", text: "Konfirmasi kata sandi baru tidak cocok." });
      return;
    }

    const updated = {
      ...settings,
      adminPassword: newPassInput,
    };
    onSaveSettings(updated);
    setCurrentPassInput("");
    setNewPassInput("");
    setConfirmPassInput("");
    setPassMessage({ type: "success", text: "Kata sandi administrator berhasil diperbarui!" });
    setTimeout(() => setPassMessage(null), 4000);
  };

  // If not authenticated, render Login Screen
  if (!isAuthenticated) {
    return (
      <div className="max-w-md w-full mx-auto my-8 sm:my-16 px-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 card-shadow border border-slate-200 shadow-xl space-y-6 text-center relative overflow-hidden">
          {/* Decorative background glow */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-100 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-indigo-100 rounded-full blur-2xl pointer-events-none" />

          <div className="relative">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30 border border-blue-400/30 mb-4">
              <Shield className="w-8 h-8 text-amber-300" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
              Menu Administrator
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Akses kontrol sistem, penggantian logo, pembersihan cache, dan pengelolaan data.
            </p>
          </div>

          {/* Password Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-left relative">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Kata Sandi Admin
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  placeholder="Masukkan password admin..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title={showPassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl text-sm uppercase tracking-wider transition-all shadow-md shadow-blue-600/30 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-amber-300" />
              <span>Masuk ke Menu Admin</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-6 sm:space-y-8 pb-20 min-w-0">
      {/* Admin Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-6 sm:p-8 card-shadow border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-600/40 border border-blue-400/40 shrink-0">
            <ShieldCheck className="w-6 h-6 text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase font-outfit">
                Panel Administrator Sistem
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Sesi Aktif
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 truncate">
              Pengaturan logo instansi, pembersihan cache & database, serta cadangan bank soal.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-rose-900/40 text-slate-200 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          <span>Kunci / Keluar Admin</span>
        </button>
      </div>

      {/* Admin Navigation Pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setAdminTab("all_banks")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            adminTab === "all_banks"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Kelola Bank Soal Database</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab("quota")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            adminTab === "quota"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>Monitoring Kuota AI</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab("logo")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            adminTab === "logo"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Ganti Logo Pojok Kiri</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab("cache")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            adminTab === "cache"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Hapus Cache & Database</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab("backup")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            adminTab === "backup"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Cadangkan & Ekspor Data</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            adminTab === "security"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Keamanan & Sandi</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 0: KELOLA BANK SOAL SEMUA PENGGUNA (DATABASE FIRESTORE)    */}
      {/* ============================================================== */}
      {adminTab === "all_banks" && (
        <section className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
          <AdminBankSoalManager
            onBankChanged={() => {
              onReloadBank();
              setStorageStats(getStorageStats(userId));
            }}
          />
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB: MONITORING & PENGATURAN KUOTA AI HARIAN (ADMIN ONLY)       */}
      {/* ============================================================== */}
      {adminTab === "quota" && (() => {
        const quotaLimit = quotaState.limit || 20;
        const quotaUsed = quotaState.count || 0;
        const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
        const percentRemaining = Math.max(0, Math.min(100, Math.round((quotaRemaining / quotaLimit) * 100)));
        const percentUsed = Math.max(0, Math.min(100, Math.round((quotaUsed / quotaLimit) * 100)));
        const isQuotaExhausted = quotaRemaining === 0 || quotaState.isApiBlocked;
        const isQuotaLow = !isQuotaExhausted && quotaRemaining <= 3;

        return (
          <section className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 min-w-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 shadow-xs border border-amber-200">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight">
                      Monitoring & Pengaturan Kuota AI Harian
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
                      Khusus Administrator
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Halaman rahasia administrator untuk memantau sisa kuota AI, hitung mundur reset tengah malam, dan mengatur batas kuota harian.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsQuotaPreviewModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Pratinjau Modal Kuota</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetQuota}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Kuota Hari Ini</span>
                </button>
              </div>
            </div>

            {quotaActionMessage && (
              <div className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 border animate-in fade-in duration-150 ${
                quotaActionMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{quotaActionMessage.text}</span>
              </div>
            )}

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Sisa Kuota Hari Ini
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-3xl font-black font-outfit ${
                    isQuotaExhausted ? "text-rose-600" : isQuotaLow ? "text-amber-600" : "text-blue-600"
                  }`}>
                    {quotaRemaining}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    / {quotaLimit} Paket
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    ({percentRemaining}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isQuotaExhausted ? "Habis (Akan reset 00:00)" : `${quotaRemaining} paket siap dibuat`}
                </p>
              </div>

              {/* Card 2 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Sudah Terpakai Hari Ini
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black font-outfit text-slate-900">
                    {quotaUsed}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Paket Soal ({percentUsed}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Generasi berhasil hari ini ({quotaState.date})
                </p>
              </div>

              {/* Card 3 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Waktu Reset Otomatis
                </span>
                <div className="mt-1">
                  <span className="font-mono text-xl font-black text-slate-900">
                    {String(countdown.hours).padStart(2, "0")}j {String(countdown.minutes).padStart(2, "0")}m {String(countdown.seconds).padStart(2, "0")}d
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Reset otomatis pukul 00:00 (Waktu Lokal)
                </p>
              </div>

              {/* Card 4 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Status Gemini API
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    quotaState.isApiBlocked ? "bg-rose-500 animate-ping" : "bg-emerald-500"
                  }`} />
                  <span className={`text-sm font-black ${
                    quotaState.isApiBlocked ? "text-rose-700" : "text-emerald-700"
                  }`}>
                    {quotaState.isApiBlocked ? "Rate Limit / 429 Aktif" : "Normal & Siap"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 truncate">
                  {quotaState.lastErrorReason || "Model Gemini responsif"}
                </p>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">Persentase Sisa Kuota Hari Ini:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isQuotaExhausted ? "bg-rose-500/30 text-rose-300" : "bg-emerald-500/30 text-emerald-300"
                  }`}>
                    {percentRemaining}% Tersedia
                  </span>
                </div>
                <span className="text-slate-400 font-mono">
                  {quotaRemaining} / {quotaLimit} Paket
                </span>
              </div>

              {/* Progress Bar Track */}
              <div 
                className="w-full h-4 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 relative"
                role="progressbar"
                aria-valuenow={percentRemaining}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div 
                  style={{ width: `${percentRemaining}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    isQuotaExhausted
                      ? "bg-rose-500"
                      : isQuotaLow
                      ? "bg-gradient-to-r from-amber-500 to-amber-600"
                      : "bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"
                  }`}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                <span>0 (Habis)</span>
                <span>Reset Pukul 00:00</span>
                <span>{quotaLimit} Paket Maksimal</span>
              </div>
            </div>

            {/* Admin Setting: Change Daily Limit */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Ubah Batas Kuota Harian Sistem (Maksimal Paket / Hari)
              </h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Tentukan jumlah maksimal paket pembuatan soal AI yang diperbolehkan per hari sebelum notifikasi jeda/hitung mundur muncul ke pengguna.
              </p>

              <form onSubmit={handleSaveCustomLimit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={customQuotaLimitInput}
                    onChange={(e) => setCustomQuotaLimitInput(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    Paket / Hari
                  </span>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Simpan Batas Kuota
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[10, 20, 30, 50, 100].map((quickVal) => (
                    <button
                      key={quickVal}
                      type="button"
                      onClick={() => setCustomQuotaLimitInput(quickVal)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                        customQuotaLimitInput === quickVal
                          ? "bg-blue-50 text-blue-700 border-blue-300"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {quickVal}
                    </button>
                  ))}
                </div>
              </form>
            </div>

            {/* Educational Info for Admin */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-2.5 leading-relaxed">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Catatan Administrator:</strong> Indikator kuota ini sengaja disembunyikan dari halaman publik guru agar tampilan penyusunan soal tetap bersih. Jika kuota habis, pengguna tetap akan menerima dialog notifikasi ramah beserta saran alternatif (Bank Soal, Impor File, dan Susun Manual).
              </div>
            </div>
          </section>
        );
      })()}

      {/* ============================================================== */}
      {/* TAB 1: GANTI LOGO POJOK KIRI ATAS                              */}
      {/* ============================================================== */}
      {adminTab === "logo" && (
        <section className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight truncate">
                Kustomisasi Logo Pojok Kiri Atas
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate">
                Ganti ikon default dengan logo resmi sekolah, madrasah, dinas, atau instansi Anda.
              </p>
            </div>
          </div>

          {/* Database Persistence Banner */}
          <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/80 flex items-start sm:items-center gap-3 text-xs text-blue-950 font-medium">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold shadow-2xs shadow-blue-600/30">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0 leading-relaxed">
              <span className="font-bold text-blue-700">Tersimpan di Database:</span> Logo yang Anda unggah/terapkan otomatis disimpan ke database sistem. Saat aplikasi dibuka di laptop, ponsel, atau perangkat guru lainnya, logo tetap tersimpan dan langsung tampil.
            </div>
          </div>

          {logoMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                logoMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : logoMessage.type === "info"
                  ? "bg-blue-50 border border-blue-200 text-blue-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {logoMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : logoMessage.type === "info" ? (
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{logoMessage.text}</span>
            </div>
          )}

          {/* Logo Preview Comparison Box */}
          <div className="p-5 sm:p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Pratinjau Tampilan Header Navbar
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Live Preview
              </span>
            </div>

            {/* Simulated Navbar Brand */}
            <div className="flex items-center gap-3.5 p-3 bg-slate-950/80 rounded-2xl border border-slate-800 max-w-sm">
              <div className="w-11 h-11 bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center font-black text-white shadow-md shadow-blue-600/30 border border-blue-400/30 shrink-0 overflow-hidden">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Pratinjau Logo"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <GraduationCap className="w-6 h-6 text-amber-300" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg text-white tracking-tight uppercase font-outfit">
                    SOAL GURU
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                    AI EDUTECH
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-semibold truncate">
                  Platform Asesmen Kurikulum Merdeka & K13
                </p>
              </div>
            </div>
          </div>

          {/* Upload and URL input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* File Upload Option */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>Unggah Berkas Gambar</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Format yang didukung: PNG (transparan disarankan), JPG, SVG, WebP. Maksimal 4 MB.
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                  id="admin-logo-upload-input"
                />
                <label
                  htmlFor="admin-logo-upload-input"
                  className="w-full py-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>{isProcessingLogo ? "Memproses Gambar..." : "Pilih File Gambar"}</span>
                </label>
              </div>
            </div>

            {/* URL Input Option */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>Tautan URL Gambar Langsung</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Masukkan tautan URL gambar logo yang sudah diunggah di website sekolah.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={logoUrlInput}
                  onChange={(e) => setLogoUrlInput(e.target.value)}
                  placeholder="https://sekolah.sch.id/logo.png"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (logoUrlInput.trim()) {
                      setLogoPreview(logoUrlInput.trim());
                    }
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shrink-0 cursor-pointer"
                >
                  Pratinjau
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isSavingLogo}
              onClick={handleResetLogo}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Kembalikan Logo Default</span>
            </button>

            <button
              type="button"
              disabled={isSavingLogo}
              onClick={() => handleSaveLogo()}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-md shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSavingLogo ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isSavingLogo ? "Menyimpan ke Database..." : "Terapkan Logo Sekarang"}</span>
            </button>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 2: HAPUS CACHE & DATA TIDAK PENTING (DATABASE MAINTENANCE)  */}
      {/* ============================================================== */}
      {adminTab === "cache" && (
        <section className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight truncate">
                Pembersihan Cache & Pemeliharaan Database
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate">
                Hapus cache dan data usang agar kapasitas database tidak cepat penuh dan performa tetap responsif.
              </p>
            </div>
          </div>

          {cacheActionMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                cacheActionMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : cacheActionMessage.type === "info"
                  ? "bg-blue-50 border border-blue-200 text-blue-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{cacheActionMessage.text}</span>
            </div>
          )}

          {/* Database Usage Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase">Ruang LocalStorage</span>
                <HardDrive className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {storageStats.approxStorageKB} <span className="text-xs font-bold text-slate-500">KB</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {storageStats.localStorageKeysCount} kunci data tersimpan
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase">Paket Bank Soal</span>
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {storageStats.bankSoalCount} <span className="text-xs font-bold text-slate-500">Paket</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                {storageStats.totalQuestionsCount} butir total soal
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase">Riwayat Form</span>
                <FileJson className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {storageStats.formHistoryCount} <span className="text-xs font-bold text-slate-500">Form</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Tautan kuis Google Form
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-black uppercase">Paket Sampel</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {storageStats.sampleSetsCount} <span className="text-xs font-bold text-slate-500">Uji Coba</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Dapat dihapus untuk hemat ruang
              </p>
            </div>
          </div>

          {/* Maintenance Action Buttons */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Pilihan Pembersihan & Optimasi
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Action 1: Clear Cache & Temp */}
              <div className="p-4 sm:p-5 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-2.5 flex flex-col justify-between">
                <div>
                  <h5 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>🧹 Bersihkan Cache Sementara & Draf</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                      Aman
                    </span>
                  </h5>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    Menghapus berkas cache ekstraksi materi, data draf sementara, dan residu parsing tanpa menghapus soal ujian Anda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearTempCache}
                  className="w-full py-2.5 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                >
                  Bersihkan Cache Sekarang
                </button>
              </div>

              {/* Action 2: Optimize & Defrag */}
              <div className="p-4 sm:p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2.5 flex flex-col justify-between">
                <div>
                  <h5 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>⚡ Optimasi Ruang Database</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                      Aman
                    </span>
                  </h5>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    Memangkas struktur data kosong, merekatkan indeks penyimpanan, dan membuang kunci sampah tak terpakai.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOptimizeStorage}
                  className="w-full py-2.5 bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                >
                  Jalankan Optimasi Database
                </button>
              </div>

              {/* Action 3: Clear Form History */}
              <div className="p-4 sm:p-5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2.5 flex flex-col justify-between">
                <div>
                  <h5 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>🗑️ Hapus Riwayat Google Form</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800">
                      Riwayat
                    </span>
                  </h5>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    Menghapus daftar tautan riwayat pembuatan Google Form yang sudah lama atau tidak diperlukan lagi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearFormHistory}
                  className="w-full py-2.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-800 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                >
                  Kosongkan Riwayat Form
                </button>
              </div>

              {/* Action 4: Remove Sample Dummy Sets */}
              <div className="p-4 sm:p-5 bg-slate-100 border border-slate-200 rounded-2xl space-y-2.5 flex flex-col justify-between">
                <div>
                  <h5 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>📦 Hapus Paket Soal Sampel Bawaan</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-800">
                      Sampel
                    </span>
                  </h5>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    Menghapus paket soal uji coba bawaan sistem (seperti sample Informatika) agar Bank Soal hanya berisi soal asli sekolah.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveSampleSets}
                  className="w-full py-2.5 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                >
                  Hapus Paket Sampel
                </button>
              </div>
            </div>

            {/* Danger Zone: Full Wipe */}
            <div className="mt-6 p-5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-black text-rose-900 text-sm uppercase tracking-tight">
                    Zona Berbahaya: Kosongkan Seluruh Bank Soal
                  </h5>
                  <p className="text-xs text-rose-700 font-medium">
                    Tindakan ini akan menghapus permanen semua naskah soal di Bank Soal. Pastikan Anda telah mengunduh cadangan JSON terlebih dahulu.
                  </p>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowWipeModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan Seluruh Data</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 3: CADANGKAN & EKSPOR DATA (PINDAHAN DARI PENGATURAN)       */}
      {/* ============================================================== */}
      {adminTab === "backup" && (
        <section className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight truncate">
                Cadangan & Ekspor Data Sistem
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate">
                Ekspor seluruh paket Bank Soal ke berkas JSON atau pulihkan data dari cadangan sebelumnya.
              </p>
            </div>
          </div>

          {importStatus && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                importStatus.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {importStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{importStatus.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full min-w-0">
            {/* Option 1: Export Bank Soal */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between min-w-0">
              <div>
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>Ekspor Cadangan Bank Soal</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">
                  Unduh seluruh paket soal yang tersimpan ke dalam format berkas JSON di komputer Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBankSoal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Unduh Bank Soal (.json)</span>
              </button>
            </div>

            {/* Option 2: Export Full System Backup */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between min-w-0">
              <div>
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-indigo-600" />
                  <span>Cadangan Lengkap Sistem</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">
                  Unduh paket soal beserta seluruh pengaturan sekolah, identitas guru, dan logo kustom.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportFullSystem}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Unduh Cadangan Lengkap (.json)</span>
              </button>
            </div>

            {/* Option 3: Import Backup */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between min-w-0">
              <div>
                <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>Pulihkan / Impor Cadangan</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 font-medium leading-relaxed">
                  Pilih berkas JSON cadangan untuk memuat kembali seluruh paket soal ke dalam sistem.
                </p>
              </div>
              <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-2xs cursor-pointer">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Pilih Berkas JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 4: KEAMANAN & GANTI SANDI ADMIN                            */}
      {/* ============================================================== */}
      {adminTab === "security" && (
        <section className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight truncate">
                Keamanan & Ubah Sandi Administrator
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate">
                Ganti kata sandi bawaan admin123 dengan kata sandi baru yang lebih aman.
              </p>
            </div>
          </div>

          {passMessage && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                passMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {passMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{passMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Kata Sandi Lama / Bawaan
              </label>
              <input
                type="password"
                value={currentPassInput}
                onChange={(e) => setCurrentPassInput(e.target.value)}
                placeholder="Masukkan kata sandi saat ini..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all shadow-2xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Kata Sandi Baru (Minimal 5 Karakter)
              </label>
              <input
                type="password"
                value={newPassInput}
                onChange={(e) => setNewPassInput(e.target.value)}
                placeholder="Masukkan kata sandi baru..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all shadow-2xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Konfirmasi Kata Sandi Baru
              </label>
              <input
                type="password"
                value={confirmPassInput}
                onChange={(e) => setConfirmPassInput(e.target.value)}
                placeholder="Ulangi kata sandi baru..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all shadow-2xs"
                required
              />
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 cursor-pointer flex items-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-amber-300" />
              <span>Perbarui Kata Sandi</span>
            </button>
          </form>
        </section>
      )}

      {/* Confirmation Modal for Full Wipe */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full card-shadow border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                Konfirmasi Kosongkan Bank Soal
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Tindakan ini akan <strong>menghapus seluruh naskah soal</strong> dari Bank Soal dan mengosongkan database.
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
              <p className="text-[11px] text-rose-800 font-bold">
                Ketik kata <span className="font-mono underline">HAPUS</span> di bawah ini untuk melanjutkan:
              </p>
              <input
                type="text"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder="Ketik HAPUS"
                className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-black text-rose-900 text-center tracking-widest uppercase focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWipeModal(false);
                  setWipeConfirmText("");
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteWipe}
                disabled={wipeConfirmText.trim().toUpperCase() !== "HAPUS"}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs uppercase cursor-pointer transition-all shadow-xs"
              >
                Kosongkan Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quota Modal Preview for Admin */}
      <QuotaExceededModal
        isOpen={isQuotaPreviewModalOpen}
        onClose={() => setIsQuotaPreviewModalOpen(false)}
        userId={userId}
        reason="Ini adalah simulasi pratinjau modal kuota yang akan dilihat oleh guru saat kuota AI hariannya habis."
      />
    </div>
  );
};
