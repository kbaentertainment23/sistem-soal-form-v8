import type { Question } from "../types.js";

/**
 * Membersihkan nomor soal di awal teks pertanyaan (misal: "1. ", "1) ", "Soal 1: ", "**1.** ")
 * agar di Google Form hanya tampil isi soal murni tanpa nomor urut.
 */
export function stripQuestionNumber(questionText: string): string {
  if (!questionText) return "";
  let clean = questionText.trim();
  clean = clean.replace(/^(?:\*\*|\*|__|_)?(?:(?:soal|nomor|no\.?)\s*\d+[\.\)\:\-\s]*|\d+[\.\)\:\-]\s*)(?:\*\*|\*|__|_)?\s*/i, "").trim();
  return clean || questionText.trim();
}

/**
 * Membersihkan label pilihan jawaban di awal teks opsi (misal: "A. ", "B) ", "(C) ", "[D] ", "**A.** ")
 * agar di Google Form pilihan jawaban tampil murni tanpa label huruf A, B, C, D.
 */
export function stripOptionPrefix(optionText: string): string {
  if (!optionText) return "";
  let clean = optionText.trim();
  clean = clean.replace(/^(?:\*\*|\*|__|_)?(?:\([A-Ea-e]\)|\[[A-Ea-e]\]|[A-Ea-e][\.\)\:\-])(?:\*\*|\*|__|_)?\s*/, "").trim();
  return clean || optionText.trim();
}

export interface GasFormOptions {
  title: string;
  description?: string;
  subject?: string;
  grade?: string;
  questions: Question[];
  includeIdentitySection?: boolean;
  classList?: string[];
  shuffleOptions?: boolean;
}

/**
 * Generates a ready-to-run Google Apps Script (GAS) to create Google Form quizzes instantly
 * with ZERO OAuth setup, ZERO Google Cloud project configuration, and works on ANY Google account.
 */
export function generateGoogleAppsScript(opts: GasFormOptions): string {
  const cleanTitle = (opts.title || "Kuis Ujian Pilihan Ganda").replace(/"/g, '\\"');
  const totalScoreDesc = opts.questions.reduce((sum, q) => sum + (typeof q.points === "number" && q.points > 0 ? q.points : 2), 0);
  const desc = (
    opts.description ||
    `Mata Pelajaran: ${opts.subject || "-"}\\nKelas: ${opts.grade || "-"}\\nTotal Soal: ${opts.questions.length} Butir (Skor Maksimal: ${totalScoreDesc} Poin)\\nPetunjuk: Pilihlah salah satu jawaban yang paling tepat.`
  ).replace(/"/g, '\\"');

  const questionsData = opts.questions.map((q) => ({
    number: q.number,
    question: stripQuestionNumber(q.question),
    options: q.options.map((o) => ({
      label: o.label,
      text: stripOptionPrefix(o.text),
    })),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || "",
    points: typeof q.points === "number" && q.points > 0 ? q.points : 2,
  }));

  const questionsJson = JSON.stringify(questionsData, null, 2);
  const classesJson = JSON.stringify(opts.classList || [], null, 2);
  const includeId = opts.includeIdentitySection !== false;

  return `/**
 * =========================================================================
 * SCRIPT OTOMATIS PEMBUAT GOOGLE FORM KUIS (SOAL GURU AI)
 * =========================================================================
 * Dibuat otomatis oleh Sistem Soal Guru AI.
 * TIDAK PERLU konfigurasi Google Cloud Console atau OAuth Client ID!
 * Dapat dijalankan menggunakan SEMUA akun Google (Gmail pribadi, Belajar.id, Google Workspace).
 * 
 * CARA MENGGUNAKAN (Hanya 3 Langkah Cepat):
 * 1. Buka https://script.new di tab baru browser Anda.
 * 2. Hapus semua teks di editor tersebut, lalu TEMPEL (Paste) seluruh script ini.
 * 3. Klik tombol "Jalankan" (Run / ikon ▶) di bagian atas layar.
 *    (Jika pertama kali, izinkan akses akun Google Anda: Klik 'Tinjau Izin' -> Pilih Akun -> 'Lanjutkan' -> 'Izinkan').
 * 
 * Hasil formulir Google Forms akan langsung jadi di Google Drive akun Anda!
 * =========================================================================
 */

function buatGoogleFormKuis() {
  var judulForm = "${cleanTitle}";
  var deskripsiForm = "${desc}";
  var includeIdentity = ${includeId};
  var daftarKelas = ${classesJson};
  var dataSoal = ${questionsJson};

  Logger.log("Mulai membuat Google Form: " + judulForm);

  // 1. Buat Formulir Baru
  var form = FormApp.create(judulForm);
  form.setDescription(deskripsiForm);
  form.setIsQuiz(true);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setProgressBar(true);

  // 2. Bagian Identitas Siswa
  if (includeIdentity) {
    var itemNama = form.addTextItem();
    itemNama.setTitle("Nama Lengkap Siswa")
            .setHelpText("Tuliskan nama lengkap Anda sesuai data absensi kelas.")
            .setRequired(true);

    if (daftarKelas && daftarKelas.length > 0) {
      var itemKelas = form.addListItem();
      itemKelas.setTitle("Kelas")
               .setHelpText("Pilih kelas Anda dari daftar.")
               .setChoiceValues(daftarKelas)
               .setRequired(true);
    } else {
      var itemKelasText = form.addTextItem();
      itemKelasText.setTitle("Kelas / Rombel")
                   .setHelpText("Tuliskan nama kelas Anda (contoh: VIII-A).")
                   .setRequired(true);
    }

    var itemNomorAbsen = form.addTextItem();
    itemNomorAbsen.setTitle("Nomor Absen / NISN")
                  .setHelpText("Masukkan nomor absen atau NISN siswa (opsional).")
                  .setRequired(false);

    // Pemisah Bagian (Section Break)
    form.addPageBreakItem()
        .setTitle("LEMBAR SOAL UJIAN")
        .setHelpText("Pilihlah salah satu jawaban yang paling tepat pada setiap nomor soal.");
  }

  // 3. Masukkan Seluruh Butir Soal Pilihan Ganda (Murni tanpa nomor soal dan tanpa label A, B, C, D)
  for (var i = 0; i < dataSoal.length; i++) {
    var q = dataSoal[i];
    var mcItem = form.addMultipleChoiceItem();
    mcItem.setTitle(q.question)
          .setPoints(q.points || 2)
          .setRequired(true);

    var choices = [];
    var correctFound = false;
    for (var j = 0; j < q.options.length; j++) {
      var opt = q.options[j];
      var isCorrect = (
        String(opt.label).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase() ||
        String(opt.text).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase()
      );
      if (isCorrect) correctFound = true;
      var choiceText = opt.text;
      choices.push(mcItem.createChoice(choiceText, isCorrect));
    }
    if (!correctFound && choices.length > 0) {
      choices[0] = mcItem.createChoice(q.options[0].text, true);
    }
    mcItem.setChoices(choices);

    // Pembahasan Feedback
    if (q.explanation && q.explanation.trim() !== "") {
      var feedback = FormApp.createFeedback()
        .setText("Pembahasan:\\n" + q.explanation)
        .build();
      mcItem.setFeedbackForCorrect(feedback);
      mcItem.setFeedbackForIncorrect(feedback);
    }
  }

  var editUrl = form.getEditUrl();
  var publishedUrl = form.getPublishedUrl();

  Logger.log("=================================================");
  Logger.log("✅ GOOGLE FORM BERHASIL DIBUAT!");
  Logger.log("Link Edit Guru: " + editUrl);
  Logger.log("Link Siswa Mengerjakan: " + publishedUrl);
  Logger.log("=================================================");

  // Tampilkan notifikasi jika editor mendukung UI
  try {
    var ui = FormApp.getUi();
    ui.alert(
      "🎉 Formulir Google Forms Berhasil Dibuat!",
      "Formulir sudah tersimpan di Google Drive Anda.\\n\\n" +
      "Judul: " + judulForm + "\\n" +
      "Total Soal: " + dataSoal.length + " butir\\n\\n" +
      "Link Edit: " + editUrl,
      ui.ButtonSet.OK
    );
  } catch (e) {
    // Abaikan jika dieksekusi tanpa antarmuka grafis
  }
}
`;
}
