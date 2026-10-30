import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      id="pwa-offline-banner"
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-600 text-white shadow-xl shadow-amber-900/20 border border-amber-500 animate-slideUp"
    >
      <div className="w-8 h-8 rounded-xl bg-amber-700/60 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
      </div>
      <div className="text-xs leading-tight">
        <p className="font-black tracking-tight">Mode Offline Aktif</p>
        <p className="text-amber-100 font-medium">
          Aplikasi tetap dapat digunakan. Bank soal dan draf yang tersimpan tetap dapat diakses.
        </p>
      </div>
    </aside>
  );
};
