import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Zap, 
  GraduationCap, 
  Clock, 
  Hourglass,
  ExternalLink,
  Plus,
  Compass,
  Layers,
  Check,
  Award,
  BarChart2,
  School,
  Info,
  ChevronDown
} from "lucide-react";
import type { QuestionSet, GoogleFormHistoryItem } from "../types.js";
import { 
  getAiQuotaState, 
  subscribeToQuotaChanges, 
  calculateCountdownToMidnight, 
  type AiQuotaState, 
  type CountdownTime 
} from "../lib/aiQuotaService.js";

interface DashboardProps {
  onNavigate: (tab: "create" | "bank" | "history" | "settings") => void;
  bankCount: number;
  formCount: number;
  isGoogleConnected: boolean;
  userEmail?: string | null;
  onConnectGoogle: () => void;
  recentSets: QuestionSet[];
  recentForms: GoogleFormHistoryItem[];
  onSelectSet: (set: QuestionSet) => void;
  onQuickStart?: (subject: string, grade: string, material: string) => void;
  userId?: string | null;
  onOpenQuotaModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  bankCount,
  formCount,
  isGoogleConnected,
  userEmail,
  onConnectGoogle,
  recentSets,
  recentForms,
  onSelectSet,
  userId,
  onOpenQuotaModal,
}) => {
  // AI Daily Quota state and live countdown
  const [quotaState, setQuotaState] = useState<AiQuotaState>(() => getAiQuotaState(userId));
  const [countdown, setCountdown] = useState<CountdownTime>(() => 
    calculateCountdownToMidnight(quotaState.blockedUntil)
  );
  // Collapsible hero description (closed by default for a clean layout)
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

  useEffect(() => {
    setQuotaState(getAiQuotaState(userId));
    const unsubscribe = subscribeToQuotaChanges((updated) => {
      setQuotaState(updated);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(calculateCountdownToMidnight(quotaState.blockedUntil));
    }, 1000);
    return () => clearInterval(timer);
  }, [quotaState.blockedUntil]);

  const quotaLimit = quotaState.limit || 20;
  const quotaUsed = quotaState.count || 0;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const percentRemaining = Math.max(0, Math.min(100, Math.round((quotaRemaining / quotaLimit) * 100)));
  const percentUsed = Math.max(0, Math.min(100, Math.round((quotaUsed / quotaLimit) * 100)));
  const isQuotaExhausted = quotaRemaining === 0 || quotaState.isApiBlocked;
  const isQuotaLow = !isQuotaExhausted && quotaRemaining <= 3;
  // Calculate total questions in bank and HOTS percentage
  const totalQuestionsInBank = recentSets.reduce((acc, set) => acc + (set.questions?.length || 0), 0);
  const totalHotsInBank = recentSets.reduce(
    (acc, set) =>
      acc +
      (set.questions?.filter(
        (q) => q.difficulty === "Sulit" || q.difficulty === "HOTS" || ["C4", "C5", "C6"].includes(q.cognitiveLevel)
      ).length || 0),
    0
  );
  const hotsPercentage = totalQuestionsInBank > 0 ? Math.round((totalHotsInBank / totalQuestionsInBank) * 100) : 40;

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 w-full min-w-0">
      {/* Top Academic Context & System Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 bg-slate-900 text-white rounded-full text-xs sm:text-sm font-black uppercase tracking-wider">
              <School className="w-4 h-4 text-blue-400" />
              <span>Portal Asesmen Digital</span>
            </div>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="bg-blue-50 text-blue-800 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-black tracking-wider uppercase border border-blue-200/80 shadow-2xs">
              Kurikulum Merdeka (Fase A–F) & K13
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2 sm:py-2.5 rounded-2xl shadow-2xs">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isGoogleConnected ? "bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" : "bg-amber-400"}`}></div>
            <span className="text-xs sm:text-sm font-bold text-slate-700 truncate max-w-[280px]">
              {isGoogleConnected ? (userEmail ? `Akun: ${userEmail}` : "Google Terhubung") : "Google Belum Terhubung"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Academic Hero Banner & High-Impact Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 xl:gap-8 items-stretch w-full min-w-0">
        {/* Left Hero Card - Deep Navy / Royal Blue Gradient */}
        <div className="lg:col-span-8 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 rounded-3xl p-6 sm:p-9 lg:p-11 xl:p-12 text-white flex flex-col justify-between card-elevation-high overflow-hidden relative min-h-[260px] sm:min-h-[300px] border border-blue-500/20 w-full min-w-0 shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/25 backdrop-blur-md rounded-full text-xs sm:text-sm font-black uppercase tracking-wider text-blue-200 border border-blue-400/30 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
              Standardisasi Asesmen & Taksonomi Bloom C1–C6
            </div>
            
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight uppercase font-outfit text-white">
              Pusat Penyusunan Soal Ujian & Integrasi Google Form
            </h1>
            
            {/* Dropdown / Collapsible Description - Closed by default for clean and comfortable view */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setIsDescriptionOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/70 text-xs sm:text-sm font-bold text-blue-200 hover:text-white transition-all cursor-pointer shadow-xs active:scale-95 group"
                aria-expanded={isDescriptionOpen}
              >
                <Info className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 transition-colors shrink-0" />
                <span>{isDescriptionOpen ? "Tutup Deskripsi & Info Lengkap" : "Lihat Deskripsi & Info Lengkap"}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-200 shrink-0 ${
                    isDescriptionOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDescriptionOpen && (
                <div className="mt-3 p-4 bg-slate-900/90 border border-blue-500/30 rounded-2xl backdrop-blur-sm shadow-lg transition-all animate-in fade-in-50 slide-in-from-top-2 duration-200">
                  <p className="text-slate-200 text-xs sm:text-sm lg:text-base leading-relaxed font-medium">
                    Rancang butir soal pilihan ganda berkualitas dengan distribusi HOTS berimbang, ekspor ke naskah Word (.docx) & PDF bertata letak standar sekolah, serta buat Google Form kuis dalam 1-klik.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 pt-6 sm:pt-8 flex flex-wrap items-center gap-3.5">
            <button
              id="hero-cta-create-soal"
              onClick={() => onNavigate("create")}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 sm:px-8 xl:px-9 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base xl:text-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 shadow-xl hover:shadow-2xl cursor-pointer border border-blue-400/40"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>SUSUN SOAL BARU</span>
            </button>

            <button
              id="hero-cta-open-bank"
              onClick={() => onNavigate("bank")}
              className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white font-bold px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base xl:text-lg border border-slate-700 transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 shadow-md"
            >
              <BookOpen className="w-5 h-5 text-blue-400" />
              <span>Bank Soal ({bankCount})</span>
            </button>
          </div>

          {/* Background subtle academic watermark ornament */}
          <div className="absolute -right-12 -bottom-12 opacity-5 pointer-events-none text-white">
            <GraduationCap className="w-96 h-96" />
          </div>
        </div>

        {/* Right Column: Academic Metric Cards */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5 xl:gap-6 w-full min-w-0">
          {/* Metric 1: Bank Soal */}
          <div 
            onClick={() => onNavigate("bank")}
            className="bg-white p-6 sm:p-7 xl:p-8 rounded-3xl card-shadow border border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between min-w-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-slate-500 font-black uppercase tracking-wider">Koleksi Bank Soal</span>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2.5">
                <span className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight font-outfit">{bankCount}</span>
                <span className="text-xs sm:text-sm text-slate-500 font-bold uppercase tracking-wider">Paket Soal</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">
                {totalQuestionsInBank} total butir soal tersimpan
              </p>
            </div>
            
            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm text-blue-600 font-black uppercase tracking-wider group-hover:translate-x-1.5 transition-transform">
              <span>Buka Arsip Bank Soal</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Metric 2: Google Forms Kuis & Standar HOTS */}
          <div 
            onClick={() => onNavigate("history")}
            className="bg-white p-6 sm:p-7 xl:p-8 rounded-3xl card-shadow border border-slate-200 hover:border-emerald-500 hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between min-w-0"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-slate-500 font-black uppercase tracking-wider">Google Form Kuis</span>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2.5">
                <span className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight font-outfit">{formCount}</span>
                <span className="text-xs sm:text-sm text-slate-500 font-bold uppercase tracking-wider">Form Siap Ujian</span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-700 mt-1.5 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Kunci jawaban otomatis aktif</span>
              </p>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm text-emerald-600 font-black uppercase tracking-wider group-hover:translate-x-1.5 transition-transform">
              <span>Kelola Riwayat Form</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Indicator: Daily AI Quota Progress Bar Widget */}
      <section 
        aria-label="Pemantau Kuota AI Harian"
        className="bg-white rounded-3xl p-6 sm:p-7 xl:p-8 border border-slate-200 card-shadow transition-all w-full min-w-0 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 transition-colors shadow-xs ${
              isQuotaExhausted 
                ? "bg-rose-50 text-rose-600 border border-rose-200" 
                : isQuotaLow 
                ? "bg-amber-50 text-amber-600 border border-amber-200" 
                : "bg-blue-50 text-blue-600 border border-blue-200"
            }`}>
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight font-outfit uppercase">
                  Kuota AI Pembuatan Soal Hari Ini
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                  isQuotaExhausted
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : isQuotaLow
                    ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}>
                  {isQuotaExhausted 
                    ? (quotaState.isApiBlocked ? "Limit API Aktif" : "Kuota Habis")
                    : isQuotaLow
                    ? "Kuota Menipis"
                    : "Siap Digunakan"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Pantau sisa kuota penyusunan paket soal otomatis berbasis AI sebelum batas harian tercapai.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {onOpenQuotaModal && (
              <button
                type="button"
                onClick={onOpenQuotaModal}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-200"
              >
                <Hourglass className="w-3.5 h-3.5 text-amber-600" />
                <span>Timer & Alternatif</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate("create")}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                isQuotaExhausted
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isQuotaExhausted ? "Buka Form Soal" : "Susun Soal AI"}</span>
            </button>
          </div>
        </div>

        {/* Big Numbers & Status Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Sisa Kuota Hari Ini
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-black font-outfit ${
                isQuotaExhausted ? "text-rose-600" : isQuotaLow ? "text-amber-600" : "text-blue-600"
              }`}>
                {quotaRemaining}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-500">
                / {quotaLimit} Paket
              </span>
              <span className="text-xs font-bold text-slate-400">
                ({percentRemaining}%)
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Sudah Dibuat Hari Ini
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-outfit text-slate-900">
                {quotaUsed}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-500">
                Paket Soal Selesai
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Waktu Reset Otomatis
            </span>
            <div className="mt-1">
              <span className="font-mono text-base sm:text-lg font-black text-slate-900">
                {String(countdown.hours).padStart(2, "0")}j {String(countdown.minutes).padStart(2, "0")}m {String(countdown.seconds).padStart(2, "0")}d
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Reset pukul 00:00 (Waktu Lokal)
              </p>
            </div>
          </div>
        </div>

        {/* The Visual Progress Bar Component */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span>Ketersediaan Kuota:</span>
              <strong className={isQuotaExhausted ? "text-rose-600" : isQuotaLow ? "text-amber-600" : "text-blue-600"}>
                {percentRemaining}% Tersedia
              </strong>
            </span>
            <span className="text-slate-400 font-medium hidden sm:inline">
              Batas Maksimal: {quotaLimit} Paket / Hari
            </span>
          </div>

          {/* Progress Bar Track */}
          <div 
            className="w-full h-4 sm:h-5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 relative shadow-inner"
            role="progressbar"
            aria-valuenow={percentRemaining}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress sisa kuota AI harian"
          >
            <div 
              style={{ width: `${percentRemaining}%` }}
              className={`h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] font-black text-white ${
                isQuotaExhausted
                  ? "bg-rose-500 shadow-sm"
                  : isQuotaLow
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-sm animate-pulse"
                  : "bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 shadow-sm"
              }`}
            >
              {percentRemaining >= 15 && (
                <span className="drop-shadow-xs tracking-wider">
                  {percentRemaining}%
                </span>
              )}
            </div>
          </div>

          {/* Bar Scale Markers */}
          <div className="flex justify-between text-[11px] text-slate-400 font-semibold px-1">
            <span>0 (Habis)</span>
            <span className="hidden sm:inline">25%</span>
            <span>50%</span>
            <span className="hidden sm:inline">75%</span>
            <span>100% ({quotaLimit} Paket)</span>
          </div>
        </div>

        {/* Helpful Info Tip */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-500 bg-slate-50/70 rounded-2xl p-3 border border-slate-100">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              Penyusunan naskah manual, penggabungan paket di <strong>Bank Soal</strong>, dan ekspor ke <strong>Google Form</strong> tidak memakai kuota AI.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("bank")}
            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Buka Bank Soal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Two Column Section: Recent Sets & Recent Google Forms */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 xl:gap-8 pt-2 w-full min-w-0">
        {/* Left: Recent Question Sets in Bank */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-5 flex flex-col justify-between w-full min-w-0">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-black text-base sm:text-lg xl:text-xl text-slate-900 tracking-tight uppercase font-outfit truncate">
                  Paket Soal Terkini
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("bank")}
                className="text-xs sm:text-sm font-black text-blue-600 hover:text-blue-800 flex items-center gap-1.5 uppercase tracking-wider cursor-pointer shrink-0"
              >
                Lihat Semua ({bankCount}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentSets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm sm:text-base font-medium">
                Belum ada paket soal tersimpan. Klik "Susun Soal Baru" untuk memulai.
              </div>
            ) : (
              <div className="space-y-3">
                {recentSets.slice(0, 3).map((set) => (
                  <div
                    key={set.id}
                    onClick={() => onSelectSet(set)}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer flex items-center justify-between gap-3.5 group min-w-0"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-blue-700 transition-colors truncate">
                        {set.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 font-semibold">
                        <span className="text-slate-800 font-bold">{set.subject}</span>
                        <span>•</span>
                        <span>Kelas {set.grade}</span>
                        <span>•</span>
                        <span className="text-blue-600 font-bold">{set.questions.length} Butir Soal</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      className="px-3.5 sm:px-4 py-2 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-xs sm:text-sm font-black text-slate-700 transition-colors shrink-0 uppercase tracking-wider cursor-pointer"
                    >
                      Buka Workspace
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate("create")}
              className="w-full py-3.5 sm:py-4 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Buat Naskah Soal Baru</span>
            </button>
          </div>
        </div>

        {/* Right: Recent Google Forms Created */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 card-shadow space-y-5 flex flex-col justify-between w-full min-w-0">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-black text-base sm:text-lg xl:text-xl text-slate-900 tracking-tight uppercase font-outfit truncate">
                  Google Form Kuis Terakhir
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("history")}
                className="text-xs sm:text-sm font-black text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider cursor-pointer shrink-0"
              >
                Lihat Semua ({formCount}) <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentForms.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm sm:text-base font-medium">
                Belum ada Google Form yang dibuat. Buka paket soal lalu klik "🚀 Buat Google Form".
              </div>
            ) : (
              <div className="space-y-3">
                {recentForms.slice(0, 3).map((form) => (
                  <div
                    key={form.id}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20 transition-all flex items-center justify-between gap-3.5 min-w-0"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                        {form.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 font-semibold">
                        <span className="font-bold text-slate-700">{form.subject}</span>
                        <span>•</span>
                        <span>Kelas {form.grade}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-bold">{form.questionsCount} Soal ({form.totalPoints} Poin)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={form.responderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 sm:px-3 sm:py-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold"
                        title="Buka Kuis Siswa"
                      >
                        <span>Kuis Siswa</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate("history")}
              className="w-full py-3.5 sm:py-4 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Compass className="w-4 h-4 text-emerald-600" />
              <span>Kelola Seluruh Tautan Google Form</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

