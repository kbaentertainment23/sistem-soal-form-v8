import React, { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  School, 
  Sliders, 
  Download, 
  Upload, 
  Save, 
  LogOut, 
  Check, 
  KeyRound,
  FileCheck,
  ListPlus,
  X,
  Plus,
  RotateCcw,
  Sparkles,
  Layers,
  Trash2,
  FileSignature,
  RefreshCw,
  Shield
} from "lucide-react";
import type { AppSettings } from "../lib/storage.js";
import { DEFAULT_CLASSES } from "../lib/storage.js";
import { PWAInstallButton } from "./PWAInstallButton.js";

interface SettingsProps {
  isGoogleConnected: boolean;
  userEmail?: string | null;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onSwitchGoogleAccount?: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onReloadBank: () => void;
  userId?: string | null;
  onNavigateToAdmin?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  isGoogleConnected,
  userEmail,
  onConnectGoogle,
  onDisconnectGoogle,
  onSwitchGoogleAccount,
  settings,
  onSaveSettings,
  onReloadBank,
  userId,
  onNavigateToAdmin,
}) => {
  const [formSettings, setFormSettings] = useState<AppSettings>({
    ...settings,
    classList: Array.isArray(settings.classList) ? settings.classList : [],
    includeIdentitySectionDefault: settings.includeIdentitySectionDefault ?? true,
    enableSignatures: settings.enableSignatures === true,
  });
  const [newClassInput, setNewClassInput] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Synchronize logo when settings are updated from database / other devices
  useEffect(() => {
    setFormSettings((prev) => ({
      ...prev,
      appLogoUrl: settings.appLogoUrl,
    }));
  }, [settings.appLogoUrl]);

  const handleToggleSignatures = (enable: boolean) => {
    const updated = { ...formSettings, enableSignatures: enable, appLogoUrl: settings.appLogoUrl };
    setFormSettings(updated);
    onSaveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const toSave = {
      ...formSettings,
      appLogoUrl: settings.appLogoUrl,
    };
    onSaveSettings(toSave);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddClass = () => {
    const trimmed = newClassInput.trim();
    if (!trimmed) return;
    
    // Support comma or newline separated inputs
    const splitted = trimmed.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const updated = Array.from(new Set([...formSettings.classList, ...splitted]));
    const nextSettings = { ...formSettings, classList: updated };
    setFormSettings(nextSettings);
    onSaveSettings(nextSettings);
    setNewClassInput("");
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleRemoveClass = (indexToRemove: number) => {
    const updated = formSettings.classList.filter((_, idx) => idx !== indexToRemove);
    const nextSettings = { ...formSettings, classList: updated };
    setFormSettings(nextSettings);
    onSaveSettings(nextSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleClearAllClasses = () => {
    if (formSettings.classList.length === 0) return;
    const nextSettings = { ...formSettings, classList: [] };
    setFormSettings(nextSettings);
    onSaveSettings(nextSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-6 sm:space-y-8 pb-20 min-w-0">
      {/* Header */}
      <div className="min-w-0">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-slate-100 text-slate-800 font-black text-xs sm:text-sm uppercase tracking-wider rounded-full border border-slate-200">
          <SettingsIcon className="w-4 h-4" />
          PENGATURAN & KONEKSI
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight uppercase mt-2 break-words">
          Pengaturan Sistem
        </h1>
        <p className="text-xs sm:text-base text-slate-500 font-medium max-w-3xl mt-1">
          Kelola status koneksi Google Forms, preferensi ujian sekolah, dan cadangan data.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 sm:p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Pengaturan dan identitas sekolah berhasil disimpan!</span>
        </div>
      )}

      {/* PWA App Installation Promo Banner */}
      <PWAInstallButton variant="banner" />

      {/* SECTION 1: STATUS GOOGLE OAUTH */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 xl:p-9 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-lg sm:text-xl uppercase tracking-tight truncate">Koneksi Akun Google</h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium truncate">
              Izin untuk membuat dan mengunggah kuis otomatis langsung ke Google Drive & Forms Anda
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-7 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-slate-50 border-slate-200 w-full min-w-0">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider ${
                isGoogleConnected ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-rose-100 text-rose-800 border border-rose-200"
              }`}>
                {isGoogleConnected ? "🟢 Google Terhubung" : "🔴 Google Belum Terhubung"}
              </span>
              {userEmail && (
                <span className="text-xs sm:text-sm text-slate-600 font-bold truncate">
                  ({userEmail})
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              {isGoogleConnected ? (
                "Akun Google aktif. Formulir kuis otomatis dibuat langsung di Google Drive Anda."
              ) : (
                "Hubungkan sekali dengan Google Identity untuk membuat Google Form kuis instan secara otomatis."
              )}
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-center gap-2.5">
            {isGoogleConnected ? (
              <>
                {onSwitchGoogleAccount && (
                  <button
                    type="button"
                    id="btn-switch-google-settings"
                    onClick={onSwitchGoogleAccount}
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black rounded-2xl text-xs sm:text-sm border border-blue-200 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Ganti Akun</span>
                  </button>
                )}
                <button
                  type="button"
                  id="btn-disconnect-google"
                  onClick={onDisconnectGoogle}
                  className="w-full sm:w-auto px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-2xl text-xs sm:text-sm border border-rose-200 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Putuskan Koneksi</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                id="btn-connect-google-settings"
                onClick={onConnectGoogle}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Hubungkan Google</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: IDENTITAS KOP SURAT SEKOLAH & TANDA TANGAN (TTD) */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 sm:p-8 card-shadow border border-slate-200 space-y-6 w-full min-w-0">
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <School className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight truncate">
              Identitas Satuan Pendidikan & Tanda Tangan (TTD)
            </h3>
            <p className="text-xs text-slate-500 font-medium truncate">
              Data ini otomatis tersinkronisasi ke Kop Surat, Lembar Kisi-Kisi, dan TTD pada PDF & Word
            </p>
          </div>
        </div>

        {/* School & Academic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">
          <div className="space-y-1.5 min-w-0">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Nama Sekolah / Madrasah
            </label>
            <input
              type="text"
              value={formSettings.schoolName}
              onChange={(e) => setFormSettings({ ...formSettings, schoolName: e.target.value })}
              placeholder="Misal: SMP Negeri 1 Jakarta"
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-1.5 min-w-0">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Kota / Kabupaten Lokasi
            </label>
            <input
              type="text"
              value={formSettings.schoolCity || ""}
              onChange={(e) => setFormSettings({ ...formSettings, schoolCity: e.target.value })}
              placeholder="Misal: Jakarta, Surabaya, Bandung"
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-1.5 min-w-0">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Tahun Ajaran Aktif
            </label>
            <input
              type="text"
              value={formSettings.academicYear || ""}
              onChange={(e) => setFormSettings({ ...formSettings, academicYear: e.target.value })}
              placeholder="Misal: 2024/2025"
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Teacher and Principal Sign-off info */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Guru Pengampu */}
          <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Identitas Guru Pengampu (Pembuat Soal)
              </h4>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Nama Lengkap & Gelar Guru
              </label>
              <input
                type="text"
                value={formSettings.teacherName || ""}
                onChange={(e) => setFormSettings({ ...formSettings, teacherName: e.target.value })}
                placeholder="Misal: Budi Santoso, S.Pd., M.Kom."
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                NIP / NUPTK Guru
              </label>
              <input
                type="text"
                value={formSettings.teacherNip || ""}
                onChange={(e) => setFormSettings({ ...formSettings, teacherNip: e.target.value })}
                placeholder="Misal: 19880315 201502 1 003 atau -"
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Kepala Sekolah */}
          <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Identitas Kepala Satuan Pendidikan
              </h4>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Nama Lengkap & Gelar Kepala Sekolah
              </label>
              <input
                type="text"
                value={formSettings.principalName || ""}
                onChange={(e) => setFormSettings({ ...formSettings, principalName: e.target.value })}
                placeholder="Misal: Dr. Hj. Siti Aminah, M.Pd."
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                NIP / NUPTK Kepala Sekolah
              </label>
              <input
                type="text"
                value={formSettings.principalNip || ""}
                onChange={(e) => setFormSettings({ ...formSettings, principalNip: e.target.value })}
                placeholder="Misal: 19750810 199903 1 002 atau -"
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Fitur Tanda Tangan & Lembar Pengesahan (Aktif / Non-Aktif) */}
        <div id="settings-signature-section" className="p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${formSettings.enableSignatures ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                <FileSignature className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Fitur Tanda Tangan & Lembar Pengesahan
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                    formSettings.enableSignatures 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {formSettings.enableSignatures ? 'Aktif' : 'Non-Aktif (Default)'}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur apakah lembar tanda tangan pengesahan dicantumkan pada kisi-kisi dan naskah soal.
                </p>
              </div>
            </div>

            {/* Segmented Switch Aktif / Non-Aktif */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                id="btn-signature-inactive"
                onClick={() => handleToggleSignatures(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  !formSettings.enableSignatures
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${!formSettings.enableSignatures ? 'bg-rose-500' : 'bg-slate-300'}`}></span>
                Non-Aktif
              </button>
              <button
                type="button"
                id="btn-signature-active"
                onClick={() => handleToggleSignatures(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  formSettings.enableSignatures
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${formSettings.enableSignatures ? 'bg-white' : 'bg-slate-300'}`}></span>
                Aktif
              </button>
            </div>
          </div>

          {/* Status Explanation Card */}
          {!formSettings.enableSignatures ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Tanda Tangan Dinonaktifkan (Tidak Digunakan di Manapun)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Saat <strong>Non-Aktif</strong>, lembar tanda tangan dan nama pengesahan pejabat <strong>TIDAK akan dimuat di manapun</strong> (baik pada Kisi-kisi, Naskah Soal Asesmen, cetak A4, maupun ekspor PDF dan Word). Dokumen Anda akan tampil lebih ringkas tanpa kolom tanda tangan.
              </p>
              <div className="mt-2 p-3 bg-white rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-400 font-medium">
                [ Kolom Tanda Tangan Ditiadakan dari Dokumen ]
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Fitur Aktif:</strong> Lembar tanda tangan berikut akan otomatis dimuat di bagian akhir Kisi-kisi dan Naskah Soal Resmi (PDF & Word).
                </span>
              </div>

              {/* Live Preview of Lembar TTD */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-center text-xs">
                <div className="space-y-1">
                  <p className="text-slate-600 font-medium">Mengetahui,</p>
                  <p className="font-bold text-slate-800">Kepala Satuan Pendidikan</p>
                  <div className="h-10"></div>
                  <p className="font-black text-slate-900 underline">
                    ( {formSettings.principalName || "Nama Kepala Sekolah, M.Pd."} )
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    NIP. {formSettings.principalNip || "...................................."}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-slate-600 font-medium">
                    {formSettings.schoolCity || "Kota"}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="font-bold text-slate-800">Guru Mata Pelajaran</p>
                  <div className="h-10"></div>
                  <p className="font-black text-slate-900 underline">
                    ( {formSettings.teacherName || "Nama Guru Pengampu, S.Pd."} )
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    NIP. {formSettings.teacherNip || "...................................."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 w-full min-w-0">
          <div className="space-y-1.5 min-w-0">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Poin Default per Soal
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={formSettings.defaultPointsPerQuestion}
              onChange={(e) => setFormSettings({ ...formSettings, defaultPointsPerQuestion: Number(e.target.value) })}
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* SECTION PENGATURAN KELAS (MANUAL) */}
        <div className="pt-6 border-t border-slate-100 space-y-4 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight flex items-center gap-2">
                <ListPlus className="w-4 h-4 text-blue-600" />
                Daftar Kelas (Input Manual Guru)
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Tambahkan daftar kelas yang Anda ampu secara manual. Kelas yang tersimpan di sini dapat Anda pilih fleksibel saat membuat Google Form.
              </p>
            </div>

            {/* Counter and Clear All */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                {formSettings.classList.length} Kelas Tersimpan
              </span>
              {formSettings.classList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllClasses}
                  className="px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 border border-rose-200"
                  title="Hapus semua kelas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua</span>
                </button>
              )}
            </div>
          </div>

          {/* Add class input */}
          <div className="flex items-center gap-2 w-full min-w-0">
            <input
              type="text"
              value={newClassInput}
              onChange={(e) => setNewClassInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddClass();
                }
              }}
              placeholder="Ketik nama kelas (contoh: 8A, 8B, atau pisahkan dengan koma)..."
              className="flex-1 h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white min-w-0"
            />
            <button
              type="button"
              onClick={handleAddClass}
              className="px-4 h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kelas</span>
            </button>
          </div>

          {/* Active class badges list */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 w-full min-w-0">
            <div className="flex flex-wrap gap-2">
              {formSettings.classList.length === 0 ? (
                <div className="w-full text-center py-4 space-y-1">
                  <p className="text-xs text-slate-500 font-bold">Belum ada daftar kelas yang ditambahkan.</p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Ketik nama kelas Anda pada kolom di atas (misal: 7A, 7B, 8A) lalu tekan tombol <strong>Tambah Kelas</strong>.
                  </p>
                </div>
              ) : (
                formSettings.classList.map((cls, idx) => (
                  <span
                    key={`${cls}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-800 rounded-xl text-xs font-black shadow-2xs group"
                  >
                    <span>{cls}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveClass(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title={`Hapus ${cls}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            {formSettings.classList.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-2.5 font-medium">
                * Saat membuka dialog Buat Google Form, Anda dapat mencentang/memilih kelas mana saja dari daftar di atas yang akan digunakan.
              </p>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            id="btn-save-settings"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 uppercase tracking-wider cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>

      {/* PEMBERITAHUAN: CADANGAN & EKSPOR DATA TELAH DIPINDAHKAN KE MENU ADMIN */}
      <section className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/60 rounded-3xl p-5 sm:p-7 border border-blue-200/80 space-y-4 w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                  Cadangkan & Ekspor Data Dipindahkan ke Menu Admin
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-300">
                  Pembaruan Sistem
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Fitur ekspor berkas JSON, pemulihan cadangan bank soal, dan pembersihan basis data kini dipusatkan di <strong>Menu Admin</strong> untuk keamanan data sekolah.
              </p>
            </div>
          </div>

          {onNavigateToAdmin && (
            <button
              type="button"
              onClick={onNavigateToAdmin}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Buka Menu Admin</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
