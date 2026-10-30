export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
    url?: string;
    hostname?: string;
  };
  android?: {
    allowMixedContent?: boolean;
  };
}

const config: CapacitorConfig = {
  appId: 'com.aipembuatsoal.app',
  appName: 'AI Pembuat Soal Guru',
  webDir: 'dist',
  server: {
    // Mode Production (APK/AAB di Android Studio):
    // Membaca file statis lokal dari folder 'dist' tanpa memerlukan WebSocket Vite / HMR server.
    //
    // Catatan untuk Live Reload saat development:
    // Jika ingin live reload di HP fisik Android/Emulator:
    // Gunakan IP WiFi komputer Anda (misal: 'http://192.168.1.5:3000') atau 'http://10.0.2.2:3000' (Emulator).
    // Jangan gunakan 'localhost' karena localhost di Android merujuk ke device itu sendiri.
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
