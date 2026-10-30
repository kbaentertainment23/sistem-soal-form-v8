import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  FileText,
  UserCheck,
  ListPlus,
  Plus,
  Layers,
  Settings2,
  ChevronDown,
  RotateCcw,
  Save,
  Filter,
  CheckSquare,
  Square
} from "lucide-react";
import confetti from "canvas-confetti";
import type { Question, GoogleFormCreateResult } from "../types.js";
import { isGoogleConnected, getCachedToken, requestGoogleAccessToken, loginWithGooglePopup, type UserProfile } from "../lib/googleAuth.js";
import { saveFormHistoryItem, getAppSettings, saveAppSettings, DEFAULT_CLASSES } from "../lib/storage.js";
import { filterClassesByGrade, isClassMatchingGrade } from "../lib/classUtils.js";
import { stripQuestionNumber, stripOptionPrefix } from "../lib/gasFormGenerator.js";

interface GoogleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subject: string;
  grade: string;
  questions: Question[];
  userProfile?: UserProfile | null;
  userEmail?: string | null;
  onFormCreatedSuccess?: (result: GoogleFormCreateResult) => void;
}

export const GoogleFormModal: React.FC<GoogleFormModalProps> = ({
  isOpen,
  onClose,
  title,
  subject,
  grade,
  questions,
  userProfile,
  userEmail,
  onFormCreatedSuccess,
}) => {
  const [step, setStep] = useState<"auth_check" | "config" | "creating" | "success" | "error">("config");
  const [currentProgressText, setCurrentProgressText] = useState<string>("Menyiapkan Google Forms...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<GoogleFormCreateResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  // Identity Section & Class Selection configuration
  const [includeIdentity, setIncludeIdentity] = useState(true);
  const [allSavedClasses, setAllSavedClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [newClassText, setNewClassText] = useState("");
  const [savedToSettingsToast, setSavedToSettingsToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep("config");
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Freeze background layer: lock body and html scroll, prevent touch and wheel propagation
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalBodyPosition = document.body.style.position;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }

      // Prevent wheel or touch gestures from moving the background behind the modal
      const handleBackgroundTouchMove = (e: TouchEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest(".google-form-modal-dialog")) {
          e.preventDefault();
        }
      };

      const handleBackgroundWheel = (e: WheelEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest(".google-form-modal-dialog")) {
          e.preventDefault();
        }
      };

      document.addEventListener("touchmove", handleBackgroundTouchMove, { passive: false });
      document.addEventListener("wheel", handleBackgroundWheel, { passive: false });

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.position = originalBodyPosition;
        document.body.style.paddingRight = originalPaddingRight;
        document.removeEventListener("touchmove", handleBackgroundTouchMove);
        document.removeEventListener("wheel", handleBackgroundWheel);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setResult(null);
      setCopiedLink(false);
      setSavedToSettingsToast(false);

      const appSettings = getAppSettings();
      setShuffleOptions(appSettings.shuffleOptionsDefault || false);
      setIncludeIdentity(appSettings.includeIdentitySectionDefault ?? true);

      const systemClasses = Array.isArray(appSettings.classList) ? appSettings.classList : [];
      setAllSavedClasses(systemClasses);

      // Smart filter by grade if grade is available and matches any classes
      const matching = grade ? filterClassesByGrade(systemClasses, grade) : [];
      if (matching.length > 0) {
        setSelectedClasses(matching);
      } else {
        setSelectedClasses([...systemClasses]);
      }

      setStep("config");
    }
  }, [isOpen, grade]);

  const handleToggleClass = (className: string) => {
    if (selectedClasses.includes(className)) {
      setSelectedClasses(selectedClasses.filter(c => c !== className));
    } else {
      setSelectedClasses([...selectedClasses, className]);
    }
  };

  const handleSelectAll = () => {
    setSelectedClasses([...allSavedClasses]);
  };

  const handleDeselectAll = () => {
    setSelectedClasses([]);
  };

  const handleSelectMatchingGrade = () => {
    if (!grade) return;
    const matching = filterClassesByGrade(allSavedClasses, grade);
    if (matching.length > 0) {
      setSelectedClasses(matching);
    }
  };

  const handleReloadFromSettings = () => {
    const appSettings = getAppSettings();
    const systemClasses = Array.isArray(appSettings.classList) ? appSettings.classList : [];
    setAllSavedClasses(systemClasses);
    const matching = grade ? filterClassesByGrade(systemClasses, grade) : [];
    if (matching.length > 0) {
      setSelectedClasses(matching);
    } else {
      setSelectedClasses([...systemClasses]);
    }
  };

  const handleSaveCurrentListToSettings = () => {
    if (allSavedClasses.length === 0) return;
    const currentSettings = getAppSettings();
    const updatedSettings = {
      ...currentSettings,
      classList: allSavedClasses
    };
    saveAppSettings(updatedSettings);
    setSavedToSettingsToast(true);
    setTimeout(() => setSavedToSettingsToast(false), 2500);
  };

  const handleAddClass = () => {
    const trimmed = newClassText.trim();
    if (!trimmed) return;
    const splitted = trimmed.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const updatedAll = Array.from(new Set([...allSavedClasses, ...splitted]));
    setAllSavedClasses(updatedAll);
    // Also auto-select the newly added classes
    setSelectedClasses(Array.from(new Set([...selectedClasses, ...splitted])));
    setNewClassText("");
  };

  const handleRemoveClass = (classToRemove: string) => {
    setAllSavedClasses(allSavedClasses.filter(c => c !== classToRemove));
    setSelectedClasses(selectedClasses.filter(c => c !== classToRemove));
  };

  const handleStartCreation = async () => {
    if (includeIdentity && allSavedClasses.length > 0 && selectedClasses.length === 0) {
      setErrorMessage("Pilih minimal 1 kelas yang akan disertakan di Google Form, atau nonaktifkan Bagian Identitas jika tidak diperlukan.");
      return;
    }

    const token = getCachedToken();
    if (token) {
      await executeCreateForm(token);
    } else {
      await handleConnectAndCreate();
    }
  };

  const handleConnectAndCreate = async () => {
    try {
      setErrorMessage(null);
      setCurrentProgressText("Menghubungkan akun Google Anda...");
      setStep("creating");

      // Trigger GSI OAuth popup
      const token = await requestGoogleAccessToken(false);
      if (!token) {
        throw new Error("Gagal memperoleh izin akses dari Google.");
      }

      // Automatically proceed to form creation
      await executeCreateForm(token);
    } catch (err: any) {
      if (err?.message?.includes("dibatalkan") || err?.message?.includes("ditutup") || err?.message?.includes("closed")) {
        // User dismissed the popup window; return gracefully to form configuration
        setStep("config");
        return;
      }
      console.warn("Connect & create notice:", err?.message || err);
      setErrorMessage(err.message || "Gagal menghubungkan Google. Silakan coba kembali.");
      setStep("error");
    }
  };

  const executeCreateForm = async (token: string) => {
    try {
      setStep("creating");
      setCurrentProgressText("1. Membuat formulir Google Forms baru...");
      await new Promise((r) => setTimeout(r, 400));

      setCurrentProgressText(includeIdentity 
        ? "2. Menyiapkan Bagian Identitas Siswa & Dropdown Kelas..." 
        : "2. Mengaktifkan Mode Kuis..."
      );
      await new Promise((r) => setTimeout(r, 400));

      setCurrentProgressText(`3. Mengunggah ${questions.length} butir soal, pilihan, skor, dan pembahasan...`);

      const res = await fetch("/api/google/forms/create", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          subject,
          grade,
          questions: questions.map((q) => ({
            ...q,
            question: stripQuestionNumber(q.question),
            options: q.options.map((opt) => ({
              ...opt,
              text: stripOptionPrefix(opt.text),
            })),
          })),
          shuffleOptions,
          includeIdentitySection: includeIdentity,
          classList: selectedClasses.length > 0 ? selectedClasses : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat Google Form di akun Anda.");
      }

      const resData = data.data as GoogleFormCreateResult;
      setResult(resData);
      setStep("success");

      // Save to local form history and Firestore
      saveFormHistoryItem({
        id: `fh_${Date.now()}`,
        userId: userProfile?.uid || undefined,
        formId: resData.formId,
        title: resData.title,
        subject,
        grade,
        questionsCount: resData.questionsCount,
        totalPoints: resData.totalPoints,
        createdAt: new Date().toISOString(),
        editUrl: resData.editUrl,
        responderUrl: resData.responderUrl,
      }, userProfile?.uid);

      if (onFormCreatedSuccess) {
        onFormCreatedSuccess(resData);
      }

      // Celebrate with confetti 🎉
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Ignore if confetti not supported
      }
    } catch (err: any) {
      console.error("Execute create form error:", err);
      setErrorMessage(err.message || "Google Form gagal dibuat. Soal Anda tetap tersimpan.");
      setStep("error");
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== "creating") {
          onClose();
        }
      }}
    >
      <div 
        className="google-form-modal-dialog bg-white rounded-3xl max-w-xl lg:max-w-2xl w-full max-h-[92vh] flex flex-col card-shadow border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <span className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-widest">BUAT GOOGLE FORM KUIS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 min-h-0">
          {/* STEP: CONFIGURATION (Default) */}
          {step === "config" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 font-black text-xs uppercase tracking-wider rounded-full border border-blue-200">
                  {subject} • Kelas {grade}
                </div>
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 uppercase tracking-tight line-clamp-2">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {questions.length} Butir Soal Pilihan Ganda siap diunggah ke Google Forms.
                </p>
              </div>

              {/* Active Logged-in Google Account Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 border border-blue-200/90 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {userProfile?.photoURL ? (
                      <img
                        src={userProfile.photoURL}
                        alt={userProfile.displayName || "Google"}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border border-emerald-400 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center border border-blue-400 shrink-0 shadow-xs">
                        {(userProfile?.displayName || userEmail || "G").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-xs truncate">
                        {userProfile?.displayName || (userEmail ? userEmail.split("@")[0] : "Akun Google Guru")}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {userProfile?.email || userEmail || "Siap terhubung dengan Google Drive"}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Akun Aktif</span>
                  </span>
                </div>
                <p className="text-xs text-blue-950 font-medium leading-relaxed bg-white/90 p-2.5 rounded-xl border border-blue-100/90">
                  ⚡ Formulir kuis, kunci jawaban, dan skor nilai otomatis langsung dibuat di Google Drive akun ini tanpa perlu login ulang.
                </p>
              </div>

              {/* Identity Section Settings */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                        Bagian 1: Identitas Siswa (Halaman Terpisah)
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                        Siswa wajib mengisi <strong className="text-slate-700">Nama Lengkap</strong>, <strong className="text-slate-700">No. Absen</strong>, dan <strong className="text-slate-700">Dropdown Kelas</strong> sebelum klik "Berikutnya / Next" untuk mengerjakan soal.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="toggle-identity-section"
                    checked={includeIdentity}
                    onChange={(e) => setIncludeIdentity(e.target.checked)}
                    className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 border-slate-300 mt-1 cursor-pointer"
                  />
                </div>

                {/* Class Dropdown configuration */}
                {includeIdentity && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                            Pilihan Kelas Google Form:
                          </label>
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black ${
                            selectedClasses.length > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {selectedClasses.length} dari {allSavedClasses.length} Dipilih
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Klik nama kelas di bawah untuk memilih kelas mana saja yang disertakan di Google Form.
                        </p>
                      </div>

                      {/* Quick Select Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                          title="Pilih seluruh kelas yang tersimpan"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                          title="Batalkan semua pilihan"
                        >
                          Batal Pilih
                        </button>
                        {grade && allSavedClasses.some(c => isClassMatchingGrade(c, grade)) && (
                          <button
                            type="button"
                            onClick={handleSelectMatchingGrade}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                            title={`Pilih hanya kelas yang sesuai dengan tingkat ${grade}`}
                          >
                            Hanya Kelas {grade}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleReloadFromSettings}
                          className="p-1 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                          title="Muat ulang dari Pengaturan Sistem"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Selectable Chips */}
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                      {allSavedClasses.length === 0 ? (
                        <div className="w-full text-center py-3 text-xs text-slate-400 italic">
                          Belum ada daftar kelas. Ketik nama kelas di bawah lalu klik <strong>Tambah</strong>.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                          {allSavedClasses.map((cls) => {
                            const isSelected = selectedClasses.includes(cls);
                            return (
                              <div
                                key={cls}
                                onClick={() => handleToggleClass(cls)}
                                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl text-xs font-bold transition-all border select-none cursor-pointer ${
                                  isSelected
                                    ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-300"
                                }`}
                                title={isSelected ? `Klik untuk membatalkan pilihan ${cls}` : `Klik untuk memilih ${cls}`}
                              >
                                <span className="flex items-center gap-1">
                                  {isSelected ? (
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  ) : (
                                    <span className="w-3.5 h-3.5 rounded-md border border-slate-400 inline-block bg-white/80" />
                                  )}
                                  <span>{cls}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveClass(cls);
                                  }}
                                  className={`p-0.5 rounded-md transition-colors ${
                                    isSelected
                                      ? "text-blue-200 hover:text-white hover:bg-blue-700"
                                      : "text-slate-400 hover:text-rose-600 hover:bg-slate-200"
                                  }`}
                                  title={`Hapus kelas ${cls}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Selected Classes Preview */}
                      {selectedClasses.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                          <span className="text-slate-700 font-bold">Akan dimasukkan ke Form:</span>{" "}
                          <span>{selectedClasses.join(", ")}</span>
                        </div>
                      )}
                    </div>

                    {/* Add class input & Save to settings */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newClassText}
                          onChange={(e) => setNewClassText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddClass();
                            }
                          }}
                          placeholder="Tambah kelas manual (contoh: 8A, 8B atau pisahkan dengan koma)..."
                          className="flex-1 h-9 px-3 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={handleAddClass}
                          className="px-3 h-9 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      </div>

                      {/* Sync / Save to Settings button */}
                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        {savedToSettingsToast ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Daftar kelas berhasil disimpan ke Pengaturan Sistem!
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSaveCurrentListToSettings}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                            title="Simpan daftar kelas ini ke Pengaturan Sistem agar permanen"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Simpan daftar kelas ini ke Pengaturan Sistem</span>
                          </button>
                        )}
                        <span className="text-slate-400 font-medium hidden sm:inline">
                          * Format Dropdown di Form
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Format indicator note */}
              <div className="flex items-start gap-2.5 p-3 bg-blue-50/80 rounded-2xl border border-blue-200/90 text-xs text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-[11px] uppercase tracking-wide text-blue-950">
                    Format Bersih Standar Kuis Google Forms:
                  </p>
                  <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                    Pertanyaan dibuat murni tanpa nomor soal, dan pilihan jawaban murni tanpa huruf A, B, C, D sehingga rapi dan siap diacak.
                  </p>
                </div>
              </div>

              {/* Shuffle Options Checkbox */}
              <label className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-700">
                  Acak urutan pilihan jawaban di Google Form
                </span>
              </label>

              {/* Action Button */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  id="btn-confirm-create-form"
                  onClick={handleStartCreation}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-sm sm:text-base"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>🚀 BUAT GOOGLE FORM SEKARANG</span>
                </button>
                <p className="text-center text-[11px] text-slate-500 font-medium">
                  ⚡ Kuis dan kunci jawaban otomatis tersimpan ke Google Drive akun Anda.
                </p>
              </div>
            </div>
          )}

          {/* STEP: AUTH REQUIRED */}
          {step === "auth_check" && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  HUBUNGKAN AKUN GOOGLE
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  Untuk membuat Google Form Quiz langsung di Google Drive / Forms Anda secara otomatis, silakan hubungkan Google terlebih dahulu.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-2 font-black text-slate-900 uppercase tracking-wide">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Otorisasi Cukup Sekali Saja</span>
                </div>
                <p className="pl-6 text-slate-500 font-medium">
                  Setelah terhubung, Anda dapat membuat kuis berikutnya secara instan tanpa perlu login berulang kali.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  id="btn-modal-connect-google"
                  onClick={handleConnectAndCreate}
                  className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  HUBUNGKAN GOOGLE & BUAT FORM
                </button>
              </div>
            </div>
          )}

          {/* STEP: CREATING / LOADING */}
          {step === "creating" && (
            <div className="text-center space-y-6 py-6">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-pulse" />
                <div className="w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                <Sparkles className="w-6 h-6 text-blue-600 absolute" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                  🚀 SEDANG MEMBUAT GOOGLE FORM...
                </h3>
                <p className="text-sm font-bold text-blue-600 animate-pulse">
                  {currentProgressText}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  Mengonfigurasi kuis, memasukkan identitas siswa, opsi pilihan, kunci jawaban, dan skor otomatis...
                </p>
              </div>
            </div>
          )}

          {/* STEP: SUCCESS */}
          {step === "success" && result && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
                  SELESAI & SIAP DIGUNAKAN
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 pt-2 uppercase tracking-tight">
                  🎉 GOOGLE FORM SIAP!
                </h3>
                <p className="text-sm text-slate-600 line-clamp-1 font-bold">
                  {result.title}
                </p>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Jumlah Soal</span>
                  <span className="text-xl font-black text-slate-900">{result.questionsCount} Butir</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Total Skor Kuis</span>
                  <span className="text-xl font-black text-blue-600">{result.totalPoints} Poin</span>
                </div>
              </div>

              {/* Action Links */}
              <div className="space-y-3 pt-1">
                {/* Edit Link for Teacher */}
                <a
                  href={result.editUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="btn-open-google-form-edit"
                  className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide hover:scale-[1.01] active:scale-[0.99]"
                >
                  <ExternalLink className="w-4 h-4" />
                  🔗 BUKA GOOGLE FORM (EDIT & PENGATURAN)
                </a>

                {/* Student Responder Link */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-left">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide block">
                    🎓 Link Kuis untuk Siswa:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={result.responderUrl}
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-mono select-all focus:outline-hidden font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.responderUrl)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-colors ${
                        copiedLink
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Tersalin!" : "Salin"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 text-slate-500 hover:text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-colors"
                >
                  Tutup Jendela
                </button>
              </div>
            </div>
          )}

          {/* STEP: ERROR */}
          {step === "error" && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                  GOOGLE FORM GAGAL DIBUAT
                </h3>
                <p className="text-sm text-slate-600 font-medium">
                  {errorMessage || "Terjadi kendala saat menghubungi Google Forms API."}
                </p>
                <p className="text-xs text-emerald-700 font-bold bg-emerald-50 py-1.5 px-3 rounded-xl inline-block border border-emerald-200">
                  ✓ Jangan khawatir, paket soal Anda tetap tersimpan aman.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  id="btn-retry-create-form"
                  onClick={handleConnectAndCreate}
                  className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-colors shadow-md cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
