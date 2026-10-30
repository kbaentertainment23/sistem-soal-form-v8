import React, { useState } from "react";
import { 
  FileText, 
  ExternalLink, 
  Copy, 
  Check, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  Search,
  BookOpen,
  Send,
  RefreshCw
} from "lucide-react";
import type { GoogleFormHistoryItem } from "../types.js";
import { ConfirmModal } from "./ConfirmModal.js";

interface FormHistoryProps {
  history: GoogleFormHistoryItem[];
  onDeleteHistoryItem: (id: string) => void;
  onNavigateToCreate: () => void;
  userEmail?: string | null;
  onSwitchAccount?: () => void;
}

export const FormHistory: React.FC<FormHistoryProps> = ({
  history,
  onDeleteHistoryItem,
  onNavigateToCreate,
  userEmail,
  onSwitchAccount,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingItem, setDeletingItem] = useState<GoogleFormHistoryItem | null>(null);

  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredHistory = history.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1600px] w-full mx-auto space-y-6 sm:space-y-8 pb-20 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-purple-50 text-purple-700 font-black text-xs sm:text-sm uppercase tracking-wider rounded-full border border-purple-200">
            <FileText className="w-4 h-4" />
            INTEGRASI GOOGLE FORMS
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase mt-2 break-words">
            Riwayat Google Forms ({history.length})
          </h1>
          <p className="text-xs sm:text-base text-slate-500 font-medium max-w-3xl mt-1">
            Daftar kuis Google Forms yang telah berhasil dibuat di akun Google Anda.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToCreate}
          className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-sm sm:text-base shadow-xl transition-all uppercase tracking-wide hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span>+ BUAT FORM BARU</span>
        </button>
      </div>

      {/* Account Real-Time Sync Status Banner */}
      {userEmail ? (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-purple-900 font-semibold min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shrink-0"></span>
            <span className="truncate">
              Tersambung Akun: <strong className="font-black text-purple-950">{userEmail}</strong>
            </span>
            <span className="inline-block text-purple-700 bg-purple-100/90 border border-purple-300 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider">
              Sinkron Real-Time
            </span>
          </div>
          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-purple-100 text-purple-800 font-bold rounded-xl border border-purple-300 transition-all shadow-xs text-xs sm:text-sm cursor-pointer ml-auto"
              title="Ganti ke akun Google lainnya"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
              <span>Ganti Akun</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-amber-900 font-medium min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
            <span>
              Mode Tamu: Riwayat Google Forms hanya tersimpan di perangkat ini. Masuk dengan Google untuk sinkronisasi otomatis antar akun & perangkat.
            </span>
          </div>
          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl transition-all shadow-xs text-xs sm:text-sm cursor-pointer ml-auto"
            >
              <span>Masuk Google</span>
            </button>
          )}
        </div>
      )}

      {/* Search Input */}
      {history.length > 0 && (
        <div className="relative w-full min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari formulir berdasarkan judul, mata pelajaran, atau kelas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-white border border-slate-300 rounded-2xl text-sm sm:text-base font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600 card-shadow"
          />
        </div>
      )}

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center card-shadow border border-slate-200 space-y-4 w-full min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center font-bold">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
              {history.length === 0 ? "Belum ada Google Form yang dibuat" : "Tidak ditemukan hasil yang cocok"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
              {history.length === 0
                ? "Buat soal baru dengan AI, lalu klik tombol '🚀 Buat Google Form' untuk membuat kuis otomatis."
                : "Coba sesuaikan kata kunci pencarian Anda."}
            </p>
          </div>
          {history.length === 0 && (
            <button
              type="button"
              onClick={onNavigateToCreate}
              className="mt-3 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Mulai Buat Soal Sekarang
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 w-full min-w-0">
          {filteredHistory.map((item) => {
            const isCopied = copiedId === item.id;
            const formattedDate = new Date(item.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-6 sm:p-7 card-shadow border border-slate-200 hover:border-purple-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group w-full min-w-0"
              >
                {/* Left details */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider min-w-0">
                    <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                      {item.subject || "Umum"}
                    </span>
                    <span className="text-slate-600">
                      Kelas {item.grade || "-"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 flex items-center gap-1.5 font-bold text-xs sm:text-sm">
                      <Calendar className="w-4 h-4" />
                      {formattedDate}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 leading-snug group-hover:text-purple-700 transition-colors uppercase tracking-tight truncate">
                    {item.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 font-semibold min-w-0">
                    <span className="text-purple-700 font-bold">
                      {item.questionsCount} Butir Soal ({item.totalPoints} Poin)
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Kuis Aktif
                    </span>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {/* Copy responder link */}
                  <button
                    type="button"
                    onClick={() => copyLink(item.id, item.responderUrl)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors cursor-pointer active:scale-95"
                    title="Salin Link Kuis untuk Siswa"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-600" />
                        <span>Salin Link Siswa</span>
                      </>
                    )}
                  </button>

                  {/* Open Responder URL */}
                  <a
                    href={item.responderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors"
                    title="Buka Form Tampilan Siswa"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Lihat Kuis</span>
                  </a>

                  {/* Open Form Editor URL */}
                  {item.editUrl && (
                    <a
                      href={item.editUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition-colors"
                      title="Buka Editor Google Form"
                    >
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>Edit di Form</span>
                    </a>
                  )}

                  {/* Delete Item */}
                  <button
                    type="button"
                    id={`btn-delete-history-${item.id}`}
                    onClick={() => setDeletingItem(item)}
                    className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Hapus dari Riwayat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Confirmation Modal for Form History Deletion */}
      <ConfirmModal
        isOpen={deletingItem !== null}
        title="Hapus Riwayat Google Form"
        message={
          deletingItem
            ? `Hapus catatan riwayat "${deletingItem.title}" dari aplikasi? (Catatan: Formulir asli di Google Drive Anda tetap aman dan tidak terhapus).`
            : ""
        }
        confirmLabel="Ya, Hapus Riwayat"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={() => {
          if (deletingItem) {
            onDeleteHistoryItem(deletingItem.id);
            setDeletingItem(null);
          }
        }}
        onClose={() => setDeletingItem(null)}
      />
    </div>
  );
};
