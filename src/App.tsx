import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "./components/Navbar.js";
import { Dashboard } from "./components/Dashboard.js";
import { CreateQuestionForm } from "./components/CreateQuestionForm.js";
import { QuestionPreview } from "./components/QuestionPreview.js";
import { QuestionBank } from "./components/QuestionBank.js";
import { FormHistory } from "./components/FormHistory.js";
import { Settings } from "./components/Settings.js";
import { AdminPanel } from "./components/AdminPanel.js";
import { GoogleFormModal } from "./components/GoogleFormModal.js";
import type { Question, QuestionSet, GoogleFormHistoryItem, GenerateRequest, GoogleFormCreateResult } from "./types.js";
import { 
  getBankSoal, 
  saveToBankSoal, 
  deleteFromBankSoal, 
  getFormHistory, 
  deleteFormHistoryItem,
  getAppSettings,
  saveAppSettings,
  fetchSystemSettingsFromDatabase,
  subscribeSystemSettings,
  syncUserDataFromCloud,
  subscribeUserBankSoal,
  subscribeUserFormHistory,
  setActiveUserId,
  getActiveUserId,
  getSavedSelectedQuestions,
  migrateGuestQuestionsToUser,
  AppSettings
} from "./lib/storage.js";
import { resetFirestoreAvailability } from "./lib/firebase.js";
import { 
  subscribeGoogleAuth, 
  requestGoogleAccessToken, 
  disconnectGoogle,
  loginWithGooglePopup,
  type UserProfile
} from "./lib/googleAuth.js";
import { AlertCircle, CheckCircle2, Info, X, ExternalLink, Copy, Check, Sparkles } from "lucide-react";
import { applyAutoPointsToQuestionSet } from "./lib/pointDistributor.js";
import { OfflineIndicator } from "./components/OfflineIndicator.js";
import { 
  checkCanGenerate, 
  recordGenerationSuccess, 
  recordApiQuotaExceeded 
} from "./lib/aiQuotaService.js";
import { QuotaExceededModal } from "./components/QuotaExceededModal.js";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "create" | "bank" | "history" | "settings" | "admin" | "preview">("dashboard");
  const [bankSoal, setBankSoal] = useState<QuestionSet[]>([]);
  const [formHistory, setFormHistory] = useState<GoogleFormHistoryItem[]>([]);
  const [appSettings, setSettings] = useState<AppSettings>(getAppSettings());
  
  // Active Question Set in Workspace
  const [currentQuestionSet, setCurrentQuestionSet] = useState<QuestionSet | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [lastFailedParams, setLastFailedParams] = useState<GenerateRequest | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // AI Quota Exceeded Modal State
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [quotaModalReason, setQuotaModalReason] = useState<string | undefined>(undefined);

  // Google OAuth State
  const [isGoogleConnectedState, setIsGoogleConnectedState] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Google Form Creation Modal
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [formModalTargetSet, setFormModalTargetSet] = useState<QuestionSet | null>(null);

  // Quick Start Form Pre-fill
  const [createFormInitialValues, setCreateFormInitialValues] = useState<Partial<GenerateRequest> | undefined>(undefined);

  // Active user real-time Firestore subscriptions
  const bankSubRef = useRef<(() => void) | null>(null);
  const historySubRef = useRef<(() => void) | null>(null);

  // Load initial local data & sync with Firebase auth + real-time listeners
  useEffect(() => {
    const initialUid = getActiveUserId();
    setBankSoal(getBankSoal(initialUid));
    setFormHistory(getFormHistory(initialUid));
    setSettings(getAppSettings());

    // Sync global system settings (school logo and branding) from database
    fetchSystemSettingsFromDatabase().then((dbSettings) => {
      if (dbSettings) {
        setSettings(dbSettings);
      }
    }).catch(() => {});

    // Attach real-time snapshot listener for global system settings (logo changes across devices)
    const unsubscribeSystemSettings = subscribeSystemSettings((liveSettings) => {
      setSettings(liveSettings);
    });

    // Subscribe to Google Auth changes
    const unsubscribeAuth = subscribeGoogleAuth(async (connected, email, profile) => {
      setIsGoogleConnectedState(connected);
      setGoogleUserEmail(profile?.email || email || null);
      setUserProfile(profile || null);

      // Clean up previous real-time listeners if any
      if (bankSubRef.current) {
        bankSubRef.current();
        bankSubRef.current = null;
      }
      if (historySubRef.current) {
        historySubRef.current();
        historySubRef.current = null;
      }

      if (connected && profile?.uid) {
        const uid = profile.uid;
        setActiveUserId(uid);

        // 1. Immediately load local cache for this specific account
        setBankSoal(getBankSoal(uid));
        setFormHistory(getFormHistory(uid));

        // 2. Automatically migrate any questions created in guest mode on this device to the user's account & Firestore
        migrateGuestQuestionsToUser(uid).catch(() => {});

        // 3. Perform cloud sync
        syncUserDataFromCloud(uid).then((synced) => {
          setBankSoal(synced.bankSoal);
          setFormHistory(synced.formHistory);
        }).catch(() => {});

        // 4. Attach real-time snapshot listeners for this user's isolated data
        bankSubRef.current = subscribeUserBankSoal(uid, (sets) => {
          setBankSoal(sets);
        });
        historySubRef.current = subscribeUserFormHistory(uid, (history) => {
          setFormHistory(history);
        });

        // If workspace set belonged to another account, reset it
        setCurrentQuestionSet((prev) => {
          if (prev && prev.userId && prev.userId !== uid) {
            return null;
          }
          return prev;
        });
      } else {
        // Disconnected / guest mode
        setActiveUserId(null);
        setBankSoal(getBankSoal(null));
        setFormHistory(getFormHistory(null));
        setCurrentQuestionSet((prev) => {
          if (prev && prev.userId) {
            return null;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSystemSettings) unsubscribeSystemSettings();
      if (bankSubRef.current) bankSubRef.current();
      if (historySubRef.current) historySubRef.current();
    };
  }, []);

  // Google Connect Handler (1-Click Popup Login for any Google account)
  const handleConnectGoogle = async (): Promise<UserProfile | null> => {
    try {
      const profile = await loginWithGooglePopup();
      if (!profile) {
        // User closed or dismissed the popup window gracefully
        return null;
      }
      setToast({
        type: "success",
        message: `Berhasil masuk dengan akun ${profile.displayName || profile.email}!`
      });
      setTimeout(() => setToast(null), 4000);
      return profile;
    } catch (err: any) {
      if (err?.message?.includes("dibatalkan") || err?.message?.includes("ditutup") || err?.message?.includes("closed")) {
        return null;
      }
      console.warn("Login notice:", err?.message || err);
      const isLongMsg = err.message && err.message.length > 80;
      setToast({
        type: "error",
        message: err.message || "Gagal masuk dengan Google. Pastikan izin popup diaktifkan di browser."
      });
      if (!isLongMsg) {
        setTimeout(() => setToast(null), 6000);
      }
      return null;
    }
  };

  const handleDisconnectGoogle = async () => {
    if (bankSubRef.current) {
      bankSubRef.current();
      bankSubRef.current = null;
    }
    if (historySubRef.current) {
      historySubRef.current();
      historySubRef.current = null;
    }
    await disconnectGoogle();
    setActiveUserId(null);
    setUserProfile(null);
    setIsGoogleConnectedState(false);
    setGoogleUserEmail(null);
    setCurrentQuestionSet((prev) => (prev?.userId ? null : prev));
    setBankSoal(getBankSoal(null));
    setFormHistory(getFormHistory(null));
    setToast({
      type: "info",
      message: "Anda telah keluar dari akun Google."
    });
    setTimeout(() => setToast(null), 3000);
  };

  // Google Account Switch Handler (seamlessly switches accounts and re-subscribes in real-time)
  const handleSwitchGoogleAccount = async () => {
    try {
      resetFirestoreAvailability();
      // Clean up previous listeners
      if (bankSubRef.current) {
        bankSubRef.current();
        bankSubRef.current = null;
      }
      if (historySubRef.current) {
        historySubRef.current();
        historySubRef.current = null;
      }
      // Disconnect current auth so Google popup displays account picker
      await disconnectGoogle();
      const profile = await loginWithGooglePopup();
      if (!profile) {
        return;
      }
      setToast({
        type: "success",
        message: `Beralih ke akun ${profile.displayName || profile.email}. Bank Soal & Google Form disinkronkan secara real-time!`
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      if (err?.message?.includes("dibatalkan") || err?.message?.includes("ditutup") || err?.message?.includes("closed")) {
        return;
      }
      console.warn("Switch account notice:", err);
      setToast({
        type: "error",
        message: err.message || "Gagal mengganti akun Google."
      });
      setTimeout(() => setToast(null), 6000);
    }
  };

  // Manual Cloud Sync Trigger (for teachers switching devices/browsers)
  const handleManualSync = async () => {
    if (!userProfile?.uid) {
      await handleConnectGoogle();
      return;
    }
    try {
      await migrateGuestQuestionsToUser(userProfile.uid);
      const synced = await syncUserDataFromCloud(userProfile.uid);
      setBankSoal(synced.bankSoal);
      setFormHistory(synced.formHistory);
      setToast({
        type: "success",
        message: `Sinkronisasi Cloud berhasil! ${synced.bankSoal.length} paket soal aktif tersimpan di Google Cloud.`,
      });
      setTimeout(() => setToast(null), 4000);
    } catch (e: any) {
      setToast({
        type: "error",
        message: `Gagal sinkronisasi: ${e?.message || "Terjadi kendala jaringan"}`,
      });
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Generate Questions via Gemini AI
  const handleGenerateQuestions = async (params: GenerateRequest) => {
    const activeUid = userProfile?.uid || null;

    // Pre-flight check client quota & API cooldown
    const quotaCheck = checkCanGenerate(activeUid);
    if (!quotaCheck.allowed) {
      setQuotaModalReason(quotaCheck.message);
      setIsQuotaModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setLastFailedParams(params);
    try {
      let res: Response | null = null;
      let lastNetworkErr: any = null;

      // Attempt fetch with automatic single retry for transient socket drops / Failed to fetch
      const requestedCount = Number(params.questionCount) || 10;
      const timeoutMs = Math.max(180000, requestedCount * 4000); // 180s - 240s for large question sets

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          res = await fetch("/api/generate-questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          break; // Success, break loop
        } catch (fetchErr: any) {
          lastNetworkErr = fetchErr;
          if (fetchErr?.name === "AbortError") {
            break; // Stop immediately if client aborted from timeout
          }
          if (attempt === 1) {
            console.info("[Auto-Retry] Koneksi awal sempat tertunda (" + (fetchErr?.message || "reconnecting") + "), sistem otomatis mencoba ulang...");
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      if (!res) {
        if (lastNetworkErr?.name === "AbortError") {
          throw new Error("Waktu tunggu pemrosesan AI melebihi batas waktu (3-4 menit). Silakan klik 'Coba Lagi' atau kurangi sedikit butir soal jika materi sangat panjang.");
        }
        throw new Error(
          "Koneksi ke server AI terputus atau batas waktu tercapai (Failed to fetch). Silakan periksa koneksi internet Anda dan klik 'Coba Lagi'."
        );
      }

      let data: any;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        if (res.status === 504 || res.status === 408) {
          throw new Error("Waktu pemrosesan melebihi batas waktu (Timeout). Coba kurangi jumlah butir soal atau perpendek materi acuan.");
        } else if (res.status === 503) {
          throw new Error("Layanan AI Gemini sedang mengalami beban tinggi (503). Sistem telah beralih ke model cadangan, silakan klik 'Coba Lagi'.");
        } else if (res.status === 500) {
          throw new Error(`Server mengalami kendala (${responseText.slice(0, 100) || "Error 500"}). Silakan coba sesaat lagi.`);
        }
        throw new Error(
          `Server API tidak mengembalikan respon JSON valid (Status: ${res.status}). Silakan coba sesaat lagi.`
        );
      }

      // Check if 429 or quota limit hit
      if (res.status === 429 || data?.isQuotaExceeded || data?.code === "QUOTA_EXHAUSTED") {
        recordApiQuotaExceeded(activeUid, data?.error);
        setQuotaModalReason(data?.error || "Batas kuota Gemini API harian telah tercapai. Kuota Anda akan diperbarui pada pukul 00:00 (Waktu Lokal).");
        setIsQuotaModalOpen(true);
        throw new Error(data?.error || "Batas kuota AI harian tercapai.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "AI gagal membuat soal. Silakan coba lagi.");
      }

      // Record successful generation usage
      recordGenerationSuccess(activeUid);

      const generated = data.data;
      if (!generated?.questions || !Array.isArray(generated.questions) || generated.questions.length === 0) {
        throw new Error("AI tidak menghasilkan butir soal. Silakan coba kembali atau sesuaikan materi acuan.");
      }
      const newSet: QuestionSet = {
        id: `set_${Date.now()}`,
        userId: activeUid || undefined,
        title: generated.title || `Soal ${params.subject} Kelas ${params.grade}`,
        subject: generated.subject || params.subject,
        grade: generated.grade || params.grade,
        semester: generated.semester || params.semester,
        material: generated.material || params.material,
        learningObjective: params.learningObjective || "",
        difficultyType: params.difficultyType,
        difficultyRatio: params.difficultyRatio,
        questionType: "Pilihan Ganda",
        onlyFromMaterial: params.onlyFromMaterial,
        questions: applyAutoPointsToQuestionSet(generated.questions || [], undefined, 100),
        createdAt: new Date().toISOString(),
        totalPoints: 100,
      };

      setCurrentQuestionSet(newSet);
      // Auto-save to Bank Soal as fresh work for current user
      saveToBankSoal(newSet, activeUid);
      setBankSoal(getBankSoal(activeUid));

      // Open Preview Screen
      setActiveTab("preview");
      setLastFailedParams(null);
    } catch (err: any) {
      console.error("Generate error:", err);
      let message = err?.message || "AI gagal membuat soal. Silakan coba lagi.";
      if (message.includes("Failed to fetch") || message.includes("Load failed") || message.includes("NetworkError")) {
        message = "Koneksi ke server AI terputus atau batas waktu tercapai (Failed to fetch). Silakan periksa koneksi internet Anda atau coba kembali.";
      }
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save to Bank Soal
  const handleSaveToBank = (set: QuestionSet) => {
    const activeUid = userProfile?.uid || null;
    const setWithUser: QuestionSet = {
      ...set,
      userId: activeUid || set.userId || undefined,
    };
    saveToBankSoal(setWithUser, activeUid);
    setBankSoal(getBankSoal(activeUid));
  };

  // Delete from Bank Soal
  const handleDeleteFromBank = (id: string) => {
    const activeUid = userProfile?.uid || null;
    deleteFromBankSoal(id, activeUid);
    setBankSoal(getBankSoal(activeUid));
    if (currentQuestionSet?.id === id) {
      setCurrentQuestionSet(null);
      setActiveTab("bank");
    }
  };

  // Duplicate Question Set
  const handleDuplicateSet = (set: QuestionSet) => {
    const activeUid = userProfile?.uid || null;
    const duplicated: QuestionSet = {
      ...JSON.parse(JSON.stringify(set)),
      id: `set_${Date.now()}`,
      userId: activeUid || undefined,
      title: `${set.title} (Salinan)`,
      createdAt: new Date().toISOString(),
    };
    saveToBankSoal(duplicated, activeUid);
    setBankSoal(getBankSoal(activeUid));
  };

  // Select Set for preview / curation
  const handleSelectSet = (set: QuestionSet) => {
    setCurrentQuestionSet(set);
    setActiveTab("preview");
  };

  // Quick Start from Dashboard cards
  const handleQuickStart = (subject: string, grade: string, material: string) => {
    setCreateFormInitialValues({
      subject,
      grade,
      material,
      questionCount: 10,
      optionsCount: appSettings.defaultOptionsCount,
      difficultyType: "Campuran",
    });
    setActiveTab("create");
  };

  // 1-Click Create Google Form from Bank Soal
  const handleCreateGoogleFormDirect = (set: QuestionSet) => {
    const savedSelected = getSavedSelectedQuestions(set.id);
    const selectedNums = (Array.isArray(set.selectedQuestionNumbers) && set.selectedQuestionNumbers.length > 0)
      ? set.selectedQuestionNumbers
      : (savedSelected && savedSelected.length > 0 ? savedSelected : null);

    // If user previously selected a subset of questions (e.g. 30 out of 50)
    if (selectedNums && selectedNums.length > 0 && selectedNums.length < set.questions.length) {
      const selSet = new Set(selectedNums);
      const balanced = applyAutoPointsToQuestionSet(set.questions, selSet, 100);
      const filtered = balanced
        .filter((q) => selSet.has(q.number))
        .map((q, idx) => ({ ...q, number: idx + 1, isSelected: true }));

      const filteredSet: QuestionSet = {
        ...set,
        questions: filtered,
        selectedQuestionNumbers: filtered.map((q) => q.number),
        totalPoints: filtered.reduce((sum, q) => sum + (q.points || 1), 0),
      };
      setFormModalTargetSet(filteredSet);
    } else {
      setFormModalTargetSet(set);
    }
    setIsGoogleModalOpen(true);
  };

  // Open Google Form Modal for current workspace question set (or selective subset)
  const handleOpenGoogleModalFromPreview = (customFilteredSet?: QuestionSet) => {
    if (customFilteredSet) {
      setFormModalTargetSet(customFilteredSet);
      setIsGoogleModalOpen(true);
    } else if (currentQuestionSet) {
      setFormModalTargetSet(currentQuestionSet);
      setIsGoogleModalOpen(true);
    }
  };

  const handleFormCreatedSuccess = (result: GoogleFormCreateResult) => {
    const activeUid = userProfile?.uid || null;
    setFormHistory(getFormHistory(activeUid));
  };

  const handleDeleteHistoryItem = (id: string) => {
    const activeUid = userProfile?.uid || null;
    deleteFormHistoryItem(id, activeUid);
    setFormHistory(getFormHistory(activeUid));
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    saveAppSettings(newSettings);
    setSettings(newSettings);
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white w-full max-w-full overflow-x-clip ${isGoogleModalOpen ? "overflow-hidden" : ""}`}>
      {/* Background Content Layer - fully frozen and non-interactive when modal is active */}
      <div
        id="app-background-layer"
        className={`flex-1 flex flex-col w-full transition-all duration-200 ${
          isGoogleModalOpen
            ? "pointer-events-none select-none filter blur-[0.6px] opacity-75 touch-none"
            : ""
        }`}
        aria-hidden={isGoogleModalOpen}
      >
        {/* Top Navbar */}
        <Navbar
          activeTab={activeTab === "preview" ? "create" : activeTab}
          setActiveTab={(tab) => {
            setGenerateError(null);
            setActiveTab(tab);
          }}
          isGoogleConnected={isGoogleConnectedState}
          userEmail={googleUserEmail}
          userProfile={userProfile}
          onConnectGoogle={handleConnectGoogle}
          onLogoutGoogle={handleDisconnectGoogle}
          onSwitchGoogleAccount={handleSwitchGoogleAccount}
          logoUrl={appSettings.appLogoUrl}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 pt-3 sm:pt-6 pb-24 md:pb-12 min-w-0">
        {/* App Notification Toast */}
        {toast && (
          <div
            className={`mb-5 p-4 sm:p-5 rounded-2xl border flex items-start justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : toast.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-blue-50 border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
              {toast.type === "error" && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
              {toast.type === "info" && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-semibold whitespace-pre-line leading-relaxed break-words">
                  {toast.message}
                </div>
                {toast.message.includes("Firebase Console") && (
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <a
                      href="https://console.firebase.google.com/project/sistem-soal/authentication/providers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <span>Buka Firebase Console (sistem-soal)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const host = typeof window !== "undefined" ? window.location.hostname : "";
                        if (host) {
                          navigator.clipboard.writeText(host);
                          setToast({
                            type: "info",
                            message: `Domain "${host}" berhasil disalin ke clipboard! Tempelkan di Authorized domains Firebase Console.`
                          });
                          setTimeout(() => setToast(null), 5000);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Salin Domain Web Ini</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1.5 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
              title="Tutup Notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Error Banner if any */}
        {generateError && (
          <div className="mb-6 p-4 sm:p-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="text-sm font-bold block">{generateError}</span>
                <span className="text-xs text-rose-600 font-medium">Tip: Kurangi jumlah butir soal (misal 5-10 butir soal) atau perpendek materi acuan untuk pembuatan yang lebih cepat dan lancar.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {lastFailedParams && (
                <button
                  onClick={() => handleGenerateQuestions(lastFailedParams)}
                  disabled={isGenerating}
                  className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Coba Lagi
                </button>
              )}
              <button
                onClick={() => setGenerateError(null)}
                className="text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <Dashboard
            onNavigate={(tab) => {
              if (tab === "create") {
                setCreateFormInitialValues(undefined);
              }
              setActiveTab(tab);
            }}
            bankCount={bankSoal.length}
            formCount={formHistory.length}
            isGoogleConnected={isGoogleConnectedState}
            userEmail={googleUserEmail}
            onConnectGoogle={handleConnectGoogle}
            recentSets={bankSoal}
            recentForms={formHistory}
            onSelectSet={handleSelectSet}
            onQuickStart={handleQuickStart}
            userId={userProfile?.uid}
            onOpenQuotaModal={() => setIsQuotaModalOpen(true)}
          />
        )}

        {/* TAB 2: BUAT SOAL */}
        {activeTab === "create" && (
          <CreateQuestionForm
            onGenerate={handleGenerateQuestions}
            onImportQuestionSet={(importedSet) => {
              const activeUid = userProfile?.uid || null;
              const stamped: QuestionSet = {
                ...importedSet,
                id: importedSet.id || `set_${Date.now()}`,
                userId: activeUid || undefined,
              };
              saveToBankSoal(stamped, activeUid);
              setBankSoal(getBankSoal(activeUid));
              setCurrentQuestionSet(stamped);
              setActiveTab("preview");
            }}
            isLoading={isGenerating}
            initialValues={createFormInitialValues}
            isLoggedIn={isGoogleConnectedState}
            userProfile={userProfile}
            onRequestLogin={handleConnectGoogle}
            onOpenQuotaModal={() => setIsQuotaModalOpen(true)}
          />
        )}

        {/* TAB 3: PREVIEW & EDIT SOAL */}
        {activeTab === "preview" && currentQuestionSet && (
          <QuestionPreview
            questionSet={currentQuestionSet}
            onUpdateQuestionSet={(updated) => {
              const activeUid = userProfile?.uid || null;
              const stamped: QuestionSet = {
                ...updated,
                userId: activeUid || updated.userId || undefined,
              };
              setCurrentQuestionSet(stamped);
              saveToBankSoal(stamped, activeUid);
              setBankSoal(getBankSoal(activeUid));
            }}
            onSaveToBank={handleSaveToBank}
            onOpenGoogleFormModal={handleOpenGoogleModalFromPreview}
            onBackToEditForm={() => setActiveTab("create")}
            onBackToBank={() => setActiveTab("bank")}
            userId={userProfile?.uid}
          />
        )}

        {/* TAB 4: BANK SOAL */}
        {activeTab === "bank" && (
          <QuestionBank
            questionSets={bankSoal}
            onSelectSet={handleSelectSet}
            onDeleteSet={handleDeleteFromBank}
            onDuplicateSet={handleDuplicateSet}
            onCreateGoogleFormDirect={handleCreateGoogleFormDirect}
            onSaveSet={handleSaveToBank}
            userId={userProfile?.uid}
            userEmail={googleUserEmail}
            onSwitchAccount={handleSwitchGoogleAccount}
            onConnectGoogle={handleConnectGoogle}
            onManualSync={handleManualSync}
            onRefreshBank={(sets) => setBankSoal(sets)}
            onNavigateToCreate={() => {
              setCreateFormInitialValues(undefined);
              setActiveTab("create");
            }}
          />
        )}

        {/* TAB 5: RIWAYAT GOOGLE FORM */}
        {activeTab === "history" && (
          <FormHistory
            history={formHistory}
            onDeleteHistoryItem={handleDeleteHistoryItem}
            userEmail={googleUserEmail}
            onSwitchAccount={handleSwitchGoogleAccount}
            onNavigateToCreate={() => {
              setCreateFormInitialValues(undefined);
              setActiveTab("create");
            }}
          />
        )}

        {/* TAB 6: PENGATURAN */}
        {activeTab === "settings" && (
          <Settings
            isGoogleConnected={isGoogleConnectedState}
            userEmail={googleUserEmail}
            userId={userProfile?.uid}
            onConnectGoogle={handleConnectGoogle}
            onDisconnectGoogle={handleDisconnectGoogle}
            onSwitchGoogleAccount={handleSwitchGoogleAccount}
            settings={appSettings}
            onSaveSettings={handleSaveSettings}
            onReloadBank={() => {
              const activeUid = userProfile?.uid || null;
              setBankSoal(getBankSoal(activeUid));
            }}
            onNavigateToAdmin={() => setActiveTab("admin")}
          />
        )}

        {/* TAB 7: MENU ADMIN */}
        {activeTab === "admin" && (
          <AdminPanel
            settings={appSettings}
            onSaveSettings={handleSaveSettings}
            userId={userProfile?.uid}
            onReloadBank={() => {
              const activeUid = userProfile?.uid || null;
              setBankSoal(getBankSoal(activeUid));
            }}
            onReloadHistory={() => {
              const activeUid = userProfile?.uid || null;
              setFormHistory(getFormHistory(activeUid));
            }}
          />
        )}
      </main>
      </div>

      {/* Google Form Creation Modal */}
      {formModalTargetSet && (() => {
        // Determine questions for Google Forms
        let activeQuestions: Question[] = [];

        // Check if selectedQuestionNumbers is a strict subset of questions
        // (meaning formModalTargetSet has NOT yet been filtered down to the subset)
        if (
          Array.isArray(formModalTargetSet.selectedQuestionNumbers) &&
          formModalTargetSet.selectedQuestionNumbers.length > 0 &&
          formModalTargetSet.selectedQuestionNumbers.length < formModalTargetSet.questions.length
        ) {
          const selSet = new Set(formModalTargetSet.selectedQuestionNumbers);
          activeQuestions = formModalTargetSet.questions
            .filter((q) => selSet.has(q.number))
            .map((q, idx) => ({ ...q, number: idx + 1, isSelected: true }));
        } else if (
          formModalTargetSet.questions.some((q) => q.isSelected === false) &&
          formModalTargetSet.questions.some((q) => q.isSelected === true)
        ) {
          activeQuestions = formModalTargetSet.questions
            .filter((q) => q.isSelected !== false)
            .map((q, idx) => ({ ...q, number: idx + 1, isSelected: true }));
        } else {
          // Questions are already the exact chosen subset (or full set)
          activeQuestions = formModalTargetSet.questions.map((q, idx) => ({
            ...q,
            number: idx + 1,
            isSelected: true,
          }));
        }

        return (
          <GoogleFormModal
            isOpen={isGoogleModalOpen}
            onClose={() => {
              setIsGoogleModalOpen(false);
              setFormModalTargetSet(null);
            }}
            title={formModalTargetSet.title}
            subject={formModalTargetSet.subject}
            grade={formModalTargetSet.grade}
            questions={activeQuestions}
            userProfile={userProfile}
            userEmail={googleUserEmail}
            onFormCreatedSuccess={handleFormCreatedSuccess}
          />
        );
      })()}

      {/* AI Daily Quota Exceeded Modal with Live Countdown Timer */}
      <QuotaExceededModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
        userId={userProfile?.uid}
        reason={quotaModalReason}
        onOpenBankSoal={() => {
          setActiveTab("bank");
        }}
        onOpenImportSoal={() => {
          setActiveTab("create");
        }}
      />

      {/* PWA Offline Indicator Badge */}
      <OfflineIndicator />
    </div>
  );
}
