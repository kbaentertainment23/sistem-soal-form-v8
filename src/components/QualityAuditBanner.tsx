import React from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Wand2, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  ShieldAlert,
  Scale,
  Brain,
  MessageSquareWarning,
  Flame
} from "lucide-react";
import type { ExamAuditResult } from "../types.js";

interface QualityAuditBannerProps {
  auditResult: ExamAuditResult;
  isAuditing: boolean;
  onReAudit: () => void;
  onClose: () => void;
  onApplyAllRevisions: () => void;
  unappliedCount: number;
}

export const QualityAuditBanner: React.FC<QualityAuditBannerProps> = ({
  auditResult,
  isAuditing,
  onReAudit,
  onClose,
  onApplyAllRevisions,
  unappliedCount,
}) => {
  const {
    overallScore,
    ratingLabel,
    summary,
    totalIssuesCount,
    distractorIssuesCount,
    longestKeyIssuesCount,
    hotsMismatchCount,
    ambiguityCount,
  } = auditResult;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-300";
    if (score >= 75) return "text-amber-600 bg-amber-50 border-amber-300";
    return "text-rose-600 bg-rose-50 border-rose-300";
  };

  const getScoreProgressColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 75) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 card-shadow border border-purple-200 ring-2 ring-purple-500/10 space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <Sparkles className="w-6 h-6 text-amber-300" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                Hasil Quality Audit & Pedagogical Reviewer AI
              </h2>
              <span className={`px-3 py-0.5 rounded-full text-xs font-black border uppercase tracking-wider ${getScoreColor(overallScore)}`}>
                {ratingLabel}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Inspeksi pedagogis komprehensif berbasis standar penulisan asesmen sekolah (Pusmendik & Kurikulum Merdeka).
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={onReAudit}
            disabled={isAuditing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            title="Audit ulang naskah soal"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin text-purple-600" : ""}`} />
            <span>{isAuditing ? "Mengaudit..." : "Audit Ulang"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup ringkasan audit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Score & Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 sm:gap-4">
        {/* Score Overview Card */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Skor Kesehatan Naskah
            </span>
            {overallScore >= 85 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
              {overallScore}
            </span>
            <span className="text-lg font-bold text-indigo-300">/ 100</span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${overallScore}%` }}
                className={`h-full rounded-full transition-all duration-500 ${getScoreProgressColor(overallScore)}`}
              />
            </div>
            <p className="text-xs text-indigo-200 leading-snug line-clamp-2">
              {summary}
            </p>
          </div>
        </div>

        {/* 4 Inspection Breakdown Columns */}
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Distraktor Lemah */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <Scale className="w-4 h-4 text-purple-600" />
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                distractorIssuesCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {distractorIssuesCount}
              </span>
            </div>
            <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
              Distraktor Lemah
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Pilihan opsi tidak masuk akal atau klise.
            </p>
          </div>

          {/* Kunci Terpanjang */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <Flame className="w-4 h-4 text-amber-600" />
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                longestKeyIssuesCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {longestKeyIssuesCount}
              </span>
            </div>
            <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
              Kunci Dominan
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Kunci jawaban terlalu panjang / detail.
            </p>
          </div>

          {/* Validasi HOTS */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <Brain className="w-4 h-4 text-blue-600" />
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                hotsMismatchCount > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {hotsMismatchCount}
              </span>
            </div>
            <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
              Level HOTS
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Kesesuaian stimulus penalaran C4–C6.
            </p>
          </div>

          {/* Ambigu / Negatif Ganda */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <MessageSquareWarning className="w-4 h-4 text-rose-600" />
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                ambiguityCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {ambiguityCount}
              </span>
            </div>
            <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
              Kalimat Ambigu
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Pola negatif ganda atau kata rancu.
            </p>
          </div>
        </div>
      </div>

      {/* Auto Fix Callout */}
      {unappliedCount > 0 ? (
        <div className="bg-purple-50 rounded-2xl p-3.5 sm:p-4 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Wand2 className="w-5 h-5 text-purple-700 shrink-0" />
            <div className="text-xs text-purple-950">
              <strong className="font-bold">Tersedia {unappliedCount} butir rekomendasi perbaikan AI.</strong> Anda dapat menerapkan perbaikan per butir soal atau menerapkan seluruhnya sekaligus.
            </div>
          </div>

          <button
            type="button"
            id="btn-apply-all-ai-revisions"
            onClick={onApplyAllRevisions}
            className="shrink-0 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-300" />
            <span>Terapkan Semua Revisi ({unappliedCount} Soal)</span>
          </button>
        </div>
      ) : totalIssuesCount > 0 ? (
        <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Seluruh rekomendasi revisi AI telah berhasil diterapkan ke naskah soal Anda!</span>
        </div>
      ) : (
        <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Luar biasa! Tidak ditemukan catatan cacat pedagogis pada naskah soal ini.</span>
        </div>
      )}
    </div>
  );
};
