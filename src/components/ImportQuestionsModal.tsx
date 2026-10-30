import React, { useState, useRef, useMemo } from "react";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  ArrowRight,
  BookOpen,
  Filter,
  Check,
  Info
} from "lucide-react";
import type { Question, QuestionSet } from "../types.js";
import {
  parseQuestionsUniversal,
  mergeQuestions,
  exportQuestionsToJSON,
  getSampleJSONTemplate,
  getSampleCSVTemplate,
  getSampleTextTemplate,
  ParseResult
} from "../lib/questionFormatUtils.js";
import { downloadFile } from "../lib/exportUtils.js";
import { checkQuestionsDuplicate } from "../lib/questionDeduplicator.js";
import { getBankSoal } from "../lib/storage.js";

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuestions: Question[];
  currentSetTitle?: string;
  userId?: string | null;
  onApplyQuestions: (
    newQuestions: Question[],
    mode: "merge" | "replace",
    importedMeta?: {
      title?: string;
      subject?: string;
      grade?: string;
      semester?: string;
      material?: string;
    }
  ) => void;
}

export const ImportQuestionsModal: React.FC<ImportQuestionsModalProps> = ({
  isOpen,
  onClose,
  currentQuestions,
  currentSetTitle,
  userId,
  onApplyQuestions,
}) => {
  const [activeTab, setActiveTab] = useState<"file" | "paste" | "bank">("file");
  const [pastedText, setPastedText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [previewExpanded, setPreviewExpanded] = useState<boolean>(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [selectedBankSetId, setSelectedBankSetId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available bank soal packages (excluding current if possible)
  const availableBankSets = useMemo(() => {
    return isOpen ? getBankSoal(userId) : [];
  }, [userId, isOpen]);

  // Process file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = parseQuestionsUniversal(content, file.name);
        setParseResult(res);
      }
    };
    reader.readAsText(file);
  };

  // Process pasted text
  const handleParsePaste = () => {
    if (!pastedText.trim()) return;
    const res = parseQuestionsUniversal(pastedText);
    setParseResult(res);
  };

  // Process selection from Bank Soal
  const handleSelectBankSet = (setId: string) => {
    setSelectedBankSetId(setId);
    const found = availableBankSets.find((s) => s.id === setId);
    if (found && found.questions.length > 0) {
      setParseResult({
        success: true,
        format: "json",
        questions: found.questions,
        metadata: {
          title: found.title,
          subject: found.subject,
          grade: found.grade,
          semester: found.semester,
          material: found.material,
        },
      });
      setFileName(`Paket Bank Soal: ${found.title}`);
    }
  };

  // Compute duplicate analysis
  const duplicateAnalysis = useMemo(() => {
    if (!parseResult || !parseResult.success || parseResult.questions.length === 0) {
      return { duplicates: [], uniqueCount: 0 };
    }

    const duplicates: Array<{
      incomingIndex: number;
      incomingQuestion: string;
      existingNumber: number;
      existingQuestion: string;
      reason: string;
    }> = [];

    parseResult.questions.forEach((inQ, idx) => {
      for (const exQ of currentQuestions) {
        const check = checkQuestionsDuplicate(inQ, exQ);
        if (check.isDuplicate) {
          duplicates.push({
            incomingIndex: idx + 1,
            incomingQuestion: inQ.question,
            existingNumber: exQ.number,
            existingQuestion: exQ.question,
            reason: check.reason || "Topik dan konsep pertanyaan serupa",
          });
          break;
        }
      }
    });

    const uniqueCount = parseResult.questions.length - duplicates.length;
    return { duplicates, uniqueCount };
  }, [parseResult, currentQuestions]);

  // Execute Merge / Replace
  const handleConfirmApply = () => {
    if (!parseResult || !parseResult.success || parseResult.questions.length === 0) return;

    if (importMode === "merge") {
      const mergeRes = mergeQuestions(currentQuestions, parseResult.questions, {
        skipDuplicates,
      });
      onApplyQuestions(mergeRes.mergedQuestions, "merge", parseResult.metadata);
    } else {
      // Replace completely
      const renumbered = parseResult.questions.map((q, idx) => ({
        ...q,
        number: idx + 1,
        isSelected: true,
      }));
      onApplyQuestions(renumbered, "replace", parseResult.metadata);
    }

    onClose();
  };

  const incomingCount = parseResult?.questions?.length || 0;
  const willAddCount = skipDuplicates
    ? duplicateAnalysis.uniqueCount
    : incomingCount;
  const finalTotalCount = importMode === "merge"
    ? currentQuestions.length + willAddCount
    : incomingCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl card-shadow border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-black uppercase tracking-wider mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Impor & Penggabungan Soal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Impor & Gabungkan Butir Soal
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Tambahkan atau satukan butir soal dari file cadangan khusus (JSON, CSV, atau Teks Guru) ke dalam naskah ini.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Top Bar: Tabs & Download Template */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("file")}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "file"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah File</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("paste")}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "paste"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Tempel Teks</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("bank")}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "bank"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Dari Bank Soal ({availableBankSets.length})</span>
              </button>
            </div>

            {/* Download Templates Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Unduh Format Template...</span>
              </button>

              {templateDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl card-shadow border border-slate-200 p-2 z-20 space-y-1">
                  <div className="px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Pilihan Format Contoh
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadFile("template_soal_standar.json", getSampleJSONTemplate(), "application/json");
                      setTemplateDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <FileCode className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Template JSON (.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadFile("template_soal_excel.csv", getSampleCSVTemplate(), "text/csv;charset=utf-8;");
                      setTemplateDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Template Excel (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadFile("template_soal_teks.txt", getSampleTextTemplate(), "text/plain;charset=utf-8;");
                      setTemplateDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Template Teks Guru (.txt)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TAB 1: FILE UPLOAD */}
          {activeTab === "file" && (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json,.csv,.txt"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-2xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    {fileName ? (
                      <span className="text-blue-700 font-black">File Terpilih: {fileName}</span>
                    ) : (
                      "Klik atau Seret File Soal ke Sini"
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Mendukung file format <strong>.json</strong> (ekspor standar), <strong>.csv</strong> (Excel), dan <strong>.txt</strong> (Teks Guru)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-xs"
                >
                  Pilih File dari Komputer
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PASTE TEXT */}
          {activeTab === "paste" && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Tempelkan Teks Soal atau Konten JSON di Bawah Ini:
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={`Contoh Teks:\n1. Bagian sel yang berfungsi mengatur kegiatan sel adalah...\nA. Nukleus\nB. Sitoplasma\nC. Ribosom\nD. Mitokondria\nKunci: A\nPembahasan: Nukleus adalah pengendali aktivitas sel.\n\nAtau tempelkan kode format JSON langsung.`}
                className="w-full h-44 p-3.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPastedText("")}
                  disabled={!pastedText}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
                >
                  Bersihkan
                </button>
                <button
                  type="button"
                  onClick={handleParsePaste}
                  disabled={!pastedText.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
                >
                  Proses & Periksa Soal
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: FROM BANK SOAL */}
          {activeTab === "bank" && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Pilih Paket Soal Lain dari Bank Soal Anda untuk Digabungkan:
              </label>

              {availableBankSets.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                  Belum ada paket soal tersimpan di Bank Soal. Silakan buat atau impor file naskah soal terlebih dahulu.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {availableBankSets.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => handleSelectBankSet(pkg.id)}
                      className={`text-left p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                        selectedBankSetId === pkg.id
                          ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/30"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {pkg.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {pkg.subject} • Kelas {pkg.grade}
                        </div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">
                          {pkg.questions.length} Butir Soal
                        </div>
                      </div>
                      {selectedBankSetId === pkg.id && (
                        <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PARSE RESULT STATUS & PREVIEW */}
          {parseResult && (
            <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
              {parseResult.success ? (
                <div className="space-y-4">
                  {/* Success Banner */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-950">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-black text-sm">
                          Berhasil Membaca {incomingCount} Butir Soal ({parseResult.format.toUpperCase()})
                        </div>
                        {parseResult.metadata?.title && (
                          <div className="text-xs text-emerald-800 font-medium">
                            Judul: {parseResult.metadata.title} {parseResult.metadata.subject ? `• ${parseResult.metadata.subject}` : ""}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewExpanded(!previewExpanded)}
                      className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                    >
                      {previewExpanded ? "Tutup Pratinjau" : "Lihat Butir Soal"}
                    </button>
                  </div>

                  {/* Duplicate Analysis Alert */}
                  {duplicateAnalysis.duplicates.length > 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 space-y-2.5">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-black text-sm text-amber-900">
                            Terdeteksi {duplicateAnalysis.duplicates.length} Butir Soal Duplikat / Serupa
                          </div>
                          <p className="text-xs text-amber-800 mt-0.5">
                            Sebagian soal yang diimpor memiliki pertanyaan atau konsep yang sama dengan soal yang sudah ada di naskah saat ini.
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-2.5 p-2 bg-white/70 border border-amber-200 rounded-xl cursor-pointer text-xs font-bold text-amber-900">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500"
                        />
                        <span>
                          Lewati butir soal duplikat (Hanya tambahkan <strong>{duplicateAnalysis.uniqueCount} butir unik</strong>)
                        </span>
                      </label>

                      <div className="text-[11px] text-amber-800/90 pl-1">
                        Contoh: Soal Baru #{duplicateAnalysis.duplicates[0].incomingIndex} serupa dengan Soal Saat Ini #{duplicateAnalysis.duplicates[0].existingNumber} ({duplicateAnalysis.duplicates[0].reason})
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-blue-900">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Semua {incomingCount} butir soal baru ini unik dan belum ada di naskah saat ini!
                      </span>
                    </div>
                  )}

                  {/* Expandable Question Preview List */}
                  {previewExpanded && (
                    <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50 max-h-60 overflow-y-auto space-y-2">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">
                        Daftar Butir Soal yang Diimpor ({incomingCount} Soal):
                      </div>
                      {parseResult.questions.map((q, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-slate-800">
                              #{idx + 1}. {q.question.slice(0, 100)}...
                            </span>
                            <span className="shrink-0 px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md text-[10px]">
                              Kunci: {q.correctAnswer} | {q.options.length} Opsi
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mode Selection: MERGE vs REPLACE */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Pilih Tindakan Penggabungan:
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: MERGE (Recommended) */}
                      <label
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                          importMode === "merge"
                            ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-400/30"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === "merge"}
                              onChange={() => setImportMode("merge")}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-black text-slate-900 text-xs">
                              Gabungkan ke Naskah Saat Ini
                            </span>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-black rounded-md text-[10px] uppercase tracking-wider">
                            Rekomendasi
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                          Menambahkan <strong>+{willAddCount} soal</strong> ke <strong>{currentQuestions.length} soal</strong> yang ada. Total naskah menjadi <strong>{finalTotalCount} butir soal</strong>. Nomor urut otomatis dilanjutkan.
                        </p>
                      </label>

                      {/* Option 2: REPLACE */}
                      <label
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                          importMode === "replace"
                            ? "bg-amber-50/90 border-amber-500 ring-2 ring-amber-400/30"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === "replace"}
                            onChange={() => setImportMode("replace")}
                            className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-black text-slate-900 text-xs">
                            Ganti / Timpa Seluruh Soal
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 pl-6 leading-relaxed">
                          Menghapus butir soal saat ini dan menggantikannya sepenuhnya dengan <strong>{incomingCount} butir soal</strong> dari file impor ini.
                        </p>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-2 text-rose-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Gagal Memproses File</span>
                  </div>
                  {parseResult.errors?.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                  <div className="pt-2 text-rose-700">
                    Silakan gunakan tombol "Unduh Format Template" di atas untuk memastikan format file sesuai standar.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {currentQuestions.length > 0 ? (
              <span>Naskah saat ini: <strong>{currentQuestions.length} butir soal</strong></span>
            ) : (
              <span>Naskah saat ini kosong</span>
            )}
            {parseResult?.success && (
              <span className="ml-2 font-bold text-blue-600">
                → Setelah penggabungan: {finalTotalCount} butir soal
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={!parseResult?.success || parseResult.questions.length === 0}
              onClick={handleConfirmApply}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                {importMode === "merge"
                  ? `Gabungkan (+${willAddCount} Soal)`
                  : `Ganti Semua (${incomingCount} Soal)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
