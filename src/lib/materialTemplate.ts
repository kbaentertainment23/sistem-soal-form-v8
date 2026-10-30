/**
 * Template & Format Rekomendasi Pengisian Materi Khusus "Ketik Materi"
 * Dirancang agar hasil generate soal AI memiliki presisi 100%, selaras CP/TP,
 * menyajikan stimulus kontekstual HOTS, dan tidak melebar keluar dari silabus guru.
 */

export const MATERIAL_INPUT_TEMPLATE = `[JUDUL MATERI / BAB POKOK]
Topik: 

[TUJUAN PEMBELAJARAN (TP / CP)]
1. Peserta didik dapat ...
2. Peserta didik mampu ...

[POIN KONSEP ESENSIAL YANG DIUJI]
1. Konsep Utama: (Tuliskan definisi, sifat, atau fungsi pokok materi)
2. Komponen / Jenis / Rumus: (Rincian klasifikasi, jenis-jenis, rumus, atau mekanisme kerja)
3. Analisis / Perbandingan: (Perbedaan antar konsep, proses sebab-akibat, atau hubungan variabel)

[KATA KUNCI & ISTILAH PENTING]
• (Daftar istilah atau kosakata ilmiah spesifik yang wajib diujikan pada soal)

[STIMULUS & STUDI KASUS KONTEKSTUAL (UNTUK SOAL HOTS)]
• (Situasi nyata, fenomena kehidupan sehari-hari, data percobaan, atau masalah kontekstual)

[BATASAN MATERI (ANTI-MELEBAR)]
• Fokus pada: (Materi esensial yang diajarkan di kelas)
• Jangan sertakan: (Topik tingkat lanjut atau istilah rumit di luar silabus)`;

export const MATERIAL_INPUT_EXAMPLE = `[JUDUL MATERI / BAB POKOK]
Topik: Jaringan Komputer dan Topologi Jaringan

[TUJUAN PEMBELAJARAN (TP / CP)]
1. Peserta didik dapat mengidentifikasi jenis-jenis jaringan berdasarkan jangkauan geografis.
2. Peserta didik mampu membedakan karakteristik, kelebihan, dan kelemahan topologi Star, Bus, dan Mesh.
3. Peserta didik mampu menjelaskan fungsi utama perangkat keras jaringan (Router, Switch, Access Point, Kabel UTP).

[POIN KONSEP ESENSIAL YANG DIUJI]
1. Klasifikasi Jaringan:
   - LAN (Local Area Network): Jaringan lokal ruang/gedung terbatas.
   - MAN (Metropolitan Area Network): Jaringan antar gedung dalam satu kota.
   - WAN (Wide Area Network): Jaringan luas antar kota, pulau, atau negara.
   - Internet: Jaringan komputer global terbesar yang saling terhubung.
2. Topologi Jaringan:
   - Topologi Star: Menggunakan konsentrator pusat (Switch/Hub); jika satu kabel putus, komputer lain tidak terganggu; mudah deteksi kerusakan.
   - Topologi Bus: Menggunakan satu kabel utama (backbone) dengan terminator; hemat kabel namun jika kabel utama putus seluruh jaringan mati.
   - Topologi Mesh: Setiap perangkat terhubung langsung ke perangkat lain; keandalan sangat tinggi namun boros kabel dan biaya instalasi tinggi.
3. Perangkat Keras Jaringan:
   - Router: Menghubungkan dua atau lebih jaringan berbeda segmen/IP dan meneruskan paket data ke internet.
   - Switch: Menghubungkan banyak komputer dalam satu LAN dan meneruskan data berdasarkan alamat MAC.
   - Access Point: Memancarkan sinyal nirkabel (Wi-Fi) untuk menghubungkan perangkat nirkabel ke LAN.

[KATA KUNCI & ISTILAH PENTING]
• LAN, MAN, WAN, Topologi Star, Topologi Bus, Topologi Mesh, Router, Switch, Access Point, Kabel UTP, MAC Address, IP Address.

[STIMULUS & STUDI KASUS KONTEKSTUAL (UNTUK SOAL HOTS)]
• Kasus laboratorium komputer sekolah: Sebuah lab memiliki 32 unit komputer yang sering mengalami gangguan koneksi kabel. Siswa diminta menganalisis topologi mana yang paling andal dan perangkat konsentrator apa yang tepat dipasang.

[BATASAN MATERI (ANTI-MELEBAR)]
• Fokus pada perangkat keras dan topologi dasar jenjang SMP/SMA awal. Jangan sertakan konfigurasi subnetting IP rumit (CIDR / VLSM) atau routing dinamis BGP/OSPF.`;

export interface GuideSectionItem {
  tag: string;
  title: string;
  description: string;
  benefit: string;
}

export const MATERIAL_GUIDE_SECTIONS: GuideSectionItem[] = [
  {
    tag: "1. Judul & Bab Pokok",
    title: "Membatasi Ruang Lingkup Materi",
    description: "Tuliskan nama bab atau pokok materi spesifik yang sedang diajarkan di kelas.",
    benefit: "Menjamin judul asesmen dan penamaan kisi-kisi tepat sasaran.",
  },
  {
    tag: "2. Tujuan Pembelajaran (TP/CP)",
    title: "Rujukan Indikator Butir Soal",
    description: "Tuliskan 2-4 capaian atau tujuan pembelajaran yang ingin diukur.",
    benefit: "AI menyusun indikator soal dan kisi-kisi yang 100% selaras dengan TP guru.",
  },
  {
    tag: "3. Poin Konsep Esensial",
    title: "Sebaran Materi yang Adil",
    description: "Rincian sub-topik, pengertian, klasifikasi, rumus, atau mekanisme penting.",
    benefit: "Soal terdistribusi merata ke seluruh sub-topik tanpa menumpuk di bagian awal saja.",
  },
  {
    tag: "4. Kata Kunci & Istilah",
    title: "Akurasi Terminologi Akademis",
    description: "Daftar istilah penting atau kosakata ilmiah yang diajarkan pada bab ini.",
    benefit: "Memastikan istilah resmi muncul di pokok soal dan opsi jawaban.",
  },
  {
    tag: "5. Stimulus & Kasus Nyata",
    title: "Pemicu Soal Penalaran (HOTS)",
    description: "Beri contoh kasus sehari-hari, data percobaan, atau masalah kontekstual.",
    benefit: "Menghasilkan stimulus soal berpikir tingkat tinggi (C4-C6) yang aplikatif.",
  },
  {
    tag: "6. Batasan Materi",
    title: "Pagar Pengaman Anti-Melebar",
    description: "Tentukan batasan apa yang boleh dan apa yang DILARANG diujikan.",
    benefit: "Mencegah AI memunculkan rumus rumit atau teori kuliah yang belum dipelajari siswa.",
  },
];

/**
 * Salin teks ke clipboard secara aman dengan fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Gagal menyalin teks ke clipboard:", err);
    return false;
  }
}
