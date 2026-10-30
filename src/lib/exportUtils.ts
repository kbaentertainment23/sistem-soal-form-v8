import { jsPDF } from "jspdf";
import type { QuestionSet, Question } from "../types.js";
import { getAppSettings } from "./storage.js";
export { exportKisiKisiPDF, exportKisiKisiWord, exportKisiKisiText, getFormattedKisiKisiItems } from "./kisiKisiUtils.js";

/**
 * Generate formatted text for Word (.doc/txt) download or copy
 */
export function exportToWordText(questionSet: QuestionSet | { title: string; subject: string; grade: string; semester: string; questions: Question[] }): string {
  const settings = getAppSettings();
  let content = `${settings.schoolName.toUpperCase()}\n`;
  content += `NASKAH SOAL ASESMEN / UJIAN PILIHAN GANDA\n`;
  content += `Mata Pelajaran : ${questionSet.subject}\n`;
  content += `Kelas / Semester : ${questionSet.grade} / Semester ${questionSet.semester || "1"}\n`;
  content += `Judul : ${questionSet.title}\n`;
  content += `Jumlah Soal : ${questionSet.questions.length} Butir\n`;
  content += `========================================================================\n\n`;
  content += `PETUNJUK PENGERJAAN:\n`;
  content += `1. Berdoalah sebelum mengerjakan soal.\n`;
  content += `2. Bacalah setiap butir pertanyaan dengan cermat.\n`;
  content += `3. Pilihlah satu jawaban yang paling benar pada huruf A, B, C, atau D.\n\n`;
  content += `------------------------------------------------------------------------\n\n`;

  questionSet.questions.forEach((q, idx) => {
    content += `${idx + 1}. ${q.question}\n`;
    q.options.forEach((opt) => {
      content += `   ${opt.label}. ${opt.text}\n`;
    });
    content += `\n`;
  });

  content += `\n========================================================================\n`;
  content += `KUNCI JAWABAN & PEMBAHASAN GURU\n`;
  content += `========================================================================\n\n`;

  questionSet.questions.forEach((q, idx) => {
    content += `Soal No. ${idx + 1}\n`;
    content += `Kunci Jawaban : ${q.correctAnswer}\n`;
    content += `Tingkat / Kognitif : ${q.difficulty} (${q.cognitiveLevel})\n`;
    content += `Skor : ${q.points || 1} Poin\n`;
    if (q.indicator) content += `Indikator : ${q.indicator}\n`;
    if (q.explanation) content += `Pembahasan : ${q.explanation}\n`;
    content += `------------------------------------------------------------------------\n\n`;
  });

  if (settings.enableSignatures) {
    content += `Mengetahui,\n`;
    content += `Kepala Satuan Pendidikan : ${settings.principalName || "Kepala Sekolah, M.Pd."} (NIP. ${settings.principalNip || "-"})\n`;
    content += `Guru Mata Pelajaran      : ${settings.teacherName || "Guru Pengampu, S.Pd."} (NIP. ${settings.teacherNip || "-"})\n`;
  }

  return content;
}

/**
 * Trigger file download in browser
 */
export function downloadFile(filename: string, content: string, mimeType: string = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate official Indonesian Exam PDF using jsPDF
 */
export function exportToPDF(questionSet: QuestionSet | { title: string; subject: string; grade: string; semester: string; questions: Question[] }): void {
  const settings = getAppSettings();
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Function to add header / Kop Ujian
  const drawKop = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(settings.schoolName.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(11);
    doc.text("ASESMEN SUMATIF / PENILAIAN HARIAN", pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Tahun Ajaran ${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, pageWidth / 2, y, { align: "center" });
    y += 3;

    // Double line divider
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 1;
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Identity Box
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Mata Pelajaran :`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${questionSet.subject}`, margin + 28, y);

    doc.setFont("helvetica", "bold");
    doc.text(`Kelas / Sem :`, margin + 95, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${questionSet.grade} / ${questionSet.semester || "1"}`, margin + 118, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text(`Materi Pokok :`, margin, y);
    doc.setFont("helvetica", "normal");
    const matText = doc.splitTextToSize(questionSet.title || "Ujian", 65);
    doc.text(matText, margin + 28, y);

    doc.setFont("helvetica", "bold");
    doc.text(`Jumlah Soal :`, margin + 95, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${questionSet.questions.length} Butir Pilihan Ganda`, margin + 118, y);
    y += 7;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  drawKop();

  // Print Questions
  questionSet.questions.forEach((q, idx) => {
    // Check if new page is needed
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const numPrefix = `${idx + 1}. `;
    const qTextLines = doc.splitTextToSize(`${numPrefix}${q.question}`, contentWidth);
    doc.text(qTextLines, margin, y);
    y += qTextLines.length * 4.5 + 1.5;

    // Options
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    q.options.forEach((opt) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 15;
      }
      const optLines = doc.splitTextToSize(`${opt.label}. ${opt.text}`, contentWidth - 6);
      doc.text(optLines, margin + 4, y);
      y += optLines.length * 4 + 1;
    });

    y += 2.5; // spacing between questions
  });

  // Kunci Jawaban Page
  doc.addPage();
  y = 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("KUNCI JAWABAN & PEMBAHASAN (PEGANGAN GURU)", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Grid for quick answer key
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RINGKASAN KUNCI JAWABAN:", margin, y);
  y += 5;

  let keySummary = "";
  questionSet.questions.forEach((q, i) => {
    keySummary += `${i + 1}.${q.correctAnswer}   `;
    if ((i + 1) % 10 === 0) keySummary += "\n";
  });

  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(keySummary, contentWidth);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4.5 + 5;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Detailed explanations
  doc.setFont("helvetica", "bold");
  doc.text("PEMBAHASAN LENGKAP TIAP BUTIR SOAL:", margin, y);
  y += 5;

  questionSet.questions.forEach((q, idx) => {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.text(`No. ${idx + 1} (Kunci: ${q.correctAnswer} | Skor: ${q.points || 1} | ${q.difficulty} - ${q.cognitiveLevel})`, margin, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    if (q.indicator) {
      const indLines = doc.splitTextToSize(`Indikator: ${q.indicator}`, contentWidth - 4);
      doc.text(indLines, margin + 2, y);
      y += indLines.length * 4;
    }

    if (q.explanation) {
      const expLines = doc.splitTextToSize(`Pembahasan: ${q.explanation}`, contentWidth - 4);
      doc.text(expLines, margin + 2, y);
      y += expLines.length * 4 + 2;
    }
    y += 1;
  });

  // Sign-off Block in Exam PDF (Hanya jika diaktifkan di Pengaturan)
  if (settings.enableSignatures) {
    // Check if sign-off fits
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 15;
    } else {
      y += 8;
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");

    const leftSignX = margin + 30;
    const rightSignX = pageWidth - margin - 40;
    const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.text("Mengetahui,", leftSignX, y, { align: "center" });
    doc.text(`${settings.schoolCity || "Kota"}, ${currentDate}`, rightSignX, y, { align: "center" });
    y += 4;
    doc.text("Kepala Satuan Pendidikan", leftSignX, y, { align: "center" });
    doc.text("Guru Mata Pelajaran", rightSignX, y, { align: "center" });

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.text(`( ${settings.principalName || "Kepala Sekolah, M.Pd."} )`, leftSignX, y, { align: "center" });
    doc.text(`( ${settings.teacherName || "Guru Pengampu, S.Pd."} )`, rightSignX, y, { align: "center" });
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`NIP. ${settings.principalNip || "...................................."}`, leftSignX, y, { align: "center" });
    doc.text(`NIP. ${settings.teacherNip || "...................................."}`, rightSignX, y, { align: "center" });
  }

  // Save PDF
  const filename = `Soal_${(questionSet.subject || "Ujian").replace(/\s+/g, "_")}_Kelas_${questionSet.grade || "X"}.pdf`;
  doc.save(filename);
}
