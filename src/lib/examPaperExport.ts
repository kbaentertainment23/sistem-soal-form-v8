import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  HeightRule,
} from "docx";
import type { QuestionSet, Question } from "../types.js";
import { getAppSettings } from "./storage.js";
import { formatGradeDisplay, cleanExamTitle, cleanGrade } from "./classUtils.js";

/**
 * Helper to trigger file download in the browser
 */
function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate and download official examination paper in Microsoft Word (.docx) format.
 * Exactly matches the Indonesian official school exam paper layout.
 */
export async function downloadExamPaperDOCX(
  questionSet: QuestionSet,
  showAnswerKeys: boolean = false
): Promise<void> {
  const settings = getAppSettings();
  const schoolName = (settings.schoolName || "SMP / SMA NEGERI NUSANTARA").toUpperCase();
  const subject = questionSet.subject || "Mata Pelajaran";
  const gradeDisplay = formatGradeDisplay(questionSet.grade) || "Kelas X";
  const semester = questionSet.semester || "1";
  const academicYear = settings.academicYear || "2024 / 2025";
  const totalQuestions = questionSet.questions.length;
  const currentDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const city = settings.schoolCity || "Kota";

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 72pt * 20 = 1440 dxa
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          // 1. KOP RESMI UJIAN
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "DINAS PENDIDIKAN DAN KEBUDAYAAN • PROVINSI / KABUPATEN",
                bold: true,
                size: 20, // 10pt
                font: "Times New Roman",
                color: "1E293B",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: schoolName,
                bold: true,
                size: 26, // 13pt
                font: "Times New Roman",
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: "LEMBAR ASESMEN SUMATIF / PENILAIAN AKHIR SEMESTER",
                bold: true,
                size: 24, // 12pt
                font: "Times New Roman",
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            border: {
              bottom: {
                style: BorderStyle.DOUBLE,
                size: 24,
                color: "0F172A",
                space: 4,
              },
            },
            children: [
              new TextRun({
                text: `TAHUN AJARAN ${academicYear} • KURIKULUM MERDEKA & K13`,
                size: 19, // 9.5pt
                font: "Times New Roman",
                color: "334155",
              }),
            ],
          }),

          // SPACING
          new Paragraph({ spacing: { before: 80, after: 80 } }),

          // 2. TABEL METADATA UJIAN
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
              left: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
              right: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    children: [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: "Mata Pelajaran  : ", bold: true, size: 19, font: "Times New Roman" }),
                          new TextRun({ text: subject, size: 19, font: "Times New Roman" }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: "Kelas / Fase     : ", bold: true, size: 19, font: "Times New Roman" }),
                          new TextRun({ text: `${gradeDisplay} (Sem. ${semester})`, size: 19, font: "Times New Roman" }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Materi Pokok   : ", bold: true, size: 19, font: "Times New Roman" }),
                          new TextRun({ text: questionSet.material || questionSet.title, size: 19, font: "Times New Roman" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    children: [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: "Bentuk Soal      : ", bold: true, size: 19, font: "Times New Roman" }),
                          new TextRun({ text: `Pilihan Ganda (${totalQuestions} Butir)`, size: 19, font: "Times New Roman" }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: "Alokasi Waktu  : ", bold: true, size: 19, font: "Times New Roman" }),
                          new TextRun({ text: "60 – 90 Menit", size: 19, font: "Times New Roman" }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Petunjuk          : ", bold: true, size: 19, font: "Times New Roman" }),
                          new TextRun({ text: "Pilih salah satu jawaban paling tepat (A, B, C, D, atau E)", size: 19, font: "Times New Roman" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // SPACING
          new Paragraph({ spacing: { before: 100, after: 60 } }),

          // 3. PETUNJUK UMUM PENGERJAAN
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: "CBD5E1" },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 60, bottom: 80, left: 40, right: 40 },
                    children: [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: "PETUNJUK UMUM:", bold: true, size: 19, font: "Times New Roman" }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 20 },
                        children: [
                          new TextRun({ text: "1. Berdoalah sebelum mengerjakan soal.", size: 18, font: "Times New Roman", color: "334155" }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 20 },
                        children: [
                          new TextRun({ text: "2. Tulislah nomor peserta dan identitas Anda secara lengkap pada lembar jawaban.", size: 18, font: "Times New Roman", color: "334155" }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 20 },
                        children: [
                          new TextRun({ text: "3. Periksalah kelengkapan naskah soal dan laporkan kepada pengawas jika terdapat kerusakan atau ketidakjelasan.", size: 18, font: "Times New Roman", color: "334155" }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({ text: "4. Dahulukan menjawab soal-soal yang Anda anggap mudah.", size: 18, font: "Times New Roman", color: "334155" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // SPACING
          new Paragraph({ spacing: { before: 100, after: 60 } }),

          // 4. DAFTAR BUTIR SOAL
          ...questionSet.questions.flatMap((q, idx) => {
            const paragraphs: Paragraph[] = [];

            // Question Prompt
            paragraphs.push(
              new Paragraph({
                spacing: { before: 140, after: 60 },
                children: [
                  new TextRun({
                    text: `${idx + 1}.  `,
                    bold: true,
                    size: 21,
                    font: "Times New Roman",
                  }),
                  new TextRun({
                    text: q.question,
                    size: 21,
                    font: "Times New Roman",
                  }),
                ],
              })
            );

            // Options formatted in 2-column or clean list
            // Each option item
            q.options.forEach((opt) => {
              const isKey = showAnswerKeys && opt.label === q.correctAnswer;
              paragraphs.push(
                new Paragraph({
                  indent: { left: 450 },
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: `${opt.label}.  `,
                      bold: true,
                      size: 20,
                      font: "Times New Roman",
                      color: isKey ? "15803D" : "0F172A",
                    }),
                    new TextRun({
                      text: opt.text,
                      size: 20,
                      font: "Times New Roman",
                      bold: isKey,
                      color: isKey ? "15803D" : "0F172A",
                    }),
                    ...(isKey
                      ? [
                          new TextRun({
                            text: "  ★ (Kunci Jawaban)",
                            bold: true,
                            size: 18,
                            font: "Times New Roman",
                            color: "15803D",
                          }),
                        ]
                      : []),
                  ],
                })
              );
            });

            // Teacher explanation callout if showAnswerKeys
            if (showAnswerKeys) {
              paragraphs.push(
                new Paragraph({
                  indent: { left: 450 },
                  spacing: { before: 40, after: 40 },
                  children: [
                    new TextRun({
                      text: `[Kunci: ${q.correctAnswer} | Level: ${q.cognitiveLevel || "C2"} (${q.difficulty || "Sedang"})] `,
                      bold: true,
                      size: 17,
                      font: "Times New Roman",
                      color: "1D4ED8",
                    }),
                    ...(q.explanation
                      ? [
                          new TextRun({
                            text: `Pembahasan: ${q.explanation}`,
                            italics: true,
                            size: 17,
                            font: "Times New Roman",
                            color: "475569",
                          }),
                        ]
                      : []),
                  ],
                })
              );
            }

            return paragraphs;
          }),

          // SPACING BEFORE FOOTER
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 180 },
            border: {
              top: { style: BorderStyle.SINGLE, size: 6, color: "CBD5E1", space: 4 },
            },
            children: [
              new TextRun({
                text: "*** Selamat Mengerjakan & Junjung Tinggi Kejujuran ***",
                italics: true,
                size: 19,
                font: "Times New Roman",
                color: "64748B",
              }),
            ],
          }),

          // 5. LEMBAR PENGESAHAN & TANDA TANGAN (Hanya jika diaktifkan di Pengaturan)
          ...(settings.enableSignatures ? [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 20 },
                          children: [
                            new TextRun({ text: "Mengetahui,", size: 19, font: "Times New Roman" }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 600 }, // Signature space
                          children: [
                            new TextRun({ text: "Kepala Satuan Pendidikan", bold: true, size: 19, font: "Times New Roman" }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: `( ${settings.principalName || "Kepala Sekolah, M.Pd."} )`,
                              bold: true,
                              underline: {},
                              size: 19,
                              font: "Times New Roman",
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: `NIP. ${settings.principalNip || "...................................."}`,
                              size: 17,
                              font: "Times New Roman",
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 20 },
                          children: [
                            new TextRun({ text: `${city}, ${currentDate}`, size: 19, font: "Times New Roman" }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 600 }, // Signature space
                          children: [
                            new TextRun({ text: "Guru Mata Pelajaran", bold: true, size: 19, font: "Times New Roman" }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: `( ${settings.teacherName || "Guru Pengampu, S.Pd."} )`,
                              bold: true,
                              underline: {},
                              size: 19,
                              font: "Times New Roman",
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: `NIP. ${settings.teacherNip || "...................................."}`,
                              size: 17,
                              font: "Times New Roman",
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = `Naskah_Ujian_${subject.replace(/[^a-zA-Z0-9]/g, "_")}_${cleanGrade(questionSet.grade)}.docx`;
  triggerBrowserDownload(blob, safeFilename);
}

/**
 * Generate and download official examination paper in PDF format.
 * Exactly matches the Indonesian official school exam paper layout.
 */
export function downloadExamPaperPDF(
  questionSet: QuestionSet,
  showAnswerKeys: boolean = false
): void {
  const settings = getAppSettings();
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const schoolName = (settings.schoolName || "SMP / SMA NEGERI NUSANTARA").toUpperCase();
  const subject = questionSet.subject || "Mata Pelajaran";
  const gradeDisplay = formatGradeDisplay(questionSet.grade) || "Kelas X";
  const semester = questionSet.semester || "1";
  const academicYear = settings.academicYear || "2024 / 2025";
  const totalQuestions = questionSet.questions.length;
  const city = settings.schoolCity || "Kota";
  const currentDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 1. KOP RESMI
  const drawKop = () => {
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.text("DINAS PENDIDIKAN DAN KEBUDAYAAN • PROVINSI / KABUPATEN", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFontSize(13);
    doc.text(schoolName, pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFontSize(12);
    doc.text("LEMBAR ASESMEN SUMATIF / PENILAIAN AKHIR SEMESTER", pageWidth / 2, y, { align: "center" });
    y += 4.5;

    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.text(`TAHUN AJARAN ${academicYear} • KURIKULUM MERDEKA & K13`, pageWidth / 2, y, { align: "center" });
    y += 3.5;

    // Double Border
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 1;
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  drawKop();

  // 2. TABEL METADATA
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(180, 190, 205);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 22, "FD");

  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text("Mata Pelajaran", margin + 3, y + 5);
  doc.text("Kelas / Fase", margin + 3, y + 11);
  doc.text("Materi Pokok", margin + 3, y + 17);

  doc.setFont("times", "normal");
  doc.text(`: ${subject}`, margin + 28, y + 5);
  doc.text(`: ${gradeDisplay} (Sem. ${semester})`, margin + 28, y + 11);
  const truncatedMaterial = (questionSet.material || questionSet.title).slice(0, 36);
  doc.text(`: ${truncatedMaterial}`, margin + 28, y + 17);

  const col2X = margin + contentWidth / 2 + 2;
  doc.setFont("times", "bold");
  doc.text("Bentuk Soal", col2X, y + 5);
  doc.text("Alokasi Waktu", col2X, y + 11);
  doc.text("Petunjuk", col2X, y + 17);

  doc.setFont("times", "normal");
  doc.text(`: Pilihan Ganda (${totalQuestions} Butir)`, col2X + 26, y + 5);
  doc.text(`: 60 – 90 Menit`, col2X + 26, y + 11);
  doc.text(`: Pilih satu jawaban tepat (A-E)`, col2X + 26, y + 17);

  y += 26;

  // 3. PETUNJUK UMUM
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.text("PETUNJUK UMUM:", margin, y);
  y += 4;
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text("1. Berdoalah sebelum mengerjakan soal. 2. Tulislah identitas Anda secara lengkap pada lembar jawaban.", margin, y);
  y += 3.5;
  doc.text("3. Periksalah naskah soal dan laporkan jika ada kerusakan. 4. Dahulukan menjawab soal yang mudah.", margin, y);
  y += 3;
  doc.setDrawColor(210, 215, 225);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // 4. DAFTAR SOAL
  questionSet.questions.forEach((q, idx) => {
    // Check page overflow
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 16;
    }

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    const numPrefix = `${idx + 1}. `;
    const qLines = doc.splitTextToSize(`${numPrefix}${q.question}`, contentWidth);
    doc.text(qLines, margin, y);
    y += qLines.length * 4.2 + 1.5;

    // Options layout: 2 columns for space efficiency & official neatness
    doc.setFont("times", "normal");
    doc.setFontSize(9);

    const halfWidth = (contentWidth - 6) / 2;
    const optLeftCol = [q.options[0], q.options[2], q.options[4]].filter(Boolean);
    const optRightCol = [q.options[1], q.options[3]].filter(Boolean);

    // Render options
    const maxRows = Math.max(optLeftCol.length, optRightCol.length);
    for (let r = 0; r < maxRows; r++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 16;
      }

      const leftOpt = optLeftCol[r];
      const rightOpt = optRightCol[r];

      let rowHeight = 4.2;

      if (leftOpt) {
        const isKey = showAnswerKeys && leftOpt.label === q.correctAnswer;
        if (isKey) {
          doc.setFont("times", "bold");
          doc.setTextColor(21, 128, 61);
        } else {
          doc.setFont("times", "normal");
          doc.setTextColor(15, 23, 42);
        }
        const leftLines = doc.splitTextToSize(`${leftOpt.label}. ${leftOpt.text}${isKey ? " *" : ""}`, halfWidth);
        doc.text(leftLines, margin + 4, y);
        rowHeight = Math.max(rowHeight, leftLines.length * 4);
      }

      if (rightOpt) {
        const isKey = showAnswerKeys && rightOpt.label === q.correctAnswer;
        if (isKey) {
          doc.setFont("times", "bold");
          doc.setTextColor(21, 128, 61);
        } else {
          doc.setFont("times", "normal");
          doc.setTextColor(15, 23, 42);
        }
        const rightLines = doc.splitTextToSize(`${rightOpt.label}. ${rightOpt.text}${isKey ? " *" : ""}`, halfWidth);
        doc.text(rightLines, margin + halfWidth + 6, y);
        rowHeight = Math.max(rowHeight, rightLines.length * 4);
      }

      doc.setTextColor(0, 0, 0);
      doc.setFont("times", "normal");
      y += rowHeight + 1;
    }

    // Teacher explanation if showAnswerKeys
    if (showAnswerKeys) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 16;
      }
      doc.setFont("times", "italic");
      doc.setFontSize(8);
      doc.setTextColor(30, 64, 175);
      const expText = `[Kunci: ${q.correctAnswer} | Level: ${q.cognitiveLevel || "C2"}] ${q.explanation ? "Pembahasan: " + q.explanation : ""}`;
      const expLines = doc.splitTextToSize(expText, contentWidth - 6);
      doc.text(expLines, margin + 4, y);
      doc.setTextColor(0, 0, 0);
      y += expLines.length * 3.8 + 1;
    }

    y += 2.5; // spacing between questions
  });

  // 5. CLOSING NOTE & SIGNATURE
  if (settings.enableSignatures) {
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 16;
    } else {
      y += 6;
    }

    doc.setFont("times", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("*** Selamat Mengerjakan & Junjung Tinggi Kejujuran ***", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 7;

    // Sign-off
    doc.setFont("times", "normal");
    doc.setFontSize(8.5);
    const leftX = margin + 28;
    const rightX = pageWidth - margin - 35;

    doc.text("Mengetahui,", leftX, y, { align: "center" });
    doc.text(`${city}, ${currentDate}`, rightX, y, { align: "center" });
    y += 4;

    doc.setFont("times", "bold");
    doc.text("Kepala Satuan Pendidikan", leftX, y, { align: "center" });
    doc.text("Guru Mata Pelajaran", rightX, y, { align: "center" });
    y += 18;

    doc.text(`( ${settings.principalName || "Kepala Sekolah, M.Pd."} )`, leftX, y, { align: "center" });
    doc.text(`( ${settings.teacherName || "Guru Pengampu, S.Pd."} )`, rightX, y, { align: "center" });
    y += 4;

    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.text(`NIP. ${settings.principalNip || "...................................."}`, leftX, y, { align: "center" });
    doc.text(`NIP. ${settings.teacherNip || "...................................."}`, rightX, y, { align: "center" });
  } else {
    // Non-active: simple end of sheet note without signatures
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 16;
    } else {
      y += 6;
    }
    doc.setFont("times", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("*** Selamat Mengerjakan & Junjung Tinggi Kejujuran ***", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  const safeFilename = `Naskah_Ujian_${subject.replace(/[^a-zA-Z0-9]/g, "_")}_${cleanGrade(questionSet.grade)}.pdf`;
  doc.save(safeFilename);
}

/**
 * Print official examination paper using an isolated printable iframe.
 * Preserves 100% exact high-contrast typography, double border, and clean A4 pagination.
 */
export function printExamPaperDirect(
  questionSet: QuestionSet,
  showAnswerKeys: boolean = false
): void {
  const settings = getAppSettings();
  const schoolName = (settings.schoolName || "SMP / SMA NEGERI NUSANTARA").toUpperCase();
  const subject = questionSet.subject || "Mata Pelajaran";
  const gradeDisplay = formatGradeDisplay(questionSet.grade) || "Kelas X";
  const semester = questionSet.semester || "1";
  const academicYear = settings.academicYear || "2024 / 2025";
  const totalQuestions = questionSet.questions.length;
  const city = settings.schoolCity || "Kota";
  const currentDate = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Naskah Ujian Resmi - ${subject}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }
    .kop-container {
      text-align: center;
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 3.5px double #000000;
    }
    .kop-dinas {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .kop-school {
      font-size: 14pt;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .kop-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .kop-meta {
      font-size: 9.5pt;
      color: #334155;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border: 1px solid #94a3b8;
      background-color: #f8fafc;
      font-size: 9.5pt;
    }
    .meta-table td {
      padding: 4px 8px;
      vertical-align: top;
      border: 1px solid #cbd5e1;
    }
    .petunjuk-box {
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 14px;
      font-size: 9pt;
      color: #334155;
    }
    .petunjuk-title {
      font-weight: bold;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .question-item {
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .question-prompt {
      font-size: 10.5pt;
      font-weight: 500;
      margin-bottom: 6px;
      display: flex;
      gap: 6px;
    }
    .question-num {
      font-weight: bold;
      min-width: 20px;
    }
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
      padding-left: 20px;
      font-size: 10pt;
    }
    .option-item {
      display: flex;
      gap: 6px;
    }
    .option-item.correct-answer {
      font-weight: bold;
      color: #15803d;
      background-color: #f0fdf4;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .explanation-callout {
      margin-top: 4px;
      margin-left: 20px;
      padding: 4px 8px;
      background-color: #f1f5f9;
      border-left: 3px solid #3b82f6;
      font-size: 8.5pt;
      color: #1e3a8a;
    }
    .closing-note {
      text-align: center;
      font-style: italic;
      color: #64748b;
      margin-top: 20px;
      margin-bottom: 16px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 9.5pt;
    }
    .sign-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
      font-size: 9.5pt;
      text-align: center;
    }
    .sign-table td {
      width: 50%;
      vertical-align: top;
      padding: 6px 12px;
    }
    .sign-space {
      height: 48px;
    }
    .sign-name {
      font-weight: bold;
      text-decoration: underline;
    }
    .sign-nip {
      font-size: 8.5pt;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="kop-container">
    <div class="kop-dinas">DINAS PENDIDIKAN DAN KEBUDAYAAN • PROVINSI / KABUPATEN</div>
    <div class="kop-school">${schoolName}</div>
    <div class="kop-title">LEMBAR ASESMEN SUMATIF / PENILAIAN AKHIR SEMESTER</div>
    <div class="kop-meta">TAHUN AJARAN ${academicYear} • KURIKULUM MERDEKA & K13</div>
  </div>

  <table class="meta-table">
    <tr>
      <td style="width: 50%;">
        <div><strong>Mata Pelajaran:</strong> ${subject}</div>
        <div><strong>Kelas / Fase:</strong> ${gradeDisplay} (Sem. ${semester})</div>
        <div><strong>Materi Pokok:</strong> ${questionSet.material || questionSet.title}</div>
      </td>
      <td style="width: 50%;">
        <div><strong>Bentuk Soal:</strong> Pilihan Ganda (${totalQuestions} Butir)</div>
        <div><strong>Alokasi Waktu:</strong> 60 – 90 Menit</div>
        <div><strong>Petunjuk:</strong> Pilih salah satu jawaban paling tepat (A, B, C, D, atau E)</div>
      </td>
    </tr>
  </table>

  <div class="petunjuk-box">
    <div class="petunjuk-title">PETUNJUK UMUM:</div>
    <div>1. Berdoalah sebelum mengerjakan soal. 2. Tulislah identitas secara lengkap pada lembar jawaban.</div>
    <div>3. Periksalah naskah soal dan laporkan jika ada ketidakjelasan. 4. Dahulukan soal yang mudah.</div>
  </div>

  <div class="questions-container">
    ${questionSet.questions
      .map(
        (q, idx) => `
      <div class="question-item">
        <div class="question-prompt">
          <span class="question-num">${idx + 1}.</span>
          <div>${q.question}</div>
        </div>
        <div class="options-grid">
          ${q.options
            .map(
              (opt) => `
            <div class="option-item ${showAnswerKeys && opt.label === q.correctAnswer ? "correct-answer" : ""}">
              <strong>${opt.label}.</strong>
              <span>${opt.text}</span>
              ${showAnswerKeys && opt.label === q.correctAnswer ? '<span style="font-size: 8pt; color: #15803d; font-weight: bold;">(Kunci)</span>' : ""}
            </div>
          `
            )
            .join("")}
        </div>
        ${
          showAnswerKeys
            ? `
          <div class="explanation-callout">
            <strong>Kunci: ${q.correctAnswer} | Level: ${q.cognitiveLevel || "C2"} (${q.difficulty || "Sedang"})</strong>
            ${q.explanation ? `<br><em>Pembahasan: ${q.explanation}</em>` : ""}
          </div>
        `
            : ""
        }
      </div>
    `
      )
      .join("")}
  </div>

  <div class="closing-note">
    *** Selamat Mengerjakan & Junjung Tinggi Kejujuran ***
  </div>

  ${settings.enableSignatures ? `
  <table class="sign-table">
    <tr>
      <td>
        <div>Mengetahui,</div>
        <div style="font-weight: bold;">Kepala Satuan Pendidikan</div>
        <div class="sign-space"></div>
        <div class="sign-name">( ${settings.principalName || "Kepala Sekolah, M.Pd."} )</div>
        <div class="sign-nip">NIP. ${settings.principalNip || "...................................."}</div>
      </td>
      <td>
        <div>${city}, ${currentDate}</div>
        <div style="font-weight: bold;">Guru Mata Pelajaran</div>
        <div class="sign-space"></div>
        <div class="sign-name">( ${settings.teacherName || "Guru Pengampu, S.Pd."} )</div>
        <div class="sign-nip">NIP. ${settings.teacherNip || "...................................."}</div>
      </td>
    </tr>
  </table>` : ""}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  }, 400);
}
