import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  FileDown,
  FileText,
  Printer,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  GraduationCap,
  Layers,
  Brain,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  SlidersHorizontal,
  Search,
  School,
  CheckSquare,
  Square,
  Filter,
  ListFilter
} from "lucide-react";
import type { QuestionSet } from "../types.js";
import { formatGradeDisplay, cleanExamTitle } from "../lib/classUtils.js";
import { applyAutoPointsToQuestionSet } from "../lib/pointDistributor.js";
import {
  getFormattedKisiKisiItems,
  exportKisiKisiPDF,
  exportKisiKisiWord,
  exportKisiKisiText,
  printSmartLayoutKisiKisi,
  type FormattedKisiKisiItem
} from "../lib/kisiKisiUtils.js";
import { getAppSettings } from "../lib/storage.js";
import { GridTemplate } from "./GridTemplate.js";

interface KisiKisiModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionSet: QuestionSet | null;
  initialSelectedNumbers?: Set<number> | number[];
  onSelectionChange?: (selectedNumbers: Set<number>) => void;
}

export const KisiKisiModal: React.FC<KisiKisiModalProps> = ({
  isOpen,
  onClose,
  questionSet,
  initialSelectedNumbers,
  onSelectionChange,
}) => {
  const [viewMode, setViewMode] = useState<"official_table" | "student_guide">("official_table");
  const [copiedToast, setCopiedToast] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCognitiveFilter, setSelectedCognitiveFilter] = useState<string>("ALL");
  const [isQuestionListOpen, setIsQuestionListOpen] = useState(false);
  const [customCountInput, setCustomCountInput] = useState<string>("30");

  // Selection state for questions included in Kisi-Kisi
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());

  // Sync selected numbers whenever modal opens or questionSet/initial selection changes
  useEffect(() => {
    if (!questionSet) return;

    if (initialSelectedNumbers !== undefined) {
      setSelectedNumbers(new Set(initialSelectedNumbers));
      return;
    }
    if (Array.isArray(questionSet.selectedQuestionNumbers)) {
      setSelectedNumbers(new Set(questionSet.selectedQuestionNumbers));
      return;
    }
    const hasFlags = questionSet.questions.some((q) => q.isSelected !== undefined);
    if (hasFlags) {
      const filtered = questionSet.questions.filter((q) => q.isSelected !== false).map((q) => q.number);
      setSelectedNumbers(new Set(filtered));
      return;
    }
    // Default to all available questions in this set
    setSelectedNumbers(new Set(questionSet.questions.map((q) => q.number)));
  }, [questionSet?.id, isOpen, initialSelectedNumbers]);

  if (!isOpen || !questionSet) return null;

  const settings = getAppSettings();
  const cleanTitle = cleanExamTitle(questionSet.title);
  const totalAvailable = questionSet.questions.length;

  // Filter and renumber selected questions consecutively (1..N) for official kisi-kisi document
  // Pastikan poin setiap butir soal terpilih berbobot tingkat kesulitan dengan akumulasi total 100 poin
  const balancedQuestions = applyAutoPointsToQuestionSet(questionSet.questions, selectedNumbers, 100);
  const selectedQuestions = balancedQuestions
    .filter((q) => selectedNumbers.has(q.number))
    .map((q, idx) => ({
      ...q,
      number: idx + 1,
      isSelected: true,
    }));

  const selectedCount = selectedQuestions.length;
  const calculatedPoints = selectedQuestions.reduce((sum, q) => sum + (q.points || 1), 0);

  // Active QuestionSet for rendering, printing, and exporting
  const activeQuestionSet: QuestionSet = {
    ...questionSet,
    questions: selectedQuestions,
    selectedQuestionNumbers: selectedQuestions.map((q) => q.number),
    totalPoints: calculatedPoints > 0 ? calculatedPoints : 100,
  };

  // Formatted Kisi-Kisi items based STRICTLY on the selected questions
  const items = getFormattedKisiKisiItems(activeQuestionSet);

  // Statistics calculation for selected questions
  const totalQuestions = items.length;
  const totalPoints = calculatedPoints;

  const bloomCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.cognitiveLevel] = (acc[item.cognitiveLevel] || 0) + 1;
    return acc;
  }, {});

  const hotsCount = items.filter((item) => item.cognitiveCategory === "HOTS").length;
  const hotsPercent = totalQuestions > 0 ? Math.round((hotsCount / totalQuestions) * 100) : 0;

  const difficultyCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.difficulty] = (acc[item.difficulty] || 0) + 1;
    return acc;
  }, { Mudah: 0, Sedang: 0, Sulit: 0 });

  // Filtered items for display (search & cognitive filters)
  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.indicator.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.material.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.studyTip.toLowerCase().includes(searchFilter.toLowerCase()) ||
      String(item.questionNumber).includes(searchFilter);
    const matchCog =
      selectedCognitiveFilter === "ALL" ||
      item.cognitiveLevel === selectedCognitiveFilter ||
      item.cognitiveCategory === selectedCognitiveFilter;
    return matchSearch && matchCog;
  });

  const updateSelection = (next: Set<number>) => {
    setSelectedNumbers(next);
    if (onSelectionChange) {
      onSelectionChange(next);
    }
  };

  // Toggle selection for a single question (by its original question number)
  const handleToggleQuestion = (questionNum: number) => {
    const next = new Set<number>(selectedNumbers);
    if (next.has(questionNum)) {
      next.delete(questionNum);
    } else {
      next.add(questionNum);
    }
    updateSelection(next);
  };

  // Select all available questions
  const handleSelectAll = () => {
    updateSelection(new Set<number>(questionSet.questions.map((q) => q.number)));
  };

  // Deselect all
  const handleDeselectAll = () => {
    updateSelection(new Set<number>());
  };

  // Quick select first N questions (e.g. 20, 30, 40)
  const handleSelectFirstN = (n: number) => {
    const targetCount = Math.min(Math.max(1, n), questionSet.questions.length);
    const targetQuestions = questionSet.questions.slice(0, targetCount);
    updateSelection(new Set<number>(targetQuestions.map((q) => q.number)));
  };

  // Select HOTS questions only
  const handleSelectHotsOnly = () => {
    const hotsNumbers = questionSet.questions
      .filter((q) => ["C4", "C5", "C6"].includes(q.cognitiveLevel?.toUpperCase() || ""))
      .map((q) => q.number);
    updateSelection(new Set<number>(hotsNumbers));
  };

  const handleApplyCustomCount = () => {
    const val = parseInt(customCountInput, 10);
    if (!isNaN(val) && val > 0) {
      handleSelectFirstN(val);
    }
  };

  const handleCopyText = async () => {
    if (selectedCount === 0) return;
    try {
      const text = exportKisiKisiText(activeQuestionSet);
      await navigator.clipboard.writeText(text);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-5xl xl:max-w-7xl 2xl:max-w-[1500px] w-full max-h-[94vh] flex flex-col card-elevation-high border border-slate-200 overflow-hidden relative my-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* MODAL HEADER                                                              */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 pb-4 border-b border-slate-200 bg-slate-900 text-white shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white shadow-md shadow-blue-500/30 border border-blue-400/30 shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-black text-[10px] sm:text-xs uppercase tracking-wider rounded-md border border-blue-400/30">
                  {questionSet.subject}
                </span>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-300">
                  {formatGradeDisplay(questionSet.grade)} • Semester {questionSet.semester || "1"}
                </span>
                <span className="hidden md:inline-block text-[11px] text-slate-400">•</span>
                <span className="text-[11px] sm:text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/30">
                  {selectedCount} dari {totalAvailable} Soal Terpilih ({totalPoints} Poin)
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-white uppercase tracking-tight truncate max-w-xl">
                Kisi-Kisi Soal: {cleanTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tutup Jendela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* QUESTION SELECTION & FILTER CONTROL BAR                                   */}
        {/* ========================================================================= */}
        <div className="px-4 sm:px-6 py-2.5 bg-amber-50/80 border-b border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs uppercase tracking-wide">
              <Filter className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Pilih Soal Kisi-Kisi:</span>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-black shadow-xs">
              <CheckSquare className="w-3.5 h-3.5" />
              {selectedCount} / {totalAvailable} Soal
            </span>

            {selectedCount < totalAvailable && (
              <span className="text-[11px] font-bold text-amber-800 hidden lg:inline">
                (Kisi-kisi yang diunduh hanya memuat {selectedCount} soal ini)
              </span>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Quick Preset: All */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                selectedCount === totalAvailable
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 hover:bg-slate-100 border-slate-300"
              }`}
              title="Pilih seluruh butir soal"
            >
              Semua ({totalAvailable})
            </button>

            {/* Quick Presets (20, 30, 40) */}
            {totalAvailable >= 20 && (
              <button
                type="button"
                onClick={() => handleSelectFirstN(20)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedCount === 20
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-slate-300"
                }`}
                title="Pilih 20 soal pertama"
              >
                Pilih 20
              </button>
            )}

            {totalAvailable >= 30 && (
              <button
                type="button"
                onClick={() => handleSelectFirstN(30)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedCount === 30
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-slate-300"
                }`}
                title="Pilih 30 soal pertama"
              >
                Pilih 30
              </button>
            )}

            {totalAvailable >= 40 && (
              <button
                type="button"
                onClick={() => handleSelectFirstN(40)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  selectedCount === 40
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-slate-300"
                }`}
                title="Pilih 40 soal pertama"
              >
                Pilih 40
              </button>
            )}

            {/* Custom N input */}
            <div className="flex items-center bg-white rounded-lg border border-slate-300 overflow-hidden">
              <input
                type="number"
                min={1}
                max={totalAvailable}
                value={customCountInput}
                onChange={(e) => setCustomCountInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyCustomCount()}
                className="w-12 px-1.5 py-1 text-xs font-bold text-center text-slate-800 focus:outline-hidden"
                title="Ketik jumlah soal yang ingin dipilih"
              />
              <button
                type="button"
                onClick={handleApplyCustomCount}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[11px] font-black text-slate-700 border-l border-slate-200 transition-colors"
                title="Terapkan jumlah soal terpilih"
              >
                Pilih
              </button>
            </div>

            {/* HOTS Only */}
            <button
              type="button"
              onClick={handleSelectHotsOnly}
              className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Pilih hanya butir soal berkategori HOTS"
            >
              HOTS Saja
            </button>

            {/* Toggle Individual Question Grid */}
            <button
              type="button"
              onClick={() => setIsQuestionListOpen(!isQuestionListOpen)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Buka daftar checklist nomor butir soal satu per satu"
            >
              <ListFilter className="w-3.5 h-3.5 text-slate-600" />
              <span>{isQuestionListOpen ? "Tutup Butir" : "Pilih Butir"}</span>
            </button>

            {selectedCount > 0 && selectedCount < totalAvailable && (
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 underline px-1 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Expandable Checklist Grid of All Individual Question Numbers */}
        {isQuestionListOpen && (
          <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 animate-in fade-in slide-in-from-top-1 duration-150 shrink-0 max-h-40 overflow-y-auto">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-bold text-slate-700">
                Centang nomor butir soal yang ingin dimasukkan ke dalam Kisi-Kisi:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-blue-600 hover:underline"
                >
                  Centang Semua
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {questionSet.questions.map((q) => {
                const isSelected = selectedNumbers.has(q.number);
                const isHots = ["C4", "C5", "C6"].includes(q.cognitiveLevel?.toUpperCase() || "");
                return (
                  <button
                    key={q.number}
                    type="button"
                    onClick={() => handleToggleQuestion(q.number)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200"
                    }`}
                    title={`Soal #${q.number}: ${q.cognitiveLevel || "C2"} (${q.difficulty || "Sedang"}) - ${q.question.slice(0, 50)}...`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    <span>No. {q.number}</span>
                    <span className={`text-[10px] px-1 rounded ${isSelected ? "bg-blue-700 text-blue-100" : "bg-slate-200 text-slate-600"}`}>
                      {q.cognitiveLevel || "C2"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUB-HEADER & DOWNLOAD ACTION TOOLBAR                                      */}
        {/* ========================================================================= */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* View Mode Toggle: Official Table vs Student Guide */}
          <div className="flex items-center gap-1 bg-slate-200/90 p-1 rounded-2xl w-full sm:w-auto border border-slate-300 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("official_table")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === "official_table"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Format Matriks Guru</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("student_guide")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                viewMode === "student_guide"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">Panduan Belajar Siswa</span>
            </button>
          </div>

          {/* Download & Export Buttons (Operates STRICTLY on Active Selected Questions) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Smart Layout Print / Save to PDF */}
            <button
              type="button"
              id="btn-print-smart-layout"
              disabled={selectedCount === 0}
              onClick={() => printSmartLayoutKisiKisi(activeQuestionSet)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wide shadow-xs transition-all ${
                selectedCount === 0
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-95"
              }`}
              title={`Cetak Kisi-Kisi untuk ${selectedCount} butir soal terpilih`}
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Cetak ({selectedCount} Soal)</span>
            </button>

            {/* Download PDF Kisi-Kisi */}
            <button
              type="button"
              id="btn-download-kisi-kisi-pdf"
              disabled={selectedCount === 0}
              onClick={() => exportKisiKisiPDF(activeQuestionSet)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wide shadow-xs transition-all ${
                selectedCount === 0
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-500 text-white cursor-pointer active:scale-95"
              }`}
              title={`Unduh PDF Kisi-Kisi untuk ${selectedCount} butir soal terpilih`}
            >
              <FileDown className="w-4 h-4" />
              <span>Unduh PDF ({selectedCount} Soal)</span>
            </button>

            {/* Download Word (.doc) Kisi-Kisi */}
            <button
              type="button"
              id="btn-download-kisi-kisi-word"
              disabled={selectedCount === 0}
              onClick={() => exportKisiKisiWord(activeQuestionSet)}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wide shadow-xs transition-all ${
                selectedCount === 0
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95"
              }`}
              title={`Unduh Word .doc Kisi-Kisi untuk ${selectedCount} butir soal terpilih`}
            >
              <FileText className="w-4 h-4" />
              <span>Unduh Word ({selectedCount} Soal)</span>
            </button>

            {/* Copy text */}
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={handleCopyText}
              className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCount === 0
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer active:scale-95"
              }`}
              title="Salin Teks Kisi-Kisi ke Clipboard"
            >
              {copiedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Salin</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODAL BODY (SCROLLABLE CONTENT)                                           */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 min-h-0 bg-slate-50/50">
          
          {/* STATISTICAL SUMMARY & TAXONOMY BAR */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Distribusi Kognitif & Tingkat Kesukaran
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md border border-purple-200">
                  HOTS: {hotsCount} Soal ({hotsPercent}%)
                </span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                  LOTS/MOTS: {totalQuestions - hotsCount} Soal ({100 - hotsPercent}%)
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                  Mudah: {difficultyCounts.Mudah || 0} | Sedang: {difficultyCounts.Sedang || 0} | Sulit: {difficultyCounts.Sulit || 0}
                </span>
              </div>
            </div>

            {/* Cognitive Visual Bar */}
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
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
                    title={`${lvl}: ${count} butir (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>

            {/* Bloom Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              {[
                { lvl: "C1", name: "Mengingat" },
                { lvl: "C2", name: "Memahami" },
                { lvl: "C3", name: "Menerapkan" },
                { lvl: "C4", name: "Menganalisis (HOTS)" },
                { lvl: "C5", name: "Mengevaluasi (HOTS)" },
                { lvl: "C6", name: "Mencipta (HOTS)" },
              ].map((item) => {
                const count = bloomCounts[item.lvl] || 0;
                const isHots = ["C4", "C5", "C6"].includes(item.lvl);
                return (
                  <button
                    key={item.lvl}
                    type="button"
                    onClick={() => setSelectedCognitiveFilter(selectedCognitiveFilter === item.lvl ? "ALL" : item.lvl)}
                    className={`px-2 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                      selectedCognitiveFilter === item.lvl
                        ? "bg-slate-900 text-white border-slate-900 ring-2 ring-blue-400"
                        : isHots
                        ? "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
                        : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <strong>{item.lvl}</strong> {item.name}: {count}
                  </button>
                );
              })}
              {selectedCognitiveFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setSelectedCognitiveFilter("ALL")}
                  className="text-xs text-blue-600 font-bold underline pl-1 cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* SEARCH & FILTER BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari target kompetensi, indikator, materi, atau panduan belajar..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 flex items-center justify-between sm:justify-end gap-2 px-1">
              <span>Menampilkan: {filteredItems.length} dari {totalQuestions} Soal</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* VIEW MODE 1: OFFICIAL TABLE MATRIX (CSS GRID TEMPLATE ARCHITECTURE)       */}
          {/* ========================================================================= */}
          {viewMode === "official_table" && (
            <div className="space-y-4">
              {selectedCount === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                    <Filter className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Belum Ada Butir Soal yang Dipilih
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Silakan klik tombol <strong>"Semua ({totalAvailable})"</strong>, <strong>"Pilih 30"</strong>, atau centang nomor butir soal pada bilah di atas untuk menyusun kisi-kisi asesmen.
                  </p>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Pilih Semua ({totalAvailable} Soal)
                  </button>
                </div>
              ) : (
                <GridTemplate
                  questionSet={activeQuestionSet}
                  filteredItems={filteredItems}
                  showKop={true}
                  showSignatures={true}
                  showStats={false} // Stats are already shown in the top analytics bar of the modal
                  showToolbar={false}
                />
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW MODE 2: STUDENT STUDY GUIDE (INTUITIVE & ACTIONABLE FOR STUDENTS)   */}
          {/* ========================================================================= */}
          {viewMode === "student_guide" && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-black text-emerald-900 uppercase tracking-tight">
                    Petunjuk Belajar Mandiri Bagi Siswa
                  </h4>
                  <p className="text-emerald-800 leading-relaxed font-medium">
                    Gunakan kartu di bawah ini untuk membantumu belajar sebelum ujian. Pahami konsep utama di setiap nomor soal dan cermati soal bertanda <strong>HOTS</strong> untuk melatih logika berpikirmu.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredItems.map((item) => {
                  const isHots = item.cognitiveCategory === "HOTS";
                  return (
                    <div
                      key={item.no}
                      className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all card-shadow space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-black text-[12px] rounded-full border border-blue-200">
                            Butir Materi #{item.no}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                isHots
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}
                            >
                              {item.cognitiveLevel} • {item.cognitiveCategory}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                item.difficulty === "Mudah"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : item.difficulty === "Sedang"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {item.difficulty}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-tight">
                            Indikator / Target Soal:
                          </h4>
                          <p className="text-[12px] text-slate-700 font-semibold leading-relaxed mt-0.5">
                            {item.indicator}
                          </p>
                        </div>

                        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 space-y-1">
                          <span className="text-[12px] font-black text-blue-800 uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Panduan Belajar Siswa:
                          </span>
                          <p className="text-[12px] text-slate-800 leading-relaxed font-medium">
                            {item.studyTip}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[12px] font-bold text-slate-500">
                        <span>Materi: {item.material}</span>
                        <span>Bobot: {item.points} Poin</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER                                                              */}
        {/* ========================================================================= */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
            Satuan Pendidikan: <span className="font-bold text-slate-700">{settings.schoolName}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2 bg-white hover:bg-slate-200 text-slate-800 font-black rounded-xl text-xs uppercase tracking-wider border border-slate-300 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
