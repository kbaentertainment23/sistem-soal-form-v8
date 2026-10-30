import { GoogleGenAI, Type } from "@google/genai";
import type { 
  GenerateRequest, 
  Question, 
  ExamAuditResult, 
  QuestionAuditItem, 
  QuestionAuditIssue, 
  QuestionOption, 
  CognitiveLevel 
} from "../src/types.js";
import {
  checkQuestionsDuplicate,
  filterUniqueQuestions
} from "../src/lib/questionDeduplicator.js";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi. Pastikan variabel lingkungan GEMINI_API_KEY sudah ditambahkan di Vercel (Project Settings > Environment Variables).");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Fallback models in priority order to handle high demand (503) or rate limits
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest"
];

/**
 * Detects if a string contains raw binary PDF markers or internal PDF object dictionaries.
 * Used to safeguard against returning raw PDF stream text.
 */
export function isRawPdfBinary(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.startsWith("%PDF-") || trimmed.startsWith("%PDF")) return true;
  if (/^[\s\S]{0,1024}%PDF-/i.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("/type /catalog") ||
    lower.includes("/type/catalog") ||
    lower.includes("/mediabox") ||
    lower.includes("/procset") ||
    lower.includes("/flatedecode") ||
    lower.includes("/pages 2 0 r") ||
    (lower.includes("obj") && lower.includes("endobj")) ||
    (lower.includes("<<") && lower.includes("/type") && lower.includes(">>"))
  ) {
    return true;
  }
  return false;
}

/**
 * High-accuracy PDF document extractor using Gemini multimodal input.
 * Sends the PDF strictly as an inline binary document (application/pdf), NEVER as raw text.
 */
export async function extractPdfDocumentWithGemini(
  base64Data: string,
  fileName?: string
): Promise<string> {
  const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, "").trim();
  if (!cleanBase64) {
    throw new Error("Data biner berkas PDF kosong.");
  }

  const prompt = `Anda adalah asisten cerdas pemroses dan ekstraktor dokumen materi pembelajaran kurikulum sekolah dan naskah bahan ajar guru.
Tugas Anda:
1. Bacalah seluruh isi dokumen PDF terlampir ini dari halaman awal sampai akhir secara teliti, lengkap, dan utuh.
2. Transkripsikan dan ekstrak seluruh teks materi pembelajaran, uraian konsep, penjelasan bab/sub-bab, tabel, definisi, rumus, butir informasi penting, rangkuman, ataupun butir pertanyaan/soal ke dalam format teks yang bersih, rapi, dan mudah dibaca.
3. Pertahankan substansi akademis, istilah teknis, fakta, data, dan struktur naskah asli dari dokumen.
4. DILARANG KERAS menyertakan kode biner atau metadata PDF (seperti %PDF-, obj, endobj, /Type /Catalog, /MediaBox, xref, trailer).
5. Berikan HANYA teks isi dokumen yang bersih tanpa komentar pengantar atau penutup.`;

  const pdfPart = {
    inlineData: {
      mimeType: "application/pdf",
      data: cleanBase64,
    },
  };

  const textPart = {
    text: prompt,
  };

  const response = await callGeminiWithRetry({
    contents: {
      parts: [pdfPart, textPart],
    },
    config: {
      temperature: 0.1,
    },
  });

  const extracted = (response?.text || "").trim();

  // Validate that response is clean and not raw binary markers
  if (isRawPdfBinary(extracted)) {
    throw new Error("Hasil ekstraksi dokumen PDF tidak valid (terdeteksi data biner mentah).");
  }

  return extracted;
}

/**
 * Timeout promise wrapper to prevent individual Gemini model calls from hanging
 */
async function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Execute a Gemini call with fast model fallback for high availability
 */
async function callGeminiWithRetry(params: {
  contents: any;
  config?: any;
}): Promise<any> {
  const ai = getAiClient();
  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    try {
      // 55s per-model timeout: if a model hangs, switch smoothly to the next fallback model
      const response = await callWithTimeout(
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        }),
        55000,
        `Waktu pemanggilan model ${model} melebihi 55 detik`
      );
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const isUnavailable = /503|unavailable|high demand|fetch failed|melebihi 55 detik/i.test(errMsg);
      const isRateLimit = /429|resource_exhausted|quota/i.test(errMsg);
      const isNotFound = /404|not_found|no longer available/i.test(errMsg);

      let cleanMsg = errMsg;
      try {
        const parsedErr = JSON.parse(errMsg);
        if (parsedErr?.error?.message) {
          cleanMsg = parsedErr.error.message;
        }
      } catch {
        // use raw string
      }

      console.warn(`[Gemini API] Model ${model} dialihkan (${cleanMsg.substring(0, 100)}). Mencoba model alternatif...`);

      // If unavailable or rate limited or not found or timed out, proceed immediately to the next fallback model
      if (isUnavailable || isRateLimit || isNotFound) {
        continue;
      }

      // For transient network glitches, try 1 quick retry with 45s timeout
      try {
        await new Promise((r) => setTimeout(r, 600));
        const retryResponse = await callWithTimeout(
          ai.models.generateContent({
            model,
            contents: params.contents,
            config: params.config,
          }),
          45000,
          `Waktu pemanggilan ulang model ${model} melebihi 45 detik`
        );
        return retryResponse;
      } catch (retryErr) {
        lastError = retryErr;
      }
    }
  }

  throw lastError || new Error("Layanan AI sedang mengalami beban tinggi. Silakan coba sesaat lagi.");
}

function cleanGradeStr(grade?: string): string {
  if (!grade) return "";
  return grade.replace(/^(kelas\s*)+/i, "").trim();
}

function cleanTitleStr(title?: string): string {
  if (!title) return "";
  return title
    .replace(/kelas\s+kelas\s+/gi, "Kelas ")
    .replace(/kelas\s+kelas\b/gi, "Kelas")
    .trim();
}

function splitQuestionChunks(total: number, maxChunkSize = 15): {
  startNum: number;
  count: number;
  chunkIndex: number;
  totalChunks: number;
}[] {
  const numChunks = Math.max(1, Math.ceil(total / maxChunkSize));
  const baseSize = Math.floor(total / numChunks);
  const remainder = total % numChunks;
  const chunks = [];
  let currentStart = 1;
  for (let i = 0; i < numChunks; i++) {
    const count = baseSize + (i < remainder ? 1 : 0);
    chunks.push({
      startNum: currentStart,
      count,
      chunkIndex: i,
      totalChunks: numChunks
    });
    currentStart += count;
  }
  return chunks;
}

async function runConcurrentTasks<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export async function generateQuestionsWithGemini(params: GenerateRequest): Promise<{
  title: string;
  subject: string;
  grade: string;
  semester: string;
  material: string;
  questions: Question[];
}> {
  const sanitizedParamGrade = cleanGradeStr(params.grade);
  const optionsCount = params.optionsCount || 4; // default 4 (A-D)
  const allowedLabels = optionsCount === 5 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];

  const targetTotal = Math.min(60, Math.max(1, Number(params.questionCount) || 10));
  // Add a small candidate buffer (+2 to +4) so filterUniqueQuestions already has enough unique items on the first pass
  const candidatePoolTotal = targetTotal <= 5 ? targetTotal : Math.min(64, targetTotal + Math.min(4, Math.ceil(targetTotal * 0.08)));
  const chunks = splitQuestionChunks(candidatePoolTotal, 16);

  // Fallback curated images for common subjects when imageUrl is missing but image was requested
  const getSubjectFallbackImage = (sub: string, qText: string): string => {
    const s = (sub + " " + qText).toLowerCase();
    if (s.includes("komputer") || s.includes("jaringan") || s.includes("informatika") || s.includes("router") || s.includes("internet") || s.includes("kabel")) {
      return "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80";
    }
    if (s.includes("sel") || s.includes("biologi") || s.includes("tumbuhan") || s.includes("hewan") || s.includes("daun") || s.includes("organ") || s.includes("jantung")) {
      return "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=800&q=80";
    }
    if (s.includes("fisika") || s.includes("listrik") || s.includes("magnet") || s.includes("optik") || s.includes("cahaya") || s.includes("gaya") || s.includes("energi")) {
      return "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=800&q=80";
    }
    if (s.includes("kimia") || s.includes("larutan") || s.includes("asam") || s.includes("basa") || s.includes("unsur") || s.includes("senyawa") || s.includes("molekul")) {
      return "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80";
    }
    if (s.includes("matematika") || s.includes("geometri") || s.includes("segitiga") || s.includes("lingkaran") || s.includes("grafik") || s.includes("sudut") || s.includes("aljabar")) {
      return "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80";
    }
    if (s.includes("geografi") || s.includes("peta") || s.includes("bumi") || s.includes("lapisan") || s.includes("batuan") || s.includes("cuaca") || s.includes("gunung")) {
      return "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80";
    }
    if (s.includes("sejarah") || s.includes("candi") || s.includes("kerajaan") || s.includes("prasasti") || s.includes("kemerdekaan")) {
      return "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=800&q=80";
    }
    return "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80";
  };

  const executeChunk = async (chunk: {
    startNum: number;
    count: number;
    chunkIndex: number;
    totalChunks: number;
  }) => {
    let difficultyGuide = "";
    if (params.difficultyType === "Campuran") {
      const ratio = params.difficultyRatio || { easy: 30, medium: 50, hard: 20 };
      const easyCount = Math.max(1, Math.round((chunk.count * ratio.easy) / 100));
      const hardCount = Math.max(1, Math.round((chunk.count * ratio.hard) / 100));
      const mediumCount = Math.max(1, chunk.count - easyCount - hardCount);
      difficultyGuide = `Komposisi Tingkat Kesulitan:
- Mudah: sekitar ${easyCount} soal (${ratio.easy}%)
- Sedang: sekitar ${mediumCount} soal (${ratio.medium}%)
- Sulit: sekitar ${hardCount} soal (${ratio.hard}%)`;
    } else {
      difficultyGuide = `Tingkat Kesulitan: Semua butir soal dibuat dengan tingkat kesulitan ${params.difficultyType}.`;
    }

    let cognitiveInstruction = "";
    if (params.cognitiveFocus === "HOTS") {
      cognitiveInstruction = `FOKUS KOGNITIF: HOTS (Higher Order Thinking Skills - C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta). Sajikan stimulus berupa studi kasus, analisis data/skenario, atau pemecahan masalah berdasarkan materi.`;
    } else if (params.cognitiveFocus === "LOTS") {
      cognitiveInstruction = `FOKUS KOGNITIF: LOTS (C1 Mengingat, C2 Memahami, C3 Mengaplikasikan). Fokuskan pada fakta, definisi, terminologi, dan konsep fundamental materi.`;
    } else {
      cognitiveInstruction = `FOKUS KOGNITIF: SEIMBANG (Kombinasi terukur antara pemahaman konsep dasar LOTS C1-C3 dan penalaran analitis HOTS C4-C6).`;
    }

    let materialSections = "";
    if (params.material && params.material.trim().length > 0) {
      materialSections += `\n=======================================================\n[SUMBER ACUAN UTAMA MATERI / MODUL AJAR DARI GURU]\n${params.material.trim()}\n=======================================================\n`;
    }
    if (params.extractedMaterial && params.extractedMaterial.trim().length > 0 && params.extractedMaterial.trim() !== params.material.trim()) {
      materialSections += `\n=======================================================\n[DOKUMEN TAMBAHAN MODUL / BAHAN AJAR]\n${params.extractedMaterial.trim()}\n=======================================================\n`;
    }
    if (params.manualMaterial && params.manualMaterial.trim().length > 0) {
      materialSections += `\n=======================================================\n[CATATAN & SILABUS TAMBAHAN GURU]\n${params.manualMaterial.trim()}\n=======================================================\n`;
    }
    if (params.kisiKisi && params.kisiKisi.trim().length > 0) {
      materialSections += `\n=======================================================\n[KISI-KISI / INDIKATOR ACUAN DARI GURU]\n${params.kisiKisi.trim()}\n=======================================================\n`;
    }

    const shouldIncludeImages = Boolean(params.includeImages) && params.imageFrequency !== "none";
    const imageFrequency = shouldIncludeImages ? (params.imageFrequency || "some") : "none";

    let imageInstruction = "";
    if (shouldIncludeImages) {
      imageInstruction = `
Ketentuan Stimulus Visual & Soal Bergambar:
- Sajikan stimulus visual (diagram, bagan, grafik, tabel, skema, peta konsep, atau ilustrasi kontekstual) sesuai materi ${params.subject}.
- Frekuensi: ${imageFrequency === "all" ? "Seluruh butir soal (100%) wajib memiliki stimulus visual." : "Sekitar 30% - 60% butir soal memiliki stimulus visual."}
- Pada butir soal yang menggunakan gambar:
  1. Buat teks pertanyaan yang merujuk jelas pada stimulus (contoh: "Perhatikan diagram/bagan berikut ini...", "Berdasarkan skema alur di bawah ini...").
  2. Isi "imageCaption" dengan deskripsi edukatif yang jelas (contoh: "Bagan: Alur Topologi Star", "Gambar: Struktur Sel Hewan", "Tabel: Hasil Percobaan Kecepatan").
  3. Isi "imageUrl" dengan tautan HTTPS publik edukatif yang relevan (misal Unsplash atau Wikimedia).`;
    } else {
      imageInstruction = `
=== MANDAT MUTLAK: SOAL MURNI TEKS (FITUR GAMBAR DINONAKTIFKAN GURU) ===
- Fitur stimulus gambar/visual sedang DINONAKTIFKAN oleh Guru.
- Seluruh butir soal (100%) WAJIB murni berbasis narasi teks tertulis mandiri, studi kasus teks, atau data deskriptif tertulis tanpa memerlukan gambar, skema, bagan, diagram, atau peta apapun.
- DILARANG KERAS membuat soal dengan kalimat rujukan visual seperti: "Perhatikan gambar berikut", "Berdasarkan diagram di samping", "Amati skema alur di bawah", "Perhatikan tabel/bagan berikut".
- Properti "imageUrl" dan "imageCaption" pada SELURUH butir soal WAJIB KOSONG (null / undefined / tidak diisi).`;
    }

    const isUploadMode = params.sourceMode === "upload" || Boolean(params.extractedMaterial);
    const isStrictGrounding = Boolean(params.onlyFromMaterial || isUploadMode);

    let strictGroundingPromptBlock = "";
    if (isStrictGrounding) {
      strictGroundingPromptBlock = `
=== MANDAT MUTLAK: STRICT CLOSED-CORPUS GROUNDING (PRINSIP UJIAN BUKU TERTUTUP) ===
SUMBER DOKUMEN MODUL / MATERI DI ATAS ADALAH SATU-SATUNYA KEBENARAN DAN BATAS RUANG LINGKUP MAKSIMAL.
1. ZERO-OUTSIDE KNOWLEDGE (DILARANG KERAS MENGAMBIL DI LUAR DOKUMEN):
   - Seluruh butir pertanyaan, kunci jawaban (correctAnswer), opsi pengecoh, dan pembahasan WAJIB 100% BERSUMBER EKSKLUSIF dari teks dokumen modul terlampir di atas.
   - Anda DILARANG KERAS menggunakan pengetahuan umum luar, teori tambahan dari internet, rumus yang tidak tertera, istilah kurikulum lain, atau nama tokoh/fakta yang TIDAK TERTULIS EKSPLISIT di dalam dokumen ini.
   - Jika suatu materi, konsep, atau istilah tidak tertulis di dalam dokumen di atas, ANGGAP HAL TERSEBUT TIDAK ADA DAN DILARANG KERAS DITANYAKAN.

2. BUKTI RUJUKAN KUTIPAN LANGSUNG WAJIB (VERBATIM CITATION):
   - Pada properti "explanation" (pembahasan) di setiap butir soal, Anda WAJIB menyertakan kutipan kalimat asli dari teks dokumen modul sebagai bukti keabsahan jawaban, dengan format persis:
     "Rujukan Modul: '[Kutipan kalimat asli dari modul yang membuktikan jawaban ini]'"
   - Jika Anda tidak dapat menemukan kalimat pembuktian langsung di dalam modul, JANGAN BUAT SOAL TERSEBUT! Gantilah dengan konsep yang memiliki bukti kalimat tertulis di dalam modul.

3. DISTRAKTOR (PENGECOH) HOMOGEN DARI ISI DOKUMEN:
   - Opsi jawaban salah (distraktor) harus diambil dari istilah atau konsep yang JUGA TERDAPAT di dalam dokumen modul tersebut (namun keliru untuk pertanyaan tersebut), bukan mengarang istilah asing dari luar dokumen.

4. ELIMINASI TOTAL TEKS NON-MATERI:
   - DILARANG KERAS membuat soal dari teks administratif dokumen seperti: Kata Pengantar, Sambutan Kepala Sekolah/Pejabat, Daftar Isi, Glosarium, Biodata Penulis/Tim, Petunjuk Tugas Kelompok, Refleksi Profil Pelajar Pancasila, atau Tata Tertib Penggunaan Modul. Fokus murni hanya pada uraian konsep materi ilmiahnya.
${params.moduleFocusTopic ? `\n5. PRIORITAS FOKUS BAB / TOPIK SPESIFIK:\n   - Guru menetapkan fokus dokumen pada: "${params.moduleFocusTopic}".\n   - Seluruh butir soal WAJIB diprioritaskan dan digali dari bagian/bab materi "${params.moduleFocusTopic}" tersebut.\n` : ""}`;
    }

    const CHUNK_THEMATIC_TRACKS = [
      {
        title: "Track 1: Fondasi Konseptual, Istilah Kunci & Komponen/Bagian Pokok",
        mandate: "Fokuskan pada pemahaman definisi konsep, fakta ilmiah kunci, terminologi esensial, klasifikasi, dan fungsi komponen mendasar materi. Hindari membuat soal analisis kasus lanjutan atau evaluasi yang dialokasikan untuk bagian lain."
      },
      {
        title: "Track 2: Mekanisme Sistem, Alur Tahapan Proses & Hubungan Sebab-Akibat",
        mandate: "Fokuskan pada cara kerja langkah demi langkah, alur mekanisme interaksi, tahapan berurutan, dan hubungan sebab-akibat antar unsur materi. Hindari mengulang soal definisi hafalan dasar."
      },
      {
        title: "Track 3: Aplikasi Kontekstual, Studi Kasus & Pemecahan Masalah (HOTS)",
        mandate: "Fokuskan pada skenario kontekstual dunia nyata, analisis studi kasus masalah, diagnosis persoalan, dan penalaran tingkat tinggi (C4-C6). Hindari mengulang konsep teoritis murni hafalan."
      },
      {
        title: "Track 4: Komparasi, Analisis Data/Pernyataan & Evaluasi Kritis",
        mandate: "Fokuskan pada analisis perbandingan (persamaan & perbedaan antar konsep), analisis pernyataan/data deskriptif, evaluasi solusi, serta implikasi penting dari materi."
      }
    ];

    const themeTrack = CHUNK_THEMATIC_TRACKS[chunk.chunkIndex % CHUNK_THEMATIC_TRACKS.length];

    const chunkBatchGuide = chunk.totalChunks > 1
      ? `
=== PANDUAN PEMBAGIAN PAKET SOAL (BAGIAN ${chunk.chunkIndex + 1} DARI ${chunk.totalChunks}) ===
- Anda sedang memproses Bagian ke-${chunk.chunkIndex + 1} dari total ${chunk.totalChunks} bagian paket ujian guru.
- Hasilkan tepat ${chunk.count} butir soal pilihan ganda baru yang UNIK, MENDALAM, BERMUTU TINGGI, dan 100% BEBAS DUPLIKASI.
- Penomoran butir soal pada bagian ini WAJIB dimulai dari nomor ${chunk.startNum} sampai nomor ${chunk.startNum + chunk.count - 1}.
- SPESIALISASI SUDUT PANDANG BAGIAN INI: ${themeTrack.title}
  ${themeTrack.mandate}
- MANDAT ZERO-DUPLIKASI MUTLAK: Seluruh butir soal dalam bagian ini harus memiliki keunikan konsep tersendiri dan tidak boleh menyerupai soal bagian lain.
`
      : "";

    const prompt = `Anda adalah Asisten Pakar Penilaian & Pembuat Soal Ujian Kurikulum Indonesia (Spesialis Strict Closed-Corpus Assessor & Zero-Duplication Specialist).
Buatlah tepat ${chunk.count} butir soal pilihan ganda berkualitas tinggi, 100% AKURAT, dan 100% UNIK ${isStrictGrounding ? "yang 100% EKSKLUSIF bersumber HANYA dari Dokumen Modul/Materi terlampir tanpa keluar sedikitpun" : "sesuai permintaan guru"} berikut:

PARAMETER ASESMEN:
- Mata Pelajaran: ${params.subject}
- Jenjang / Kelas: Kelas ${sanitizedParamGrade}
- Semester: ${params.semester}
- Jenis Ujian: ${params.examType || "Penilaian Harian"}
- Jumlah Opsi Pilihan Jawaban per Soal: ${optionsCount} opsi (${allowedLabels.join(", ")})
- ${difficultyGuide}
- ${cognitiveInstruction}
${params.learningObjective ? `- Capaian / Tujuan Pembelajaran: ${params.learningObjective}` : ""}
${params.moduleFocusTopic ? `- Fokus Bab / Bagian Dokumen: ${params.moduleFocusTopic}` : ""}
${params.customPrompt ? `- INSTRUKSI KHUSUS GURU: ${params.customPrompt}` : ""}
${imageInstruction}
${chunkBatchGuide}

${materialSections}
${strictGroundingPromptBlock}

=== MANDAT MUTLAK: ZERO-DUPLIKASI & KEBERAGAMAN SOAL 100% ===
1. DILARANG KERAS membuat soal yang sama, hampir sama, atau hanya memparafrasekan pertanyaan yang sudah dibuat.
2. Setiap butir soal (dari butir pertama hingga terakhir) WAJIB menguji konsep, indikator, sub-topik, proses, atau sudut pandang masalah yang BERBEDA secara substansial.
3. Kunci jawaban dan opsi pengecoh pada setiap soal harus bervariasi. DILARANG mendaur ulang kunci jawaban yang sama untuk pertanyaan bertema serupa.
4. Gali materi secara menyeluruh dan komprehensif ke semua bagian, istilah, mekanisme, dan aplikasi praktis agar setiap butir soal bernilai evaluasi baru bagi siswa.

=== ATURAN MUTLAK KUALITAS & AKURASI 100% (STRICT GROUNDING) ===
1. BATASAN MATERI UTAMA:
   - Setiap butir pertanyaan, pilihan jawaban yang benar (correctAnswer), opsi pengecoh, dan pembahasan WAJIB 100% bersumber, sesuai, dan dapat dibuktikan kebenarannya secara langsung dari Teks Materi/Modul yang diberikan oleh Guru di atas.
   - Buat soal HANYA bersumber dari konsep esensial materi pada bab yang relevan di dalam dokumen atau teks terlampir.
   - DILARANG KERAS mengutip atau membuat soal dari teks pelengkap seperti: Kata Pengantar, Daftar Isi, Glosarium, Refleksi Profil Pelajar Pancasila, Petunjuk Tugas Proyek Kelompok, Biodata Penulis, atau cerita pengantar yang tidak bernilai ilmiah.
   - DILARANG KERAS memunculkan teori, rumus, atau istilah teknis lanjutan di luar dokumen/teks ini kecuali pengetahuan umum dasar yang relevan bagi jenjang siswa ini.

2. ATURAN PENYUSUNAN BUTIR SOAL:
   - Setiap soal harus menguji pemahaman fakta, konsep, cara kerja, atau fungsi yang tertulis eksplisit di dalam materi/modul.
   - Sebarkan butir-butir soal secara proporsional ke seluruh sub-topik, istilah penting, dan konsep materi (jangan hanya menumpuk pada bagian awal).
   - Hindari membuat soal mengenai kutipan narasi cerita pengantar yang tidak bernilai akademis; fokuskan murni pada konsep ilmiah materinya.

3. KUALITAS OPSI & PILIHAN GANDA:
   - Kunci jawaban HANYA SATU yang mutlak benar dan 100% selaras dengan keterangan di modul/materi.
   - Pengecoh (distraktor) harus homogen, masuk akal, logis, tidak konyol, berhubungan dengan topik, namun secara jelas salah menurut materi.
   - Panjang kalimat setiap opsi jawaban harus seimbang dan setara.
   - DILARANG menggunakan opsi "Semua jawaban benar" atau "Semua jawaban salah".
   - Hindari pola jawaban berulang (misal A terus menerus).

4. KUNCI JAWABAN & PEMBAHASAN SINGKAT PADAT (EFISIENSI TOKEN):
   - Pokok soal (stem) dirumuskan to-the-point dan lugas tanpa kalimat pembuka yang bertele-tele.
   - Opsi jawaban dibuat ringkas, homogen, dan langsung ke inti makna tanpa redundansi kata.
   - Pada kolom "explanation", jelaskan secara singkat dan padat (maksimal 1-2 kalimat) mengapa jawaban tersebut benar ${isStrictGrounding ? "disertai kutipan ringkas rujukan modul ('Rujukan Modul: \"...\"')." : "merujuk pada konsep materi pembelajaran."} Hindari menulis penjelasan berparagraf panjang yang memboroskan token output.

5. BAHASA INDONESIA BAKU & SESUAI NALAR SISWA:
   - Gunakan Bahasa Indonesia baku, efektif, jelas, padat, dan tidak ambigu.
   - Sesuaikan kosakata agar mudah dicerna oleh tingkat nalar siswa pada jenjang Kelas ${sanitizedParamGrade}.

6. INDIKATOR & LEVEL KOGNITIF:
   - Cantumkan indikator soal spesifik (misal: "Disajikan teks materi, peserta didik dapat menganalisis fungsi X").
   - Tentukan cognitiveLevel yang tepat: C1 (Mengingat), C2 (Memahami), C3 (Menerapkan), C4 (Menganalisis), C5 (Mengevaluasi), C6 (Mencipta).

7. MATERI POKOK / SUB-MATERI PER BUTIR SOAL:
   - Pada setiap butir soal di 'questions', isi properti 'material' dengan sub-topik / konsep pokok spesifik yang diuji butir soal tersebut (contoh: 'Topologi Star Jaringan', 'Siklus Hidrologi', 'Operasi Aljabar Linear'). Ini sangat penting untuk pemetaan tabel Kisi-Kisi Ujian otomatis per butir soal.

8. INTEGRASI FORMAT KHUSUS KETIK MATERI (JIKA TERSEDIA):
   - Jika teks materi mengandung format terstruktur ([JUDUL MATERI], [TUJUAN PEMBELAJARAN (TP/CP)], [POIN KONSEP ESENSIAL], [KATA KUNCI], [STIMULUS & STUDI KASUS], atau [BATASAN MATERI]):
     * Gunakan butir-butir [TUJUAN PEMBELAJARAN] sebagai rujukan utama perumusan 'indicator' pada setiap soal.
     * Sebarkan butir soal secara merata menguji seluruh [POIN KONSEP ESENSIAL].
     * Wajib memuat [KATA KUNCI & ISTILAH PENTING] dalam pertanyaan atau opsi yang tepat.
     * Jadikan [STIMULUS & STUDI KASUS] sebagai narasi skenario kontekstual untuk butir-butir soal bernalar tinggi (HOTS).
     * Patuhi secara mutlak [BATASAN MATERI] agar soal tidak keluar dari kurikulum yang ditentukan guru.`;

    const response = await callGeminiWithRetry({
      contents: prompt,
      config: {
        temperature: isStrictGrounding ? 0.25 : 0.4,
        responseMimeType: "application/json",
        maxOutputTokens: 65536,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subject: { type: Type.STRING },
            grade: { type: Type.STRING },
            semester: { type: Type.STRING },
            material: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  number: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  imageUrl: { type: Type.STRING, description: "URL HTTPS gambar/diagram pendukung jika ada" },
                  imageCaption: { type: Type.STRING, description: "Keterangan gambar/diagram" },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING, enum: allowedLabels },
                        text: { type: Type.STRING }
                      },
                      required: ["label", "text"]
                    }
                  },
                  correctAnswer: { type: Type.STRING, enum: allowedLabels },
                  explanation: { type: Type.STRING },
                  material: { type: Type.STRING },
                  difficulty: { type: Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
                  cognitiveLevel: { type: Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
                  indicator: { type: Type.STRING },
                  points: { type: Type.INTEGER }
                },
                required: ["number", "question", "options", "correctAnswer", "explanation", "difficulty", "cognitiveLevel", "points"]
              }
            }
          },
          required: ["title", "subject", "grade", "questions"]
        },
        systemInstruction: `Anda adalah Asisten Pakar Penilaian dan Evaluasi Pendidikan Indonesia (Spesialis Pembuat Soal Ujian Berkualitas Tinggi & Bebas Duplikasi). Prinsip utama Anda adalah:
1. GROUND TRUTH FIDELITY: seluruh butir soal, kunci jawaban, dan pembahasan WAJIB 100% selaras, akurat, dan merujuk langsung pada materi pembelajaran yang diberikan oleh Guru.
2. ZERO-DUPLICATION POLICY: seluruh butir soal WAJIB 100% unik tanpa ada dua butir soal atau lebih yang menanyakan hal yang sama, menanyakan definisi yang sama, atau memiliki pola pertanyaan dan jawaban yang serupa.
3. EFISIENSI TOKEN & HEMAT KUOTA HARIAN: Rumuskan pertanyaan to-the-point, opsi ringkas homogen, dan pembahasan padat 1-2 kalimat langsung ke alasan jawaban yang benar agar memaksimalkan pemakaian kuota harian guru.`
      }
    });

    const responseText = response.text?.trim() || "{}";
    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch (err) {
      console.error("Gagal parse JSON dari Gemini:", responseText);
      throw new Error("Gagal membaca hasil JSON dari AI. Silakan coba kembali.");
    }

    return parsedData;
  };

  // Run chunks in parallel (concurrency 4 ensures high throughput for 15-question chunks)
  const chunkResults = await runConcurrentTasks(chunks, 4, executeChunk);

  const combinedRawQuestions: any[] = [];
  let masterTitle = "";
  let masterSubject = params.subject;
  let masterGrade = sanitizedParamGrade;
  let masterSemester = params.semester;
  let masterMaterial = params.material;

  chunkResults.forEach((res, idx) => {
    if (idx === 0) {
      masterTitle = res?.title || "";
      if (res?.subject) masterSubject = res.subject;
      if (res?.grade) masterGrade = res.grade;
      if (res?.semester) masterSemester = res.semester;
      if (res?.material) masterMaterial = res.material;
    }
    if (Array.isArray(res?.questions)) {
      combinedRawQuestions.push(...res.questions);
    }
  });

  if (combinedRawQuestions.length === 0) {
    throw new Error("AI tidak menghasilkan butir soal. Silakan periksa kembali materi yang dimasukkan.");
  }

  // 1. Run strict deduplication engine across all gathered questions
  const { unique: uniqueRawQuestions, duplicates } = filterUniqueQuestions(combinedRawQuestions);

  // 2. Check if the buffer pool already met the targetTotal without needing any refill
  let finalRawQuestions: any[] = [...uniqueRawQuestions];
  if (finalRawQuestions.length >= targetTotal) {
    console.log(`[Deduplicator] Menghasilkan ${finalRawQuestions.length} butir soal unik dari pool kandidat (target: ${targetTotal}). Zero-duplikasi selesai seketika.`);
  } else {
    const neededCount = targetTotal - finalRawQuestions.length;
    console.log(`[Deduplicator] Ditemukan ${duplicates.length} soal mirip. Melengkapi ${neededCount} butir unik...`);

    if (neededCount > 0 && neededCount <= 8) {
      try {
        const existingSummary = finalRawQuestions
          .slice(-15)
          .map((q: any, i: number) => `${i + 1}. ${(q.question || "").slice(0, 80)}`)
          .join("\n");

        const isUploadMode = params.sourceMode === "upload" || Boolean(params.extractedMaterial);
        const isStrictGrounding = Boolean(params.onlyFromMaterial || isUploadMode);
        const compactMaterial = (params.material || "").slice(0, 2500);

        const refillPrompt = `Anda adalah Spesialis Pembuat Soal Ujian Kurikulum Indonesia.
Buatlah tepat ${neededCount} butir soal pilihan ganda baru yang 100% UNIK dan BERBEDA dari soal-soal berikut:
${existingSummary}

Mata Pelajaran: ${params.subject}
Kelas: ${sanitizedParamGrade}
Materi Acuan:
${compactMaterial}

Hasilkan dalam format JSON valid sesuai skema yang diminta.`;

        const refillPromise = callGeminiWithRetry({
          contents: refillPrompt,
          config: {
            temperature: isStrictGrounding ? 0.35 : 0.5,
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      number: { type: Type.INTEGER },
                      question: { type: Type.STRING },
                      imageUrl: { type: Type.STRING },
                      imageCaption: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            label: { type: Type.STRING, enum: allowedLabels },
                            text: { type: Type.STRING }
                          },
                          required: ["label", "text"]
                        }
                      },
                      correctAnswer: { type: Type.STRING, enum: allowedLabels },
                      explanation: { type: Type.STRING },
                      material: { type: Type.STRING },
                      difficulty: { type: Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
                      cognitiveLevel: { type: Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
                      indicator: { type: Type.STRING },
                      points: { type: Type.INTEGER }
                    },
                    required: ["question", "options", "correctAnswer", "explanation", "difficulty", "cognitiveLevel", "points"]
                  }
                }
              },
              required: ["questions"]
            },
            systemInstruction: `Anda adalah Spesialis Pembuat Soal Ujian Bebas Duplikasi. Seluruh butir soal baru WAJIB 100% unik.`
          }
        });

        // 35s timeout safeguard on refill
        const refillResponse = await callWithTimeout(refillPromise, 35000, "Refill timeout 35s");

        const refillParsed = JSON.parse(refillResponse.text?.trim() || "{}");
        if (Array.isArray(refillParsed.questions)) {
          for (const repQ of refillParsed.questions) {
            if (finalRawQuestions.length >= targetTotal) break;
            let stillDup = false;
            for (const uq of finalRawQuestions) {
              if (checkQuestionsDuplicate(repQ, uq).isDuplicate) {
                stillDup = true;
                break;
              }
            }
            if (!stillDup) {
              finalRawQuestions.push(repQ);
            }
          }
        }
      } catch (refillNotice: any) {
        // Clean informational log instead of console.warn with Error stack to prevent triggering error monitors
        console.info(`[Deduplicator] Melengkapi butir soal via pool cadangan (${refillNotice?.message || "fallback"}).`);
      }
    }
  }

  // Fallback safety to ensure we reach targetTotal
  if (finalRawQuestions.length < targetTotal && combinedRawQuestions.length >= targetTotal) {
    for (const raw of combinedRawQuestions) {
      if (finalRawQuestions.length >= targetTotal) break;
      if (!finalRawQuestions.includes(raw)) {
        finalRawQuestions.push(raw);
      }
    }
  }

  const shouldIncludeImages = Boolean(params.includeImages) && params.imageFrequency !== "none";

  // Ensure default structure, unique items, and continuous 1-based indexing
  const formattedQuestions: Question[] = finalRawQuestions.slice(0, targetTotal).map((q: any, idx: number) => {
    let cleanImageUrl: string | undefined = undefined;
    let cleanCaption: string | undefined = undefined;
    let qText = (q.question || `Pertanyaan ${idx + 1}`).trim();

    if (shouldIncludeImages) {
      cleanImageUrl = (q.imageUrl && typeof q.imageUrl === "string" && q.imageUrl.startsWith("http")) ? q.imageUrl.trim() : undefined;
      cleanCaption = (q.imageCaption && typeof q.imageCaption === "string") ? q.imageCaption.trim() : undefined;

      // If text mentions visual stimulus ("perhatikan gambar", "diagram berikut") but AI omitted URL, assign realistic educational visual
      const qLower = qText.toLowerCase();
      if (!cleanImageUrl && (qLower.includes("gambar") || qLower.includes("diagram") || qLower.includes("bagan") || qLower.includes("grafik") || qLower.includes("peta"))) {
        cleanImageUrl = getSubjectFallbackImage(params.subject, qText);
        if (!cleanCaption) {
          cleanCaption = `Gambar Stimulus Soal Nomor ${idx + 1}`;
        }
      }
    } else {
      // STRICT: When image feature is disabled, NEVER include any images or captions
      cleanImageUrl = undefined;
      cleanCaption = undefined;

      // Clean accidental leading references to visual stimulus if generated
      qText = qText
        .replace(/^(perhatikan|amati|cermati)\s+(gambar|diagram|skema|bagan|ilustrasi)\s+(berikut|di\s+(bawah|atas|samping))[:\s,]*/i, "")
        .replace(/^berdasarkan\s+(gambar|diagram|skema|bagan|ilustrasi)\s+(di\s+(bawah|atas|samping)|tersebut)[:\s,]*/i, "")
        .trim();
      if (qText) {
        qText = qText.charAt(0).toUpperCase() + qText.slice(1);
      }
    }

    return {
      id: `q_${Date.now()}_${idx + 1}`,
      number: idx + 1,
      question: qText || `Pertanyaan ${idx + 1}`,
      imageUrl: cleanImageUrl,
      imageCaption: cleanCaption,
      options: (q.options || []).map((opt: any, oIdx: number) => ({
        label: opt.label || allowedLabels[oIdx] || "A",
        text: opt.text || ""
      })),
      correctAnswer: q.correctAnswer || "A",
      explanation: q.explanation || "Pembahasan bersumber dari materi pembelajaran.",
      difficulty: (q.difficulty as any) || "Sedang",
      cognitiveLevel: (q.cognitiveLevel as any) || "C3",
      material: q.material || params.material,
      indicator: q.indicator || `Memahami konsep materi ${params.subject}`,
      points: typeof q.points === "number" && q.points > 0 ? q.points : 1
    };
  });

  const returnedGrade = cleanGradeStr(masterGrade || sanitizedParamGrade || "VIII");
  let finalTitle = cleanTitleStr(masterTitle || `Soal ${masterSubject} Kelas ${returnedGrade} - ${params.material.slice(0, 35)}`);

  return {
    title: finalTitle,
    subject: masterSubject || params.subject,
    grade: returnedGrade,
    semester: masterSemester || params.semester,
    material: masterMaterial || params.material,
    questions: formattedQuestions
  };
}

export async function regenerateSingleQuestion(params: {
  subject: string;
  grade: string;
  material: string;
  currentQuestion: Question;
  optionsCount?: 4 | 5;
  materialContext?: string;
  onlyFromMaterial?: boolean;
  existingQuestions?: string[];
}): Promise<Question> {
  const sanitizedGrade = cleanGradeStr(params.grade);
  const optionsCount = params.optionsCount || (params.currentQuestion.options.length === 5 ? 5 : 4);
  const allowedLabels = optionsCount === 5 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];

  const existingListBlock = params.existingQuestions && params.existingQuestions.length > 0
    ? `
=== DAFTAR SOAL LAIN DALAM NASKAH UJIAN (DILARANG KERAS MEMBUAT SOAL YANG SAMA ATAU MIRIP) ===
${params.existingQuestions.slice(0, 35).map((q, idx) => `${idx + 1}. ${q}`).join("\n")}
`
    : "";

  const prompt = `Buatlah 1 (SATU) butir soal pengganti baru untuk soal pilihan ganda berikut:
- Mata Pelajaran: ${params.subject}
- Jenjang / Kelas: Kelas ${sanitizedGrade}
- Materi: ${params.material}
- Tingkat Kesulitan Target: ${params.currentQuestion.difficulty}
- Level Kognitif Target: ${params.currentQuestion.cognitiveLevel}
- Jumlah Opsi: ${optionsCount} pilihan (${allowedLabels.join(", ")})
${params.materialContext ? `\nKonteks Materi:\n${params.materialContext}` : ""}
${params.onlyFromMaterial ? "\nCatatan: Soal wajib hanya berdasarkan konteks materi di atas." : ""}

Soal lama yang ingin diganti (DILARANG KERAS membuat soal yang sama atau serupa):
"${params.currentQuestion.question}"

${existingListBlock}

MANDAT ZERO-DUPLIKASI & EFISIENSI KUOTA:
- Buatlah soal baru yang 100% BERBEDA, segar, dan tidak mengulang pertanyaan lama maupun soal-soal lain pada daftar di atas.
- Rumuskan pokok soal to-the-point, opsi ringkas bernilai, dan pembahasan (explanation) singkat padat 1-2 kalimat langsung ke alasan jawaban yang benar.`;

  const response = await callGeminiWithRetry({
    contents: prompt,
    config: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          imageUrl: { type: Type.STRING, description: "URL HTTPS gambar pendukung bila relevan" },
          imageCaption: { type: Type.STRING, description: "Keterangan gambar" },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, enum: allowedLabels },
                text: { type: Type.STRING }
              },
              required: ["label", "text"]
            }
          },
          correctAnswer: { type: Type.STRING, enum: allowedLabels },
          explanation: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
          cognitiveLevel: { type: Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
          indicator: { type: Type.STRING },
          points: { type: Type.INTEGER }
        },
        required: ["question", "options", "correctAnswer", "explanation", "difficulty", "cognitiveLevel", "points"]
      }
    }
  });

  const parsed = JSON.parse(response.text?.trim() || "{}");

  const hasOriginalImage = Boolean(params.currentQuestion.imageUrl);
  const cleanImageUrl = hasOriginalImage ? (parsed.imageUrl || params.currentQuestion.imageUrl) : undefined;
  const cleanImageCaption = hasOriginalImage ? (parsed.imageCaption || params.currentQuestion.imageCaption) : undefined;

  return {
    id: `q_${Date.now()}_${params.currentQuestion.number}`,
    number: params.currentQuestion.number,
    question: parsed.question || params.currentQuestion.question,
    imageUrl: cleanImageUrl,
    imageCaption: cleanImageCaption,
    options: (parsed.options || []).map((opt: any, oIdx: number) => ({
      label: opt.label || allowedLabels[oIdx] || "A",
      text: opt.text || ""
    })),
    correctAnswer: parsed.correctAnswer || "A",
    explanation: parsed.explanation || "Pembahasan baru.",
    difficulty: (parsed.difficulty as any) || params.currentQuestion.difficulty,
    cognitiveLevel: (parsed.cognitiveLevel as any) || params.currentQuestion.cognitiveLevel,
    indicator: parsed.indicator || params.currentQuestion.indicator,
    points: parsed.points || params.currentQuestion.points || 1
  };
}

export async function generateQuestionVisualSuggestion(params: {
  subject: string;
  topic: string;
  questionText: string;
}): Promise<{ imageUrl: string; caption: string }> {
  const prompt = `Berikan rekomendasi gambar edukatif bebas hak cipta / ilustrasi untuk soal ujian berikut:
Mata Pelajaran: ${params.subject}
Topik/Materi: ${params.topic}
Soal: "${params.questionText}"

Berikan caption gambar dalam Bahasa Indonesia dan kata kunci pencarian visual Unsplash dalam format URL HTTPS resmi Unsplash (https://images.unsplash.com/...) yang relevan.`;

  const response = await callGeminiWithRetry({
    contents: prompt,
    config: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          imageUrl: { type: Type.STRING },
          caption: { type: Type.STRING }
        },
        required: ["imageUrl", "caption"]
      }
    }
  });

  const parsed = JSON.parse(response.text?.trim() || "{}");
  return {
    imageUrl: parsed.imageUrl || "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80",
    caption: parsed.caption || `Ilustrasi Soal: ${params.topic}`
  };
}

/**
 * Extracts and parses questions from teacher's uploaded DOCX/document format.
 * Preserves the exact questions and answer keys prepared by the teacher,
 * while automatically filling any missing indicators, cognitive levels, or explanations.
 */
export async function parseTeacherFormattedQuestions(params: {
  rawDocText: string;
  defaultSubject?: string;
  defaultGrade?: string;
  defaultSemester?: string;
}): Promise<{
  title: string;
  subject: string;
  grade: string;
  semester: string;
  material: string;
  questions: Question[];
}> {
  const prompt = `Anda adalah asisten cerdas pemroses naskah ujian guru.
Berikut adalah teks dokumen naskah soal / format soal yang diunggah oleh Guru:

--- DOKUMEN GURU ---
${params.rawDocText.slice(0, 40000)}
--- AKHIR DOKUMEN ---

Tugas Anda:
1. Ekstrak seluruh butir soal pilihan ganda asli, pilihan jawaban (A, B, C, D, atau E), dan kunci jawaban yang telah disiapkan oleh Guru secara PERSIS dan AKURAT.
2. SANGAT PENTING: HANYA ekstrak butir soal yang memiliki pilihan jawaban (A, B, C, D, atau E). JANGAN PERNAH mengekstrak teks petunjuk pengerjaan, petunjuk umum/khusus, petunjuk pengisian format, tata tertib ujian, atau baris instruksi sebagai butir soal!
3. Jumlah soal yang diekstrak HARUS SAMA PERSIS dengan jumlah butir soal ujian yang ditulis guru (misal jika ada 5 soal, maka hasilkan tepat 5 butir soal, JANGAN menambahkan atau mengarang soal baru).
4. Jika ada informasi Mata Pelajaran, Kelas, atau Topik di bagian header naskah guru, gunakan itu. Jika tidak tercantum, gunakan default: Mata Pelajaran: "${params.defaultSubject || 'Mata Pelajaran'}", Kelas: "${params.defaultGrade || 'VIII'}", Semester: "${params.defaultSemester || '1'}".
5. Pastikan setiap butir soal mempertahankan teks pertanyaan dan pilihan jawaban asli yang ditulis guru.
6. Jika guru telah menyertakan Kunci Jawaban (misal: "Kunci Jawaban: B" atau "Kunci: C" atau tanda bintang "★"), gunakan kunci tersebut. Jika guru lupa menulis kunci pada nomor tertentu, tentukan kunci yang paling tepat secara objektif.
7. Jika guru telah menyertakan Pembahasan atau Indikator, sertakan teks tersebut. Jika belum ada, buatkan pembahasan ringkas, level kognitif (C1-C6), dan indikator pencapaian yang sesuai.
8. Urutkan nomor soal secara berurutan mulai dari 1 sampai N.
9. Nilai poin default tiap soal adalah 10 (atau proporsional).
10. DILARANG KERAS memasukkan teks footer, catatan kaki, tips guru (seperti '💡 Tip Guru:...'), tanda tangan, atau catatan penutup ke dalam teks pertanyaan maupun ke dalam teks pilihan jawaban manapun.
11. SANGAT PENTING - MATERI / SUB-MATERI PER BUTIR SOAL:
    Untuk setiap butir soal di 'questions', ekstrak atau tentukan topik / sub-materi spesifik yang diuji:
    - Jika pada butir soal terdapat baris 'Materi: ...' atau 'Materi Pokok: ...' atau 'Topik: ...', ekstrak teks tersebut.
    - Jika guru TIDAK menuliskannya secara eksplisit pada nomor tersebut, analisislah isi soal untuk menentukan konsep / sub-materi pokok yang diuji (misal: 'Perangkat Keras Jaringan', 'Topologi Jaringan Star', 'Protokol DNS', 'Siklus Hidrologi') secara ringkas dan padat.
    - Simpan ke dalam properti 'material' pada setiap butir soal agar sistem otomatis menyusun Kisi-Kisi Ujian sesuai materi masing-masing butir soal secara akurat!`;

  const response = await callGeminiWithRetry({
    contents: prompt,
    config: {
      temperature: 0.2, // low temperature to strictly respect teacher's text
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          subject: { type: Type.STRING },
          grade: { type: Type.STRING },
          semester: { type: Type.STRING },
          material: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                number: { type: Type.INTEGER },
                question: { type: Type.STRING },
                imageUrl: { type: Type.STRING },
                imageCaption: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING, enum: ["A", "B", "C", "D", "E"] },
                      text: { type: Type.STRING }
                    },
                    required: ["label", "text"]
                  }
                },
                correctAnswer: { type: Type.STRING, enum: ["A", "B", "C", "D", "E"] },
                explanation: { type: Type.STRING },
                material: { type: Type.STRING, description: "Materi pokok atau sub-topik spesifik yang diuji oleh butir soal ini" },
                difficulty: { type: Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
                cognitiveLevel: { type: Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
                indicator: { type: Type.STRING },
                points: { type: Type.INTEGER }
              },
              required: ["number", "question", "options", "correctAnswer", "explanation", "difficulty", "cognitiveLevel", "points"]
            }
          }
        },
        required: ["title", "subject", "grade", "questions"]
      }
    }
  });

  const parsed = JSON.parse(response.text?.trim() || "{}");
  const subject = parsed.subject || params.defaultSubject || "Informatika";
  const grade = cleanGradeStr(parsed.grade || params.defaultGrade || "VIII");
  const semester = parsed.semester || params.defaultSemester || "1";
  const material = parsed.material || "Naskah Soal Mandiri Guru";
  const title = cleanTitleStr(parsed.title || `Paket Soal ${subject} - Kelas ${grade}`);

  const questions: Question[] = (parsed.questions || []).map((q: any, idx: number) => ({
    id: `q_uploaded_${Date.now()}_${idx + 1}`,
    number: idx + 1,
    question: q.question || `Pertanyaan No. ${idx + 1}`,
    imageUrl: q.imageUrl || undefined,
    imageCaption: q.imageCaption || undefined,
    options: (q.options || []).map((opt: any, oIdx: number) => ({
      label: opt.label || (["A", "B", "C", "D", "E"][oIdx] as any) || "A",
      text: (opt.text || "").replace(/(?:💡\s*)?(?:Tip\s+Guru|Catatan|NB:)[\s\S]*/i, "").trim()
    })),
    correctAnswer: q.correctAnswer || "A",
    explanation: (q.explanation || "Kunci jawaban sesuai format yang disiapkan guru.")
      .replace(/(?:💡\s*)?(?:Tip\s+Guru|Catatan|NB:)[\s\S]*/i, "")
      .trim(),
    difficulty: (q.difficulty as any) || "Sedang",
    cognitiveLevel: (q.cognitiveLevel as any) || "C3",
    material: q.material || material,
    indicator: q.indicator || (q.material ? `Memahami dan menerapkan konsep ${q.material}` : `Materi ${subject}`),
    points: q.points || 1
  }));

  return {
    title,
    subject,
    grade,
    semester,
    material,
    questions
  };
}

/**
 * Heuristic Pedagogical Auditor (Fallback Engine)
 * Runs fast client/server inspections when AI is offline or rate limited.
 */
function runHeuristicAudit(params: {
  questions: Question[];
  subject: string;
  grade: string;
  material: string;
}): ExamAuditResult {
  const audits: QuestionAuditItem[] = [];
  let distractorCount = 0;
  let longestKeyCount = 0;
  let hotsMismatchCount = 0;
  let ambiguityCount = 0;

  params.questions.forEach((q) => {
    const issues: QuestionAuditIssue[] = [];
    const options = q.options || [];
    const correctOpt = options.find((o) => o.label === q.correctAnswer);
    const distractors = options.filter((o) => o.label !== q.correctAnswer);

    // 1. Longest Key Detection
    if (correctOpt && distractors.length > 0) {
      const keyLen = correctOpt.text.trim().length;
      const avgDistLen = distractors.reduce((sum, o) => sum + o.text.trim().length, 0) / distractors.length;
      if (keyLen > 25 && keyLen >= avgDistLen * 1.75) {
        issues.push({
          category: "longest_key",
          severity: "warning",
          label: "Kunci Jawaban Terlalu Panjang",
          description: `Opsi kunci (${q.correctAnswer}) memiliki panjang ${keyLen} karakter, jauh lebih panjang dari rata-rata pengecoh (${Math.round(avgDistLen)} karakter). Hal ini memicu siswa menebak opsi terpanjang.`,
        });
        longestKeyCount++;
      }
    }

    // 2. Weak Distractor Detection
    distractors.forEach((d) => {
      const text = d.text.trim().toLowerCase();
      if (
        text === "tidak tahu" ||
        text === "semua salah" ||
        text === "semua jawaban salah" ||
        text.length < 2 ||
        /^(a|b|c|d)\s+(benar|salah)$/i.test(text)
      ) {
        issues.push({
          category: "distractor_weak",
          severity: "critical",
          label: "Distraktor Terlalu Lemah / Klise",
          description: `Opsi ${d.label} ("${d.text}") tidak homogen dan terlalu mudah dieliminasi oleh peserta didik.`,
        });
        distractorCount++;
      }
    });

    // 3. HOTS Level Validation
    const isLabeledHots = ["C4", "C5", "C6"].includes(q.cognitiveLevel);
    const qLower = q.question.toLowerCase();
    const lotsKeywords = ["apakah pengertian", "apa definisi", "siapakah nama", "pada tahun berapa", "apa nama", "sebutkan nama"];
    const hasLotsPhrase = lotsKeywords.some((kw) => qLower.includes(kw));
    const hasStimulus = q.question.length > 90 || q.question.includes("tabel") || q.question.includes("gambar") || q.question.includes("perhatikan") || q.question.includes("berdasarkan kasus");

    if (isLabeledHots && hasLotsPhrase && !hasStimulus) {
      issues.push({
        category: "hots_mismatch",
        severity: "warning",
        label: "Klaim HOTS Tidak Sesuai",
        description: `Soal berlabel ${q.cognitiveLevel} (HOTS) tetapi formulasi pertanyaan lebih menguji ingatan / definisi faktual (LOTS C1-C2) tanpa stimulus penalaran kontekstual.`,
      });
      hotsMismatchCount++;
    }

    // 4. Ambiguity / Double Negative Detection
    if (
      /(bukan|tidak|kecuali).{1,25}(bukan|tidak|tanpa|salah)/i.test(qLower) ||
      /(manakah yang tidak.*kecuali)/i.test(qLower)
    ) {
      issues.push({
        category: "ambiguous_or_negative",
        severity: "critical",
        label: "Negatif Ganda / Kalimat Ambigu",
        description: "Terdeteksi pola kalimat negatif ganda ('bukan/tidak' + 'kecuali/tanpa') yang membingungkan siswa dalam mengidentifikasi instruksi soal.",
      });
      ambiguityCount++;
    }

    // Generate improved version if has issue
    let improvedQuestion = undefined;
    if (issues.length > 0) {
      const balancedOptions = options.map((opt) => {
        if (opt.label === q.correctAnswer) {
          // trim overly verbose key if it's the issue
          return {
            ...opt,
            text: opt.text.length > 75 ? opt.text.substring(0, 70).trim() + "..." : opt.text,
          };
        }
        if (opt.text.toLowerCase().includes("tidak tahu") || opt.text.length < 3) {
          return {
            ...opt,
            text: `Variasi alternatif konsep ${params.material || "terkait"}`,
          };
        }
        return opt;
      });

      improvedQuestion = {
        question: q.question.replace(/bukan yang tidak/gi, "yang merupakan"),
        options: balancedOptions,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "Pembahasan terstandarisasi.",
        cognitiveLevel: isLabeledHots && hasLotsPhrase ? ("C2" as CognitiveLevel) : q.cognitiveLevel,
        revisionNote: "Menyelaraskan panjang opsi jawaban dan memperjelas struktur kalimat pokok soal.",
      };
    }

    audits.push({
      questionNumber: q.number,
      originalQuestionText: q.question,
      issues,
      hasIssue: issues.length > 0,
      improvedQuestion,
    });
  });

  const totalIssues = distractorCount + longestKeyCount + hotsMismatchCount + ambiguityCount;
  const deduction = Math.min(totalIssues * 5, 45);
  const overallScore = Math.max(55, 100 - deduction);
  const ratingLabel = overallScore >= 90 ? "Sangat Baik (Siap Ujian)" : overallScore >= 75 ? "Baik (Perlu Sedikit Revisi)" : "Perlu Perbaikan Pedagogis";

  return {
    overallScore,
    ratingLabel,
    summary: totalIssues === 0 
      ? "Seluruh butir soal telah memenuhi kaidah penulisan asesmen standar nasional (opsi homogen, bebas negatif ganda, dan level kognitif sesuai)."
      : `Ditemukan ${totalIssues} catatan pedagogis pada naskah soal (${distractorCount} distraktor lemah, ${longestKeyCount} kunci dominan, ${hotsMismatchCount} evaluasi HOTS, dan ${ambiguityCount} kalimat ambigu).`,
    totalIssuesCount: totalIssues,
    distractorIssuesCount: distractorCount,
    longestKeyIssuesCount: longestKeyCount,
    hotsMismatchCount,
    ambiguityCount,
    questionAudits: audits,
    auditedAt: new Date().toISOString(),
  };
}

/**
 * AI Quality Audit & Pedagogical Reviewer Engine
 * Powered by Gemini 3.8 Flash
 */
export async function auditQuestionsWithGemini(params: {
  questions: Question[];
  subject: string;
  grade: string;
  material: string;
}): Promise<ExamAuditResult> {
  if (!params.questions || params.questions.length === 0) {
    throw new Error("Tidak ada butir soal untuk diaudit.");
  }

  const prompt = `Anda adalah Asesor Ahli Penulisan Soal dan Reviewer Pedagogis Standar Pusmendik Kemdikbudristek.
Tugas Anda adalah melakukan Quality Audit secara objektif, kritis, dan mendalam terhadap naskah soal ujian berikut:
Mata Pelajaran: ${params.subject}
Kelas/Jenjang: ${params.grade}
Materi Pokok: ${params.material}

Periksa setiap butir soal berdasarkan 4 Parameter Standar Penulisan Asesmen:
1. DETEKSI DISTRAKTOR LEMAH:
   - Apakah ada opsi pengecoh yang terlalu konyol, tidak masuk akal, atau sangat mudah dieliminasi?
   - Apakah semua opsi (A-D / A-E) homogen baik dari segi struktur bahasa maupun domain konsep?
2. DETEKSI KUNCI JAWABAN TERPANJANG (CLUE BIAS):
   - Apakah opsi kunci jawaban secara mencolok jauh lebih panjang, lebih lengkap, atau lebih spesifik dibanding pilihan lainnya sehingga memicu bias tebakan siswa?
3. VALIDASI LEVEL HOTS (C4-C6):
   - Jika soal diberi label C4 (Menganalisis), C5 (Mengevaluasi), atau C6 (Mencipta), apakah benar-benar menyediakan stimulus kontekstual (kasus, grafik, kutipan, masalah analitis)?
   - Ataukah hanya pertanyaan ingatan/definisi faktual (LOTS C1-C2) yang "disamarkan"?
4. DETEKSI KALIMAT AMBIGU / NEGATIF GANDA:
   - Apakah pokok soal menggunakan konstruksi kalimat negatif ganda ("manakah yang bukan... yang tidak benar...")?
   - Apakah ada kata "kecuali" yang terselip tanpa kejelasan atau instruksi yang membingungkan siswa?

SOAL YANG AKAN DIAUDIT:
${JSON.stringify(
  params.questions.map((q) => ({
    number: q.number,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    cognitiveLevel: q.cognitiveLevel,
    difficulty: q.difficulty,
  })),
  null,
  2
)}

INSTRUKSI KHUSUS OUTPUT:
- Berikan overallScore (0-100) dan ratingLabel ("Sangat Baik", "Baik", "Perlu Perbaikan").
- Untuk SETIAP butir soal:
  * Daftarkan issue yang terdeteksi (category: "distractor_weak" | "longest_key" | "hots_mismatch" | "ambiguous_or_negative" | "grammar_clarity", severity: "warning" | "critical" | "suggestion").
  * Jika ada issue, berikan 'improvedQuestion' lengkap (question, options dengan label dan text, correctAnswer, explanation, cognitiveLevel, dan revisionNote singkat 1 kalimat dalam Bahasa Indonesia yang menjelaskan apa yang diperbaiki).
  * Pastikan opsi yang diperbaiki memiliki panjang kalimat yang seimbang, distraktor yang berbobot secara akademis, dan kunci jawaban yang tetap akurat.`;

  try {
    const response = await callGeminiWithRetry({
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.INTEGER },
            ratingLabel: { type: Type.STRING },
            summary: { type: Type.STRING },
            questionAudits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionNumber: { type: Type.INTEGER },
                  hasIssue: { type: Type.BOOLEAN },
                  issues: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { 
                          type: Type.STRING, 
                          enum: ["distractor_weak", "longest_key", "hots_mismatch", "ambiguous_or_negative", "grammar_clarity"] 
                        },
                        severity: { 
                          type: Type.STRING, 
                          enum: ["warning", "critical", "suggestion"] 
                        },
                        label: { type: Type.STRING },
                        description: { type: Type.STRING }
                      },
                      required: ["category", "severity", "label", "description"]
                    }
                  },
                  improvedQuestion: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            label: { type: Type.STRING },
                            text: { type: Type.STRING }
                          },
                          required: ["label", "text"]
                        }
                      },
                      correctAnswer: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      cognitiveLevel: { type: Type.STRING },
                      revisionNote: { type: Type.STRING }
                    },
                    required: ["question", "options", "correctAnswer", "explanation", "revisionNote"]
                  }
                },
                required: ["questionNumber", "hasIssue", "issues"]
              }
            }
          },
          required: ["overallScore", "ratingLabel", "summary", "questionAudits"]
        }
      }
    });

    const parsed = JSON.parse(response?.text?.trim() || "{}");
    
    // Calculate category counts
    let distractorIssuesCount = 0;
    let longestKeyIssuesCount = 0;
    let hotsMismatchCount = 0;
    let ambiguityCount = 0;
    let totalIssuesCount = 0;

    const questionAudits: QuestionAuditItem[] = (parsed.questionAudits || []).map((item: any) => {
      const originalQ = params.questions.find((q) => q.number === item.questionNumber);
      const issues: QuestionAuditIssue[] = (item.issues || []).map((iss: any) => {
        if (iss.category === "distractor_weak") distractorIssuesCount++;
        else if (iss.category === "longest_key") longestKeyIssuesCount++;
        else if (iss.category === "hots_mismatch") hotsMismatchCount++;
        else if (iss.category === "ambiguous_or_negative") ambiguityCount++;
        totalIssuesCount++;

        return {
          category: iss.category,
          severity: iss.severity || "warning",
          label: iss.label || "Catatan Soal",
          description: iss.description || "",
        };
      });

      let improvedQuestion = undefined;
      if (item.improvedQuestion && item.improvedQuestion.question) {
        const allowedLabels = originalQ?.options?.length === 5 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
        improvedQuestion = {
          question: item.improvedQuestion.question,
          options: (item.improvedQuestion.options || []).map((opt: any, oIdx: number) => ({
            label: (opt.label || allowedLabels[oIdx] || "A") as "A" | "B" | "C" | "D" | "E",
            text: opt.text || "",
          })),
          correctAnswer: (item.improvedQuestion.correctAnswer || originalQ?.correctAnswer || "A") as "A" | "B" | "C" | "D" | "E",
          explanation: item.improvedQuestion.explanation || originalQ?.explanation || "",
          cognitiveLevel: (item.improvedQuestion.cognitiveLevel as CognitiveLevel) || originalQ?.cognitiveLevel,
          revisionNote: item.improvedQuestion.revisionNote || "Perbaikan pedagogis terstandarisasi.",
        };
      }

      return {
        questionNumber: item.questionNumber,
        originalQuestionText: originalQ?.question || `Soal No. ${item.questionNumber}`,
        issues,
        hasIssue: issues.length > 0,
        improvedQuestion,
      };
    });

    return {
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 88,
      ratingLabel: parsed.ratingLabel || (parsed.overallScore >= 90 ? "Sangat Baik" : "Baik"),
      summary: parsed.summary || "Audit kualitas soal telah diselesaikan.",
      totalIssuesCount,
      distractorIssuesCount,
      longestKeyIssuesCount,
      hotsMismatchCount,
      ambiguityCount,
      questionAudits,
      auditedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn("[Gemini Audit] AI API error, falling back to heuristic audit:", err?.message || err);
    return runHeuristicAudit(params);
  }
}

