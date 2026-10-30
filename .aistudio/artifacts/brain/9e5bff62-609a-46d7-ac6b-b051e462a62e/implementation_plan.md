# Rencana Implementasi: Notifikasi & Hitung Mundur Kuota AI Habis

Sistem pemantauan kuota pembuatan soal AI yang memberikan notifikasi interaktif kepada guru saat kuota habis atau saat API mencapai limit, dilengkapi dengan hitung mundur waktu (jam dan menit) hingga kuota di-reset kembali pada tengah malam (pukul 00:00), serta rekomendasi alur alternatif tanpa hambatan.

## Keputusan Kritis & Review Pengguna

Berdasarkan klarifikasi yang telah dikonfirmasi oleh pengguna:
- **Mekanisme Penentuan Kuota**: Menggabungkan pelacakan kuota harian lokal per pengguna (misal: 25 generasi/hari) dan deteksi otomatis error limit dari Gemini API (`HTTP 429`, `RESOURCE_EXHAUSTED`, `quotaExceeded`).
- **Waktu Reset Kuota**: Reset otomatis setiap tengah malam (pukul 00:00) waktu lokal perangkat, menjadi acuan hitung mundur dinamis jam dan menit.
- **Bentuk Notifikasi**: Modal dialog popup khusus yang informatif dengan visual hitung mundur waktu aktif (*countdown timer* jam & menit), keterangan waktu reset, dan opsi jalan pintas ke fitur alternatif (Bank Soal, Impor File, atau Buat Manual).

---

## 1. Ikhtisar & Konsep Utama

### Masalah yang Diselesaikan
Ketika guru sedang menyusun soal ujian dan kuota AI harian habis atau kunci API mencapai batas kuota (*rate limit/quota exhaustion*), sistem sebelumnya hanya menampilkan pesan error umum yang dapat membingungkan guru mengenai kapan mereka bisa menggunakan fitur AI kembali.

### Solusi yang Dihadirkan
1. **Layanan Manajemen Kuota AI (`aiQuotaService.ts`)**:
   - Mencatat jumlah pembuatan soal AI harian per akun/perangkat dengan penanda tanggal (YYYY-MM-DD).
   - Mendeteksi error kuota Gemini API dari respons backend (`429 Too Many Requests`, `RESOURCE_EXHAUSTED`, atau pesan limit kuota).
   - Menghitung sisa waktu secara presisi dalam jam, menit, dan detik menuju pergantian hari berikutnya (pukul 00:00).
2. **Komponen Modal Notifikasi Kuota (`QuotaExceededModal.tsx`)**:
   - Dialog popup elegan dan ramah pengguna dengan ikon jam/waktu yang tenang (bukan merah agresif/menakutkan).
   - Tampilan hitung mundur waktu dinamis (*live countdown*) yang berdetik setiap detik: `X Jam Y Menit Z Detik`.
   - Informasi jam reset pasti: *"Kuota Anda akan otomatis diperbarui pada pukul 00:00 (Waktu Lokal)"*.
   - Rekomendasi tindakan produktif selama menunggu:
     - 📚 **Buka Bank Soal**: Menggunakan kembali atau menggabungkan paket soal yang sudah pernah dibuat.
     - 📥 **Impor Soal**: Memasukkan bank soal yang sudah dimiliki lewat format JSON, CSV, atau Teks Guru.
     - ✏️ **Edit & Susun Manual**: Menyusun butir soal secara manual tanpa ketergantungan AI.
3. **Indikator Kuota di Formulir Pembuatan Soal (`CreateQuestionForm.tsx`)**:
   - Menampilkan badge info status kuota harian secara halus di dekat tombol submit agar guru mendapatkan transparansi pemakaian sebelum menekan tombol buat soal.

---

## 2. Alur Pengalaman Pengguna (UX) & Desain Antarmuka

### Alur Interaksi Pengguna
```
[ Guru Mengisi Formulir Soal ]
             │
             ▼
[ Klik Tombol "Buat Naskah Soal dengan AI" ]
             │
     ┌───────┴────────────────────────┐
     ▼                                ▼
[ Kuota Harian Habis ]      [ Kirim Permintaan ke API ]
     │                                │
     │                      ┌─────────┴─────────┐
     │                      ▼                   ▼
     │               [ Berhasil (200) ]   [ Error Limit (429) ]
     │                      │                   │
     │                      ▼                   ▼
     │              [ Buka Halaman      [ Tandai Kuota Habis
     │                 Pratinjau ]         & Catat Cooldown ]
     │                                          │
     └──────────────────────┬───────────────────┘
                            │
                            ▼
              [ Muncul Modal Dialog Kuota ]
              ┌──────────────────────────────────────────────┐
              │  ⏳ Kuota AI Hari Ini Telah Mencapai Batas   │
              │                                              │
              │  Akses akan terbuka kembali dalam:           │
              │  ┌────────────────────────────────────────┐  │
              │  │         04 JAM  38 MENIT  12 DETIK     │  │
              │  │      Otomatis reset pada pukul 00:00   │  │
              │  └────────────────────────────────────────┘  │
              │                                              │
              │  Sementara itu, Bapak/Ibu Guru dapat:        │
              │  • Membuka Bank Soal untuk melihat koleksi   │
              │  • Mengimpor file soal eksternal (JSON/CSV)  │
              │  • Melanjutkan perakitan soal secara manual  │
              │                                              │
              │  [ Buka Bank Soal ]      [ Tutup Notifikasi ]│
              └──────────────────────────────────────────────┘
```

### Visual & Tipografi
- **Warna & Suasana**: Tema profesional dan bersahabat. Menggunakan aksen amber/indigo hangat (`amber-500`, `blue-600`, `slate-900`) untuk nuansa penantian yang informatif, menghindari warna merah krisis yang membuat cemas.
- **Tipografi**: Angka countdown menggunakan font monospaced tebal (`font-mono font-black text-2xl sm:text-3xl`) dengan kontras tinggi agar sangat mudah dibaca sekilas.
- **Aksesibilitas**: Kontras teks memenuhi standar WCAG AA, tombol dapat ditutup dengan tombol Escape atau klik luar, serta fokus navigasi keyboard yang jelas.

---

## 3. Arsitektur Teknis & Struktur Data

### Diagram Komponen & Alur Data
```
┌────────────────────────────────────────────────────────┐
│                      Client Layer                      │
│                                                        │
│  ┌─────────────────────────┐   ┌────────────────────┐  │
│  │ CreateQuestionForm.tsx  │   │  Navbar.tsx / App  │  │
│  └────────────┬────────────┘   └─────────┬──────────┘  │
│               │                          │             │
│               ▼                          ▼             │
│  ┌──────────────────────────────────────────────────┐  │
│  │           aiQuotaService.ts (Storage)            │  │
│  │  - getRemainingDailyQuota()                      │  │
│  │  - getResetCountdownTime()                       │  │
│  │  - recordGenerationUsage()                       │  │
│  │  - markApiRateLimited(retryAfterSeconds?)        │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                            │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │           QuotaExceededModal.tsx                 │  │
│  │  - Live Countdown Timer (HH:MM:SS)               │  │
│  │  - Exact Reset Time Display (00:00)              │  │
│  │  - Quick Action Shortcuts (Bank Soal / Import)   │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST /api/generate-questions
                            ▼
┌────────────────────────────────────────────────────────┐
│                      Server Layer                      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ server/app.ts                                    │  │
│  │  - Tangkap error 429/RESOURCE_EXHAUSTED          │  │
│  │  - Kembalikan format JSON terstruktur:           │  │
│  │    { error, isQuotaExceeded: true, resetAt }     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Format Data Penyimpanan Lokal (`localStorage`)
```ts
interface AiQuotaState {
  date: string; // YYYY-MM-DD
  count: number; // Jumlah yang sudah dipakai hari ini
  limit: number; // Batas harian (default: 25)
  isApiBlocked: boolean; // Jika terkena blokir 429 resmi Gemini
  blockedUntil?: number; // Timestamp epoch ms
  lastErrorReason?: string;
}
```

---

## 4. Langkah Implementasi Terperinci

1. **Pembuatan Layanan `src/lib/aiQuotaService.ts`**:
   - Fungsi inisialisasi & sinkronisasi tanggal harian.
   - Perhitungan hitung mundur jam dan menit menuju pukul 00:00.
   - Pengecekan limit sebelum request dikirim dan pencatatan setelah berhasil.
2. **Penyempurnaan Penanganan Error di `server/app.ts`**:
   - Mendeteksi galat `429`, `RESOURCE_EXHAUSTED`, atau `rate limit` dari SDK Google GenAI.
   - Mengembalikan status HTTP 429 dengan flag `isQuotaExceeded: true` dan pesan edukatif berbahasa Indonesia.
3. **Pembuatan Komponen `src/components/QuotaExceededModal.tsx`**:
   - Desain modal responsif, timer hitung mundur real-time per detik, tombol navigasi langsung ke Bank Soal dan Impor Soal.
4. **Integrasi ke `src/App.tsx` & `src/components/CreateQuestionForm.tsx`**:
   - State modal `isQuotaModalOpen` dan trigger otomatis ketika kuota harian habis atau ketika API mengembalikan respons 429.
   - Penambahan badge kuota harian yang ramah pada formulir pembuatan soal.
5. **Verifikasi & Pengujian**:
   - Uji verifikasi hitung mundur waktu ke tengah malam.
   - Pengujian simulasi batas kuota dan penutupan/pembukaan modal.
   - Pengujian kompilasi `npm run build` dan linting `npm run lint`.
