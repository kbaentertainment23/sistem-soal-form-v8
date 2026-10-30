import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, Check, ArrowRight, Laptop } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

interface PWAInstallButtonProps {
  variant?: 'nav' | 'banner' | 'card' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'nav',
  className = ''
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If app is already opened in standalone mode, hide the install buttons
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 3500);
      }
    } else {
      // Show guided instructions for iOS or desktop/mobile browsers
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Variant: NAV (Header / Navbar button) */}
      {variant === 'nav' && (
        <button
          type="button"
          onClick={handleInstallClick}
          id="btn-pwa-install-nav"
          title="Pasang aplikasi ke layar laptop atau ponsel Anda"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 active:scale-95 transition-all cursor-pointer ${className}`}
        >
          {installSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-300" />
              <span>Terpasang!</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 animate-bounce" />
              <span className="hidden sm:inline">Install Aplikasi</span>
              <span className="sm:hidden">Install</span>
            </>
          )}
        </button>
      )}

      {/* Variant: COMPACT (Minimal icon button for tight spaces) */}
      {variant === 'compact' && (
        <button
          type="button"
          onClick={handleInstallClick}
          id="btn-pwa-install-compact"
          title="Install ke Layar Utama"
          className={`p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200 cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 text-blue-600" />
        </button>
      )}

      {/* Variant: CARD / BANNER (Full instructional prompt in Settings or Dashboard) */}
      {(variant === 'banner' || variant === 'card') && (
        <div
          id="pwa-install-promo-card"
          className={`relative overflow-hidden rounded-2xl p-5 border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-50 shadow-xs ${className}`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight">
                    Pasang Aplikasi ke Perangkat (PWA)
                  </h4>
                  <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-blue-100 text-blue-700">
                    Cepat & Ringan
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Buka Soal Guru layaknya aplikasi asli tanpa buka tab browser. Bebas hambatan, hemat kuota, dan dapat diakses langsung dari Home Screen laptop atau smartphone.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleInstallClick}
              id="btn-pwa-install-banner"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Pasang Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* Guided Installation Modal (for iOS or browsers without native beforeinstallprompt) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-600/30 shrink-0">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {isIOS ? "Pasang di iPhone / iPad" : "Pasang Aplikasi Soal Guru"}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Petunjuk instalasi ke Layar Utama perangkat
                </p>
              </div>
            </div>

            {isIOS ? (
              /* iOS Safari Instructions */
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0 text-xs">
                    1
                  </div>
                  <p className="pt-0.5">
                    Ketuk tombol <strong>Bagikan / Share</strong> (<Share2 className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />) pada bilah bawah browser Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0 text-xs">
                    2
                  </div>
                  <p className="pt-0.5">
                    Gulir ke bawah dan ketuk opsi <strong>"Tambahkan ke Layar Utama"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />).
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0 text-xs">
                    3
                  </div>
                  <p className="pt-0.5">
                    Ketuk <strong>"Tambah"</strong> di pojok kanan atas. Ikon Soal Guru akan langsung muncul di menu iPhone/iPad Anda!
                  </p>
                </div>
              </div>
            ) : (
              /* Android & Desktop Chrome/Edge Instructions */
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black shrink-0 text-xs">
                    <Laptop className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">Di Komputer / Laptop (Chrome / Edge):</p>
                    <p className="text-slate-600">
                      Klik ikon <strong>Install Aplikasi</strong> (<Download className="w-3 h-3 inline text-blue-600" />) di ujung kanan bilah alamat (URL bar) browser Anda.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0 text-xs">
                    <Smartphone className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">Di Smartphone Android:</p>
                    <p className="text-slate-600">
                      Ketuk menu titik tiga (<strong>⋮</strong>) di pojok kanan atas browser, lalu pilih <strong>"Install Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
            >
              Mengerti, Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
