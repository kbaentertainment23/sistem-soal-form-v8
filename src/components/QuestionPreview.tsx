import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  Save, 
  FileDown, 
  Plus, 
  Edit3, 
  RotateCcw, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  FileText, 
  Layers, 
  Check, 
  HelpCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Share2,
  Image as ImageIcon,
  ZoomIn,
  X,
  CheckSquare,
  Square,
  ArrowLeft,
  Filter,
  CheckCircle2,
  Settings,
  GraduationCap,
  Award,
  BarChart2,
  Eye,
  Sliders,
  School,
  FileSpreadsheet,
  FileCode,
  ChevronDown
} from "lucide-react";
import type { Question, QuestionSet, GenerateRequest, ExamAuditResult } from "../types.js";
import { EditQuestionModal } from "./EditQuestionModal.js";
import { EditPackageInfoModal } from "./EditPackageInfoModal.js";
import { ConfirmModal } from "./ConfirmModal.js";
import { KisiKisiModal } from "./KisiKisiModal.js";
import { QualityAuditBanner } from "./QualityAuditBanner.js";
import { QuestionAuditBox } from "./QuestionAuditBox.js";
import { GridTemplate } from "./GridTemplate.js";
import { exportToPDF, exportToWordText, downloadFile, exportKisiKisiPDF, exportKisiKisiWord } from "../lib/exportUtils.js";
import { findDuplicateQuestionPairs } from "../lib/questionDeduplicator.js";
import { recordApiQuotaExceeded } from "../lib/aiQuotaService.js";
import { formatGradeDisplay, cleanGrade, cleanExamTitle } from "../lib/classUtils.js";
import { getAppSettings, saveSelectedQuestions, getSavedSelectedQuestions } from "../lib/storage.js";
import { downloadExamPaperDOCX, downloadExamPaperPDF, printExamPaperDirect } from "../lib/examPaperExport.js";
import { applyAutoPointsToQuestionSet, calculateDifficultyWeightedPoints } from "../lib/pointDistributor.js";
import { exportQuestionsToJSON, exportQuestionsToCSV, exportQuestionsToText } from "../lib/questionFormatUtils.js";
import { ImportQuestionsModal } from "./ImportQuestionsModal.js";

interface QuestionPreviewProps {
  questionSet: QuestionSet;
  onUpdateQuestionSet: (updatedSet: QuestionSet) => void;
  onSaveToBank: (set: QuestionSet) => void;
  onOpenGoogleFormModal: (customSet?: QuestionSet) => void;
  onBackToEditForm?: () => void;
  onBackToBank?: () => void;
  userId?: string | null;
}

export const QuestionPreview: React.FC<QuestionPreviewProps> = ({
  questionSet,
  onUpdateQuestionSet,
  onSaveToBank,
  onOpenGoogleFormModal,
  onBackToEditForm,
  onBackToBank,
  userId,
}) => {
  const [viewMode, setViewMode] = useState<"interactive" | "exam_paper" | "kisi_kisi">("interactive");
  const [showAnswerKeysInPrint, setShowAnswerKeysInPrint] = useState(false);
  const [showExplanationsInPrint, setShowExplanationsInPrint] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isNewQuestionModal, setIsNewQuestionModal] = useState(false);
  const [isEditPackageModalOpen, setIsEditPackageModalOpen] = useState(false);
  const [isKisiKisiModalOpen, setIsKisiKisiModalOpen] = useState(false);
  const [deletingQuestionNumber, setDeletingQuestionNumber] = useState<number | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [imageGeneratingIndex, setImageGeneratingIndex] = useState<number | null>(null);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; caption?: string } | null>(null);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [deleteWarningToast, setDeleteWarningToast] = useState<string | null>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [isExamExportMenuOpen, setIsExamExportMenuOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<ExamAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [showAuditBanner, setShowAuditBanner] = useState(true);
  const [appliedRevisionNumbers, setAppliedRevisionNumbers] = useState<Set<number>>(new Set());
  const settings = getAppSettings();

  // Helper to determine initial selected numbers for this question set
  const getInitialSelection = (set: QuestionSet): Set<number> => {
    // 1. Explicitly saved in questionSet.selectedQuestionNumbers
    if (Array.isArray(set.selectedQuestionNumbers)) {
      const valid = set.selectedQuestionNumbers.filter((n) =>
        set.questions.some((q) => q.number === n)
      );
      return new Set(valid);
    }
    // 2. Explicitly saved on question items (isSelected: boolean)
    const hasFlags = set.questions.some((q) => q.isSelected !== undefined);
    if (hasFlags) {
      const valid = set.questions
        .filter((q) => q.isSelected !== false)
        .map((q) => q.number);
      return new Set(valid);
    }
    // 3. Fallback to localStorage fast cache
    const cached = getSavedSelectedQuestions(set.id);
    if (cached) {
      const valid = cached.filter((n) => set.questions.some((q) => q.number === n));
      return new Set(valid);
    }
    // Default: all questions selected initially
    return new Set(set.questions.map((q) => q.number));
  };

  // Selected Question Numbers (persisted per questionSet)
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(() =>
    getInitialSelection(questionSet)
  );
  const [customSelectCount, setCustomSelectCount] = useState<string>("");
  const [justAutoSavedSelection, setJustAutoSavedSelection] = useState<boolean>(false);

  // Sync selected numbers if the active question set changes (switching package)
  useEffect(() => {
    const initial = getInitialSelection(questionSet);
    setSelectedNumbers(initial);

    // Jika paket baru dimuat dan soal terpilih belum disesuaikan ke 100 poin (masih default 1 poin), otomatis ratakan ke 100
    const selected = questionSet.questions.filter((q) => initial.has(q.number));
    const sum = selected.reduce((acc, q) => acc + (q.points || 1), 0);
    if (initial.size > 0 && sum !== 100 && selected.every((q) => (q.points || 1) === 1)) {
      const balanced = applyAutoPointsToQuestionSet(questionSet.questions, initial, 100);
      const updatedSet: QuestionSet = {
        ...questionSet,
        selectedQuestionNumbers: Array.from(initial),
        questions: balanced,
        totalPoints: 100,
      };
      onUpdateQuestionSet(updatedSet);
      onSaveToBank(updatedSet);
    }
  }, [questionSet.id]);

  // Centralized selection update that IMMEDIATELY persists to QuestionSet, Storage, and Bank Soal
  // Otomatis mendistribusikan total 100 poin berbobot tingkat kesulitan (Mudah, Sedang, Sulit) ke soal terpilih
  const applyAndPersistSelection = (newSelectedNumbers: Set<number>, autoBalancePoints: boolean = true) => {
    setSelectedNumbers(newSelectedNumbers);
    const selectedArr = Array.from(newSelectedNumbers);

    // 1. Cache to localStorage immediately
    saveSelectedQuestions(questionSet.id, selectedArr);

    // 2. Distribusikan poin berbobot tingkat kesulitan ke soal-soal yang dipilih sehingga tepat 100 poin
    let updatedQuestions = questionSet.questions;
    if (autoBalancePoints && newSelectedNumbers.size > 0) {
      updatedQuestions = applyAutoPointsToQuestionSet(questionSet.questions, newSelectedNumbers, 100);
    } else {
      updatedQuestions = questionSet.questions.map((q) => ({
        ...q,
        isSelected: newSelectedNumbers.has(q.number),
      }));
    }

    const calculatedSelectedScore = updatedQuestions
      .filter((q) => newSelectedNumbers.has(q.number))
      .reduce((acc, q) => acc + (q.points || 1), 0);

    // 3. Update QuestionSet and questions' isSelected flags
    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: selectedArr,
      questions: updatedQuestions,
      totalPoints: calculatedSelectedScore > 0 ? calculatedSelectedScore : 100,
    };

    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);

    // Visual feedback indicator
    setJustAutoSavedSelection(true);
    setTimeout(() => setJustAutoSavedSelection(false), 2200);
  };

  // Re-distribusi otomatis 100 poin berbobot tingkat kesulitan (Mudah, Sedang, Sulit)
  const handleAutoBalancePoints = () => {
    if (selectedCount === 0) return;
    const balancedQuestions = applyAutoPointsToQuestionSet(questionSet.questions, selectedNumbers, 100);
    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: Array.from(selectedNumbers),
      questions: balancedQuestions,
      totalPoints: 100,
    };
    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);
    setJustAutoSavedSelection(true);
    setTimeout(() => setJustAutoSavedSelection(false), 2200);
  };

  // Fleksibilitas ubah poin per butir soal secara manual oleh user
  const handleQuickChangePoints = (questionNumber: number, newPoints: number) => {
    const validPoints = Math.max(1, Math.min(100, isNaN(newPoints) ? 1 : newPoints));
    const updatedQuestions = questionSet.questions.map((q) =>
      q.number === questionNumber ? { ...q, points: validPoints } : q
    );
    const selectedPts = updatedQuestions
      .filter((q) => selectedNumbers.has(q.number))
      .reduce((sum, q) => sum + (q.points || 1), 0);

    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: Array.from(selectedNumbers),
      questions: updatedQuestions,
      totalPoints: selectedPts > 0 ? selectedPts : updatedQuestions.reduce((sum, q) => sum + (q.points || 1), 0),
    };
    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);
  };

  // Totals
  const totalQuestions = questionSet.questions.length;
  const totalScore = questionSet.questions.reduce((acc, q) => acc + (q.points || 1), 0);

  // Selected Totals
  const selectedQuestions = questionSet.questions.filter((q) => selectedNumbers.has(q.number));
  const selectedCount = selectedQuestions.length;
  const selectedScore = selectedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);

  // Bloom's Taxonomy Counts
  const bloomCounts: Record<string, number> = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };
  questionSet.questions.forEach((q) => {
    const lvl = q.cognitiveLevel || "C2";
    if (bloomCounts[lvl] !== undefined) {
      bloomCounts[lvl]++;
    } else {
      bloomCounts["C2"]++;
    }
  });

  const hotsCount = (bloomCounts.C4 || 0) + (bloomCounts.C5 || 0) + (bloomCounts.C6 || 0);
  const hotsPercent = totalQuestions > 0 ? Math.round((hotsCount / totalQuestions) * 100) : 0;

  // Duplicate Questions Detection
  const duplicatePairs = React.useMemo(() => {
    return findDuplicateQuestionPairs(questionSet.questions);
  }, [questionSet.questions]);

  const [isFixingDuplicates, setIsFixingDuplicates] = useState(false);

  // Validation
  const validationIssues: { questionNumber: number; reason: string }[] = [];
  questionSet.questions.forEach((q, idx) => {
    if (!q.question.trim()) {
      validationIssues.push({ questionNumber: idx + 1, reason: "Teks pertanyaan kosong" });
    }
    const emptyOpts = q.options.filter((o) => !o.text.trim());
    if (emptyOpts.length > 0) {
      validationIssues.push({ questionNumber: idx + 1, reason: `Opsi ${emptyOpts.map((o) => o.label).join(", ")} kosong` });
    }
    if (!q.correctAnswer) {
      validationIssues.push({ questionNumber: idx + 1, reason: "Kunci jawaban belum ditentukan" });
    }
  });

  if (duplicatePairs.length > 0) {
    duplicatePairs.forEach((dp) => {
      validationIssues.push({
        questionNumber: dp.numB,
        reason: `Mirip/duplikat dengan Soal No. ${dp.numA} (${dp.reason})`
      });
    });
  }

  // Toggle selection for a single question (auto-saves immediately)
  const handleToggleSelectQuestion = (number: number) => {
    const next = new Set<number>(selectedNumbers);
    if (next.has(number)) {
      next.delete(number);
    } else {
      next.add(number);
    }
    applyAndPersistSelection(next);
  };

  // Select all questions (auto-saves immediately)
  const handleSelectAll = () => {
    const all = new Set<number>(questionSet.questions.map((q) => q.number));
    applyAndPersistSelection(all);
  };

  // Deselect all questions (auto-saves immediately)
  const handleDeselectAll = () => {
    applyAndPersistSelection(new Set<number>());
  };

  // Select first N questions (auto-saves immediately)
  const handleSelectFirstN = (n: number) => {
    const count = Math.min(Math.max(1, n), totalQuestions);
    const subset = new Set<number>(questionSet.questions.slice(0, count).map((q) => q.number));
    applyAndPersistSelection(subset);
  };

  // Select only HOTS questions (auto-saves immediately)
  const handleSelectOnlyHots = () => {
    const hots = new Set<number>(
      questionSet.questions
        .filter((q) => q.difficulty === "HOTS" || q.difficulty === "Sulit" || ["C4", "C5", "C6"].includes(q.cognitiveLevel))
        .map((q) => q.number)
    );
    if (hots.size > 0) {
      applyAndPersistSelection(hots);
    }
  };

  // Create a filtered QuestionSet based on selected questions
  const getSelectedQuestionSet = (): QuestionSet => {
    const filteredQuestions = questionSet.questions
      .filter((q) => selectedNumbers.has(q.number))
      .map((q, idx) => ({
        ...q,
        number: idx + 1,
        isSelected: true,
      }));

    const calculatedPoints = filteredQuestions.reduce((acc, q) => acc + (q.points || 1), 0);

    return {
      ...questionSet,
      questions: filteredQuestions,
      selectedQuestionNumbers: filteredQuestions.map((q) => q.number),
      totalPoints: calculatedPoints,
    };
  };

  const handleExportOfficialPDF = () => {
    try {
      setIsExportingPdf(true);
      const filteredSet = getSelectedQuestionSet();
      downloadExamPaperPDF(filteredSet, showAnswerKeysInPrint);
      setExportSuccessMessage("Naskah Ujian Resmi (.pdf) berhasil diunduh!");
      setTimeout(() => setExportSuccessMessage(null), 3500);
      setIsExamExportMenuOpen(false);
    } catch (err) {
      console.error("Gagal mengekspor PDF naskah ujian:", err);
      setDeleteWarningToast("Gagal mengunduh file PDF.");
      setTimeout(() => setDeleteWarningToast(null), 3000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportOfficialDOCX = async () => {
    try {
      setIsExportingDocx(true);
      const filteredSet = getSelectedQuestionSet();
      await downloadExamPaperDOCX(filteredSet, showAnswerKeysInPrint);
      setExportSuccessMessage("Naskah Ujian Resmi (.docx) berhasil diunduh!");
      setTimeout(() => setExportSuccessMessage(null), 3500);
      setIsExamExportMenuOpen(false);
    } catch (err) {
      console.error("Gagal mengekspor DOCX naskah ujian:", err);
      setDeleteWarningToast("Gagal mengunduh file DOCX.");
      setTimeout(() => setDeleteWarningToast(null), 3000);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handlePrintOfficialDirect = () => {
    setIsExamExportMenuOpen(false);
    const filteredSet = getSelectedQuestionSet();
    printExamPaperDirect(filteredSet, showAnswerKeysInPrint);
  };

  const handleEditClick = (q: Question) => {
    setEditingQuestion(q);
    setIsNewQuestionModal(false);
  };

  const handleSaveEditedQuestion = (updatedQ: Question) => {
    const updatedQuestions = questionSet.questions.map((q) =>
      q.number === updatedQ.number ? { ...updatedQ, isSelected: selectedNumbers.has(updatedQ.number) } : q
    );
    const newTotal = updatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: Array.from(selectedNumbers),
      questions: updatedQuestions,
      totalPoints: newTotal,
    };
    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);
  };

  const handleRunQualityAudit = async () => {
    setIsAuditing(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/audit-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questionSet.questions,
          subject: questionSet.subject,
          grade: questionSet.grade,
          material: questionSet.material,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal melakukan audit kualitas soal.");
      }

      setAuditResult(data.data);
      setShowAuditBanner(true);
      setAppliedRevisionNumbers(new Set());
    } catch (err: any) {
      console.error("Audit error:", err);
      setAuditError(err.message || "Terjadi kesalahan saat mengaudit soal.");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleApplySingleRevision = (questionNumber: number) => {
    if (!auditResult) return;
    const auditItem = auditResult.questionAudits.find((a) => a.questionNumber === questionNumber);
    if (!auditItem?.improvedQuestion) return;

    const imp = auditItem.improvedQuestion;
    const updatedQuestions = questionSet.questions.map((q) => {
      if (q.number === questionNumber) {
        return {
          ...q,
          question: imp.question,
          options: imp.options,
          correctAnswer: imp.correctAnswer,
          explanation: imp.explanation,
          cognitiveLevel: imp.cognitiveLevel || q.cognitiveLevel,
          difficulty: ["C4", "C5", "C6"].includes(imp.cognitiveLevel || "") ? "HOTS" : q.difficulty,
        };
      }
      return q;
    });

    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: Array.from(selectedNumbers),
      questions: updatedQuestions,
    };

    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);

    setAppliedRevisionNumbers((prev) => new Set([...prev, questionNumber]));
  };

  const handleApplyAllRevisions = () => {
    if (!auditResult) return;
    const applicableItems = auditResult.questionAudits.filter(
      (a): a is typeof a & { improvedQuestion: NonNullable<typeof a.improvedQuestion> } => 
        Boolean(a.hasIssue && a.improvedQuestion)
    );
    if (applicableItems.length === 0) return;

    const itemMap = new Map<number, NonNullable<(typeof applicableItems)[0]["improvedQuestion"]>>(
      applicableItems.map((a) => [a.questionNumber, a.improvedQuestion])
    );
    const newlyApplied = new Set(appliedRevisionNumbers);

    const updatedQuestions = questionSet.questions.map((q) => {
      const imp = itemMap.get(q.number);
      if (imp) {
        newlyApplied.add(q.number);
        return {
          ...q,
          question: imp.question,
          options: imp.options,
          correctAnswer: imp.correctAnswer,
          explanation: imp.explanation,
          cognitiveLevel: imp.cognitiveLevel || q.cognitiveLevel,
          difficulty: ["C4", "C5", "C6"].includes(imp.cognitiveLevel || "") ? "HOTS" : q.difficulty,
        };
      }
      return q;
    });

    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: Array.from(selectedNumbers),
      questions: updatedQuestions,
    };

    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);
    setAppliedRevisionNumbers(newlyApplied);
  };

  const handleDeleteQuestionConfirm = (number: number) => {
    if (questionSet.questions.length <= 1) {
      setDeleteWarningToast("Paket soal minimal harus memiliki 1 butir pertanyaan.");
      setTimeout(() => setDeleteWarningToast(null), 3000);
      return;
    }

    const filtered = questionSet.questions.filter((q) => q.number !== number);
    const renumbered = filtered.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
    const newTotal = renumbered.reduce((acc, q) => acc + (q.points || 1), 0);

    // Preserve selection mapping for remaining questions
    const newSelected = new Set<number>();
    filtered.forEach((q, idx) => {
      if (selectedNumbers.has(q.number)) {
        newSelected.add(idx + 1);
      }
    });
    const selectedArr = Array.from(newSelected);
    setSelectedNumbers(newSelected);
    saveSelectedQuestions(questionSet.id, selectedArr);

    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: selectedArr,
      questions: renumbered.map((q) => ({
        ...q,
        isSelected: newSelected.has(q.number),
      })),
      totalPoints: newTotal,
    };

    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);
    setDeletingQuestionNumber(null);
  };

  const handleAddNewQuestionManual = () => {
    const nextNum = questionSet.questions.length + 1;
    const newQ: Question = {
      id: `q_${Date.now()}_${nextNum}`,
      number: nextNum,
      question: "",
      options: [
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ],
      correctAnswer: "A",
      explanation: "",
      difficulty: "Sedang",
      cognitiveLevel: "C2",
      indicator: `Siswa dapat memahami materi ${questionSet.material}`,
      points: 1,
    };
    setEditingQuestion(newQ);
    setIsNewQuestionModal(true);
  };

  const handleSaveNewQuestion = (newQ: Question) => {
    const nextNum = questionSet.questions.length + 1;
    const formatted: Question = {
      ...newQ,
      number: nextNum,
      isSelected: true,
    };
    const updatedQuestions = [...questionSet.questions, formatted];
    const newTotal = updatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const newSelected = new Set([...selectedNumbers, nextNum]);
    const selectedArr = Array.from(newSelected);
    
    setSelectedNumbers(newSelected);
    saveSelectedQuestions(questionSet.id, selectedArr);

    const updatedSet: QuestionSet = {
      ...questionSet,
      selectedQuestionNumbers: selectedArr,
      questions: updatedQuestions.map((q) => ({
        ...q,
        isSelected: newSelected.has(q.number),
      })),
      totalPoints: newTotal,
    };

    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);
  };

  const handleSavePackageMeta = (updatedMeta: {
    title: string;
    subject: string;
    grade: string;
    semester: string;
    material: string;
  }) => {
    const updatedSet: QuestionSet = {
      ...questionSet,
      ...updatedMeta,
      title: cleanExamTitle(updatedMeta.title),
      grade: cleanGrade(updatedMeta.grade),
      selectedQuestionNumbers: Array.from(selectedNumbers),
    };
    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);
  };

  const handleApplyImportedQuestions = (
    newQuestions: Question[],
    mode: "merge" | "replace",
    importedMeta?: {
      title?: string;
      subject?: string;
      grade?: string;
      semester?: string;
      material?: string;
    }
  ) => {
    // Recompute sequential numbers 1..N
    const renumbered = newQuestions.map((q, idx) => ({
      ...q,
      number: idx + 1,
      isSelected: true,
    }));

    const allNumbers = new Set(renumbered.map((q) => q.number));
    setSelectedNumbers(allNumbers);
    saveSelectedQuestions(questionSet.id, Array.from(allNumbers));

    const newTotalPoints = renumbered.reduce((acc, q) => acc + (q.points || 1), 0);

    const updatedSet: QuestionSet = {
      ...questionSet,
      ...(mode === "replace" && importedMeta?.title ? { title: cleanExamTitle(importedMeta.title) } : {}),
      ...(mode === "replace" && importedMeta?.subject ? { subject: importedMeta.subject } : {}),
      ...(mode === "replace" && importedMeta?.grade ? { grade: cleanGrade(importedMeta.grade) } : {}),
      ...(mode === "replace" && importedMeta?.material ? { material: importedMeta.material } : {}),
      questions: renumbered,
      selectedQuestionNumbers: Array.from(allNumbers),
      totalPoints: newTotalPoints,
    };

    onUpdateQuestionSet(updatedSet);
    onSaveToBank(updatedSet);

    if (mode === "merge") {
      setExportSuccessMessage(
        `Berhasil menggabungkan soal! Total naskah kini menjadi ${renumbered.length} butir soal.`
      );
    } else {
      setExportSuccessMessage(
        `Berhasil mengimpor ${renumbered.length} butir soal baru ke dalam naskah!`
      );
    }
    setTimeout(() => setExportSuccessMessage(null), 5000);
  };

  // Regenerate single question with AI
  const handleRegenerateSingle = async (q: Question, idx: number) => {
    try {
      setRegeneratingIndex(idx);
      const otherQuestions = questionSet.questions
        .filter((_, i) => i !== idx)
        .map((item) => item.question);

      const res = await fetch("/api/regenerate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: questionSet.subject,
          grade: questionSet.grade,
          material: questionSet.material,
          currentQuestion: q,
          optionsCount: q.options.length === 5 ? 5 : 4,
          materialContext: questionSet.material,
          onlyFromMaterial: questionSet.onlyFromMaterial,
          existingQuestions: otherQuestions,
        }),
      });

      const data = await res.json();
      if (res.status === 429 || data?.isQuotaExceeded || data?.code === "QUOTA_EXHAUSTED") {
        recordApiQuotaExceeded(userId, data?.error);
        throw new Error(data?.error || "Batas kuota Gemini API tercapai saat meregenerasi soal. Kuota akan diperbarui pada pukul 00:00 (Waktu Lokal).");
      }
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat soal pengganti.");
      }

      const newQuestionObj = data.question || data;
      const updatedQuestions = [...questionSet.questions];
      updatedQuestions[idx] = {
        ...newQuestionObj,
        number: q.number,
        id: q.id,
      };

      const updatedSet: QuestionSet = {
        ...questionSet,
        questions: updatedQuestions,
      };
      onUpdateQuestionSet(updatedSet);
      onSaveToBank(updatedSet);
    } catch (err: any) {
      setDeleteWarningToast(err.message || "Gagal regenerasi soal.");
      setTimeout(() => setDeleteWarningToast(null), 3500);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  // Auto-replace duplicate questions with guaranteed unique AI-generated questions
  const handleFixAllDuplicates = async () => {
    if (duplicatePairs.length === 0 || isFixingDuplicates) return;
    setIsFixingDuplicates(true);
    try {
      const duplicateTargetIndices: number[] = Array.from(new Set(duplicatePairs.map((dp) => dp.indexB)));
      for (const idx of duplicateTargetIndices) {
        const qToReplace = questionSet.questions[idx];
        if (!qToReplace) continue;
        await handleRegenerateSingle(qToReplace, idx);
      }
    } catch (err: any) {
      setDeleteWarningToast(err.message || "Gagal mengganti beberapa soal duplikat.");
      setTimeout(() => setDeleteWarningToast(null), 3500);
    } finally {
      setIsFixingDuplicates(false);
    }
  };

  const handleAutoAddImageToQuestion = async (q: Question, idx: number) => {
    try {
      setImageGeneratingIndex(idx);
      const res = await fetch("/api/generate-question-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: questionSet.subject,
          topic: q.indicator || questionSet.material,
          questionText: q.question,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal merekomendasikan gambar.");
      }

      const updatedQuestions = [...questionSet.questions];
      updatedQuestions[idx] = {
        ...q,
        imageUrl: data.imageUrl,
        imageCaption: data.caption || `Gambar Soal No. ${q.number}`,
      };

      const updatedSet: QuestionSet = {
        ...questionSet,
        questions: updatedQuestions,
      };
      onUpdateQuestionSet(updatedSet);
      onSaveToBank(updatedSet);
    } catch (err: any) {
      setDeleteWarningToast(err.message || "Gagal menyematkan gambar visual.");
      setTimeout(() => setDeleteWarningToast(null), 3500);
    } finally {
      setImageGeneratingIndex(null);
    }
  };

  const handleRemoveImageFromQuestion = (idx: number) => {
    const updatedQuestions = [...questionSet.questions];
    const q = updatedQuestions[idx];
    if (q) {
      updatedQuestions[idx] = {
        ...q,
        imageUrl: undefined,
        imageCaption: undefined,
      };
      const updatedSet: QuestionSet = {
        ...questionSet,
        questions: updatedQuestions,
      };
      onUpdateQuestionSet(updatedSet);
      onSaveToBank(updatedSet);
    }
  };

  const handleSaveBankClick = () => {
    onSaveToBank(questionSet);
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 3000);
  };

  // Launch Google Form creation with selected questions
  const handleLaunchGoogleForm = () => {
    if (selectedCount === 0) {
      setDeleteWarningToast("Silakan pilih minimal 1 butir soal yang ingin dimasukkan ke Google Form.");
      setTimeout(() => setDeleteWarningToast(null), 3500);
      return;
    }
    const filteredSet = getSelectedQuestionSet();
    onOpenGoogleFormModal(filteredSet);
  };

  return (
    <div className="max-w-[1600px] w-full mx-auto space-y-6 sm:space-y-8 pb-28 min-w-0">
      {/* Toast Notification */}
      {saveSuccessToast && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 sm:px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-[calc(100vw-2rem)]">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold truncate">Paket Soal berhasil disimpan ke Bank Soal!</span>
        </div>
      )}

      {exportSuccessMessage && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white px-4 sm:px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-[calc(100vw-2rem)]">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold truncate">{exportSuccessMessage}</span>
        </div>
      )}

      {/* Navigation Breadcrumb / Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 no-print">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {onBackToBank && (
            <button
              type="button"
              onClick={onBackToBank}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Bank Soal</span>
            </button>
          )}

          {onBackToEditForm && (
            <button
              type="button"
              onClick={onBackToEditForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Form Generator</span>
            </button>
          )}
        </div>

        {/* View Mode Toggle: Interactive vs Official Exam Paper vs Kisi-Kisi Grid */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-2xl w-full sm:w-auto border border-slate-300">
          <button
            type="button"
            onClick={() => setViewMode("interactive")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === "interactive"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Mode Kurasi & Edit</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("exam_paper")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === "exam_paper"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">Naskah Ujian Resmi</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("kisi_kisi")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === "kisi_kisi"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200 shrink-0" />
            <span className="truncate">Kisi-Kisi ({selectedCount} Soal)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE: OFFICIAL KISI-KISI CSS GRID TEMPLATE (PRINT & EXAM STANDARDS)       */}
      {/* ========================================================================= */}
      {viewMode === "kisi_kisi" && (
        <div className="space-y-6">
          <GridTemplate
            questionSet={getSelectedQuestionSet()}
            showKop={true}
            showSignatures={true}
            showStats={true}
            showToolbar={true}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: OFFICIAL SCHOOL EXAMINATION PAPER VIEW (PRINT READY)              */}
      {/* ========================================================================= */}
      {viewMode === "exam_paper" && (
        <div className="space-y-6">
          {/* Print Controls Toolbar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 card-shadow border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">
                <School className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                  Pratinjau Naskah Ujian Standar Satuan Pendidikan
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Format tata letak naskah ujian cetak A4 / F4 lengkap dengan Kop dan Petunjuk Pengerjaan.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 relative">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer select-none transition-colors border border-slate-200">
                <input
                  type="checkbox"
                  checked={showAnswerKeysInPrint}
                  onChange={(e) => setShowAnswerKeysInPrint(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Sertakan Kunci Guru</span>
              </label>

              {/* Primary Exam Export Button (Target of CSS Selector button:nth-of-type(1)) */}
              <button
                type="button"
                id="btn-download-naskah-official"
                onClick={() => setIsExamExportMenuOpen(!isExamExportMenuOpen)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all border border-blue-500/50"
                title="Pilih format unduhan naskah ujian resmi (PDF atau DOCX)"
              >
                <FileDown className="w-4 h-4 text-amber-300" />
                <span>Download Naskah Ujian (PDF / DOCX)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExamExportMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Direct Quick Download PDF */}
              <button
                type="button"
                id="btn-quick-export-pdf"
                onClick={handleExportOfficialPDF}
                disabled={isExportingPdf}
                className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                title="Download langsung file PDF naskah ujian resmi siap cetak"
              >
                <FileText className="w-4 h-4 text-rose-200" />
                <span>{isExportingPdf ? "Membuat PDF..." : "Unduh PDF"}</span>
              </button>

              {/* Direct Quick Download DOCX */}
              <button
                type="button"
                id="btn-quick-export-docx"
                onClick={handleExportOfficialDOCX}
                disabled={isExportingDocx}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                title="Download langsung file Microsoft Word (.docx) naskah ujian resmi"
              >
                <FileCode className="w-4 h-4 text-indigo-200" />
                <span>{isExportingDocx ? "Membuat DOCX..." : "Unduh DOCX"}</span>
              </button>

              {/* Direct Quick Print */}
              <button
                type="button"
                id="btn-quick-print"
                onClick={handlePrintOfficialDirect}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                title="Cetak lewat printer atau Save as PDF browser"
              >
                <Printer className="w-4 h-4 text-slate-300" />
                <span>Cetak</span>
              </button>

              {/* Dropdown Options Popup */}
              {isExamExportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Format Naskah Ujian Resmi
                  </div>

                  <button
                    type="button"
                    id="btn-menu-export-pdf"
                    onClick={handleExportOfficialPDF}
                    disabled={isExportingPdf}
                    className="w-full text-left p-2.5 hover:bg-rose-50 rounded-xl transition-colors flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700 flex items-center gap-1.5">
                        <span>Unduh File PDF Resmi</span>
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-mono font-bold">.pdf</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Format cetak A4 rapi, lengkap dengan Kop, Petunjuk, & Lembar Pengesahan</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-menu-export-docx"
                    onClick={handleExportOfficialDOCX}
                    disabled={isExportingDocx}
                    className="w-full text-left p-2.5 hover:bg-blue-50 rounded-xl transition-colors flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 flex items-center gap-1.5">
                        <span>Unduh File Word (DOCX)</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-mono font-bold">.docx</span>
                      </div>
                      <div className="text-[11px] text-slate-500">Microsoft Word siap edit bebas, format standar sekolah & dinas</div>
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-1"></div>

                  <button
                    type="button"
                    id="btn-menu-print-paper"
                    onClick={handlePrintOfficialDirect}
                    className="w-full text-left p-2.5 hover:bg-slate-100 rounded-xl transition-colors flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Cetak Langsung (Printer / Save PDF)</div>
                      <div className="text-[11px] text-slate-500">Buka dialog cetak bawaan browser untuk cetak fisik atau PDF</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Authentic Examination Paper Sheet */}
          <div className="bg-white rounded-3xl p-6 sm:p-12 card-elevation-high border border-slate-200 text-slate-900 space-y-6 font-serif-exam exam-paper max-w-4xl mx-auto shadow-2xl">
            {/* Kop Resmi Ujian */}
            <div className="text-center pb-4 border-b-4 border-double border-slate-900 space-y-1">
              <h2 className="text-sm sm:text-base font-bold tracking-wider uppercase text-slate-800">
                DINAS PENDIDIKAN DAN KEBUDAYAAN • PROVINSI / KABUPATEN
              </h2>
              <div className="text-base sm:text-xl font-black uppercase tracking-wide text-slate-900">
                {settings.schoolName || "SMP / SMA NEGERI NUSANTARA"}
              </div>
              <h1 className="text-lg sm:text-2xl font-black uppercase tracking-wide">
                LEMBAR ASESMEN SUMATIF / PENILAIAN AKHIR SEMESTER
              </h1>
              <p className="text-xs sm:text-sm font-semibold tracking-normal text-slate-700">
                TAHUN AJARAN {settings.academicYear || "2024 / 2025"} • KURIKULUM MERDEKA & K13
              </p>
            </div>

            {/* Metadata Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm border border-slate-400 p-3 sm:p-4 rounded-lg bg-slate-50/50">
              <div className="space-y-1">
                <div><strong>Mata Pelajaran:</strong> {questionSet.subject}</div>
                <div><strong>Kelas / Fase:</strong> {formatGradeDisplay(questionSet.grade)} (Fase Kurikulum)</div>
                <div><strong>Materi Pokok:</strong> {questionSet.material}</div>
              </div>
              <div className="space-y-1 sm:text-right">
                <div><strong>Bentuk Soal:</strong> Pilihan Ganda ({selectedCount} Butir)</div>
                <div><strong>Alokasi Waktu:</strong> 60 – 90 Menit</div>
                <div><strong>Petunjuk:</strong> Pilihlah salah satu jawaban yang paling tepat (A, B, C, D, atau E).</div>
              </div>
            </div>

            {/* Petunjuk Umum */}
            <div className="text-xs text-slate-700 space-y-0.5 border-b border-slate-300 pb-3">
              <div className="font-bold text-slate-900">PETUNJUK UMUM:</div>
              <ol className="list-decimal pl-5 space-y-0.5">
                <li>Berdoalah sebelum mengerjakan soal.</li>
                <li>Tulislah nomor peserta dan identitas Anda secara lengkap pada lembar jawaban.</li>
                <li>Periksalah kelengkapan naskah soal dan laporkan kepada pengawas jika terdapat kerusakan atau ketidakjelasan.</li>
                <li>Dahulukan menjawab soal-soal yang Anda anggap mudah.</li>
              </ol>
            </div>

            {/* Questions List */}
            <div className="space-y-6 pt-2">
              {selectedQuestions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-2 text-sm leading-relaxed print:break-inside-avoid break-inside-avoid">
                  <div className="flex items-start gap-2">
                    <span className="font-bold shrink-0">{idx + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <div className="font-medium">{q.question}</div>

                      {q.imageUrl && (
                        <div className="my-2 max-w-sm rounded-lg overflow-hidden border border-slate-300 p-1 bg-white">
                          <img
                            src={q.imageUrl}
                            alt={q.imageCaption || "Stimulus Soal"}
                            className="max-h-48 max-w-full object-contain mx-auto"
                          />
                          {q.imageCaption && (
                            <p className="text-[11px] text-center text-slate-500 italic mt-1">{q.imageCaption}</p>
                          )}
                        </div>
                      )}

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1 text-xs sm:text-sm">
                        {q.options.map((opt) => (
                          <div 
                            key={opt.label} 
                            className={`flex items-start gap-2 ${
                              showAnswerKeysInPrint && opt.label === q.correctAnswer
                                ? "font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded"
                                : ""
                            }`}
                          >
                            <span className="font-bold">{opt.label}.</span>
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>

                      {/* Teacher's Key & Explanation (if toggled) */}
                      {showAnswerKeysInPrint && (
                        <div className="mt-2 p-2.5 bg-slate-100 rounded-lg text-xs text-slate-700 space-y-1">
                          <div><strong>Kunci Jawaban:</strong> {q.correctAnswer} | <strong>Level:</strong> {q.cognitiveLevel} ({q.difficulty})</div>
                          {q.explanation && <div><strong>Pembahasan:</strong> {q.explanation}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* End of Exam Sheet Note */}
            <div className="pt-8 border-t border-slate-300 text-center text-xs text-slate-500 italic">
              *** Selamat Mengerjakan & Junjung Tinggi Kejujuran ***
            </div>

            {/* Lembar Pengesahan & Tanda Tangan */}
            {settings.enableSignatures && (
              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs text-slate-800 print:break-inside-avoid break-inside-avoid">
                <div className="space-y-1">
                  <div>Mengetahui,</div>
                  <div className="font-bold">Kepala Satuan Pendidikan</div>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 italic select-none print:hidden">
                    [Tanda Tangan & Cap Sekolah]
                  </div>
                  <div className="font-bold underline pt-2">
                    ( {settings.principalName || "Kepala Sekolah, M.Pd."} )
                  </div>
                  <div className="text-[11px] text-slate-500">
                    NIP. {settings.principalNip || "...................................."}
                  </div>
                </div>

                <div className="space-y-1">
                  <div>{settings.schoolCity || "Kota"}, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
                  <div className="font-bold">Guru Mata Pelajaran</div>
                  <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 italic select-none print:hidden">
                    [Tanda Tangan Guru]
                  </div>
                  <div className="font-bold underline pt-2">
                    ( {settings.teacherName || "Guru Pengampu, S.Pd."} )
                  </div>
                  <div className="text-[11px] text-slate-500">
                    NIP. {settings.teacherNip || "...................................."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: INTERACTIVE CURATION & SELECTION WORKSPACE                        */}
      {/* ========================================================================= */}
      {viewMode === "interactive" && (
        <>
          {/* Top Banner with Subject Info & Primary Actions */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 xl:p-10 card-shadow border border-slate-200 space-y-6 sm:space-y-8 w-full min-w-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 pb-6 border-b border-slate-100 min-w-0">
              <div className="space-y-3 max-w-3xl min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
                  <span className="px-3.5 py-1 bg-blue-50 text-blue-700 font-black text-xs sm:text-sm uppercase tracking-wider rounded-full border border-blue-200">
                    {questionSet.subject}
                  </span>
                  <span className="px-3.5 py-1 bg-slate-100 text-slate-700 font-black text-xs sm:text-sm uppercase tracking-wider rounded-full border border-slate-200/60">
                    {formatGradeDisplay(questionSet.grade)} • Sem {questionSet.semester || "1"}
                  </span>
                  <span className="px-3.5 py-1 bg-slate-900 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-full">
                    {totalQuestions} TOTAL SOAL • {totalScore} POIN
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditPackageModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 text-xs sm:text-sm font-bold rounded-full border border-slate-200 transition-colors cursor-pointer"
                    title="Edit judul paket, mata pelajaran, kelas, materi"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Edit Info Paket</span>
                  </button>
                </div>

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase leading-snug break-words">
                  {cleanExamTitle(questionSet.title)}
                </h1>
              </div>

              {/* Primary Action Button (Selected questions count) */}
              <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  id="btn-preview-buat-google-form"
                  onClick={handleLaunchGoogleForm}
                  disabled={selectedCount === 0 || validationIssues.length > 0}
                  className={`w-full sm:w-auto px-7 sm:px-9 py-4 sm:py-4.5 rounded-2xl font-black text-sm sm:text-base text-white shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-wide cursor-pointer ${
                    selectedCount === 0 || validationIssues.length > 0
                      ? "bg-slate-400 cursor-not-allowed shadow-none"
                      : "bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] shadow-blue-900/30"
                  }`}
                >
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse shrink-0" />
                  <span className="truncate">BUAT GOOGLE FORM ({selectedCount} SOAL)</span>
                </button>
                <span className="text-xs font-bold text-slate-500 text-center sm:text-right">
                  * Hanya {selectedCount} butir soal terpilih yang akan dibuatkan formulir kuis.
                </span>
              </div>
            </div>

            {/* Bloom's Taxonomy & HOTS Distribution Meter */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Distribusi Taksonomi Bloom & Standar HOTS
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                    HOTS (C4-C6): {hotsCount} Soal ({hotsPercent}%)
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                    LOTS (C1-C3): {totalQuestions - hotsCount} Soal ({100 - hotsPercent}%)
                  </span>
                </div>
              </div>

              {/* Progress visual bar */}
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                {Object.entries(bloomCounts).map(([lvl, count]) => {
                  if (count === 0) return null;
                  const pct = (count / totalQuestions) * 100;
                  const isHots = ["C4", "C5", "C6"].includes(lvl);
                  const color = isHots ? "bg-purple-600" : lvl === "C3" ? "bg-indigo-500" : "bg-blue-500";
                  return (
                    <div
                      key={lvl}
                      style={{ width: `${pct}%` }}
                      className={`${color} h-full transition-all`}
                      title={`${lvl}: ${count} soal (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              {/* Bloom breakdown pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { lvl: "C1", label: "Mengingat", color: "text-blue-700 bg-blue-50 border-blue-200" },
                  { lvl: "C2", label: "Memahami", color: "text-blue-800 bg-blue-50 border-blue-200" },
                  { lvl: "C3", label: "Menerapkan", color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                  { lvl: "C4", label: "Menganalisis (HOTS)", color: "text-purple-700 bg-purple-50 border-purple-200 font-bold" },
                  { lvl: "C5", label: "Mengevaluasi (HOTS)", color: "text-purple-800 bg-purple-50 border-purple-200 font-bold" },
                  { lvl: "C6", label: "Mencipta (HOTS)", color: "text-purple-900 bg-purple-50 border-purple-200 font-bold" },
                ].map((item) => (
                  <span
                    key={item.lvl}
                    className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${item.color}`}
                  >
                    <strong>{item.lvl}</strong> {item.label}: {bloomCounts[item.lvl] || 0}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {/* AI Quality Audit Button */}
                <button
                  type="button"
                  id="btn-quality-audit-ai"
                  onClick={handleRunQualityAudit}
                  disabled={isAuditing}
                  className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Audit Kualitas Soal & Koreksi Pedagogis dengan AI (Distraktor, Kunci Dominan, HOTS, Negatif Ganda)"
                >
                  {isAuditing ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  )}
                  <span>{isAuditing ? "Mengaudit..." : "🔍 Audit Kualitas Soal (AI)"}</span>
                </button>

                {/* Save to Bank Soal */}
                <button
                  type="button"
                  id="btn-save-to-bank"
                  onClick={handleSaveBankClick}
                  className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4 text-blue-600" />
                  <span>Simpan ke Bank</span>
                </button>

                {/* Dedicated Kisi-Kisi Button */}
                <button
                  type="button"
                  id="btn-preview-kisi-kisi"
                  onClick={() => setIsKisiKisiModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-black rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                  title="Lihat & Unduh Kisi-Kisi Asesmen Lengkap dan Panduan Belajar Siswa"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Kisi-Kisi Soal
                    {selectedCount < questionSet.questions.length && (
                      <span className="ml-1 text-[11px] font-bold text-amber-700">({selectedCount})</span>
                    )}
                  </span>
                </button>

                {/* Export Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    id="btn-export-dropdown"
                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                    className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                  >
                    <FileDown className="w-4 h-4 text-slate-700" />
                    <span>Ekspor Naskah...</span>
                  </button>

                  {exportDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl card-shadow border border-slate-200 p-2 z-30 space-y-1">
                      {/* Kisi-Kisi PDF */}
                      <button
                        type="button"
                        onClick={() => {
                          exportKisiKisiPDF(getSelectedQuestionSet());
                          setExportDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-50 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="truncate">Unduh <strong>Kisi-Kisi Resmi (PDF - {selectedCount} Soal)</strong></span>
                      </button>

                      {/* Kisi-Kisi Word */}
                      <button
                        type="button"
                        onClick={() => {
                          exportKisiKisiWord(getSelectedQuestionSet());
                          setExportDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                        <span className="truncate">Unduh <strong>Kisi-Kisi (Word - {selectedCount} Soal)</strong></span>
                      </button>

                      <div className="h-px bg-slate-100 my-1" />

                      {/* Selected questions PDF */}
                      <button
                        type="button"
                        onClick={() => {
                          exportToPDF(getSelectedQuestionSet());
                          setExportDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="truncate">Unduh Naskah PDF (<strong>{selectedCount} Soal</strong>)</span>
                      </button>

                      {/* Selected questions Word */}
                      <button
                        type="button"
                        onClick={() => {
                          const text = exportToWordText(getSelectedQuestionSet());
                          downloadFile(`Naskah_Soal_${questionSet.subject}_Terpilih.doc`, text, "application/msword");
                          setExportDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-slate-800 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">Unduh Naskah Word (<strong>{selectedCount} Soal</strong>)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setViewMode("exam_paper");
                          setExportDropdownOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <Printer className="w-4 h-4 text-slate-600 shrink-0" />
                        <span className="truncate">Pratinjau Naskah Cetak Sekolah</span>
                      </button>

                      {/* Divider for Interchangeable / Mergeable File Formats */}
                      <div className="h-px bg-slate-100 my-1" />
                      <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Format Standar (Bisa Diimpor & Digabung)
                      </div>

                      {/* Export JSON Standard Format */}
                      <button
                        type="button"
                        onClick={() => {
                          const json = exportQuestionsToJSON(getSelectedQuestionSet());
                          const dateStr = new Date().toISOString().slice(0, 10);
                          downloadFile(`Paket_Soal_${(questionSet.subject || "Ujian").replace(/\s+/g, "_")}_${dateStr}.json`, json, "application/json");
                          setExportDropdownOpen(false);
                          setExportSuccessMessage("File format JSON berhasil diunduh! File ini dapat diimpor & digabungkan kembali kapan saja.");
                          setTimeout(() => setExportSuccessMessage(null), 5000);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-50 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <FileCode className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">Unduh <strong>Format JSON (.json)</strong> - Siap Digabung</span>
                      </button>

                      {/* Export CSV Excel Format */}
                      <button
                        type="button"
                        onClick={() => {
                          const csv = exportQuestionsToCSV(getSelectedQuestionSet());
                          const dateStr = new Date().toISOString().slice(0, 10);
                          downloadFile(`Paket_Soal_${(questionSet.subject || "Ujian").replace(/\s+/g, "_")}_${dateStr}.csv`, csv, "text/csv;charset=utf-8;");
                          setExportDropdownOpen(false);
                          setExportSuccessMessage("File format Excel (CSV) berhasil diunduh! Bisa diedit di Microsoft Excel atau diimpor kembali.");
                          setTimeout(() => setExportSuccessMessage(null), 5000);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-50 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">Unduh <strong>Format Excel (.csv)</strong> - Siap Digabung</span>
                      </button>

                      {/* Export Text Format */}
                      <button
                        type="button"
                        onClick={() => {
                          const txt = exportQuestionsToText(getSelectedQuestionSet());
                          const dateStr = new Date().toISOString().slice(0, 10);
                          downloadFile(`Paket_Soal_${(questionSet.subject || "Ujian").replace(/\s+/g, "_")}_${dateStr}.txt`, txt, "text/plain;charset=utf-8;");
                          setExportDropdownOpen(false);
                          setExportSuccessMessage("File format Teks Guru (.txt) berhasil diunduh!");
                          setTimeout(() => setExportSuccessMessage(null), 5000);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-blue-950 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-2.5"
                      >
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">Unduh <strong>Format Teks Guru (.txt)</strong></span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Import & Merge Questions Button */}
                <button
                  type="button"
                  id="btn-import-merge-questions"
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  title="Impor butir soal dari file atau gabungkan dari paket bank soal lain"
                >
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Impor & Gabung Soal</span>
                </button>

                {/* Add New Question Manual */}
                <button
                  type="button"
                  id="btn-add-question"
                  onClick={handleAddNewQuestionManual}
                  className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Soal</span>
                </button>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                Perubahan otomatis tersimpan ke Bank Soal
              </div>
            </div>

            {/* Duplicate Questions Alert with Auto-fix Button */}
            {duplicatePairs.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black text-amber-900 text-sm">
                      Terdeteksi {duplicatePairs.length} Butir Soal Serupa / Duplikat
                    </div>
                    <p className="text-amber-800 text-xs mt-0.5">
                      {duplicatePairs.map((dp) => `Soal No. ${dp.numA} & No. ${dp.numB}`).join(", ")} memiliki inti pertanyaan atau konsep yang hampir sama.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isFixingDuplicates}
                  onClick={handleFixAllDuplicates}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isFixingDuplicates ? "animate-spin" : ""}`} />
                  <span>{isFixingDuplicates ? "Mengganti..." : "Ganti Soal Duplikat Otomatis (AI)"}</span>
                </button>
              </div>
            )}

            {/* Validation Alert if any issue */}
            {validationIssues.length > 0 && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs space-y-2 font-medium">
                <div className="flex items-center gap-2 font-black text-sm text-amber-800 uppercase tracking-tight">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Beberapa butir soal belum lengkap:</span>
                </div>
                <ul className="list-disc pl-6 space-y-1">
                  {validationIssues.map((issue, i) => (
                    <li key={i}>
                      Soal No. {issue.questionNumber}: {issue.reason}
                    </li>
                  ))}
                </ul>
                <p className="font-bold text-amber-800 pt-1">
                  Silakan klik tombol "Edit" pada soal yang bermasalah sebelum membuat Google Form.
                </p>
              </div>
            )}
          </div>

          {/* QUESTION SELECTION & FILTER BAR */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 card-shadow border border-slate-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                      Seleksi Soal Ujian
                    </h3>
                    <span className={`px-2.5 py-0.5 font-black text-xs rounded-full border flex items-center gap-1.5 ${
                      selectedScore === 100
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-amber-50 text-amber-800 border-amber-300"
                    }`}>
                      {selectedScore === 100 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />}
                      <span>{selectedCount} / {totalQuestions} Soal Terpilih ({selectedScore} / 100 Poin)</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Sistem otomatis mengatur total <strong className="text-slate-800 font-bold">100 poin</strong> berbobot tingkat kesulitan (Mudah, Sedang, Sulit). Poin setiap soal tetap dapat diubah manual.
                  </p>
                </div>
              </div>

              {/* Quick Action Presets & Auto Balance Button */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleAutoBalancePoints}
                  className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  title="Hitung ulang otomatis pembagian 100 poin berdasarkan tingkat kesulitan (Mudah, Sedang, Sulit)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Setel Ulang 100 Poin</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                    selectedCount === totalQuestions
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  Pilih Semua ({totalQuestions})
                </button>

                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                    selectedCount === 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  Kosongkan (0)
                </button>

                {totalQuestions >= 20 && (
                  <button
                    type="button"
                    onClick={() => handleSelectFirstN(20)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                    title="Pilih 20 soal pertama (otomatis total 100 poin)"
                  >
                    20 Soal
                  </button>
                )}

                {totalQuestions >= 25 && (
                  <button
                    type="button"
                    onClick={() => handleSelectFirstN(25)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                    title="Pilih 25 soal pertama (otomatis total 100 poin)"
                  >
                    25 Soal
                  </button>
                )}

                {totalQuestions >= 30 && (
                  <button
                    type="button"
                    onClick={() => handleSelectFirstN(30)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                    title="Pilih 30 soal pertama (otomatis total 100 poin)"
                  >
                    30 Soal
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSelectOnlyHots}
                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                  title="Pilih hanya soal kategori HOTS / C4-C6 (otomatis total 100 poin)"
                >
                  HOTS Saja
                </button>
              </div>
            </div>

            {/* Custom N selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold">Pilih Sejumlah Soal Pertama:</span>
                <input
                  type="number"
                  min={1}
                  max={totalQuestions}
                  placeholder="Jml"
                  value={customSelectCount}
                  onChange={(e) => setCustomSelectCount(e.target.value)}
                  className="w-16 h-8 px-2 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = parseInt(customSelectCount, 10);
                    if (!isNaN(n) && n > 0) {
                      handleSelectFirstN(n);
                    }
                  }}
                  className="px-2.5 h-8 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg uppercase text-[11px] transition-colors"
                >
                  Terapkan
                </button>
              </div>

              <div className="flex items-center gap-3">
                {justAutoSavedSelection ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-300 animate-in fade-in duration-200 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Pilihan Soal Tersimpan Otomatis!</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Pilihan centang tersimpan otomatis & permanen</span>
                  </span>
                )}

                <div className="text-slate-500 font-medium hidden sm:block">
                  {selectedCount === 0 ? (
                    <span className="text-rose-600 font-bold">⚠️ Belum ada soal yang dipilih</span>
                  ) : (
                    <span>
                      <strong>{selectedCount}</strong> soal aktif untuk Google Form & Kisi-Kisi
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AI Quality Audit Banner */}
          {auditResult && showAuditBanner && (
            <QualityAuditBanner
              auditResult={auditResult}
              isAuditing={isAuditing}
              onReAudit={handleRunQualityAudit}
              onClose={() => setShowAuditBanner(false)}
              onApplyAllRevisions={handleApplyAllRevisions}
              unappliedCount={
                auditResult.questionAudits.filter(
                  (a) => a.hasIssue && a.improvedQuestion && !appliedRevisionNumbers.has(a.questionNumber)
                ).length
              }
            />
          )}

          {auditError && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{auditError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAuditError(null)}
                className="text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* List of Question Cards */}
          <div className="space-y-4">
            {questionSet.questions.map((q, idx) => {
              const isRegenerating = regeneratingIndex === idx;
              const isSelected = selectedNumbers.has(q.number);
              const isHots = ["C4", "C5", "C6"].includes(q.cognitiveLevel) || q.difficulty === "HOTS" || q.difficulty === "Sulit";

              return (
                <div
                  key={q.id || idx}
                  id={`question-card-${q.number}`}
                  className={`rounded-3xl p-6 sm:p-7 xl:p-8 card-shadow border transition-all space-y-5 sm:space-y-6 ${
                    isSelected
                      ? "bg-white border-slate-200 hover:border-blue-300 ring-1 ring-blue-500/20"
                      : "bg-slate-50/70 border-dashed border-slate-300 opacity-60 hover:opacity-90"
                  }`}
                >
                  {/* Question Selection Toggle Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                    <div 
                      onClick={() => handleToggleSelectQuestion(q.number)}
                      className="flex items-center gap-3 cursor-pointer select-none group"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectQuestion(q.number);
                        }}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-all ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                            : "bg-white border-slate-300 text-transparent hover:border-blue-400"
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>

                      <div className="flex items-center gap-2.5">
                        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs shrink-0">
                          {q.number < 10 ? `0${q.number}` : q.number}
                        </span>

                        <span className={`text-xs sm:text-sm font-black uppercase tracking-wider ${
                          isSelected ? "text-blue-700" : "text-slate-400 line-through"
                        }`}>
                          {isSelected ? "✓ Digunakan untuk Ujian" : "Dilewati (Tidak Dimasukkan ke Form)"}
                        </span>
                      </div>
                    </div>

                    {/* Badges Info */}
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider">
                      <span className={`px-3 py-1 rounded-full border ${
                        q.difficulty === "Mudah"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : q.difficulty === "Sedang"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        {q.difficulty}
                      </span>

                      <span className={`px-3 py-1 rounded-full border ${
                        isHots
                          ? "bg-purple-100 text-purple-800 border-purple-300 font-black"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}>
                        {q.cognitiveLevel} {isHots ? "• HOTS" : ""}
                      </span>

                      {/* Editable Points Badge */}
                      <div 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-xs sm:text-sm shadow-2xs"
                        title="Poin soal ini (dihitung otomatis sesuai kesulitan & dapat Anda ubah manual)"
                      >
                        <span className="text-xs uppercase text-amber-700 font-bold">Bobot:</span>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={q.points || 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            handleQuickChangePoints(q.number, isNaN(val) ? 1 : val);
                          }}
                          className="w-12 h-6 px-1 text-center font-black text-amber-950 bg-white border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-xs sm:text-sm"
                        />
                        <span className="text-xs font-bold text-amber-800">Poin</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-slate-500">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold border border-blue-200/80">
                        📚 Materi: {q.material || questionSet.material}
                      </span>
                      <span>
                        Indikator: <span className="font-semibold text-slate-700">{q.indicator || questionSet.material}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!q.imageUrl && (
                        <button
                          type="button"
                          disabled={imageGeneratingIndex === idx}
                          onClick={() => handleAutoAddImageToQuestion(q, idx)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors cursor-pointer"
                          title="Sematkan gambar stimulus otomatis dari AI"
                        >
                          <ImageIcon className={`w-4 h-4 ${imageGeneratingIndex === idx ? "animate-spin text-blue-600" : "text-blue-600"}`} />
                          <span>{imageGeneratingIndex === idx ? "Memuat..." : "+ Gambar (AI)"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleEditClick(q)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors cursor-pointer"
                        title="Edit butir soal ini (teks, opsi, kunci jawaban, skor, penjelasan)"
                      >
                        <Edit3 className="w-4 h-4 text-blue-600" />
                        <span>Edit Soal</span>
                      </button>

                      <button
                        type="button"
                        disabled={isRegenerating}
                        onClick={() => handleRegenerateSingle(q, idx)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors cursor-pointer"
                        title="Ganti soal ini dengan soal baru dari AI"
                      >
                        <RefreshCw className={`w-4 h-4 text-blue-600 ${isRegenerating ? "animate-spin" : ""}`} />
                        <span>
                          {isRegenerating ? "Membuat..." : "Generate Ulang"}
                        </span>
                      </button>

                      <button
                        type="button"
                        id={`btn-delete-q-${q.number}`}
                        onClick={() => {
                          if (questionSet.questions.length <= 1) {
                            setDeleteWarningToast("Paket soal minimal harus memiliki 1 butir pertanyaan.");
                            setTimeout(() => setDeleteWarningToast(null), 3000);
                          } else {
                            setDeletingQuestionNumber(q.number);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Hapus butir soal ini dari paket"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pedagogical Quality Audit Box */}
                  {auditResult && (
                    (() => {
                      const auditItem = auditResult.questionAudits.find(
                        (a) => a.questionNumber === q.number
                      );
                      if (!auditItem) return null;
                      return (
                        <QuestionAuditBox
                          auditItem={auditItem}
                          isApplied={appliedRevisionNumbers.has(q.number)}
                          onApplyRevision={() => handleApplySingleRevision(q.number)}
                        />
                      );
                    })()
                  )}

                  {/* Stimulus Visual Image (if present) */}
                  {q.imageUrl && (
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                          <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                            {q.imageCaption || "Stimulus / Ilustrasi Soal"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setZoomedImage({ url: q.imageUrl!, caption: q.imageCaption })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Perbesar Tampilan Gambar"
                          >
                            <ZoomIn className="w-4 h-4" />
                            <span>Perbesar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImageFromQuestion(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus Gambar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div 
                        onClick={() => setZoomedImage({ url: q.imageUrl!, caption: q.imageCaption })}
                        className="relative group rounded-xl overflow-hidden bg-white border border-slate-200 cursor-pointer max-h-72 flex items-center justify-center p-2"
                      >
                        <img
                          src={q.imageUrl}
                          alt={q.imageCaption || "Stimulus Soal"}
                          className="max-h-64 max-w-full object-contain rounded-lg group-hover:scale-[1.01] transition-transform"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="bg-slate-900/80 text-white text-xs sm:text-sm font-black px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg">
                            <ZoomIn className="w-4 h-4" />
                            Klik untuk Perbesar
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Question Text */}
                  <div className="text-slate-900 font-bold text-base sm:text-lg lg:text-xl leading-relaxed pl-1">
                    {q.question}
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {q.options.map((opt) => {
                      const isCorrect = opt.label === q.correctAnswer;

                      return (
                        <div
                          key={opt.label}
                          className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                            isCorrect
                              ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 ring-1 ring-emerald-400/40"
                              : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrect
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {opt.label}
                          </span>
                          <div className="flex-1 text-sm sm:text-base font-medium leading-relaxed pt-0.5">
                            {opt.text}
                          </div>
                          {isCorrect && (
                            <span className="text-xs font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-800 px-2.5 py-1 rounded-lg shrink-0">
                              Kunci
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation / Pembahasan */}
                  {q.explanation && (
                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs sm:text-sm text-slate-600 space-y-1.5">
                      <div className="flex items-center gap-2 font-black text-slate-700 uppercase tracking-wider text-xs sm:text-sm">
                        <HelpCircle className="w-4 h-4 text-blue-600" />
                        <span>Pembahasan Kunci Jawaban:</span>
                      </div>
                      <p className="leading-relaxed font-medium pl-6">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Floating/Persistent Summary Bar */}
          <div className="sticky bottom-6 z-30 bg-slate-900/95 backdrop-blur-md text-white rounded-3xl p-4 sm:p-5 card-shadow border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl w-full min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-xs sm:text-sm uppercase tracking-wider truncate flex items-center gap-2">
                  <span>{selectedCount} dari {totalQuestions} Soal Terpilih</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                    selectedScore === 100
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}>
                    {selectedScore} / 100 Poin
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
                  Siap dikonversi menjadi formulir kuis Google Forms interaktif.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAddNewQuestionManual}
                className="px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">Tambah Soal</span>
                <span className="sm:hidden">+ Soal</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchGoogleForm}
                disabled={selectedCount === 0 || validationIssues.length > 0}
                className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-black text-xs sm:text-sm text-white uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                  selectedCount === 0 || validationIssues.length > 0
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95"
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="truncate">Buat Google Form</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Question Modal */}
      <EditQuestionModal
        isOpen={editingQuestion !== null}
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        isNewQuestion={isNewQuestionModal}
        onSave={(updatedQ) => {
          if (isNewQuestionModal) {
            handleSaveNewQuestion(updatedQ);
          } else {
            handleSaveEditedQuestion(updatedQ);
          }
        }}
      />

      {/* Edit Package Info Modal */}
      <EditPackageInfoModal
        isOpen={isEditPackageModalOpen}
        questionSet={questionSet}
        onClose={() => setIsEditPackageModalOpen(false)}
        onSave={handleSavePackageMeta}
      />

      {/* In-App Confirmation Modal for Question Deletion */}
      <ConfirmModal
        isOpen={deletingQuestionNumber !== null}
        title="Hapus Butir Soal"
        message={
          deletingQuestionNumber !== null
            ? `Apakah Anda yakin ingin menghapus butir soal nomor ${deletingQuestionNumber}? Soal yang tersisa akan otomatis dinomori ulang.`
            : ""
        }
        confirmLabel="Ya, Hapus Soal"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={() => {
          if (deletingQuestionNumber !== null) {
            handleDeleteQuestionConfirm(deletingQuestionNumber);
          }
        }}
        onClose={() => setDeletingQuestionNumber(null)}
      />

      {/* Warning Toast */}
      {deleteWarningToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-rose-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold">{deleteWarningToast}</span>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-150 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-6 card-shadow border border-slate-200 space-y-3 cursor-default"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                {zoomedImage.caption || "Stimulus / Diagram Soal"}
              </span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[75vh] overflow-auto rounded-2xl bg-slate-50 p-2">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.caption || "Zoomed visual"}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-xs"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Kisi-Kisi Soal & Panduan Belajar Modal */}
      <KisiKisiModal
        isOpen={isKisiKisiModalOpen}
        onClose={() => setIsKisiKisiModalOpen(false)}
        questionSet={questionSet}
        initialSelectedNumbers={selectedNumbers}
        onSelectionChange={(newSelection) => {
          applyAndPersistSelection(newSelection);
        }}
      />

      {/* Import & Merge Questions Modal */}
      <ImportQuestionsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentQuestions={questionSet.questions}
        currentSetTitle={questionSet.title}
        userId={userId}
        onApplyQuestions={handleApplyImportedQuestions}
      />
    </div>
  );
};
