import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  BookOpen, 
  Layers, 
  Upload, 
  FileText, 
  Settings2, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Clock,
  Zap,
  Check,
  FileCheck,
  Percent,
  Cpu,
  ChevronRight,
  Info,
  Image as ImageIcon,
  Download,
  FileDown,
  Eye,
  Save,
  CheckCheck,
  Copy,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldCheck,
  Lock,
  Hourglass
} from "lucide-react";
import type { GenerateRequest, EducationLevel, DifficultyDistribution, QuestionSet } from "../types.js";
import { SUBJECT_PRESETS, GRADE_OPTIONS } from "../types.js";
import { parseDocumentFile, isRawPdfBinary } from "../lib/fileParser.js";
import { generateQuestionTemplateDocx } from "../lib/docxTemplate.js";
import { parseTeacherExamFile, ParsedExamResult } from "../lib/examDocxParser.js";
import { 
  getAppSettings,
  saveQuestionFormDraft,
  getQuestionFormDraft,
  clearQuestionFormDraft
} from "../lib/storage.js";
import { 
  getAiQuotaState,
  subscribeToQuotaChanges,
  type AiQuotaState
} from "../lib/aiQuotaService.js";
import { 
  isGoogleConnected,
  getUserProfile,
  loginWithGooglePopup,
  subscribeGoogleAuth,
  type UserProfile
} from "../lib/googleAuth.js";
import { applyAutoPointsToQuestionSet } from "../lib/pointDistributor.js";
import { 
  MATERIAL_INPUT_TEMPLATE, 
  MATERIAL_INPUT_EXAMPLE, 
  MATERIAL_GUIDE_SECTIONS, 
  copyTextToClipboard 
} from "../lib/materialTemplate.js";

interface CreateQuestionFormProps {
  onGenerate: (req: GenerateRequest) => Promise<void>;
  onImportQuestionSet?: (set: QuestionSet) => void;
  isLoading: boolean;
  initialValues?: Partial<GenerateRequest>;
  isLoggedIn?: boolean;
  userProfile?: UserProfile | null;
  onRequestLogin?: () => Promise<UserProfile | null>;
  onOpenQuotaModal?: () => void;
}

export const CreateQuestionForm: React.FC<CreateQuestionFormProps> = ({
  onGenerate,
  onImportQuestionSet,
  isLoading,
  initialValues,
  isLoggedIn,
  userProfile,
  onRequestLogin,
  onOpenQuotaModal,
}) => {
  // Read persisted draft to ensure teacher's settings and material are never lost
  const initialDraft = getQuestionFormDraft();

  // AI Daily Quota tracking
  const [quotaState, setQuotaState] = useState<AiQuotaState>(() => getAiQuotaState(userProfile?.uid));

  useEffect(() => {
    setQuotaState(getAiQuotaState(userProfile?.uid));
    const unsubscribe = subscribeToQuotaChanges((updated) => {
      setQuotaState(updated);
    });
    return () => unsubscribe();
  }, [userProfile?.uid]);

  // Form State
  const [level, setLevel] = useState<EducationLevel>(
    initialValues?.level || (initialDraft?.level as EducationLevel) || "SMP"
  );
  const [subject, setSubject] = useState<string>(
    initialValues?.subject || initialDraft?.subject || "Informatika"
  );
  const [customSubject, setCustomSubject] = useState<string>(
    initialDraft?.customSubject || ""
  );
  const [isCustomSubject, setIsCustomSubject] = useState(
    Boolean(initialDraft?.isCustomSubject)
  );
  const [grade, setGrade] = useState<string>(
    initialValues?.grade || initialDraft?.grade || "VIII"
  );
  const [semester, setSemester] = useState<"1" | "2">(
    ((initialValues?.semester || initialDraft?.semester || "1") as "1" | "2")
  );
  const [examType, setExamType] = useState<string>(
    initialValues?.examType || initialDraft?.examType || "Penilaian Harian (PH)"
  );

  const [questionCount, setQuestionCount] = useState<number>(() => {
    const raw = initialValues?.questionCount || initialDraft?.questionCount || 10;
    return Math.min(60, Math.max(1, raw));
  });
  const [optionsCount, setOptionsCount] = useState<4 | 5>(
    ((initialValues?.optionsCount || initialDraft?.optionsCount || 4) as 4 | 5)
  );
  const [cognitiveFocus, setCognitiveFocus] = useState<"HOTS" | "LOTS" | "BALANCED">(
    initialDraft?.cognitiveFocus || "BALANCED"
  );
  const [includeImages, setIncludeImages] = useState<boolean>(
    initialValues?.includeImages ?? initialDraft?.includeImages ?? false
  );
  const [imageFrequency, setImageFrequency] = useState<"none" | "some" | "all">(
    initialValues?.imageFrequency || initialDraft?.imageFrequency || "none"
  );
  
  // Difficulty ratios
  const [diffEasy, setDiffEasy] = useState<number>(
    initialValues?.difficultyRatio?.easy ?? initialDraft?.diffEasy ?? 30
  );
  const [diffMedium, setDiffMedium] = useState<number>(
    initialValues?.difficultyRatio?.medium ?? initialDraft?.diffMedium ?? 50
  );
  const [diffHard, setDiffHard] = useState<number>(
    initialValues?.difficultyRatio?.hard ?? initialDraft?.diffHard ?? 20
  );

  // Input source mode: "manual" | "upload" | "docx-format"
  const [sourceMode, setSourceMode] = useState<"manual" | "upload" | "docx-format">(
    initialDraft?.sourceMode || "manual"
  );
  const [materialText, setMaterialText] = useState<string>(
    initialValues?.material || initialDraft?.materialText || ""
  );
  const [onlyFromMaterial, setOnlyFromMaterial] = useState<boolean>(
    initialValues?.onlyFromMaterial ?? initialDraft?.onlyFromMaterial ?? true
  );
  const [customPrompt, setCustomPrompt] = useState<string>(
    initialValues?.customPrompt || initialDraft?.customPrompt || ""
  );
  const [moduleFocusTopic, setModuleFocusTopic] = useState<string>(
    initialValues?.moduleFocusTopic || initialDraft?.moduleFocusTopic || ""
  );

  // Active Auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => 
    userProfile || (isGoogleConnected() ? getUserProfile() : null)
  );
  const [isAuthConnected, setIsAuthConnected] = useState<boolean>(() => 
    isLoggedIn ?? isGoogleConnected()
  );

  // Login Gate Modal state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginModalError, setLoginModalError] = useState<string | null>(null);
  const [pendingGeneratePayload, setPendingGeneratePayload] = useState<GenerateRequest | null>(null);
  const [pendingDocxAction, setPendingDocxAction] = useState(false);

  // Sync auth state from props and real-time subscription
  useEffect(() => {
    if (userProfile !== undefined) setCurrentUser(userProfile);
    if (isLoggedIn !== undefined) setIsAuthConnected(isLoggedIn);
  }, [userProfile, isLoggedIn]);

  useEffect(() => {
    const unsub = subscribeGoogleAuth((connected, _email, profile) => {
      setIsAuthConnected(connected);
      setCurrentUser(profile || null);
    });
    return unsub;
  }, []);

  // Continuous auto-save draft to protect teacher's inputs from refresh / account login
  useEffect(() => {
    saveQuestionFormDraft({
      level,
      subject,
      customSubject,
      isCustomSubject,
      grade,
      semester,
      examType,
      questionCount,
      optionsCount,
      cognitiveFocus,
      includeImages,
      imageFrequency: includeImages ? imageFrequency : "none",
      diffEasy,
      diffMedium,
      diffHard,
      sourceMode,
      materialText,
      onlyFromMaterial,
      customPrompt,
      moduleFocusTopic,
      uploadedFileName,
    });
  }, [
    level,
    subject,
    customSubject,
    isCustomSubject,
    grade,
    semester,
    examType,
    questionCount,
    optionsCount,
    cognitiveFocus,
    includeImages,
    imageFrequency,
    diffEasy,
    diffMedium,
    diffHard,
    sourceMode,
    materialText,
    onlyFromMaterial,
    customPrompt,
    moduleFocusTopic,
  ]);

  // Module file upload state (Tab 2)
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [detectedExamFormatFile, setDetectedExamFormatFile] = useState<File | null>(null);

  // DOCX Format Exam upload & parsed state (Tab 3)
  const [isParsingDocxExam, setIsParsingDocxExam] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [docxExamFileName, setDocxExamFileName] = useState<string | null>(null);
  const [docxExamError, setDocxExamError] = useState<string | null>(null);
  const [parsedExamSet, setParsedExamSet] = useState<ParsedExamResult | null>(null);
  const [showParsedPreviewList, setShowParsedPreviewList] = useState(false);

  // Validation
  const [validationError, setValidationError] = useState<string | null>(null);

  // Material Format Helpers state ("Ketik Materi")
  const [copiedFormat, setCopiedFormat] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  const handleCopyFormatTemplate = async () => {
    const ok = await copyTextToClipboard(MATERIAL_INPUT_TEMPLATE);
    if (ok) {
      setCopiedFormat(true);
      setTimeout(() => setCopiedFormat(false), 2500);
    }
  };

  const handleApplyFormatTemplate = () => {
    if (materialText.trim() && !materialText.includes("[JUDUL MATERI") && materialText.length > 20) {
      if (!window.confirm("Ganti isi kolom materi dengan format template standar?")) {
        return;
      }
    }
    setMaterialText(MATERIAL_INPUT_TEMPLATE);
  };

  const handleCopyExample = async () => {
    const ok = await copyTextToClipboard(MATERIAL_INPUT_EXAMPLE);
    if (ok) {
      setCopiedExample(true);
      setTimeout(() => setCopiedExample(false), 2500);
    }
  };

  const handleApplyExample = () => {
    if (materialText.trim() && !materialText.includes("[JUDUL MATERI") && materialText.length > 20) {
      if (!window.confirm("Ganti isi kolom materi dengan contoh materi terisi?")) {
        return;
      }
    }
    setMaterialText(MATERIAL_INPUT_EXAMPLE);
  };

  // Handle download template DOCX
  const handleDownloadDocxTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const appSettings = getAppSettings();
      const actualSubject = isCustomSubject ? customSubject.trim() : subject;
      const blob = await generateQuestionTemplateDocx({
        schoolName: appSettings.schoolName || "SMP / SMA NEGERI NUSANTARA",
        teacherName: appSettings.teacherName || "Guru Pengampu, S.Pd.",
        subject: actualSubject || "Informatika",
        grade: grade || "VIII",
        semester: semester === "1" ? "1 (Ganjil)" : "2 (Genap)",
        examType: examType || "Penilaian Harian",
        optionsCount: optionsCount || 4,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Format_Soal_${(actualSubject || "Ujian").replace(/\s+/g, "_")}_Kelas_${grade}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.warn("Error generating docx template:", err);
      setDocxExamError("Gagal mengunduh template format soal: " + (err.message || "Terjadi kesalahan"));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // Handle upload of filled teacher DOCX format
  const handleDocxExamUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocxExamError(null);
    setIsParsingDocxExam(true);
    setDocxExamFileName(file.name);
    setParsedExamSet(null);

    const actualSubject = isCustomSubject ? customSubject.trim() : subject;

    try {
      const parsed = await parseTeacherExamFile(file, {
        subject: actualSubject,
        grade,
        semester,
        examType,
      });

      if (!parsed || !parsed.questions || parsed.questions.length === 0) {
        throw new Error("Tidak ada butir soal yang dapat dibaca dari berkas ini. Pastikan berkas mengikuti format naskah soal.");
      }

      setParsedExamSet(parsed);
      setValidationError(null);
    } catch (err: any) {
      console.error("Error parsing docx exam file:", err);
      setDocxExamError(err.message || "Gagal memproses berkas format soal.");
      setDocxExamFileName(null);
      setParsedExamSet(null);
    } finally {
      setIsParsingDocxExam(false);
    }
  };

  // Direct save of parsed exam set to Bank Soal
  const handleSaveParsedExamToBank = () => {
    if (!parsedExamSet || parsedExamSet.questions.length === 0) {
      setValidationError("Belum ada soal yang diunggah dan dibaca.");
      return;
    }

    const actualSubject = isCustomSubject ? customSubject.trim() : subject;
    const finalSet: QuestionSet = {
      id: `set_imported_${Date.now()}`,
      title: parsedExamSet.title || `${examType} ${actualSubject} Kelas ${grade}`,
      subject: parsedExamSet.subject || actualSubject,
      grade: parsedExamSet.grade || grade,
      semester: parsedExamSet.semester || semester,
      material: parsedExamSet.material || `Naskah Soal Format DOCX (${actualSubject})`,
      learningObjective: `Asesmen dan naskah format soal mandiri dari Guru (${actualSubject})`,
      difficultyType: "Campuran",
      questionType: "Pilihan Ganda",
      onlyFromMaterial: false,
      questions: applyAutoPointsToQuestionSet(parsedExamSet.questions, undefined, 100),
      createdAt: new Date().toISOString(),
      totalPoints: 100,
    };

    if (onImportQuestionSet) {
      onImportQuestionSet(finalSet);
    }
  };

  // Handle module/notes file drop/upload (Tab 2)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setIsParsingFile(true);
    setUploadedFileName(file.name);
    setDetectedExamFormatFile(null);

    try {
      const extractedText = await parseDocumentFile(file);
      if (isRawPdfBinary(extractedText)) {
        throw new Error("Dokumen PDF menghasilkan teks biner mentah. Sistem menolak teks tersebut untuk menjaga integritas materi.");
      }
      setMaterialText(extractedText);

      // Check if uploaded document is actually a completed question template
      const hasQuestionNumbering = /(?:(?:No\.?\s*|Soal\s*)?\d+[\.\)]\s+.+[\r\n]+[A-E][\.\)])/i.test(extractedText);
      const hasAnswerKey = /(?:Kunci|Jawaban\s+Benar|Key)\s*[:=]?\s*[A-E]/i.test(extractedText);
      if (hasQuestionNumbering && hasAnswerKey) {
        setDetectedExamFormatFile(file);
      }
    } catch (err: any) {
      setFileError(err.message || "Gagal membaca berkas dokumen.");
      setUploadedFileName(null);
    } finally {
      setIsParsingFile(false);
    }
  };

  // Switch from upload mode to docx-format and process the file directly
  const handleSwitchToDocxFormat = async (fileToUse?: File) => {
    const targetFile = fileToUse || detectedExamFormatFile;
    setSourceMode("docx-format");
    setDetectedExamFormatFile(null);

    if (targetFile) {
      setDocxExamError(null);
      setIsParsingDocxExam(true);
      setDocxExamFileName(targetFile.name);
      setParsedExamSet(null);

      const actualSubject = isCustomSubject ? customSubject.trim() : subject;
      try {
        const parsed = await parseTeacherExamFile(targetFile, {
          subject: actualSubject,
          grade,
          semester,
          examType,
        });

        if (!parsed || !parsed.questions || parsed.questions.length === 0) {
          throw new Error("Tidak ada butir soal yang dapat dibaca dari berkas ini. Pastikan berkas mengikuti format naskah soal.");
        }

        setParsedExamSet(parsed);
        setValidationError(null);
      } catch (err: any) {
        setDocxExamError(err.message || "Gagal memproses berkas format soal.");
        setDocxExamFileName(null);
        setParsedExamSet(null);
      } finally {
        setIsParsingDocxExam(false);
      }
    }
  };

  const handleLoginAndProceed = async () => {
    setIsLoggingIn(true);
    setLoginModalError(null);
    try {
      let profile: UserProfile | null = null;
      if (onRequestLogin) {
        profile = await onRequestLogin();
      } else {
        profile = await loginWithGooglePopup();
      }

      if (profile) {
        setCurrentUser(profile);
        setIsAuthConnected(true);
        setShowLoginModal(false);

        // Automatically proceed with pending action
        if (pendingDocxAction) {
          setPendingDocxAction(false);
          handleSaveParsedExamToBank();
        } else if (pendingGeneratePayload) {
          const payloadToExec = pendingGeneratePayload;
          setPendingGeneratePayload(null);
          await onGenerate(payloadToExec);
          clearQuestionFormDraft();
        }
      }
    } catch (err: any) {
      if (err?.message?.includes("dibatalkan") || err?.message?.includes("ditutup") || err?.message?.includes("closed")) {
        return;
      }
      setLoginModalError(err?.message || "Gagal masuk dengan Google. Pastikan jendela pop-up diizinkan pada browser Anda.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetForm = () => {
    if (window.confirm("Kosongkan dan atur ulang isian formulir pembuatan soal?")) {
      clearQuestionFormDraft();
      setMaterialText("");
      setCustomSubject("");
      setIsCustomSubject(false);
      setCustomPrompt("");
      setModuleFocusTopic("");
      setUploadedFileName(null);
      setFileError(null);
      setDocxExamFileName(null);
      setParsedExamSet(null);
      setValidationError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const actualSubject = isCustomSubject ? customSubject.trim() : subject;
    if (!actualSubject) {
      setValidationError("Silakan pilih atau masukkan Nama Mata Pelajaran.");
      return;
    }

    // Save current draft immediately so user's work is 100% secured
    saveQuestionFormDraft({
      level,
      subject,
      customSubject,
      isCustomSubject,
      grade,
      semester,
      examType,
      questionCount,
      optionsCount,
      cognitiveFocus,
      includeImages,
      imageFrequency: includeImages ? imageFrequency : "none",
      diffEasy,
      diffMedium,
      diffHard,
      sourceMode,
      materialText,
      onlyFromMaterial,
      customPrompt,
      moduleFocusTopic,
      uploadedFileName,
    });

    // If in DOCX Format mode
    if (sourceMode === "docx-format") {
      if (parsedExamSet && parsedExamSet.questions.length > 0) {
        // Enforce account login before saving to Bank Soal
        if (!isAuthConnected && !currentUser) {
          setPendingDocxAction(true);
          setPendingGeneratePayload(null);
          setShowLoginModal(true);
          return;
        }
        handleSaveParsedExamToBank();
        return;
      }
      setValidationError("Silakan unggah berkas naskah format soal (.docx) yang sudah diisi.");
      return;
    }

    if (sourceMode === "manual" || sourceMode === "upload") {
      if (!materialText.trim()) {
        setValidationError("Silakan masukkan topik materi pembelajaran atau unggah dokumen materi.");
        return;
      }
    }

    // Auto-balance difficulty if sum != 100
    let easy = diffEasy;
    let medium = diffMedium;
    let hard = diffHard;
    const sum = easy + medium + hard;
    if (sum !== 100 && sum > 0) {
      easy = Math.round((easy / sum) * 100);
      medium = Math.round((medium / sum) * 100);
      hard = 100 - easy - medium;
    }

    const payload: GenerateRequest = {
      level,
      grade,
      subject: actualSubject,
      semester,
      examType,
      material: materialText,
      questionCount: Math.min(60, Math.max(1, questionCount)),
      optionsCount,
      difficultyRatio: { easy, medium, hard },
      cognitiveFocus,
      includeImages: Boolean(includeImages),
      imageFrequency: includeImages ? imageFrequency : "none",
      onlyFromMaterial,
      customPrompt: customPrompt.trim() || undefined,
      sourceMode,
      moduleFocusTopic: moduleFocusTopic.trim() || undefined,
    };

    // STRICT CHECK: Ensure account is logged in before generating questions
    if (!isAuthConnected && !currentUser) {
      setPendingGeneratePayload(payload);
      setPendingDocxAction(false);
      setShowLoginModal(true);
      return;
    }

    // AI Quota Pre-flight Check
    if (quotaState.isApiBlocked || quotaState.count >= quotaState.limit) {
      if (onOpenQuotaModal) {
        onOpenQuotaModal();
        return;
      }
    }

    await onGenerate(payload);
    clearQuestionFormDraft();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl w-full mx-auto space-y-6 sm:space-y-8 pb-24 min-w-0">
      {/* Title & Description Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 xl:p-10 card-shadow border border-slate-200 space-y-3 w-full min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-blue-700 font-black text-xs sm:text-sm uppercase tracking-wider rounded-full border border-blue-200">
            <Sparkles className="w-4 h-4" />
            GENERATOR SOAL CERDAS BERBASIS AI
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-full border border-slate-200" title="Semua settingan soal tersimpan otomatis di perangkat Anda">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Draft Tersimpan Otomatis</span>
            </span>
            {materialText && (
              <button
                type="button"
                onClick={handleResetForm}
                className="px-2.5 py-1 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-full border border-slate-200 transition-colors font-semibold cursor-pointer"
                title="Bersihkan kolom materi dan setel ulang form"
              >
                ↺ Reset Form
              </button>
            )}
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase break-words">
          Formulir Pembuatan Soal & Kuis
        </h1>
        <p className="text-xs sm:text-sm lg:text-base text-slate-600 font-medium max-w-3xl leading-relaxed">
          Lengkapi parameter kurikulum di bawah ini. AI akan menganalisis topik dan menghasilkan butir soal pilihan ganda lengkap dengan kunci jawaban, kisi-kisi HOTS/LOTS, dan pembahasan.
        </p>
      </div>

      {validationError && (
        <div className="p-4 sm:p-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm lg:text-base font-bold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* STEP 1: IDENTITAS KURIKULUM & MAPEL */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 xl:p-10 card-shadow border border-slate-200 space-y-6 sm:space-y-8 w-full min-w-0">
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm sm:text-base shrink-0 shadow-xs">
            1
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-lg sm:text-xl lg:text-2xl uppercase tracking-tight truncate">
              Identitas Kurikulum & Jenjang
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Tentukan tingkat pendidikan dan mata pelajaran</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch w-full min-w-0">
          {/* Jenjang Pendidikan */}
          <div className="space-y-2 flex flex-col justify-between min-w-0">
            <label className="block text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
              Jenjang Sekolah
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl h-12 items-center">
              {(["SD", "SMP", "SMA", "SMK"] as EducationLevel[]).map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => {
                    setLevel(lvl);
                    // auto pick suitable grade
                    if (lvl === "SD" && !GRADE_OPTIONS["SD"].includes(grade)) setGrade("VI");
                    if (lvl === "SMP" && !GRADE_OPTIONS["SMP"].includes(grade)) setGrade("VIII");
                    if ((lvl === "SMA" || lvl === "SMK") && !GRADE_OPTIONS["SMA"].includes(grade)) setGrade("XI");
                  }}
                  className={`h-10 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center cursor-pointer ${
                    level === lvl
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Kelas */}
          <div className="space-y-2 flex flex-col justify-between min-w-0">
            <label className="block text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
              Tingkat Kelas
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm lg:text-base font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              {GRADE_OPTIONS[level]?.map((gr) => (
                <option key={gr} value={gr}>
                  Kelas {gr}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="space-y-2 flex flex-col justify-between sm:col-span-2 lg:col-span-1 min-w-0">
            <label className="block text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
              Semester
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl h-12 items-center">
              <button
                type="button"
                onClick={() => setSemester("1")}
                className={`h-10 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center cursor-pointer ${
                  semester === "1"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Ganjil (1)
              </button>
              <button
                type="button"
                onClick={() => setSemester("2")}
                className={`h-10 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center cursor-pointer ${
                  semester === "2"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Genap (2)
              </button>
            </div>
          </div>
        </div>

        {/* Mata Pelajaran & Jenis Asesmen */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 pt-2 w-full min-w-0">
          {/* Mata Pelajaran */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between">
              <label className="block text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
                Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomSubject(!isCustomSubject)}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {isCustomSubject ? "← Pilih dari Daftar" : "+ Tulis Manual"}
              </button>
            </div>

            {isCustomSubject ? (
              <input
                type="text"
                placeholder="Misal: Seni Musik, Bimbingan Konseling..."
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm lg:text-base font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                autoFocus
              />
            ) : (
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm lg:text-base font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              >
                {SUBJECT_PRESETS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Jenis Asesmen */}
          <div className="space-y-2 min-w-0">
            <label className="block text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
              Jenis Asesmen / Ujian
            </label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm lg:text-base font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="Penilaian Harian (PH)">Penilaian Harian / Formatif (PH)</option>
              <option value="Asesmen Sumatif Tengah Semester (ASTS)">Asesmen Tengah Semester (ASTS / UTS)</option>
              <option value="Asesmen Sumatif Akhir Semester (ASAS)">Asesmen Akhir Semester (ASAS / PAS)</option>
              <option value="Ujian Sekolah / Asesmen Akhir Jenjang (ASAJ)">Ujian Sekolah / Kelulusan (ASAJ)</option>
              <option value="Kuis Latihan Cepat">Kuis Latihan Cepat</option>
            </select>
          </div>
        </div>
      </div>

      {/* PILIH METODE PEMBUATAN SOAL - PROMINENT HIGHLIGHTED SECTION */}
      <div 
        id="section-source-mode-selector"
        className={`rounded-3xl p-5 sm:p-6.5 transition-all duration-300 shadow-md border-2 ${
          sourceMode === "docx-format"
            ? "bg-linear-to-br from-emerald-50 via-teal-50/80 to-emerald-100/60 border-emerald-400 ring-4 ring-emerald-500/15"
            : "bg-linear-to-br from-blue-50 via-indigo-50/80 to-blue-100/60 border-blue-400 ring-4 ring-blue-500/15"
        }`}
      >
        <div className="space-y-4">
          {/* Top Priority Badge & Active Status */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-600 text-white shadow-xs">
                <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
                Langkah Awal • Pilih Alur Dahulu
              </span>
              <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                Tentukan metode input sebelum melanjutkan pengisian di bawah
              </span>
            </div>

            {sourceMode === "docx-format" ? (
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mode Format Template Word Aktif
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-600 text-white shadow-xs inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Mode AI Generator Aktif
              </span>
            )}
          </div>

          {/* Title & Guidance */}
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-lg sm:text-xl uppercase tracking-tight flex items-center gap-2">
              <span>Pilih Metode Pembuatan Soal Ujian</span>
            </h3>
            <p className="text-xs sm:text-sm lg:text-base text-slate-600 font-medium mt-1.5 leading-relaxed">
              {sourceMode === "docx-format"
                ? "Anda memilih impor naskah resmi Word (.docx) — butir soal asli Bapak/Ibu guru dimasukkan 100% presisi tanpa diubah ataupun ditambah oleh AI."
                : "Anda memilih pembuatan soal berbasis AI cerdas — sistem akan menganalisis topik dan menghasilkan butir soal baru lengkap dengan kunci dan pembahasan."}
            </p>
          </div>

          {/* 3 Prominent Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* OPSI 1: KETIK MATERI */}
            <button
              type="button"
              onClick={() => setSourceMode("manual")}
              className={`p-4 sm:p-5 rounded-2xl transition-all text-left cursor-pointer flex flex-col justify-between gap-3.5 border ${
                sourceMode === "manual"
                  ? "bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/50 scale-[1.01]"
                  : "bg-white text-slate-800 border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/40 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  sourceMode === "manual" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                  sourceMode === "manual" ? "bg-white/25 text-white" : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}>
                  Otomatis AI
                </span>
              </div>
              <div>
                <div className="font-black text-sm sm:text-base">Ketik Materi (AI)</div>
                <div className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                  sourceMode === "manual" ? "text-blue-100" : "text-slate-500"
                }`}>
                  Ketik atau salin teks materi silabus, AI membuat butir soal baru otomatis.
                </div>
              </div>
            </button>

            {/* OPSI 2: UPLOAD MODUL */}
            <button
              type="button"
              onClick={() => setSourceMode("upload")}
              className={`p-4 sm:p-5 rounded-2xl transition-all text-left cursor-pointer flex flex-col justify-between gap-3.5 border ${
                sourceMode === "upload"
                  ? "bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/50 scale-[1.01]"
                  : "bg-white text-slate-800 border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/40 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  sourceMode === "upload" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                }`}>
                  <Upload className="w-5 h-5" />
                </div>
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                  sourceMode === "upload" ? "bg-white/25 text-white" : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}>
                  Dokumen Modul
                </span>
              </div>
              <div>
                <div className="font-black text-sm sm:text-base">Upload Modul (AI)</div>
                <div className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                  sourceMode === "upload" ? "text-blue-100" : "text-slate-500"
                }`}>
                  Unggah file modul (PDF, DOCX, TXT) untuk dibaca dan dibuatkan soal oleh AI.
                </div>
              </div>
            </button>

            {/* OPSI 3: FORMAT TEMPLATE DOCX */}
            <button
              type="button"
              onClick={() => setSourceMode("docx-format")}
              className={`p-4 sm:p-5 rounded-2xl transition-all text-left cursor-pointer flex flex-col justify-between gap-3.5 border ${
                sourceMode === "docx-format"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/50 scale-[1.01]"
                  : "bg-white text-slate-800 border-slate-200/90 hover:border-emerald-300 hover:bg-emerald-50/40 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  sourceMode === "docx-format" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                }`}>
                  <FileDown className="w-5 h-5" />
                </div>
                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full ${
                  sourceMode === "docx-format" ? "bg-white/25 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  Soal Asli Guru • 100%
                </span>
              </div>
              <div>
                <div className="font-black text-sm sm:text-base">Format Naskah (.docx)</div>
                <div className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                  sourceMode === "docx-format" ? "text-emerald-100" : "text-slate-500"
                }`}>
                  Unggah dokumen naskah soal Word, diimpor langsung tanpa diubah AI.
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* JIKA SUMBER MODE ADALAH TEMPLATE DOCX: TAMPILKAN LANGKAH 2 DEDIKASI */}
      {sourceMode === "docx-format" ? (
        <div className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0">
              2
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight truncate">
                Naskah Soal Sesuai Format Template (.docx)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Unduh template standar, lengkapi butir soal di Word, lalu unggah untuk dimasukkan langsung ke Bank Soal
              </p>
            </div>
          </div>

          {/* NOTIFIKASI: STRUKTUR KOMPOSISI SOAL DIABAIKAN */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wide">
                Struktur Komposisi Soal Dinonaktifkan Otomatis (Mengikuti Berkas Template 100%)
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                Pada mode naskah template ini, <strong>fitur komposisi soal (seperti pengaturan jumlah butir soal, opsi pilihan jawaban A-D/E, fokus kognitif C1-C6, dan persentase tingkat kesulitan) dinonaktifkan secara otomatis</strong>. Sistem akan membaca dan memasukkan <strong>seluruh butir soal asli</strong> yang tertulis di dalam dokumen Word Anda secara persis apa adanya tanpa diubah, ditambah, atau dikurangi oleh AI.
              </p>
            </div>
          </div>

          {/* 1. Unduh Template Format Soal */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-3xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <FileDown className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full inline-block mb-1">
                    Langkah 1: Siapkan Naskah Soal
                  </span>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Unduh Format Soal Ujian Terstandar (.DOCX)
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium leading-relaxed">
                    Format dokumen Word yang rapi, profesional, dan siap diisi soal pilihan ganda, opsi A-D/E, kunci jawaban, dan pembahasan.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadDocxTemplate}
                disabled={isDownloadingTemplate}
                className="shrink-0 py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                {isDownloadingTemplate ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Menyiapkan Dokumen...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Unduh Template .DOCX</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-blue-200/50 text-[11px]">
              <div className="flex items-center gap-2 text-slate-700 font-medium bg-white/70 p-2.5 rounded-xl border border-blue-100">
                <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Kop Asesmen & Identitas Mapel</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-medium bg-white/70 p-2.5 rounded-xl border border-blue-100">
                <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Opsi A, B, C, D (atau E) & Kunci</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-medium bg-white/70 p-2.5 rounded-xl border border-blue-100">
                <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Materi & Indikator Per Soal (Kisi-Kisi)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-medium bg-white/70 p-2.5 rounded-xl border border-blue-100">
                <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Uraian Pembahasan & Poin Nilai</span>
              </div>
            </div>
          </div>

          {/* 2. Unggah Naskah Soal yang Sudah Diisi */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                Langkah 2: Unggah Naskah Soal yang Sudah Diisi (.docx / .txt) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Otomatis membaca butir soal asli
              </span>
            </div>

            <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-3xl p-6 sm:p-8 text-center transition-all cursor-pointer relative group">
              <input
                type="file"
                accept=".docx,.doc,.txt"
                onChange={handleDocxExamUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              <div className="space-y-3 max-w-md mx-auto pointer-events-none">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {isParsingDocxExam ? "Mengekstrak naskah soal & kunci jawaban..." : "Klik atau seret berkas naskah soal (.docx) ke sini"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Sistem membaca seluruh nomor soal, opsi, kunci, dan pembahasan secara presisi tanpa batasan jumlah.
                  </p>
                </div>
              </div>
            </div>

            {docxExamError && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{docxExamError}</span>
              </div>
            )}

            {/* Status Parsed Question Set */}
            {parsedExamSet && (
              <div className="p-4 sm:p-5 bg-emerald-50 border border-emerald-200 rounded-3xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-200/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-emerald-950">
                        {parsedExamSet.questions.length} Butir Soal Berhasil Dibaca!
                      </h4>
                      <p className="text-xs text-emerald-700 font-medium">
                        {parsedExamSet.title} • {parsedExamSet.subject} (Kelas {parsedExamSet.grade})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowParsedPreviewList(!showParsedPreviewList)}
                      className="py-2 px-3 bg-white text-emerald-800 hover:bg-emerald-100 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{showParsedPreviewList ? "Tutup Pratinjau" : "Lihat Butir Soal"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveParsedExamToBank}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan ke Bank Soal</span>
                    </button>
                  </div>
                </div>

                {/* Question Cards Accordion / List */}
                {showParsedPreviewList && (
                  <div className="space-y-3 pt-1 max-h-96 overflow-y-auto pr-1">
                    {parsedExamSet.questions.map((q, idx) => (
                      <div key={q.id || idx} className="p-3.5 bg-white rounded-2xl border border-emerald-100 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-black text-slate-900">
                            {q.number || idx + 1}. {q.question}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {q.material && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold text-[10px] rounded-lg">
                                {q.material}
                              </span>
                            )}
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-lg">
                              Kunci: {q.correctAnswer}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-3 border-l-2 border-emerald-200">
                          {q.options.map((opt) => (
                            <div
                              key={opt.label}
                              className={`text-[11px] font-medium ${
                                opt.label === q.correctAnswer ? "font-bold text-emerald-700" : "text-slate-600"
                              }`}
                            >
                              <span className="font-bold">{opt.label}.</span> {opt.text}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <p className="text-[11px] text-slate-500 italic pl-3 border-l-2 border-slate-200">
                            <span className="font-bold not-italic">Pembahasan: </span>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* STEP 2: KONFIGURASI SOAL & KOGNITIF */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 xl:p-10 card-shadow border border-slate-200 space-y-6 sm:space-y-8 w-full min-w-0">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm sm:text-base shrink-0 shadow-xs">
                2
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 text-lg sm:text-xl lg:text-2xl uppercase tracking-tight truncate">
                  Struktur & Komposisi Soal
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Jumlah butir, opsi jawaban, dan proporsi tingkat kesulitan</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-start w-full min-w-0">
              {/* Jumlah Soal */}
              <div className="space-y-3 p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col justify-between h-full min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <label className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider block truncate">
                      Jumlah Butir Soal
                    </label>
                    <span className="text-[10px] text-slate-500 font-semibold">Tersedia 3 s.d. 60 soal (Maksimal 60)</span>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-50 border border-blue-200/90 rounded-xl px-2.5 py-1 shadow-2xs shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={questionCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setQuestionCount(Math.min(60, Math.max(1, val)));
                        } else {
                          setQuestionCount(1);
                        }
                      }}
                      className="w-10 text-center text-xs sm:text-sm font-black text-blue-700 bg-transparent focus:outline-hidden"
                      aria-label="Input jumlah butir soal (maksimal 60)"
                    />
                    <span className="text-xs font-black text-blue-700">Soal</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min={3}
                    max={60}
                    step={1}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.min(60, Math.max(1, Number(e.target.value))))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold px-0.5">
                    <span>3</span>
                    <span>15</span>
                    <span>30</span>
                    <span>45</span>
                    <span className="text-blue-600 font-black">60 (Maks)</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600">Pilihan Cepat:</span>
                    {questionCount >= 50 && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded-md border border-amber-300">
                        ⚡ Paket Lengkap ({questionCount} Soal)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[5, 10, 15, 20, 25, 30, 35, 40, 50, 60].map((num) => (
                      <button
                        type="button"
                        key={num}
                        onClick={() => setQuestionCount(num)}
                        className={`text-xs font-bold py-1.5 px-1 rounded-lg border transition-all text-center cursor-pointer ${
                          questionCount === num
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-400"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  {/* Zero-duplication guarantee */}
                  <div className="text-[10px] text-emerald-800 bg-emerald-50/90 px-2 py-1.5 rounded-lg border border-emerald-200/80 font-bold flex items-center gap-1.5 leading-snug">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Batas Maks. 60 Soal: Menjamin 100% variasi, kualitas tinggi, & bebas soal duplikat.</span>
                  </div>
                </div>
              </div>

              {/* Opsi Pilihan Jawaban */}
              <div className="space-y-3 p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col justify-between h-full min-w-0">
                <label className="block text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
                  Opsi Jawaban
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setOptionsCount(4)}
                    className={`py-3 px-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      optionsCount === 4
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-bold ring-2 ring-blue-400/30 shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-black uppercase">4 Opsi (A - D)</div>
                    <div className="text-xs text-slate-500 mt-0.5">Standar SD & SMP</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOptionsCount(5)}
                    className={`py-3 px-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      optionsCount === 5
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-bold ring-2 ring-blue-400/30 shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-black uppercase">5 Opsi (A - E)</div>
                    <div className="text-xs text-slate-500 mt-0.5">Standar SMA & SMK</div>
                  </button>
                </div>
              </div>

              {/* Fokus Kognitif */}
              <div className="space-y-3 p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col justify-between h-full md:col-span-2 lg:col-span-1 min-w-0">
                <label className="block text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider">
                  Fokus Kognitif
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCognitiveFocus("BALANCED")}
                    className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      cognitiveFocus === "BALANCED"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Seimbang
                  </button>
                  <button
                    type="button"
                    onClick={() => setCognitiveFocus("HOTS")}
                    className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      cognitiveFocus === "HOTS"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    HOTS (C4-C6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCognitiveFocus("LOTS")}
                    className={`py-2 px-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      cognitiveFocus === "LOTS"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Dasar (C1-C3)
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {cognitiveFocus === "HOTS"
                    ? "Menekankan analisis, evaluasi, dan studi kasus berpikir kritis."
                    : cognitiveFocus === "LOTS"
                    ? "Menekankan ingatan fakta, konsep dasar, dan definisi."
                    : "Proporsi seimbang antara konsep dasar dan soal penalaran."}
                </p>
              </div>
            </div>

        {/* Distribusi Tingkat Kesulitan */}
        <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Distribusi Tingkat Kesulitan (%)
            </span>
            <span className="text-[11px] text-slate-500 font-bold">
              Total: {diffEasy + diffMedium + diffHard}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full min-w-0">
            <div className="space-y-1 min-w-0">
              <label className="text-[11px] font-bold text-emerald-700 uppercase truncate block">Mudah</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={diffEasy}
                  onChange={(e) => setDiffEasy(Number(e.target.value))}
                  className="w-full py-2 pl-2.5 sm:pl-3 pr-5 sm:pr-6 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
                <span className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <label className="text-[11px] font-bold text-amber-700 uppercase truncate block">Sedang</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={diffMedium}
                  onChange={(e) => setDiffMedium(Number(e.target.value))}
                  className="w-full py-2 pl-2.5 sm:pl-3 pr-5 sm:pr-6 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
                <span className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <label className="text-[11px] font-bold text-rose-700 uppercase truncate block">Sukar</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={diffHard}
                  onChange={(e) => setDiffHard(Number(e.target.value))}
                  className="w-full py-2 pl-2.5 sm:pl-3 pr-5 sm:pr-6 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-600"
                />
                <span className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dukungan Soal Bergambar & Stimulus Visual */}
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 w-full min-w-0 ${
          includeImages
            ? "bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border-blue-300 shadow-xs"
            : "bg-slate-50 border-slate-200"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                includeImages ? "bg-blue-600 text-white shadow-xs" : "bg-slate-200 text-slate-500"
              }`}>
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider block truncate">
                    Stimulus Visual & Soal Bergambar (AI)
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    includeImages ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                  }`}>
                    {includeImages ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium truncate block">
                  {includeImages
                    ? "Diagram, bagan alir, skema, tabel, atau ilustrasi konsep edukatif"
                    : "Nonaktif (default). Klik tombol di sebelah kanan jika ingin menyertakan gambar."}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
              <button
                type="button"
                id="btn-toggle-visual-stimulus"
                onClick={() => {
                  const nextState = !includeImages;
                  setIncludeImages(nextState);
                  if (!nextState) setImageFrequency("none");
                  else if (imageFrequency === "none") setImageFrequency("some");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  includeImages
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300"
                }`}
              >
                <span>{includeImages ? "✓ Aktif" : "Aktifkan"}</span>
              </button>
            </div>
          </div>

          {includeImages && (
            <div className="pt-2 border-t border-blue-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full min-w-0">
              <button
                type="button"
                onClick={() => setImageFrequency("some")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  imageFrequency === "some"
                    ? "bg-white border-blue-500 ring-2 ring-blue-400/30 text-blue-900 font-bold shadow-xs"
                    : "bg-white/60 border-slate-200 text-slate-700 hover:bg-white"
                }`}
              >
                <div className="text-xs font-black uppercase flex items-center justify-between">
                  <span>Variatif (~30% - 60% Soal)</span>
                  {imageFrequency === "some" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  AI menyematkan gambar pada butir soal yang paling tepat (HOTS/diagram/analisis).
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImageFrequency("all")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  imageFrequency === "all"
                    ? "bg-white border-blue-500 ring-2 ring-blue-400/30 text-blue-900 font-bold shadow-xs"
                    : "bg-white/60 border-slate-200 text-slate-700 hover:bg-white"
                }`}
              >
                <div className="text-xs font-black uppercase flex items-center justify-between">
                  <span>Semua Soal (100% Bergambar)</span>
                  {imageFrequency === "all" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Setiap butir pertanyaan wajib dilengkapi ilustrasi visual kontekstual.
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* STEP 3: MATERI PEMBELAJARAN / SILABUS / DOKUMEN */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 xl:p-10 card-shadow border border-slate-200 space-y-6 sm:space-y-8 w-full min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3.5 min-w-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm sm:text-base shrink-0 shadow-xs">
              3
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-lg sm:text-xl lg:text-2xl uppercase tracking-tight truncate">
                Sumber Materi Pembelajaran
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Pilih metode input materi atau kisi-kisi</p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl text-xs sm:text-sm font-bold border border-slate-200/60 shadow-2xs self-start md:self-auto w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setSourceMode("manual")}
              className={`px-4 py-2.5 rounded-xl transition-all text-center cursor-pointer ${
                sourceMode === "manual" ? "bg-white text-blue-700 font-black shadow-xs border border-slate-200/50" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ketik Materi
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode("upload");
                setOnlyFromMaterial(true);
              }}
              className={`px-4 py-2.5 rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                sourceMode === "upload" ? "bg-white text-blue-700 font-black shadow-xs border border-slate-200/50" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Upload Modul</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 text-blue-700 border border-blue-200">
                100% Modul
              </span>
            </button>
          </div>
        </div>

        {/* Tab 1: Manual Material Text */}
        {sourceMode === "manual" && (
          <div className="space-y-3.5 w-full min-w-0">
            {/* Format Bar & Copy Action Card */}
            <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-slate-50 border border-blue-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 sm:mt-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                        Format Khusus Pengisian Materi
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-blue-100 text-blue-700 border border-blue-200">
                        Hasil AI Maksimal
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Format terstruktur (Bab, TP/CP, Poin Konsep, Kata Kunci, & Batasan) agar butir soal 100% tepat sasaran, akurat, dan tidak melebar.
                    </p>
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="flex items-center gap-2 shrink-0 self-start md:self-auto flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopyFormatTemplate}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                      copiedFormat
                        ? "bg-emerald-600 text-white shadow-emerald-200 ring-2 ring-emerald-300"
                        : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xs active:scale-95"
                    }`}
                    title="Salin format teks pengisian materi ke clipboard agar mudah diisi"
                  >
                    {copiedFormat ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Format Disalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Format Materi</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyFormatTemplate}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    title="Langsung tempelkan kerangka template ke kotak isian di bawah"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Terapkan ke Kolom</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFormatGuide(!showFormatGuide)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      showFormatGuide
                        ? "bg-blue-100/90 border-blue-300 text-blue-800"
                        : "bg-white hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900"
                    }`}
                    title="Buka panduan komponen format & contoh terisi"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">{showFormatGuide ? "Tutup Panduan" : "Panduan & Contoh"}</span>
                    <span className="sm:hidden">Contoh</span>
                    {showFormatGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Guide Drawer / Collapsible Box */}
              {showFormatGuide && (
                <div className="pt-3 border-t border-blue-200/70 space-y-3">
                  {/* 6 Sections Guide Grid */}
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-blue-600 rounded-full inline-block"></span>
                      Panduan 6 Bagian Format Rekomendasi
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                      {MATERIAL_GUIDE_SECTIONS.map((sec, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-blue-700 text-[11px]">{sec.tag}</span>
                            <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded">Penting</span>
                          </div>
                          <div className="font-bold text-slate-800 text-[11px]">{sec.title}</div>
                          <p className="text-[11px] text-slate-600 leading-tight">{sec.description}</p>
                          <p className="text-[10px] text-emerald-700 font-semibold pt-1 flex items-center gap-1">
                            <span>✓</span> <span>{sec.benefit}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Example Box */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-black text-slate-800">
                          Contoh Format Terisi Lengkap (Informatika - Jaringan Komputer)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={handleCopyExample}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          {copiedExample ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedExample ? "Tersalin!" : "Salin Contoh"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyExample}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Gunakan Contoh Ini</span>
                        </button>
                      </div>
                    </div>
                    <pre className="text-[11px] leading-relaxed text-slate-700 font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 overflow-x-auto max-h-52 whitespace-pre-wrap select-all">
                      {MATERIAL_INPUT_EXAMPLE}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Textarea Label & Quick Tools */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                Topik / Rangkuman Materi Ajar <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                {materialText.trim() && (
                  <>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                      {materialText.trim().split(/\s+/).filter(Boolean).length} kata
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Kosongkan isi kolom materi?")) {
                          setMaterialText("");
                        }
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Kosongkan</span>
                    </button>
                  </>
                )}
                {!materialText.trim() && (
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                    Tempel format yang sudah disalin atau ketik langsung
                  </span>
                )}
              </div>
            </div>

            <textarea
              rows={10}
              value={materialText}
              onChange={(e) => setMaterialText(e.target.value)}
              placeholder="[JUDUL MATERI / BAB POKOK]&#10;Topik: Jaringan Komputer dan Topologi Jaringan&#10;&#10;[TUJUAN PEMBELAJARAN (TP / CP)]&#10;1. Peserta didik mampu menjelaskan jenis jaringan (LAN, MAN, WAN).&#10;2. Peserta didik mampu menganalisis kelebihan topologi Star, Bus, dan Mesh.&#10;&#10;[POIN KONSEP ESENSIAL YANG DIUJI]&#10;1. Pengertian & jangkauan LAN, MAN, WAN.&#10;2. Fungsi Router, Switch, dan Access Point.&#10;3. Karakteristik topologi Star vs Bus.&#10;&#10;[KATA KUNCI & ISTILAH PENTING]&#10;• LAN, WAN, Router, Switch, Topologi Star, IP Address.&#10;&#10;[STIMULUS & STUDI KASUS (HOTS)]&#10;• Kasus kerusakan koneksi pada laboratorium sekolah.&#10;&#10;[BATASAN MATERI (ANTI-MELEBAR)]&#10;• Fokus pada konsep dasar, jangan sertakan subnetting rumit."
              className="w-full p-4 sm:p-5 bg-slate-50 border border-slate-300 rounded-2xl text-sm sm:text-base font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 leading-relaxed placeholder:text-slate-400 font-mono shadow-2xs transition-all"
            />

            {/* Micro Helper Note */}
            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 font-medium px-1">
              <span className="flex items-center gap-1.5">
                <span className="text-blue-600 font-bold">💡 Tips:</span>
                <span>Gunakan tombol <strong>Copy Format Materi</strong> di atas, lalu isi sesuai silabus kelas Anda.</span>
              </span>
              <button
                type="button"
                onClick={handleCopyFormatTemplate}
                className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer hidden sm:inline-flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Ulang Format</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: File Upload (PDF, Word, Text) */}
        {sourceMode === "upload" && (
          <div className="space-y-4 w-full min-w-0">
            {/* Strict Closed-Corpus Guarantee Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-emerald-50/80 border border-blue-200/90 rounded-2xl flex items-start gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                    Mode Dokumen Tertutup (Strict Closed-Corpus) Aktif
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                    100% Dari Modul
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-medium">
                  Soal yang dibuat <strong>100% mutlak hanya bersumber dari isi modul/dokumen</strong> yang Anda unggah. AI dilarang keras mengarang materi di luar dokumen ini, dan sistem <strong>mewajibkan AI mencantumkan kutipan kalimat asli</strong> dari modul pada bagian pembahasan sebagai bukti keabsahan jawaban.
                </p>
              </div>
            </div>

            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Unggah File Modul / Bahan Ajar / LKS (.pdf, .docx, .txt)
            </label>

            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/40 rounded-3xl p-6 sm:p-8 text-center transition-all cursor-pointer relative group">
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              <div className="space-y-3 max-w-sm mx-auto pointer-events-none">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800">
                    {isParsingFile ? "Membaca teks dari berkas..." : "Klik atau seret file modul ke sini"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Mendukung PDF, Word (.docx), dan Dokumen Teks (.txt)
                  </p>
                </div>
              </div>
            </div>

            {/* Focus Chapter / Section Input */}
            <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>Fokus Bab / Sub-Topik Tertentu Dokumen (Opsional)</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Sangat disarankan bila modul tebal</span>
              </div>
              <input
                type="text"
                value={moduleFocusTopic}
                onChange={(e) => setModuleFocusTopic(e.target.value)}
                placeholder="Contoh: Bab 2 Sistem Ekskresi pada Manusia (atau Halaman 15 - 30)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all shadow-2xs"
              />
              <p className="text-[11px] text-slate-500 font-medium">
                Tentukan bab atau topik spesifik agar AI hanya mengambil soal dari bab tersebut dan tidak melompat ke bab lain.
              </p>
            </div>

            {uploadedFileName && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl text-xs font-bold flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">Berkas terlampir: {uploadedFileName}</span>
                </div>
                <span className="text-[11px] text-blue-600 font-black uppercase shrink-0">Siap Digunakan</span>
              </div>
            )}

            {fileError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {detectedExamFormatFile && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-black text-amber-950 block">Terdeteksi Berkas Format Naskah Soal Lengkap!</span>
                    <span className="text-amber-800 font-medium">
                      Berkas yang Anda unggah berisi butir soal lengkap & kunci jawaban. Beralih ke <strong>Format Template (.docx)</strong> agar soal dimasukkan persis apa adanya tanpa di-generate atau ditambah AI.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitchToDocxFormat(detectedExamFormatFile)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  Beralih ke Format Template (.docx)
                </button>
              </div>
            )}

            {/* Extracted material preview */}
            {materialText && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-black text-slate-700 uppercase">
                  Teks Terekstrak dari Berkas:
                </label>
                <textarea
                  rows={4}
                  value={materialText}
                  onChange={(e) => setMaterialText(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </div>
        )}

        {/* Checkbox: Strict grounding */}
        <div className="pt-2 flex items-start gap-3 p-4 bg-blue-50/70 rounded-2xl border border-blue-200">
          <input
            type="checkbox"
            id="checkbox-only-material"
            checked={onlyFromMaterial}
            onChange={(e) => setOnlyFromMaterial(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="checkbox-only-material" className="text-xs text-slate-700 font-medium cursor-pointer leading-relaxed">
            <span className="font-black text-slate-900">Batasi Sumber Soal (Strict Grounding): </span>
            Buat soal hanya berdasarkan konsep esensial materi yang dicantumkan di atas agar 100% tidak melenceng dari silabus guru dan tidak mengambil teks pengantar/glosarium.
          </label>
        </div>

        {/* Optional Custom Instructions with Presets */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Instruksi Khusus / Pedoman Tambahan Guru (Opsional)
            </label>
            <span className="text-[11px] text-slate-400 font-medium">
              Pilih template cepat atau tulis instruksi mandiri
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            {/* Preset 0: Mode Hemat Kuota (Paling Irit Token & Kuota) */}
            <button
              type="button"
              onClick={() =>
                setCustomPrompt(
                  `MODE HEMAT KUOTA & EFISIENSI TOKEN (MAKSIMALKAN KUOTA HARIAN):\n1. FORMAT PADAT & LANGSUNG: Rumuskan pokok soal (stem) secara tajam, lugas, dan to-the-point tanpa kalimat pembuka yang bertele-tele.\n2. OPSI RINGKAS BERNILAI: Setiap opsi jawaban dibuat padat dan esensial, tanpa redundansi kata.\n3. PEMBAHASAN SINGKAT PADAT: Tuliskan 'explanation' secara ringkas 1-2 kalimat langsung pada alasan ilmiah jawaban yang benar, tanpa pengulangan teks soal.\n4. AKURASI TINGGI (ZERO-RETRY): Pastikan 100% kunci jawaban mutlak benar pada percobaan pertama sehingga tidak perlu membuat ulang (regenerasi soal).`
                )
              }
              className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-xs hover:scale-102 active:scale-98"
            >
              <span>⚡ Mode Hemat Kuota (Paling Irit)</span>
            </button>

            {/* Preset 1: 100% Eksklusif Dokumen Modul */}
            <button
              type="button"
              onClick={() =>
                setCustomPrompt(
                  `MANDAT STRICT CLOSED-CORPUS (100% EKSKLUSIF MODUL):\n1. SUMBER TERTUTUP: Dokumen modul terlampir adalah SATU-SATUNYA acuan informasi. DILARANG KERAS menggunakan pengetahuan umum, istilah kurikulum lain, atau fakta apa pun di luar dokumen ini.\n2. VALIDASI BUKTI KUTIPAN: Pada setiap kolom 'explanation', WAJIB sertakan kutipan kalimat asli dari teks dokumen: 'Rujukan Modul: "[kutipan kalimat persis]"'.\n3. PENGECOH HOMOGEN: Opsi salah (distraktor) harus diambil dari istilah atau konsep yang juga ada di dalam dokumen modul tersebut, bukan mengarang istilah baru dari luar.\n4. ELIMINASI NOISE: Dilarang membuat soal dari kata pengantar, daftar isi, glosarium, biodata penyusun, atau tugas kelompok.`
                )
              }
              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-blue-300 hover:border-blue-500 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>🔒 100% Eksklusif Modul</span>
            </button>

            {/* Preset 2: Anti-Melebar / Strict Scope */}
            <button
              type="button"
              onClick={() =>
                setCustomPrompt(
                  `PEDOMAN STRICT KONTROL MATERI (ANTI-MELEBAR):\n1. STRICT SCOPE: Sumber materi yang saya tuliskan/berikan adalah BATAS MAKSIMAL ruang lingkup materi. DILARANG KERAS memunculkan topik, rumus, algoritma, atau istilah teknis lanjutan yang tidak ada kaitannya dengan pokok materi tersebut.\n2. DISTRIBUSI & VARIASI: Sebarkan butir soal secara merata ke seluruh poin materi, jangan menumpuk hanya pada satu sub-topik. Variasikan bentuk pertanyaan: identifikasi konsep, analisis sebab-akibat, perbandingan dua objek/istilah, dan pemecahan kasus praktis.\n3. KEDALAMAN KOGNITIF: Buat stimulus kontekstual yang dekat dengan pengalaman nyata siswa. Untuk soal HOTS, uji kemampuan menganalisis dan mengambil keputusan berdasarkan stimulus, bukan hafalan kata per kata.\n4. STANDAR FORMAT: Pokok soal (stem) dirumuskan tegas dan jelas. Opsi jawaban homogen dan tidak memberikan petunjuk kunci pada kalimat soal.`
                )
              }
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 border border-emerald-300 hover:border-emerald-500 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>🛡️ Anti-Melebar (Strict Scope)</span>
            </button>

            {/* Preset 3: HOTS */}
            <button
              type="button"
              onClick={() =>
                setCustomPrompt(
                  `FOKUS HOTS & ANALISIS KASUS:\n- Sajikan stimulus berupa studi kasus dunia nyata, tabel perbandingan, atau skenario praktis.\n- Uji kemampuan menganalisis (C4) dan mengevaluasi (C5) pemecahan masalah.\n- Distraktor diambil dari kesalahan persepsi (miskonsepsi) umum siswa.`
                )
              }
              className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 hover:text-purple-800 border border-purple-300 hover:border-purple-500 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>🎯 Fokus HOTS & Kasus</span>
            </button>

            {/* Preset 4: Bahasa Ringkas */}
            <button
              type="button"
              onClick={() =>
                setCustomPrompt(
                  `BAHASA SEDERHANA & LANGSUNG:\n- Gunakan kalimat ringkas dan jelas tanpa pengantar yang berbelit-belit.\n- Hindari istilah asing yang belum dijelaskan di materi pokok.`
                )
              }
              className="px-2.5 py-1 bg-white hover:bg-amber-50 text-amber-700 hover:text-amber-800 border border-amber-300 hover:border-amber-500 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>✨ Bahasa Ringkas</span>
            </button>

            {customPrompt && (
              <button
                type="button"
                onClick={() => setCustomPrompt("")}
                className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                title="Hapus instruksi"
              >
                ✕ Kosongkan
              </button>
            )}
          </div>

          <textarea
            rows={3}
            placeholder="Contoh: Fokuskan pada fungsi switch vs router, atau klik salah satu tombol preset di atas..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-600 leading-relaxed placeholder:text-slate-400"
          />
        </div>
      </div>
        </>
      )}

      {/* SUBMIT BUTTON */}
      <div className="pt-2 w-full min-w-0">
        {/* Account login requirement banner */}
        {!isAuthConnected && !currentUser ? (
          <div className="mb-3.5 p-4 rounded-2xl bg-amber-50/95 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-950 font-medium shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-amber-900 text-xs sm:text-sm">Pengaturan Soal Tersimpan Aman</p>
                <p className="text-amber-800 text-[11px] sm:text-xs">
                  Masuk akun Google diperlukan sebelum generate agar soal langsung tersimpan ke Bank Soal akun Anda.
                </p>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setShowLoginModal(true);
              }}
              className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs rounded-xl transition-colors shrink-0 shadow-xs cursor-pointer select-none text-center"
            >
              Masuk Akun Google
            </div>
          </div>
        ) : (
          <div className="mb-3.5 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950 font-medium">
            <div className="flex items-center gap-2.5 truncate">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || ""}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover border border-emerald-400 shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                  {(currentUser?.displayName || currentUser?.email || "G").charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate">
                Akun aktif: <strong className="font-black text-emerald-900">{currentUser?.displayName || currentUser?.email}</strong> (Soal otomatis tersimpan ke Bank Soal Anda)
              </span>
            </div>
            <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-black px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
              Tersambung
            </span>
          </div>
        )}

        {sourceMode === "docx-format" ? (
          <button
            type="submit"
            id="btn-submit-generate-questions"
            disabled={isParsingDocxExam}
            className={`w-full py-4 sm:py-5 px-6 rounded-3xl font-black text-sm sm:text-lg text-white shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-wide cursor-pointer ${
              parsedExamSet && parsedExamSet.questions.length > 0
                ? "bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] shadow-emerald-900/30"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.01] active:scale-[0.99] shadow-blue-900/30"
            }`}
          >
            {isParsingDocxExam ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Mengekstrak Naskah Format Soal...</span>
              </>
            ) : parsedExamSet && parsedExamSet.questions.length > 0 ? (
              <>
                <Save className="w-5 h-5" />
                <span>💾 SIMPAN {parsedExamSet.questions.length} BUTIR SOAL KE BANK SOAL {!isAuthConnected ? "(PERLU LOGIN)" : "& BUKA PRATINJAU"}</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>📥 PROSES & SIMPAN FORMAT SOAL KE BANK SOAL</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="submit"
            id="btn-submit-generate-questions"
            disabled={isLoading || isParsingFile}
            className={`w-full py-4 sm:py-5 px-6 rounded-3xl font-black text-sm sm:text-lg text-white shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-wide cursor-pointer ${
              isLoading || isParsingFile
                ? "bg-slate-400 cursor-not-allowed shadow-none"
                : (quotaState.isApiBlocked || quotaState.count >= quotaState.limit)
                ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 hover:scale-[1.01] active:scale-[0.99] shadow-amber-900/30"
                : !isAuthConnected && !currentUser
                ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.01] active:scale-[0.99] shadow-blue-900/30"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.01] active:scale-[0.99] shadow-blue-900/30"
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses & Menyusun Soal dengan AI...</span>
              </>
            ) : (quotaState.isApiBlocked || quotaState.count >= quotaState.limit) ? (
              <>
                <Hourglass className="w-5 h-5 text-amber-300 animate-pulse" />
                <span>⏳ KUOTA HARI INI TERCAPAI (KLIK UNTUK LIHAT HITUNG MUNDUR)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                <span>
                  {!isAuthConnected && !currentUser
                    ? `🚀 GENERATE ${questionCount} BUTIR SOAL (MASUK & SIMPAN KE AKUN GURU)`
                    : `🚀 GENERATE ${questionCount} BUTIR SOAL SEKARANG`}
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </form>

    {/* LOGIN REQUIRED MODAL (PRESERVES FORM SETTINGS 100%) */}
    {showLoginModal && (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider rounded-full border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Settingan Soal Tersimpan Aman</span>
            </div>
            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 text-sm font-bold transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              Masuk Akun Google untuk Melanjutkan
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              Semua isian form dan materi yang Anda siapkan <strong>tidak akan hilang</strong>. Silakan masuk dengan Akun Google agar paket soal yang dibuat AI otomatis tersimpan ke Bank Soal akun Anda.
            </p>
          </div>

          {/* Form Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-semibold">Mata Pelajaran:</span>
              <span className="font-black text-slate-900">{isCustomSubject ? customSubject.trim() : subject} (Kelas {grade})</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-semibold">Target Soal:</span>
              <span className="font-black text-blue-600">{questionCount} Butir Pilihan Ganda ({optionsCount} Opsi)</span>
            </div>
            {materialText && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-semibold">Materi:</span>
                <span className="font-medium text-slate-800 truncate max-w-[190px]">
                  {materialText.replace(/[\n\r]+/g, " ").slice(0, 40)}...
                </span>
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="space-y-2 text-xs text-slate-600 font-medium">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Soal tersimpan otomatis di Bank Soal akun Anda.</span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Siap ekspor langsung ke Google Form & Google Drive Anda.</span>
            </div>
          </div>

          {loginModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {loginModalError}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleLoginAndProceed}
              disabled={isLoggingIn}
              className="w-full py-3.5 sm:py-4 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 font-black text-white text-sm sm:text-base flex items-center justify-center gap-3 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:bg-slate-400"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menghubungkan ke Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Masuk dengan Google & Lanjutkan</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              disabled={isLoggingIn}
              className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              Kembali ke Form (Settingan Tetap Utuh)
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};
