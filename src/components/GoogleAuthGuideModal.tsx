import React, { useState, useEffect } from "react";
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  KeyRound, 
  Sparkles, 
  LogOut, 
  Globe, 
  Info,
  HelpCircle
} from "lucide-react";
import { 
  isGoogleConnected, 
  getGoogleEmail, 
  loginWithGooglePopup,
  requestGoogleAccessToken, 
  disconnectGoogle,
  getCustomGoogleClientId,
  setCustomGoogleClientId 
} from "../lib/googleAuth.js";

interface GoogleAuthGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectedSuccess?: () => void;
}

export const GoogleAuthGuideModal: React.FC<GoogleAuthGuideModalProps> = ({
  isOpen,
  onClose,
  onConnectedSuccess,
}) => {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [customClientId, setCustomClientId] = useState("");
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"script_info" | "connect" | "guide">("script_info");

  useEffect(() => {
    if (isOpen) {
      setConnected(isGoogleConnected());
      setEmail(getGoogleEmail());
      setCurrentOrigin(typeof window !== "undefined" ? window.location.origin : "");
      setCustomClientId(getCustomGoogleClientId());
      setErrorMessage(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyOrigin = () => {
    if (!currentOrigin) return;
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  const handleSaveClientId = () => {
    setCustomGoogleClientId(customClientId);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const profile = await loginWithGooglePopup();
      if (!profile) {
        setIsConnecting(false);
        return;
      }
      setConnected(isGoogleConnected());
      setEmail(getGoogleEmail());
      if (onConnectedSuccess) onConnectedSuccess();
    } catch (err: any) {
      if (err?.message?.includes("dibatalkan") || err?.message?.includes("ditutup") || err?.message?.includes("closed")) {
        // User closed the popup, cancel without error
        return;
      }
      console.warn("Google connect notice:", err?.message || err);
      setErrorMessage(err.message || "Gagal menghubungkan Google.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectGoogle();
    setConnected(false);
    setEmail(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                Koneksi Akun Google & Google Forms
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Kelola login Google dan akses pembuatan Google Form otomatis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-5 sm:px-7 pt-2 gap-2 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("script_info")}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "script_info"
                ? "border-emerald-600 text-emerald-700 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚡ Ekspor Mandiri (Bebas Setup)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("connect")}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "connect"
                ? "border-blue-600 text-blue-700 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            🔑 Hubungkan Akun (Login Langsung)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === "guide"
                ? "border-blue-600 text-blue-700 font-black"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚙️ Panduan Developer
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm">

          {/* TAB 1: CONNECT */}
          {activeTab === "connect" && (
            <div className="space-y-5">
              {/* Status Box */}
              <div className="p-4 sm:p-5 rounded-2xl border bg-slate-50 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                      connected ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}>
                      {connected ? "🟢 Terhubung ke Google" : "🟡 Belum Terhubung"}
                    </span>
                    {email && (
                      <span className="font-bold text-slate-800 text-xs truncate max-w-[200px]">
                        ({email})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {connected
                      ? "Akun Google Anda aktif. Formulir kuis otomatis dibuat langsung di Google Drive akun ini."
                      : "Login dengan akun Google Anda (Personal Gmail, Akun Belajar.id, atau Google Workspace Sekolah)."}
                  </p>
                </div>

                <div className="shrink-0">
                  {connected ? (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Putuskan Akun</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4 text-amber-300" />
                      <span>{isConnecting ? "Menghubungkan..." : "Login Akun Google"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Error Box if any */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-black uppercase tracking-wide">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Kendala Otorisasi Google</span>
                  </div>
                  <p className="leading-relaxed font-medium pl-6">{errorMessage}</p>
                  <div className="pl-6 pt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("script_info")}
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Gunakan Opsi 1-Klik Script (Bebas Setup)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("guide")}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Lihat Cara Daftarkan Domain Vercel
                    </button>
                  </div>
                </div>
              )}

              {/* Fast Tips Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-black text-blue-900 uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Solusi Instan Tanpa Masalah Login:</span>
                </div>
                <p className="text-blue-800 leading-relaxed font-medium">
                  Jika Anda tidak ingin repot mendaftarkan domain Vercel ke Google Cloud Console, Anda dapat menggunakan <strong>Fitur Ekspor Instan Script 1-Klik</strong> saat mengekspor soal ke Google Form. Cukup salin script dan jalankan di <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-blue-950">script.new</code>, Google Form langsung jadi dengan <strong>SEMUA</strong> akun Google tanpa batasan!
                </p>
              </div>

              {/* Custom Google Client ID Setting */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                    Kustom Google OAuth Client ID (Opsional):
                  </span>
                  {saveSuccess && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Tersimpan!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Jika Anda memiliki Google OAuth Client ID sendiri dari Google Cloud Console proyek sekolah/organisasi:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    placeholder="Contoh: 123456789-abc.apps.googleusercontent.com"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleSaveClientId}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GUIDE FOR DEPLOYMENT */}
          {activeTab === "guide" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
                <span className="font-black text-xs uppercase tracking-wide text-blue-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" />
                  Domain Web Anda Saat Ini:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentOrigin}
                    className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-mono font-bold text-blue-950 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyOrigin}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      copiedOrigin ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {copiedOrigin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedOrigin ? "Tersalin!" : "Salin Domain"}</span>
                  </button>
                </div>
                <p className="text-[11px] text-blue-800">
                  Salin domain di atas untuk dimasukkan ke <strong>Authorized JavaScript Origins</strong> (Google Cloud) dan <strong>Authorized Domains</strong> (Firebase).
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  3 Langkah Agar Login Google Aktif untuk Semua Akun Saat Deploy:
                </h4>
                
                <ol className="list-decimal pl-4 space-y-2.5 text-xs text-slate-600 leading-relaxed font-medium">
                  <li className="space-y-1">
                    <strong className="text-slate-900">Atasi Error 400 (origin_mismatch) di Google Cloud Console:</strong>
                    <p className="text-[11px] text-slate-600">
                      Buka <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold inline-flex items-center gap-0.5">Google Cloud Console &gt; Credentials <ExternalLink className="w-3 h-3" /></a>, klik Client ID OAuth 2.0 Anda. Pada bagian <strong>Authorized JavaScript origins</strong>, klik <em>Add URI</em> dan tempel domain Anda: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-900 font-mono">{currentOrigin}</code>, lalu klik <strong>Save</strong>.
                    </p>
                  </li>

                  <li className="space-y-1">
                    <strong className="text-slate-900">Otorisasi Domain di Firebase Console:</strong>
                    <p className="text-[11px] text-slate-600">
                      Buka <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold inline-flex items-center gap-0.5">Firebase Console <ExternalLink className="w-3 h-3" /></a>, pilih proyek Anda, masuk ke <strong>Authentication &gt; Settings &gt; Authorized domains</strong>. Klik <em>Add domain</em> dan masukkan host Anda: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-900 font-mono">{typeof window !== "undefined" ? window.location.hostname : "domain-anda"}</code>.
                    </p>
                  </li>

                  <li className="space-y-1">
                    <strong className="text-slate-900">Izinkan Semua Akun Guru (Gmail, Belajar.id, Workspace):</strong>
                    <p className="text-[11px] text-slate-600">
                      Di Google Cloud Console, buka menu <strong>OAuth consent screen</strong> di bilah kiri. Pada bagian <em>Publishing status</em>, pastikan telah menekan <strong>Publish App</strong> (status menjadi <strong>In Production</strong>). Dengan ini, seluruh akun Google tanpa terkecuali dapat langsung login tanpa pesan <em>"Aplikasi sedang diuji / 403 access_denied"</em>!
                    </p>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: SCRIPT 1-KLIK EXPLANATION */}
          {activeTab === "script_info" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-emerald-950">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wide text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Keuntungan Menggunakan Ekspor Script 1-Klik:</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-xs text-emerald-800 leading-relaxed">
                  <li><strong>100% Bebas Konfigurasi:</strong> Tidak perlu membuat project di Google Cloud Console.</li>
                  <li><strong>Bisa untuk Semua Akun:</strong> Akun Gmail pribadi, @belajar.id, maupun Google Workspace sekolah langsung bisa digunakan.</li>
                  <li><strong>Tidak Ada Masalah Domain/Origin:</strong> Berjalan langsung di dalam Google Drive Anda sendiri melalui script.new.</li>
                  <li><strong>Lengkap & Otomatis:</strong> Kuis mode aktif, identitas nama siswa, dropdown kelas, kunci jawaban, dan pembahasan otomatis masuk ke Google Form!</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider block">
                  Cara Membuat Form Melalui Script:
                </span>
                <p className="text-slate-600 leading-relaxed">
                  Saat Anda selesai membuat soal, klik tombol <strong>"Kirim ke Google Form"</strong>, lalu pilih tab <strong>"Ekspor Instan (Script 1-Klik)"</strong>. Di sana Anda cukup menekan tombol "Buka script.new" dan "Salin Script", lalu tekan tombol Run di Google. Formulir kuis otomatis dibuat dalam 5 detik!
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            Sistem Pembuat Soal Guru AI • Siap Pakai
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
