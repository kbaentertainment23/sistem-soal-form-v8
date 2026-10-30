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
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  HeightRule
} from "docx";

export interface DocxTemplateOptions {
  schoolName?: string;
  subject?: string;
  grade?: string;
  semester?: string;
  examType?: string;
  teacherName?: string;
  optionsCount?: 4 | 5;
}

/**
 * Generates a clean, professional, and well-structured .docx file template
 * for Indonesian teachers to create exam questions.
 */
export async function generateQuestionTemplateDocx(options: DocxTemplateOptions = {}): Promise<Blob> {
  const {
    schoolName = "SMP / SMA / SMK NUSANTARA CERDAS",
    subject = "Informatika",
    grade = "VIII (Delapan)",
    semester = "1 (Ganjil)",
    examType = "Penilaian Harian / Asesmen Sumatif",
    teacherName = "Guru Mata Pelajaran",
    optionsCount = 4,
  } = options;

  const primaryColor = "1E40AF"; // Deep Royal Blue
  const secondaryColor = "3B82F6"; // Slate Blue
  const headerBgColor = "F1F5F9"; // Light Slate
  const boxBgColor = "EFF6FF"; // Soft Blue tint
  const lightBorderColor = "CBD5E1";

  const is5Options = optionsCount === 5;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch (72 pt * 20)
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          // KOP HEADER DOKUMEN
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: schoolName.toUpperCase(),
                bold: true,
                size: 26, // 13pt
                font: "Calibri",
                color: "0F172A",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "FORMAT STANDAR PENYUSUNAN NASKAH SOAL UJIAN & ASESMEN",
                bold: true,
                size: 24, // 12pt
                font: "Calibri",
                color: primaryColor,
              }),
            ],
          }),

          // GARIS PEMBATAS KOP
          new Paragraph({
            border: {
              bottom: {
                color: "0F172A",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 16,
              },
            },
            spacing: { after: 200 },
          }),

          // TABEL INFORMASI UJIAN / ASESMEN
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Mata Pelajaran", bold: true, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: `: ${subject}`, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Kelas / Semester", bold: true, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: `: Kelas ${grade} / Sem. ${semester}`, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Jenis Asesmen", bold: true, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: `: ${examType}`, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: headerBgColor },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Guru Pengampu", bold: true, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: `: ${teacherName}`, size: 20, font: "Calibri" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // SPACING
          new Paragraph({ spacing: { before: 200, after: 120 } }),

          // KOTAK PETUNJUK PENGISIAN FORMAT (BOXED INSTRUCTIONS)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: boxBgColor },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 8, color: secondaryColor },
                      bottom: { style: BorderStyle.SINGLE, size: 8, color: secondaryColor },
                      left: { style: BorderStyle.SINGLE, size: 24, color: primaryColor },
                      right: { style: BorderStyle.SINGLE, size: 8, color: secondaryColor },
                    },
                    margins: { top: 160, bottom: 160, left: 240, right: 240 },
                    children: [
                      new Paragraph({
                        spacing: { after: 80 },
                        children: [
                          new TextRun({
                            text: "📌 PETUNJUK PENGISIAN FORMAT SOAL UNTUK GURU:",
                            bold: true,
                            size: 22,
                            font: "Calibri",
                            color: primaryColor,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: "• Nomor Soal: Tuliskan nomor urut diikuti tanda titik, contoh: ",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                          new TextRun({
                            text: "1. [Teks Pertanyaan / Kasus Soal]",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: "0F172A",
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: "• Pilihan Jawaban: Tuliskan tiap opsi pada baris tersendiri: ",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                          new TextRun({
                            text: is5Options ? "A. ..., B. ..., C. ..., D. ..., E. ..." : "A. ..., B. ..., C. ..., D. ...",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: "0F172A",
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: "• Kunci Jawaban: Tuliskan huruf kunci, contoh: ",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                          new TextRun({
                            text: "Kunci: B",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: "15803D",
                          }),
                          new TextRun({
                            text: " (atau Kunci Jawaban: B).",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: "• Materi Pokok / Sub-Materi (Untuk Kisi-Kisi Otomatis): ",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: "1E40AF",
                          }),
                          new TextRun({
                            text: "Tuliskan materi atau topik spesifik per butir soal, contoh: ",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                          new TextRun({
                            text: "Materi: Topologi Star",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: "1E40AF",
                          }),
                          new TextRun({
                            text: ". Sistem akan otomatis menyusun tabel Kisi-Kisi Ujian, indikator, dan matriks materi per butir soal!",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: "• Pembahasan: ",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                          new TextRun({
                            text: "Pembahasan: [Uraian penjelasan ringkas]",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: "0F172A",
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [
                          new TextRun({
                            text: "• Atribut Tambahan (Opsional): ",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                          new TextRun({
                            text: "Materi: [Topik] | Tingkat Kesulitan: Sedang | Level: C3 | Poin: 10",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: "64748B",
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "• Jumlah Soal Fleksibel: ",
                            size: 19,
                            font: "Calibri",
                            color: "334155",
                          }),
                          new TextRun({
                            text: "Anda bebas menulis butir soal sebanyak yang dibutuhkan (1 s.d. 30, 40, 50, dst) dengan mengikuti format penomoran di bawah.",
                            bold: true,
                            size: 19,
                            font: "Calibri",
                            color: primaryColor,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // SECTION TITLE
          new Paragraph({
            spacing: { before: 280, after: 120 },
            children: [
              new TextRun({
                text: "=== DAFTAR BUTIR SOAL PILIHAN GANDA ===",
                bold: true,
                size: 22,
                font: "Calibri",
                color: "0F172A",
              }),
            ],
          }),

          // CONTOH SOAL 1
          ...createQuestionBlock({
            number: 1,
            questionText: "Topologi jaringan komputer di mana setiap komputer terhubung langsung ke satu perangkat pusat seperti Switch atau Hub disebut topologi...",
            options: [
              { label: "A", text: "Topologi Bus" },
              { label: "B", text: "Topologi Ring (Cincin)" },
              { label: "C", text: "Topologi Star (Bintang)" },
              { label: "D", text: "Topologi Mesh (Jala)" },
              ...(is5Options ? [{ label: "E", text: "Topologi Tree (Pohon)" }] : []),
            ],
            correctAnswer: "C",
            explanation: "Topologi Star menghubungkan semua node (komputer klien) ke satu konsentrator pusat berupa Switch atau Hub sehingga jika salah satu kabel klien putus, jaringan lainnya tetap bekerja.",
            material: "Topologi Jaringan Komputer",
            difficulty: "Mudah",
            cognitiveLevel: "C2",
            points: 10,
          }),

          // CONTOH SOAL 2 (HOTS / STUDI KASUS)
          ...createQuestionBlock({
            number: 2,
            questionText: "Sebuah laboratorium sekolah memiliki 30 unit komputer yang sering mengalami kelambatan saat mengakses internet secara bersamaan. Setelah diperiksa, ditemukan bahwa semua komputer memiliki alamat IP statis dengan subnet mask yang kurang tepat dan broadcast berlebihan. Solusi terbaik yang harus dilakukan oleh teknisi jaringan adalah...",
            options: [
              { label: "A", text: "Mengganti seluruh kabel jaringan dengan kabel serat optik tanpa mengubah konfigurasi IP" },
              { label: "B", text: "Menerapkan Router dengan DHCP Server serta membagi segmen jaringan menggunakan VLAN" },
              { label: "C", text: "Mematikan sambungan internet pada 15 unit komputer secara bergantian setiap jam" },
              { label: "D", text: "Menghubungkan semua komputer hanya menggunakan koneksi Bluetooth" },
              ...(is5Options ? [{ label: "E", text: "Menonaktifkan firewall di komputer server utama" }] : []),
            ],
            correctAnswer: "B",
            explanation: "Penggunaan DHCP Server memastikan alokasi IP otomatis dan teratur, sedangkan penerapan VLAN memecah broadcast domain sehingga lalu lintas data menjadi jauh lebih efisien dan terisolasi dengan baik.",
            material: "Konfigurasi Subnetting & VLAN",
            difficulty: "Sulit",
            cognitiveLevel: "C4",
            points: 10,
          }),

          // CONTOH SOAL 3
          ...createQuestionBlock({
            number: 3,
            questionText: "Protokol standar pada jaringan internet yang bertanggung jawab menerjemahkan nama domain (seperti www.kemdikbud.go.id) menjadi alamat IP angka adalah...",
            options: [
              { label: "A", text: "FTP (File Transfer Protocol)" },
              { label: "B", text: "DNS (Domain Name System)" },
              { label: "C", text: "HTTP (Hypertext Transfer Protocol)" },
              { label: "D", text: "SMTP (Simple Mail Transfer Protocol)" },
              ...(is5Options ? [{ label: "E", text: "SSH (Secure Shell)" }] : []),
            ],
            correctAnswer: "B",
            explanation: "DNS (Domain Name System) berfungsi sebagai buku telepon internet yang memetakan nama domain yang mudah diingat manusia ke alamat IP numerik komputer server.",
            material: "Protokol Jaringan (DNS)",
            difficulty: "Sedang",
            cognitiveLevel: "C3",
            points: 10,
          }),

          // BLANGKO TEMPLATE SOAL 4 (SIAP DIISI GURU)
          ...createQuestionBlock({
            number: 4,
            questionText: "[Tuliskan teks pertanyaan soal nomor 4 di sini...]",
            options: [
              { label: "A", text: "[Pilihan Jawaban A]" },
              { label: "B", text: "[Pilihan Jawaban B]" },
              { label: "C", text: "[Pilihan Jawaban C]" },
              { label: "D", text: "[Pilihan Jawaban D]" },
              ...(is5Options ? [{ label: "E", text: "[Pilihan Jawaban E]" }] : []),
            ],
            correctAnswer: "A",
            explanation: "[Tuliskan penjelasan dan pembahasan mengapa jawaban tersebut benar]",
            material: "[Tuliskan Sub-Materi / Topik Pokok Soal Ini]",
            difficulty: "Sedang",
            cognitiveLevel: "C3",
            points: 10,
          }),

          // BLANGKO TEMPLATE SOAL 5 (SIAP DIISI GURU)
          ...createQuestionBlock({
            number: 5,
            questionText: "[Tuliskan teks pertanyaan soal nomor 5 di sini...]",
            options: [
              { label: "A", text: "[Pilihan Jawaban A]" },
              { label: "B", text: "[Pilihan Jawaban B]" },
              { label: "C", text: "[Pilihan Jawaban C]" },
              { label: "D", text: "[Pilihan Jawaban D]" },
              ...(is5Options ? [{ label: "E", text: "[Pilihan Jawaban E]" }] : []),
            ],
            correctAnswer: "B",
            explanation: "[Tuliskan penjelasan dan pembahasan mengapa jawaban tersebut benar]",
            material: "[Tuliskan Sub-Materi / Topik Pokok Soal Ini]",
            difficulty: "Sedang",
            cognitiveLevel: "C3",
            points: 10,
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function createQuestionBlock(params: {
  number: number;
  questionText: string;
  options: { label: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  material?: string;
  difficulty?: string;
  cognitiveLevel?: string;
  points?: number;
}): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Question Title & Text
  paragraphs.push(
    new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({
          text: `${params.number}. `,
          bold: true,
          size: 21,
          font: "Calibri",
          color: "0F172A",
        }),
        new TextRun({
          text: params.questionText,
          size: 21,
          font: "Calibri",
          color: "0F172A",
        }),
      ],
    })
  );

  // Options A, B, C, D, E
  params.options.forEach((opt) => {
    paragraphs.push(
      new Paragraph({
        indent: { left: 400 },
        spacing: { before: 30, after: 30 },
        children: [
          new TextRun({
            text: `${opt.label}. `,
            bold: true,
            size: 20,
            font: "Calibri",
            color: "1E293B",
          }),
          new TextRun({
            text: opt.text,
            size: 20,
            font: "Calibri",
            color: "334155",
          }),
        ],
      })
    );
  });

  // Answer Key & Attributes (including Material)
  paragraphs.push(
    new Paragraph({
      indent: { left: 400 },
      spacing: { before: 60, after: 30 },
      children: [
        new TextRun({
          text: "Kunci Jawaban: ",
          bold: true,
          size: 19,
          font: "Calibri",
          color: "15803D",
        }),
        new TextRun({
          text: params.correctAnswer,
          bold: true,
          size: 19,
          font: "Calibri",
          color: "15803D",
        }),
        ...(params.material
          ? [
              new TextRun({
                text: `  |  Materi: ${params.material}`,
                bold: true,
                size: 18,
                font: "Calibri",
                color: "1E40AF",
              }),
            ]
          : []),
        ...(params.difficulty
          ? [
              new TextRun({
                text: `  |  Tingkat Kesulitan: ${params.difficulty}`,
                size: 18,
                font: "Calibri",
                color: "64748B",
              }),
            ]
          : []),
        ...(params.cognitiveLevel
          ? [
              new TextRun({
                text: `  |  Level: ${params.cognitiveLevel}`,
                size: 18,
                font: "Calibri",
                color: "64748B",
              }),
            ]
          : []),
        ...(params.points
          ? [
              new TextRun({
                text: `  |  Poin: ${params.points}`,
                size: 18,
                font: "Calibri",
                color: "64748B",
              }),
            ]
          : []),
      ],
    })
  );

  // Explanation
  paragraphs.push(
    new Paragraph({
      indent: { left: 400 },
      spacing: { before: 30, after: 120 },
      children: [
        new TextRun({
          text: "Pembahasan: ",
          bold: true,
          size: 18,
          font: "Calibri",
          color: "475569",
        }),
        new TextRun({
          text: params.explanation,
          size: 18,
          font: "Calibri",
          color: "475569",
          italics: true,
        }),
      ],
    })
  );

  return paragraphs;
}
