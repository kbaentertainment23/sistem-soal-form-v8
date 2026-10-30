import type { QuestionSet, Question } from "../types.js";

/**
 * Generates an HTML document structured as a standard Indonesian Exam template,
 * which can be downloaded as .docx / .doc and opened directly in Microsoft Word.
 */
export function generateExamTemplateDocx(): string {
  const content = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>Format Kisi-kisi & Naskah Soal Guru</title>
<style>
  @page {
    size: 21.59cm 33.0cm; /* F4 / Folio standard or A4 */
    margin: 2cm 2cm 2cm 2cm;
    mso-header-margin: 1cm;
    mso-footer-margin: 1cm;
  }
  body {
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 11pt;
    line-height: 1.35;
    color: #000000;
  }
  h1, h2, h3, h4 {
    margin: 0;
    padding: 0;
    text-align: center;
    font-family: 'Calibri', 'Arial', sans-serif;
  }
  .header-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 15px;
    border-bottom: 3px double #000;
    padding-bottom: 8px;
  }
  .meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    font-size: 10pt;
  }
  .meta-table td {
    padding: 3px 6px;
    vertical-align: top;
  }
  .instruksi-box {
    background-color: #f3f4f6;
    border: 1px solid #9ca3af;
    padding: 10px 14px;
    font-size: 9.5pt;
    margin-bottom: 20px;
  }
  .question-block {
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .q-number {
    font-weight: bold;
    display: inline;
  }
  .q-text {
    display: inline;
  }
  .options-table {
    margin-left: 20px;
    margin-top: 4px;
    border-collapse: collapse;
  }
  .options-table td {
    padding: 2px 4px;
    vertical-align: top;
    font-size: 10.5pt;
  }
  .answer-key-box {
    margin-left: 20px;
    margin-top: 5px;
    font-size: 9.5pt;
    color: #1e3a8a;
    background-color: #eff6ff;
    padding: 4px 8px;
    border-left: 3px solid #3b82f6;
  }
</style>
</head>
<body>

<div style="text-align: center; margin-bottom: 12px;">
  <h2 style="font-size: 14pt; font-weight: bold; text-transform: uppercase;">FORMAT PENYUSUNAN NASKAH SOAL PILIHAN GANDA</h2>
  <h3 style="font-size: 12pt; font-weight: bold; color: #374151;">STANDAR SISTEM OTOMASI GOOGLE FORM</h3>
</div>

<table class="meta-table">
  <tr>
    <td style="width: 20%; font-weight: bold;">Mata Pelajaran</td>
    <td style="width: 30%;">: [Tuliskan Nama Mapel, contoh: Informatika]</td>
    <td style="width: 20%; font-weight: bold;">Kelas / Jenjang</td>
    <td style="width: 30%;">: [Tuliskan Kelas, contoh: Kelas VIII / SMP]</td>
  </tr>
  <tr>
    <td style="font-weight: bold;">Materi Pokok</td>
    <td colspan="3">: [Tuliskan Topik / Bab Materi Pembelajaran]</td>
  </tr>
</table>

<div class="instruksi-box">
  <strong>PANDUAN PENGISIAN UNTUK GURU:</strong><br>
  1. Anda dapat menulis butir soal secara langsung pada format di bawah ini, atau menyalin dari bank soal yang Anda miliki.<br>
  2. Format butir soal: Nomor soal diikuti teks pertanyaan, opsi jawaban (A, B, C, D, atau E), dan baris <em>Kunci Jawaban: [Huruf]</em>.<br>
  3. <strong>Materi Pokok / Sub-Materi Tiap Soal (Sangat Dianjurkan):</strong> Cantumkan <em>Materi: [Topik Spesifik]</em> pada setiap butir soal agar sistem dapat otomatis menyusun tabel Kisi-Kisi Ujian, indikator, dan distribusi materi tanpa perlu pengisian manual.<br>
  4. Baris <em>[Pembahasan: ...]</em> dan <em>[Indikator: ...]</em> bersifat opsional namun sangat dianjurkan agar otomatis tersusun lengkap di sistem.<br>
  5. Simpan file ini sebagai <strong>.docx</strong> atau <strong>.doc</strong> lalu unggah kembali pada fitur <strong>"Format Soal (.docx)"</strong>.
</div>

<hr style="border: none; border-top: 1px solid #d1d5db; margin: 20px 0;" />

<!-- CONTOH SOAL 1 -->
<div class="question-block">
  <p style="margin: 0 0 4px 0;">
    <strong>1.</strong> Perangkat keras jaringan komputer yang berfungsi untuk menghubungkan beberapa komputer dalam satu jaringan lokal (LAN) serta meneruskan paket data ke alamat tujuan secara spesifik adalah...
  </p>
  <table class="options-table">
    <tr><td style="width: 25px; font-weight: bold;">A.</td><td>Router</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">B.</td><td>Switch</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">C.</td><td>Modem</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">D.</td><td>Repeater</td></tr>
  </table>
  <div class="answer-key-box">
    <strong>Kunci Jawaban: B</strong> | <strong>Materi: Perangkat Jaringan Lokal (Switch)</strong><br>
    <em>Pembahasan: Switch bekerja pada Data Link Layer dan meneruskan frame secara spesifik ke port tujuan berdasarkan MAC Address.</em><br>
    <em>Level Kognitif: C2 (Memahami) | Indikator: Siswa dapat mengidentifikasi fungsi perangkat jaringan switch.</em>
  </div>
</div>

<!-- CONTOH SOAL 2 -->
<div class="question-block">
  <p style="margin: 0 0 4px 0;">
    <strong>2.</strong> Dalam sebuah topologi jaringan Star, apabila salah satu kabel komputer klien terputus atau mengalami gangguan, maka dampak yang akan terjadi pada seluruh jaringan adalah...
  </p>
  <table class="options-table">
    <tr><td style="width: 25px; font-weight: bold;">A.</td><td>Seluruh jaringan akan lumpuh dan tidak bisa berkomunikasi</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">B.</td><td>Hanya komputer tersebut yang terputus, sedangkan komputer lainnya tetap berfungsi normal</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">C.</td><td>Server pusat akan otomatis mengalami restart berulang kali</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">D.</td><td>Kecepatan koneksi internet seluruh komputer klien akan menurun drastis</td></tr>
  </table>
  <div class="answer-key-box">
    <strong>Kunci Jawaban: B</strong> | <strong>Materi: Karakteristik Topologi Star</strong><br>
    <em>Pembahasan: Keunggulan topologi Star adalah isolasi kesalahan; kerusakan kabel pada satu node klien tidak mempengaruhi komunikasi node lainnya.</em><br>
    <em>Level Kognitif: C4 (Menganalisis) | Indikator: Siswa dapat menganalisis kelebihan topologi star dalam penanganan gangguan.</em>
  </div>
</div>

<!-- CONTOH SOAL 3 -->
<div class="question-block">
  <p style="margin: 0 0 4px 0;">
    <strong>3.</strong> Protokol jaringan yang bertugas memberikan konfigurasi alamat IP secara otomatis kepada perangkat yang baru terhubung ke jaringan lokal disebut...
  </p>
  <table class="options-table">
    <tr><td style="width: 25px; font-weight: bold;">A.</td><td>DNS (Domain Name System)</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">B.</td><td>HTTP (Hypertext Transfer Protocol)</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">C.</td><td>DHCP (Dynamic Host Configuration Protocol)</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">D.</td><td>FTP (File Transfer Protocol)</td></tr>
  </table>
  <div class="answer-key-box">
    <strong>Kunci Jawaban: C</strong> | <strong>Materi: Protokol Jaringan (DHCP)</strong><br>
    <em>Pembahasan: DHCP (Dynamic Host Configuration Protocol) adalah layanan jaringan yang secara otomatis mendistribusikan IP Address ke klien.</em><br>
    <em>Level Kognitif: C1 (Mengingat) | Indikator: Siswa dapat mengingat kepanjangan dan fungsi protokol DHCP.</em>
  </div>
</div>

<!-- TEMPLATE KOSONG UNTUK DILANJUTKAN GURU -->
<div style="margin-top: 30px; padding: 15px; border: 2px dashed #9ca3af; background-color: #fafafa;">
  <p style="margin: 0 0 10px 0; font-weight: bold; color: #4b5563;">
    [LANJUTKAN BUTIR SOAL ANDA DI SINI - HAPUS TEKS CONTOH JIKA TIDAK DIPERLUKAN]
  </p>
  <p style="margin: 0 0 4px 0;">
    <strong>4.</strong> [Tuliskan pertanyaan soal nomor 4 di sini...]
  </p>
  <table class="options-table">
    <tr><td style="width: 25px; font-weight: bold;">A.</td><td>[Pilihan A]</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">B.</td><td>[Pilihan B]</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">C.</td><td>[Pilihan C]</td></tr>
    <tr><td style="width: 25px; font-weight: bold;">D.</td><td>[Pilihan D]</td></tr>
  </table>
  <div class="answer-key-box">
    <strong>Kunci Jawaban: A</strong> | <strong>Materi: [Tuliskan Materi / Sub-Topik Soal Ini]</strong><br>
    <em>Pembahasan: [Tuliskan pembahasan singkat kunci jawaban]</em><br>
    <em>Level Kognitif: C3 | Indikator: [Indikator capaian soal ini]</em>
  </div>
</div>

</body>
</html>`;

  return content;
}

/**
 * Triggers instant browser download of the Word DOCX template file.
 */
export function downloadExamTemplateDocx(fileName = "Format_Soal_Guru.docx") {
  const htmlContent = generateExamTemplateDocx();
  const blob = new Blob(["\ufeff", htmlContent], {
    type: "application/msword",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
