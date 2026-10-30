import React, { useState, useRef } from "react";
import { 
  BookOpen, 
  Search, 
  Filter, 
  Sparkles, 
  Trash2, 
  Copy, 
  FileDown, 
  Plus, 
  Eye, 
  ArrowRight,
  Layers,
  Calendar,
  CheckCircle,
  FileText,
  Edit3,
  ListChecks,
  CheckSquare,
  FileSpreadsheet,
  GraduationCap,
  RefreshCw,
  Cloud,
  Upload,
  Download,
  AlertCircle,
  LogIn,
  Check,
  HelpCircle
} from "lucide-react";
import type { QuestionSet, Question } from "../types.js";
import { exportToPDF, exportToWordText, downloadFile, exportKisiKisiPDF, exportKisiKisiWord } from "../lib/exportUtils.js";
import { ConfirmModal } from "./ConfirmModal.js";
import { KisiKisiModal } from "./KisiKisiModal.js";
import { formatGradeDisplay, cleanGrade, cleanExamTitle } from "../lib/classUtils.js";
import { 
  saveToBankSoal, 
  saveSelectedQuestions, 
  getSavedSelectedQuestions,
  exportBankSoalToJSON,
  importBankSoalFromJSON,
  getBankSoal
} from "../lib/storage.js";
import { applyAutoPointsToQuestionSet } from "../lib/pointDistributor.js";
import { parseQuestionsUniversal, mergeQuestions } from "../lib/questionFormatUtils.js";

interface QuestionBankProps {
  questionSets: QuestionSet[];
  onSelectSet: (set: QuestionSet) => void;
  onDeleteSet: (id: string) => void;
  onDuplicateSet: (set: QuestionSet) => void;
  onCreateGoogleFormDirect: (set: QuestionSet) => void;
  onNavigateToCreate: () => void;
  onSaveSet?: (set: QuestionSet) => void;
  userId?: string | null;
  userEmail?: string | null;
  onSwitchAccount?: () => void;
  onConnectGoogle?: () => void;
  onManualSync?: () => Promise<void>;
  onRefreshBank?: (sets: QuestionSet[]) => void;
}

export const QuestionBank: React.FC<QuestionBankProps> = ({
  questionSets,
  onSelectSet,
  onDeleteSet,
  onDuplicateSet,
  onCreateGoogleFormDirect,
  onNavigateToCreate,
  onSaveSet,
  userId,
  userEmail,
  onSwitchAccount,
  onConnectGoogle,
  onManualSync,
  onRefreshBank,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [deletingSet, setDeletingSet] = useState<QuestionSet | null>(null);
  const [viewingKisiKisiSet, setViewingKisiKisiSet] = useState<QuestionSet | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);
  const [showSyncGuide, setShowSyncGuide] = useState(false);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [isMerging, setIsMerging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger manual sync
  const handleTriggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusText("Sedang menyinkronkan data dengan Cloud...");
    try {
      if (onManualSync) {
        await onManualSync();
      }
      setSyncStatusText("Sinkronisasi selesai! Bank soal terbaru telah dimuat.");
      setTimeout(() => setSyncStatusText(null), 4000);
    } catch (e: any) {
      setSyncStatusText(`Gagal: ${e?.message || "Kesalahan jaringan"}`);
      setTimeout(() => setSyncStatusText(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Export JSON Backup
  const handleExportJSON = () => {
    const jsonStr = exportBankSoalToJSON(userId);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(jsonStr, `Bank_Soal_${dateStr}.json`, "application/json");
  };

  // Import JSON / CSV / TXT File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        const isJson = file.name.toLowerCase().endsWith(".json");
        if (isJson) {
          const res = await importBankSoalFromJSON(text, userId);
          if (res.success) {
            if (onRefreshBank) {
              onRefreshBank(getBankSoal(userId));
            }
            setSyncStatusText(res.message);
            setTimeout(() => setSyncStatusText(null), 5000);
            return;
          }
        }

        // CSV, TXT, or single package format fallback
        const parsed = parseQuestionsUniversal(text, file.name);
        if (parsed.success && parsed.questions.length > 0) {
          const newSet: QuestionSet = {
            id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            userId: userId || undefined,
            title: cleanExamTitle(parsed.metadata?.title || `Naskah Impor ${file.name.replace(/\.[^/.]+$/, "")}`),
            subject: parsed.metadata?.subject || "Umum",
            grade: cleanGrade(parsed.metadata?.grade || "X"),
            semester: parsed.metadata?.semester || "1",
            material: parsed.metadata?.material || "",
            questions: parsed.questions,
            totalPoints: parsed.questions.reduce((acc, q) => acc + (q.points || 1), 0),
            createdAt: new Date().toISOString(),
            onlyFromMaterial: true,
          };
          saveToBankSoal(newSet, userId);
          if (onRefreshBank) {
            onRefreshBank(getBankSoal(userId));
          }
          setSyncStatusText(`Berhasil mengimpor ${parsed.questions.length} butir soal dari ${file.name}!`);
          setTimeout(() => setSyncStatusText(null), 5000);
        } else {
          alert(parsed.errors?.join("\n") || "Gagal mengimpor file. Format tidak dikenali.");
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      alert(`Gagal mengimpor file: ${err?.message || "Format tidak didukung"}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Merge selected question sets into one comprehensive exam set
  const handleMergeSelectedSets = () => {
    const selectedSets = questionSets.filter((s) => selectedSetIds.has(s.id));
    if (selectedSets.length < 2) return;

    let mergedQuestions: Question[] = [];
    selectedSets.forEach((pkg) => {
      const res = mergeQuestions(mergedQuestions, pkg.questions, { skipDuplicates: true });
      mergedQuestions = res.mergedQuestions;
    });

    const firstSet = selectedSets[0];
    const combinedTitle = `Naskah Gabungan: ${selectedSets.map((s) => s.title.replace(/^asesmen sumatif\s*/i, "").slice(0, 25)).join(" + ")}`;

    const newMergedSet: QuestionSet = {
      id: `set_merged_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: userId || undefined,
      title: cleanExamTitle(combinedTitle),
      subject: firstSet.subject || "Umum",
      grade: cleanGrade(firstSet.grade || "X"),
      semester: firstSet.semester || "1",
      material: selectedSets.map((s) => s.material).filter(Boolean).join(", "),
      questions: mergedQuestions,
      totalPoints: mergedQuestions.reduce((acc, q) => acc + (q.points || 1), 0),
      createdAt: new Date().toISOString(),
      onlyFromMaterial: true,
      selectedQuestionNumbers: mergedQuestions.map((q) => q.number),
    };

    saveToBankSoal(newMergedSet, userId);
    if (onRefreshBank) {
      onRefreshBank(getBankSoal(userId));
    }

    setSelectedSetIds(new Set());
    setSyncStatusText(`Berhasil menggabungkan ${selectedSets.length} paket menjadi 1 naskah baru (${mergedQuestions.length} butir soal)!`);
    setTimeout(() => setSyncStatusText(null), 5000);

    // Automatically navigate teacher to preview the combined package!
    onSelectSet(newMergedSet);
  };

  // Get unique subjects and grades for filters
  const subjects = Array.from(new Set<string>(questionSets.map((s) => s.subject || ""))).filter(Boolean);
  const grades = Array.from(new Set<string>(questionSets.map((s) => cleanGrade(s.grade)))).filter(Boolean);

  // Filtered list
  const filteredSets = questionSets.filter((set) => {
    const matchSearch =
      set.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      set.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
      set.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSubject = selectedSubject === "ALL" || set.subject === selectedSubject;
    const matchGrade = selectedGrade === "ALL" || cleanGrade(set.grade) === cleanGrade(selectedGrade);

    return matchSearch && matchSubject && matchGrade;
  });

  return (
    <div className="max-w-[1600px] w-full mx-auto space-y-6 sm:space-y-8 pb-20 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-blue-50 text-blue-700 font-black text-xs sm:text-sm uppercase tracking-wider rounded-full border border-blue-200">
            <BookOpen className="w-4 h-4" />
            ARSIP & BANK SOAL
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase mt-2 break-words">
            Bank Soal ({questionSets.length} Paket)
          </h1>
          <p className="text-xs sm:text-base text-slate-500 font-medium max-w-3xl mt-1">
            Koleksi paket soal tersimpan. Klik pada paket untuk mengedit butir soal, memilih/menyeleksi soal yang akan dipakai, menambah/menghapus soal manual, serta membuat Google Form.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToCreate}
          className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-sm sm:text-base shadow-xl transition-all uppercase tracking-wide hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span>+ BUAT SOAL BARU</span>
        </button>
      </div>

      {/* Hidden File Input for JSON / CSV / TXT Bank Soal Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,.csv,.txt"
        className="hidden"
      />

      {/* Account Real-Time Sync Status Banner */}
      {userEmail ? (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-emerald-950 font-semibold min-w-0">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <div className="min-w-0">
                <span className="text-slate-600 font-medium">Tersambung Cloud: </span>
                <strong className="font-black text-emerald-950">{userEmail}</strong>
                <span className="ml-2 inline-block text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Real-Time Sync Aktif
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                title="Tarik data soal terbaru dari Cloud Firebase"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan Sekarang"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportJSON}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-all shadow-2xs cursor-pointer"
                title="Unduh seluruh paket bank soal sebagai cadangan file JSON"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Cadangkan (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-all shadow-2xs cursor-pointer"
                title="Impor paket soal dari file cadangan JSON"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>Impor File</span>
              </button>

              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={onSwitchAccount}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-300 transition-all shadow-2xs text-xs cursor-pointer"
                  title="Ganti ke akun Google lainnya"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ganti Akun</span>
                </button>
              )}
            </div>
          </div>

          {syncStatusText && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-300">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{syncStatusText}</span>
            </div>
          )}

          <div className="border-t border-emerald-200/70 pt-2.5 flex items-start gap-2 text-[11px] text-slate-600 font-medium leading-relaxed">
            <Cloud className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Info Sinkronisasi Lintas Perangkat:</strong> Bank soal Anda otomatis tersimpan di Cloud Firebase. Jika Anda membuka website ini di laptop, komputer sekolah, atau HP lain, cukup masuk dengan akun Google yang sama (<strong>{userEmail}</strong>), maka seluruh paket bank soal akan langsung muncul seketika.
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 flex flex-col gap-3 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-900 font-black text-sm uppercase tracking-wide">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Mode Tamu (Belum Masuk Akun Google)</span>
              </div>
              <p className="text-xs text-amber-900/90 font-medium max-w-3xl leading-relaxed">
                Soal yang dibuat di perangkat ini saat ini hanya tersimpan di memori browser ini dan <strong>belum tersinkron ke Cloud</strong>. Jika Anda membuka web di komputer/laptop lain, bank soal tidak akan muncul sebelum Anda Masuk dengan Akun Google yang sama.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={onConnectGoogle || onSwitchAccount}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-amber-300" />
                <span>Masuk dengan Google</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-300 text-xs transition-all shadow-xs cursor-pointer"
                title="Impor paket soal dari file cadangan JSON"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>Impor File JSON</span>
              </button>
            </div>
          </div>

          <div className="border-t border-amber-200/80 pt-2 flex items-center gap-2 text-[11px] text-amber-800 font-medium">
            <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Saat Anda mengklik <strong>"Masuk dengan Google"</strong>, semua paket soal yang sudah ada saat ini akan otomatis dipindahkan ke akun Google Anda dan langsung tersinkron ke Cloud.
            </span>
          </div>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 card-shadow border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full min-w-0">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari judul soal, mata pelajaran, atau materi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-sm sm:text-base font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        {/* Subject & Grade Filter */}
        <div className="flex items-center gap-2.5 min-w-0">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="flex-1 md:flex-none px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">SEMUA MAPEL</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="flex-1 md:flex-none px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="ALL">SEMUA KELAS</option>
            {grades.map((gr) => (
              <option key={gr} value={gr}>{formatGradeDisplay(gr).toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Question Sets */}
      {filteredSets.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center card-shadow border border-slate-200 space-y-4 w-full min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center font-bold">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">Tidak ada paket soal yang cocok</h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto font-medium">
              Coba sesuaikan kata kunci pencarian Anda atau buat paket soal baru dengan AI.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 sm:gap-6 w-full min-w-0">
          {filteredSets.map((set) => (
            <div
              key={set.id}
              className="bg-white rounded-3xl p-5 sm:p-6 card-shadow border border-slate-200 hover:border-blue-300 transition-all flex flex-col justify-between space-y-4 group"
            >
              {/* Card Header */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedSetIds.has(set.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        const next = new Set(selectedSetIds);
                        if (next.has(set.id)) next.delete(set.id);
                        else next.add(set.id);
                        setSelectedSetIds(next);
                      }}
                      className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                      title="Centang untuk menggabungkan paket soal ini"
                    />
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-black text-[11px] uppercase tracking-wider rounded-full border border-blue-200 truncate">
                      {set.subject}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 shrink-0">
                    {formatGradeDisplay(set.grade)} • Sem {set.semester || "1"}
                  </span>
                </div>

                <h3 
                  onClick={() => onSelectSet(set)}
                  className="font-black text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer pt-1 leading-snug uppercase tracking-tight"
                  title="Klik untuk membuka, mengedit & memilih butir soal"
                >
                  {cleanExamTitle(set.title)}
                </h3>
              </div>

              {/* Badges Info */}
              {(() => {
                const saved = getSavedSelectedQuestions(set.id);
                const selCount = (Array.isArray(set.selectedQuestionNumbers) && set.selectedQuestionNumbers.length > 0)
                  ? set.selectedQuestionNumbers.length
                  : (saved ? saved.length : set.questions.length);
                const isPartialSelection = selCount < set.questions.length;

                return (
                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wider min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-blue-700 min-w-0">
                        <ListChecks className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                        <span className="truncate">{set.questions.length} Butir Soal</span>
                      </span>
                      <span className="text-slate-500 shrink-0 whitespace-nowrap text-right">
                        Total: {set.totalPoints || set.questions.length} Poin
                      </span>
                    </div>

                    {isPartialSelection && (
                      <div 
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-emerald-50 rounded-xl border border-emerald-200/90 text-xs font-bold text-emerald-900 transition-all min-w-0 shadow-2xs"
                        title={`${selCount} dari ${set.questions.length} butir soal aktif dipilih untuk naskah ujian & kisi-kisi`}
                      >
                        <span className="inline-flex items-center gap-1.5 min-w-0 truncate text-[11px] font-black uppercase tracking-wider text-emerald-800">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Soal Terpilih</span>
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
                          {selCount} dari {set.questions.length} Soal
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Card Actions */}
              <div className="space-y-2 pt-1">
                {/* Primary: Edit & Seleksi Soal */}
                <button
                  type="button"
                  id={`btn-edit-set-${set.id}`}
                  onClick={() => onSelectSet(set)}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Edit & Seleksi Soal</span>
                </button>

                {/* Secondary Row: Kisi-Kisi Soal & Buat Google Form */}
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Kisi-Kisi Soal Button */}
                  <button
                    type="button"
                    id={`btn-kisi-kisi-set-${set.id}`}
                    onClick={() => setViewingKisiKisiSet(set)}
                    className="py-2 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/60 font-black rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Lihat & Unduh Kisi-Kisi Soal (Format Resmi & Panduan Belajar)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Kisi-Kisi</span>
                  </button>

                  {/* 1-Click Create Google Form */}
                  <button
                    type="button"
                    id={`btn-gform-set-${set.id}`}
                    onClick={() => {
                      const savedNums = getSavedSelectedQuestions(set.id);
                      const activeSet = (savedNums && savedNums.length > 0)
                        ? { ...set, selectedQuestionNumbers: savedNums }
                        : set;
                      onCreateGoogleFormDirect(activeSet);
                    }}
                    className="py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-black rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Buat Google Form Kuis Otomatis"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Google Form</span>
                  </button>
                </div>

                {/* Bottom Quick Download & Management Toolbar */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => exportToPDF(set)}
                    className="flex-1 py-1.5 px-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Unduh Naskah Soal PDF"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = exportToWordText(set);
                      downloadFile(`Naskah_Soal_${set.subject}.doc`, text, "application/msword");
                    }}
                    className="flex-1 py-1.5 px-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Unduh Naskah Dokumen Word"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Word</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDuplicateSet(set)}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    title="Duplikasi Paket Soal"
                  >
                    <Copy className="w-4 h-4 text-blue-600" />
                  </button>

                  <button
                    type="button"
                    id={`btn-delete-set-${set.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingSet(set);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Hapus Paket Soal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Kisi-Kisi Preview & Download Modal */}
      <KisiKisiModal
        isOpen={viewingKisiKisiSet !== null}
        onClose={() => setViewingKisiKisiSet(null)}
        questionSet={viewingKisiKisiSet}
        initialSelectedNumbers={viewingKisiKisiSet?.selectedQuestionNumbers}
        onSelectionChange={(newSelection: Set<number>) => {
          if (viewingKisiKisiSet) {
            const selectedArr: number[] = Array.from(newSelection);
            saveSelectedQuestions(viewingKisiKisiSet.id, selectedArr);
            const questionsWithPoints = applyAutoPointsToQuestionSet(
              viewingKisiKisiSet.questions,
              newSelection,
              100
            );
            const selectedScore = questionsWithPoints
              .filter((q) => newSelection.has(q.number))
              .reduce((sum, q) => sum + (q.points || 1), 0);
            const updated: QuestionSet = {
              ...viewingKisiKisiSet,
              userId: userId || viewingKisiKisiSet.userId,
              selectedQuestionNumbers: selectedArr,
              questions: questionsWithPoints,
              totalPoints: selectedScore > 0 ? selectedScore : 100,
            };
            if (onSaveSet) {
              onSaveSet(updated);
            } else {
              saveToBankSoal(updated, userId);
            }
            setViewingKisiKisiSet(updated);
          }
        }}
      />

      {/* In-App Confirmation Modal for Package Deletion */}
      <ConfirmModal
        isOpen={deletingSet !== null}
        title="Hapus Paket Soal"
        message={deletingSet ? `Apakah Anda yakin ingin menghapus paket soal "${deletingSet.title}" (${deletingSet.questions.length} butir soal)? Tindakan ini akan menghapus paket dari Bank Soal.` : ""}
        confirmLabel="Ya, Hapus Paket"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={() => {
          if (deletingSet) {
            onDeleteSet(deletingSet.id);
            setDeletingSet(null);
          }
        }}
        onClose={() => setDeletingSet(null)}
      />

      {/* Floating Action Bar for Merging Selected Sets */}
      {selectedSetIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 sm:px-6 py-3.5 rounded-3xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-center gap-3 sm:gap-5 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-200">
            <Layers className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{selectedSetIds.size} Paket</strong> Dipilih (
              {questionSets
                .filter((s) => selectedSetIds.has(s.id))
                .reduce((acc, s) => acc + s.questions.length, 0)}{" "}
              Butir Soal)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedSetIds(new Set())}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={selectedSetIds.size < 2}
              onClick={handleMergeSelectedSets}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title={
                selectedSetIds.size < 2
                  ? "Pilih minimal 2 paket soal untuk digabungkan"
                  : "Gabungkan semua soal dari paket terpilih menjadi 1 paket baru"
              }
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {selectedSetIds.size < 2
                  ? "Pilih 1 Paket Lagi..."
                  : "Gabungkan Jadi 1 Naskah"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
