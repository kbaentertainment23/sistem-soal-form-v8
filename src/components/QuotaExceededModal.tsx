import React, { useEffect, useState } from "react";
import { 
  Clock, 
  Hourglass, 
  BookOpen, 
  Upload, 
  Sparkles, 
  X, 
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Layers
} from "lucide-react";
import { 
  calculateCountdownToMidnight, 
  type CountdownTime, 
  type AiQuotaState, 
  getAiQuotaState 
} from "../lib/aiQuotaService.js";

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  reason?: string;
  onOpenBankSoal?: () => void;
  onOpenImportSoal?: () => void;
}

export const QuotaExceededModal: React.FC<QuotaExceededModalProps> = ({
  isOpen,
  onClose,
  userId,
  reason,
  onOpenBankSoal,
  onOpenImportSoal,
}) => {
  const [quotaState, setQuotaState] = useState<AiQuotaState>(() => getAiQuotaState(userId));
  const [countdown, setCountdown] = useState<CountdownTime>(() => 
    calculateCountdownToMidnight(quotaState.blockedUntil)
  );

  // Sync state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      const state = getAiQuotaState(userId);
      setQuotaState(state);
      setCountdown(calculateCountdownToMidnight(state.blockedUntil));
    }
  }, [isOpen, userId]);

  // Live countdown timer running every 1 second
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setCountdown(calculateCountdownToMidnight(quotaState.blockedUntil));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, quotaState.blockedUntil]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 px-6 py-5 sm:px-8 sm:py-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup notifikasi kuota"
            className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-black/15 hover:bg-black/25 flex items-center justify-center text-white/90 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/25 border border-amber-300/40 text-amber-100 text-xs font-black tracking-wide uppercase">
              <Hourglass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} />
              Batas Kuota AI Tercapai
            </span>
            <span className="text-xs text-amber-100/90 font-medium hidden sm:inline">
              Reset Harian Otomatis
            </span>
          </div>

          <h2 id="quota-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
            Kuota Pembuatan Soal AI Hari Ini Telah Habis
          </h2>
          <p className="text-xs sm:text-sm text-amber-100 font-medium mt-1 leading-relaxed">
            {reason || quotaState.lastErrorReason || "Batas pemakaian harian telah tercapai. Akses AI akan di-reset otomatis setiap tengah malam."}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Live Countdown Display Box */}
          <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 text-white border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-3">
              <span className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-400" />
                Akses Terbuka Kembali Dalam:
              </span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Reset pukul 00:00 (Waktu Lokal)
              </span>
            </div>

            {/* Countdown Grid Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 sm:p-4">
                <div className="font-mono text-2xl sm:text-4xl font-black text-amber-400 tracking-tight">
                  {String(countdown.hours).padStart(2, "0")}
                </div>
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                  Jam
                </div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 sm:p-4">
                <div className="font-mono text-2xl sm:text-4xl font-black text-amber-400 tracking-tight">
                  {String(countdown.minutes).padStart(2, "0")}
                </div>
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                  Menit
                </div>
              </div>

              <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 sm:p-4">
                <div className="font-mono text-2xl sm:text-4xl font-black text-amber-400 tracking-tight">
                  {String(countdown.seconds).padStart(2, "0")}
                </div>
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                  Detik
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
              <span>Status Kuota Hari Ini:</span>
              <span className="font-bold text-slate-200">
                {quotaState.count} dari {quotaState.limit} kuota telah digunakan
              </span>
            </div>
          </div>

          {/* Alternative Productive Actions */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Saran Alternatif Sembari Menunggu
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Buka Bank Soal */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBankSoal?.();
                }}
                className="group p-3.5 sm:p-4 rounded-2xl border border-slate-200 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/40 text-left transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                    Koleksi Bank Soal
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Gunakan atau gabungkan paket soal yang sudah pernah Bapak/Ibu susun sebelumnya.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-bold text-blue-600">
                  <span>Buka Bank Soal</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Option 2: Impor Soal Eksternal */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImportSoal?.();
                }}
                className="group p-3.5 sm:p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/40 text-left transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2 group-hover:scale-105 transition-transform">
                    <Upload className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                    Impor Soal Mandiri
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Unggah naskah format teks guru, DOCX, CSV, atau JSON tanpa perlu kuota AI.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <span>Impor File Soal</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </div>

          {/* Educational Note */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-900/90 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Tips Guru:</strong> Penyusunan manual, penggabungan naskah ujian dari Bank Soal, dan ekspor ke Google Form tetap berjalan 100% normal dan tidak terpengaruh batas kuota AI.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 text-center sm:text-left">
            Kuota harian diperbarui otomatis pukul <strong>00:00</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
