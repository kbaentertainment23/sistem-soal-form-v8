var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express2 = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/app.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_mammoth = __toESM(require("mammoth"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);

// server/gemini.ts
var import_genai = require("@google/genai");

// src/lib/questionDeduplicator.ts
var INTRO_PREFIX_REGEX = /^(perhatikan|cermati|amati|simaklah|berdasarkan|pada|dalam|menurut)\s+[^:?!.\n]+[:.]\s*/gi;
var FILLER_PHRASE_REGEX = /\b(berikut\s+ini\s+yang\s+merupakan|berikut\s+ini\s+yang|berikut\s+yang\s+merupakan|berikut\s+yang|di\s+bawah\s+ini\s+yang|manakah\s+yang\s+merupakan|manakah\s+yang|pernyataan\s+yang\s+benar\s+adalah|pernyataan\s+yang\s+tepat|hal\s+yang\s+merupakan|apa\s+yang\s+dimaksud\s+dengan|faktor\s+yang\s+mempengaruhi|pada\s+dasarnya)\b/gi;
var INDONESIA_STOPWORDS = /* @__PURE__ */ new Set([
  "yang",
  "di",
  "ke",
  "dari",
  "ini",
  "itu",
  "dan",
  "atau",
  "pada",
  "untuk",
  "dengan",
  "adalah",
  "merupakan",
  "yaitu",
  "sebagai",
  "dalam",
  "bisa",
  "dapat",
  "akan",
  "oleh",
  "antara",
  "salah",
  "satu",
  "apakah",
  "apa",
  "bagaimana",
  "mengapa",
  "kenapa",
  "siapa",
  "dimana",
  "kapan",
  "manakah",
  "sebutkan",
  "jelaskan",
  "tersebut",
  "paling",
  "sangat",
  "lebih",
  "telah",
  "sudah",
  "jika",
  "karena",
  "sehingga",
  "tentang",
  "terhadap",
  "secara",
  "suatu",
  "sebuah",
  "para",
  "agar",
  "supaya",
  "yaitu",
  "yakni"
]);
function normalizeQuestionStem(text) {
  if (!text) return "";
  return text.toLowerCase().replace(INTRO_PREFIX_REGEX, "").replace(FILLER_PHRASE_REGEX, "").replace(/[^\w\s\d]/gi, " ").replace(/\s+/g, " ").trim();
}
function getQuestionKeywords(text) {
  const norm = normalizeQuestionStem(text);
  const words = norm.split(" ").filter((w) => w.length > 2 && !INDONESIA_STOPWORDS.has(w));
  return new Set(words);
}
function calculateJaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
function checkQuestionsDuplicate(q1, q2) {
  const text1 = (q1?.question || "").trim();
  const text2 = (q2?.question || "").trim();
  if (!text1 || !text2) return { isDuplicate: false, similarity: 0 };
  const norm1 = normalizeQuestionStem(text1);
  const norm2 = normalizeQuestionStem(text2);
  if (norm1 === norm2 && norm1.length >= 6) {
    return {
      isDuplicate: true,
      similarity: 1,
      reason: "Teks pertanyaan identik"
    };
  }
  if (norm1.length >= 25 && norm2.length >= 25) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return {
        isDuplicate: true,
        similarity: 0.95,
        reason: "Teks pertanyaan mencakup satu sama lain"
      };
    }
  }
  const kw1 = getQuestionKeywords(text1);
  const kw2 = getQuestionKeywords(text2);
  const jaccard = calculateJaccardSimilarity(kw1, kw2);
  if (jaccard >= 0.62 && kw1.size >= 3 && kw2.size >= 3) {
    return {
      isDuplicate: true,
      similarity: jaccard,
      reason: `Inti pertanyaan dan konsep serupa (${Math.round(jaccard * 100)}% kemiripan kata kunci)`
    };
  }
  const getAnswerText = (q) => {
    if (!q?.options || !Array.isArray(q.options)) return "";
    const correctOpt = q.options.find((o) => o.label === q.correctAnswer);
    return correctOpt ? (correctOpt.text || "").toLowerCase().trim() : "";
  };
  const ans1 = getAnswerText(q1);
  const ans2 = getAnswerText(q2);
  if (ans1 && ans2 && ans1.length > 2 && (ans1 === ans2 || ans1.includes(ans2) || ans2.includes(ans1))) {
    if (jaccard >= 0.4) {
      return {
        isDuplicate: true,
        similarity: jaccard,
        reason: "Kunci jawaban identik dan topik pertanyaan bertumpuk"
      };
    }
  }
  if (Array.isArray(q1?.options) && Array.isArray(q2?.options) && q1.options.length > 0) {
    const opts1 = new Set(
      q1.options.map((o) => (o.text || "").toLowerCase().trim()).filter(Boolean)
    );
    const opts2 = new Set(
      q2.options.map((o) => (o.text || "").toLowerCase().trim()).filter(Boolean)
    );
    let matchingOpts = 0;
    for (const opt of opts1) {
      if (opts2.has(opt)) matchingOpts++;
    }
    if (matchingOpts >= 3 && jaccard >= 0.35) {
      return {
        isDuplicate: true,
        similarity: 0.85,
        reason: "Pilihan opsi jawaban dan konsep soal identik"
      };
    }
  }
  return { isDuplicate: false, similarity: jaccard };
}
function filterUniqueQuestions(rawQuestions) {
  const unique = [];
  const duplicates = [];
  for (const q of rawQuestions) {
    let dupFound = false;
    for (let uIdx = 0; uIdx < unique.length; uIdx++) {
      const check = checkQuestionsDuplicate(q, unique[uIdx]);
      if (check.isDuplicate) {
        duplicates.push({
          question: q,
          duplicateOfIndex: uIdx,
          reason: check.reason || "Duplikat"
        });
        dupFound = true;
        break;
      }
    }
    if (!dupFound) {
      unique.push(q);
    }
  }
  return { unique, duplicates };
}

// server/gemini.ts
var aiClient = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi. Pastikan variabel lingkungan GEMINI_API_KEY sudah ditambahkan di Vercel (Project Settings > Environment Variables).");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest"
];
function isRawPdfBinary(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.startsWith("%PDF-") || trimmed.startsWith("%PDF")) return true;
  if (/^[\s\S]{0,1024}%PDF-/i.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  if (lower.includes("/type /catalog") || lower.includes("/type/catalog") || lower.includes("/mediabox") || lower.includes("/procset") || lower.includes("/flatedecode") || lower.includes("/pages 2 0 r") || lower.includes("obj") && lower.includes("endobj") || lower.includes("<<") && lower.includes("/type") && lower.includes(">>")) {
    return true;
  }
  return false;
}
async function extractPdfDocumentWithGemini(base64Data, fileName) {
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
      data: cleanBase64
    }
  };
  const textPart = {
    text: prompt
  };
  const response = await callGeminiWithRetry({
    contents: {
      parts: [pdfPart, textPart]
    },
    config: {
      temperature: 0.1
    }
  });
  const extracted = (response?.text || "").trim();
  if (isRawPdfBinary(extracted)) {
    throw new Error("Hasil ekstraksi dokumen PDF tidak valid (terdeteksi data biner mentah).");
  }
  return extracted;
}
async function callWithTimeout(promise, timeoutMs, errorMsg) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
async function callGeminiWithRetry(params) {
  const ai = getAiClient();
  let lastError = null;
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await callWithTimeout(
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config
        }),
        55e3,
        `Waktu pemanggilan model ${model} melebihi 55 detik`
      );
      return response;
    } catch (err) {
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
      }
      console.warn(`[Gemini API] Model ${model} dialihkan (${cleanMsg.substring(0, 100)}). Mencoba model alternatif...`);
      if (isUnavailable || isRateLimit || isNotFound) {
        continue;
      }
      try {
        await new Promise((r) => setTimeout(r, 600));
        const retryResponse = await callWithTimeout(
          ai.models.generateContent({
            model,
            contents: params.contents,
            config: params.config
          }),
          45e3,
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
function cleanGradeStr(grade) {
  if (!grade) return "";
  return grade.replace(/^(kelas\s*)+/i, "").trim();
}
function cleanTitleStr(title) {
  if (!title) return "";
  return title.replace(/kelas\s+kelas\s+/gi, "Kelas ").replace(/kelas\s+kelas\b/gi, "Kelas").trim();
}
function splitQuestionChunks(total, maxChunkSize = 15) {
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
async function runConcurrentTasks(items, concurrency, fn) {
  const results = new Array(items.length);
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
async function generateQuestionsWithGemini(params) {
  const sanitizedParamGrade = cleanGradeStr(params.grade);
  const optionsCount = params.optionsCount || 4;
  const allowedLabels = optionsCount === 5 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
  const targetTotal = Math.min(60, Math.max(1, Number(params.questionCount) || 10));
  const candidatePoolTotal = targetTotal <= 5 ? targetTotal : Math.min(64, targetTotal + Math.min(4, Math.ceil(targetTotal * 0.08)));
  const chunks = splitQuestionChunks(candidatePoolTotal, 16);
  const getSubjectFallbackImage = (sub, qText) => {
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
  const executeChunk = async (chunk) => {
    let difficultyGuide = "";
    if (params.difficultyType === "Campuran") {
      const ratio = params.difficultyRatio || { easy: 30, medium: 50, hard: 20 };
      const easyCount = Math.max(1, Math.round(chunk.count * ratio.easy / 100));
      const hardCount = Math.max(1, Math.round(chunk.count * ratio.hard / 100));
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
      materialSections += `
=======================================================
[SUMBER ACUAN UTAMA MATERI / MODUL AJAR DARI GURU]
${params.material.trim()}
=======================================================
`;
    }
    if (params.extractedMaterial && params.extractedMaterial.trim().length > 0 && params.extractedMaterial.trim() !== params.material.trim()) {
      materialSections += `
=======================================================
[DOKUMEN TAMBAHAN MODUL / BAHAN AJAR]
${params.extractedMaterial.trim()}
=======================================================
`;
    }
    if (params.manualMaterial && params.manualMaterial.trim().length > 0) {
      materialSections += `
=======================================================
[CATATAN & SILABUS TAMBAHAN GURU]
${params.manualMaterial.trim()}
=======================================================
`;
    }
    if (params.kisiKisi && params.kisiKisi.trim().length > 0) {
      materialSections += `
=======================================================
[KISI-KISI / INDIKATOR ACUAN DARI GURU]
${params.kisiKisi.trim()}
=======================================================
`;
    }
    const shouldIncludeImages2 = Boolean(params.includeImages) && params.imageFrequency !== "none";
    const imageFrequency = shouldIncludeImages2 ? params.imageFrequency || "some" : "none";
    let imageInstruction = "";
    if (shouldIncludeImages2) {
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
${params.moduleFocusTopic ? `
5. PRIORITAS FOKUS BAB / TOPIK SPESIFIK:
   - Guru menetapkan fokus dokumen pada: "${params.moduleFocusTopic}".
   - Seluruh butir soal WAJIB diprioritaskan dan digali dari bagian/bab materi "${params.moduleFocusTopic}" tersebut.
` : ""}`;
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
    const chunkBatchGuide = chunk.totalChunks > 1 ? `
=== PANDUAN PEMBAGIAN PAKET SOAL (BAGIAN ${chunk.chunkIndex + 1} DARI ${chunk.totalChunks}) ===
- Anda sedang memproses Bagian ke-${chunk.chunkIndex + 1} dari total ${chunk.totalChunks} bagian paket ujian guru.
- Hasilkan tepat ${chunk.count} butir soal pilihan ganda baru yang UNIK, MENDALAM, BERMUTU TINGGI, dan 100% BEBAS DUPLIKASI.
- Penomoran butir soal pada bagian ini WAJIB dimulai dari nomor ${chunk.startNum} sampai nomor ${chunk.startNum + chunk.count - 1}.
- SPESIALISASI SUDUT PANDANG BAGIAN INI: ${themeTrack.title}
  ${themeTrack.mandate}
- MANDAT ZERO-DUPLIKASI MUTLAK: Seluruh butir soal dalam bagian ini harus memiliki keunikan konsep tersendiri dan tidak boleh menyerupai soal bagian lain.
` : "";
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
   - Pada kolom "explanation", jelaskan secara singkat dan padat (maksimal 1-2 kalimat) mengapa jawaban tersebut benar ${isStrictGrounding ? `disertai kutipan ringkas rujukan modul ('Rujukan Modul: "..."').` : "merujuk pada konsep materi pembelajaran."} Hindari menulis penjelasan berparagraf panjang yang memboroskan token output.

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
          type: import_genai.Type.OBJECT,
          properties: {
            title: { type: import_genai.Type.STRING },
            subject: { type: import_genai.Type.STRING },
            grade: { type: import_genai.Type.STRING },
            semester: { type: import_genai.Type.STRING },
            material: { type: import_genai.Type.STRING },
            questions: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  number: { type: import_genai.Type.INTEGER },
                  question: { type: import_genai.Type.STRING },
                  imageUrl: { type: import_genai.Type.STRING, description: "URL HTTPS gambar/diagram pendukung jika ada" },
                  imageCaption: { type: import_genai.Type.STRING, description: "Keterangan gambar/diagram" },
                  options: {
                    type: import_genai.Type.ARRAY,
                    items: {
                      type: import_genai.Type.OBJECT,
                      properties: {
                        label: { type: import_genai.Type.STRING, enum: allowedLabels },
                        text: { type: import_genai.Type.STRING }
                      },
                      required: ["label", "text"]
                    }
                  },
                  correctAnswer: { type: import_genai.Type.STRING, enum: allowedLabels },
                  explanation: { type: import_genai.Type.STRING },
                  material: { type: import_genai.Type.STRING },
                  difficulty: { type: import_genai.Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
                  cognitiveLevel: { type: import_genai.Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
                  indicator: { type: import_genai.Type.STRING },
                  points: { type: import_genai.Type.INTEGER }
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
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (err) {
      console.error("Gagal parse JSON dari Gemini:", responseText);
      throw new Error("Gagal membaca hasil JSON dari AI. Silakan coba kembali.");
    }
    return parsedData;
  };
  const chunkResults = await runConcurrentTasks(chunks, 4, executeChunk);
  const combinedRawQuestions = [];
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
  const { unique: uniqueRawQuestions, duplicates } = filterUniqueQuestions(combinedRawQuestions);
  let finalRawQuestions = [...uniqueRawQuestions];
  if (finalRawQuestions.length >= targetTotal) {
    console.log(`[Deduplicator] Menghasilkan ${finalRawQuestions.length} butir soal unik dari pool kandidat (target: ${targetTotal}). Zero-duplikasi selesai seketika.`);
  } else {
    const neededCount = targetTotal - finalRawQuestions.length;
    console.log(`[Deduplicator] Ditemukan ${duplicates.length} soal mirip. Melengkapi ${neededCount} butir unik...`);
    if (neededCount > 0 && neededCount <= 8) {
      try {
        const existingSummary = finalRawQuestions.slice(-15).map((q, i) => `${i + 1}. ${(q.question || "").slice(0, 80)}`).join("\n");
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
              type: import_genai.Type.OBJECT,
              properties: {
                questions: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      number: { type: import_genai.Type.INTEGER },
                      question: { type: import_genai.Type.STRING },
                      imageUrl: { type: import_genai.Type.STRING },
                      imageCaption: { type: import_genai.Type.STRING },
                      options: {
                        type: import_genai.Type.ARRAY,
                        items: {
                          type: import_genai.Type.OBJECT,
                          properties: {
                            label: { type: import_genai.Type.STRING, enum: allowedLabels },
                            text: { type: import_genai.Type.STRING }
                          },
                          required: ["label", "text"]
                        }
                      },
                      correctAnswer: { type: import_genai.Type.STRING, enum: allowedLabels },
                      explanation: { type: import_genai.Type.STRING },
                      material: { type: import_genai.Type.STRING },
                      difficulty: { type: import_genai.Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
                      cognitiveLevel: { type: import_genai.Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
                      indicator: { type: import_genai.Type.STRING },
                      points: { type: import_genai.Type.INTEGER }
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
        const refillResponse = await callWithTimeout(refillPromise, 35e3, "Refill timeout 35s");
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
      } catch (refillNotice) {
        console.info(`[Deduplicator] Melengkapi butir soal via pool cadangan (${refillNotice?.message || "fallback"}).`);
      }
    }
  }
  if (finalRawQuestions.length < targetTotal && combinedRawQuestions.length >= targetTotal) {
    for (const raw of combinedRawQuestions) {
      if (finalRawQuestions.length >= targetTotal) break;
      if (!finalRawQuestions.includes(raw)) {
        finalRawQuestions.push(raw);
      }
    }
  }
  const shouldIncludeImages = Boolean(params.includeImages) && params.imageFrequency !== "none";
  const formattedQuestions = finalRawQuestions.slice(0, targetTotal).map((q, idx) => {
    let cleanImageUrl = void 0;
    let cleanCaption = void 0;
    let qText = (q.question || `Pertanyaan ${idx + 1}`).trim();
    if (shouldIncludeImages) {
      cleanImageUrl = q.imageUrl && typeof q.imageUrl === "string" && q.imageUrl.startsWith("http") ? q.imageUrl.trim() : void 0;
      cleanCaption = q.imageCaption && typeof q.imageCaption === "string" ? q.imageCaption.trim() : void 0;
      const qLower = qText.toLowerCase();
      if (!cleanImageUrl && (qLower.includes("gambar") || qLower.includes("diagram") || qLower.includes("bagan") || qLower.includes("grafik") || qLower.includes("peta"))) {
        cleanImageUrl = getSubjectFallbackImage(params.subject, qText);
        if (!cleanCaption) {
          cleanCaption = `Gambar Stimulus Soal Nomor ${idx + 1}`;
        }
      }
    } else {
      cleanImageUrl = void 0;
      cleanCaption = void 0;
      qText = qText.replace(/^(perhatikan|amati|cermati)\s+(gambar|diagram|skema|bagan|ilustrasi)\s+(berikut|di\s+(bawah|atas|samping))[:\s,]*/i, "").replace(/^berdasarkan\s+(gambar|diagram|skema|bagan|ilustrasi)\s+(di\s+(bawah|atas|samping)|tersebut)[:\s,]*/i, "").trim();
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
      options: (q.options || []).map((opt, oIdx) => ({
        label: opt.label || allowedLabels[oIdx] || "A",
        text: opt.text || ""
      })),
      correctAnswer: q.correctAnswer || "A",
      explanation: q.explanation || "Pembahasan bersumber dari materi pembelajaran.",
      difficulty: q.difficulty || "Sedang",
      cognitiveLevel: q.cognitiveLevel || "C3",
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
async function regenerateSingleQuestion(params) {
  const sanitizedGrade = cleanGradeStr(params.grade);
  const optionsCount = params.optionsCount || (params.currentQuestion.options.length === 5 ? 5 : 4);
  const allowedLabels = optionsCount === 5 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
  const existingListBlock = params.existingQuestions && params.existingQuestions.length > 0 ? `
=== DAFTAR SOAL LAIN DALAM NASKAH UJIAN (DILARANG KERAS MEMBUAT SOAL YANG SAMA ATAU MIRIP) ===
${params.existingQuestions.slice(0, 35).map((q, idx) => `${idx + 1}. ${q}`).join("\n")}
` : "";
  const prompt = `Buatlah 1 (SATU) butir soal pengganti baru untuk soal pilihan ganda berikut:
- Mata Pelajaran: ${params.subject}
- Jenjang / Kelas: Kelas ${sanitizedGrade}
- Materi: ${params.material}
- Tingkat Kesulitan Target: ${params.currentQuestion.difficulty}
- Level Kognitif Target: ${params.currentQuestion.cognitiveLevel}
- Jumlah Opsi: ${optionsCount} pilihan (${allowedLabels.join(", ")})
${params.materialContext ? `
Konteks Materi:
${params.materialContext}` : ""}
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
        type: import_genai.Type.OBJECT,
        properties: {
          question: { type: import_genai.Type.STRING },
          imageUrl: { type: import_genai.Type.STRING, description: "URL HTTPS gambar pendukung bila relevan" },
          imageCaption: { type: import_genai.Type.STRING, description: "Keterangan gambar" },
          options: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                label: { type: import_genai.Type.STRING, enum: allowedLabels },
                text: { type: import_genai.Type.STRING }
              },
              required: ["label", "text"]
            }
          },
          correctAnswer: { type: import_genai.Type.STRING, enum: allowedLabels },
          explanation: { type: import_genai.Type.STRING },
          difficulty: { type: import_genai.Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
          cognitiveLevel: { type: import_genai.Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
          indicator: { type: import_genai.Type.STRING },
          points: { type: import_genai.Type.INTEGER }
        },
        required: ["question", "options", "correctAnswer", "explanation", "difficulty", "cognitiveLevel", "points"]
      }
    }
  });
  const parsed = JSON.parse(response.text?.trim() || "{}");
  const hasOriginalImage = Boolean(params.currentQuestion.imageUrl);
  const cleanImageUrl = hasOriginalImage ? parsed.imageUrl || params.currentQuestion.imageUrl : void 0;
  const cleanImageCaption = hasOriginalImage ? parsed.imageCaption || params.currentQuestion.imageCaption : void 0;
  return {
    id: `q_${Date.now()}_${params.currentQuestion.number}`,
    number: params.currentQuestion.number,
    question: parsed.question || params.currentQuestion.question,
    imageUrl: cleanImageUrl,
    imageCaption: cleanImageCaption,
    options: (parsed.options || []).map((opt, oIdx) => ({
      label: opt.label || allowedLabels[oIdx] || "A",
      text: opt.text || ""
    })),
    correctAnswer: parsed.correctAnswer || "A",
    explanation: parsed.explanation || "Pembahasan baru.",
    difficulty: parsed.difficulty || params.currentQuestion.difficulty,
    cognitiveLevel: parsed.cognitiveLevel || params.currentQuestion.cognitiveLevel,
    indicator: parsed.indicator || params.currentQuestion.indicator,
    points: parsed.points || params.currentQuestion.points || 1
  };
}
async function generateQuestionVisualSuggestion(params) {
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
        type: import_genai.Type.OBJECT,
        properties: {
          imageUrl: { type: import_genai.Type.STRING },
          caption: { type: import_genai.Type.STRING }
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
async function parseTeacherFormattedQuestions(params) {
  const prompt = `Anda adalah asisten cerdas pemroses naskah ujian guru.
Berikut adalah teks dokumen naskah soal / format soal yang diunggah oleh Guru:

--- DOKUMEN GURU ---
${params.rawDocText.slice(0, 4e4)}
--- AKHIR DOKUMEN ---

Tugas Anda:
1. Ekstrak seluruh butir soal pilihan ganda asli, pilihan jawaban (A, B, C, D, atau E), dan kunci jawaban yang telah disiapkan oleh Guru secara PERSIS dan AKURAT.
2. SANGAT PENTING: HANYA ekstrak butir soal yang memiliki pilihan jawaban (A, B, C, D, atau E). JANGAN PERNAH mengekstrak teks petunjuk pengerjaan, petunjuk umum/khusus, petunjuk pengisian format, tata tertib ujian, atau baris instruksi sebagai butir soal!
3. Jumlah soal yang diekstrak HARUS SAMA PERSIS dengan jumlah butir soal ujian yang ditulis guru (misal jika ada 5 soal, maka hasilkan tepat 5 butir soal, JANGAN menambahkan atau mengarang soal baru).
4. Jika ada informasi Mata Pelajaran, Kelas, atau Topik di bagian header naskah guru, gunakan itu. Jika tidak tercantum, gunakan default: Mata Pelajaran: "${params.defaultSubject || "Mata Pelajaran"}", Kelas: "${params.defaultGrade || "VIII"}", Semester: "${params.defaultSemester || "1"}".
5. Pastikan setiap butir soal mempertahankan teks pertanyaan dan pilihan jawaban asli yang ditulis guru.
6. Jika guru telah menyertakan Kunci Jawaban (misal: "Kunci Jawaban: B" atau "Kunci: C" atau tanda bintang "\u2605"), gunakan kunci tersebut. Jika guru lupa menulis kunci pada nomor tertentu, tentukan kunci yang paling tepat secara objektif.
7. Jika guru telah menyertakan Pembahasan atau Indikator, sertakan teks tersebut. Jika belum ada, buatkan pembahasan ringkas, level kognitif (C1-C6), dan indikator pencapaian yang sesuai.
8. Urutkan nomor soal secara berurutan mulai dari 1 sampai N.
9. Nilai poin default tiap soal adalah 10 (atau proporsional).
10. DILARANG KERAS memasukkan teks footer, catatan kaki, tips guru (seperti '\u{1F4A1} Tip Guru:...'), tanda tangan, atau catatan penutup ke dalam teks pertanyaan maupun ke dalam teks pilihan jawaban manapun.
11. SANGAT PENTING - MATERI / SUB-MATERI PER BUTIR SOAL:
    Untuk setiap butir soal di 'questions', ekstrak atau tentukan topik / sub-materi spesifik yang diuji:
    - Jika pada butir soal terdapat baris 'Materi: ...' atau 'Materi Pokok: ...' atau 'Topik: ...', ekstrak teks tersebut.
    - Jika guru TIDAK menuliskannya secara eksplisit pada nomor tersebut, analisislah isi soal untuk menentukan konsep / sub-materi pokok yang diuji (misal: 'Perangkat Keras Jaringan', 'Topologi Jaringan Star', 'Protokol DNS', 'Siklus Hidrologi') secara ringkas dan padat.
    - Simpan ke dalam properti 'material' pada setiap butir soal agar sistem otomatis menyusun Kisi-Kisi Ujian sesuai materi masing-masing butir soal secara akurat!`;
  const response = await callGeminiWithRetry({
    contents: prompt,
    config: {
      temperature: 0.2,
      // low temperature to strictly respect teacher's text
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          title: { type: import_genai.Type.STRING },
          subject: { type: import_genai.Type.STRING },
          grade: { type: import_genai.Type.STRING },
          semester: { type: import_genai.Type.STRING },
          material: { type: import_genai.Type.STRING },
          questions: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                number: { type: import_genai.Type.INTEGER },
                question: { type: import_genai.Type.STRING },
                imageUrl: { type: import_genai.Type.STRING },
                imageCaption: { type: import_genai.Type.STRING },
                options: {
                  type: import_genai.Type.ARRAY,
                  items: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      label: { type: import_genai.Type.STRING, enum: ["A", "B", "C", "D", "E"] },
                      text: { type: import_genai.Type.STRING }
                    },
                    required: ["label", "text"]
                  }
                },
                correctAnswer: { type: import_genai.Type.STRING, enum: ["A", "B", "C", "D", "E"] },
                explanation: { type: import_genai.Type.STRING },
                material: { type: import_genai.Type.STRING, description: "Materi pokok atau sub-topik spesifik yang diuji oleh butir soal ini" },
                difficulty: { type: import_genai.Type.STRING, enum: ["Mudah", "Sedang", "Sulit"] },
                cognitiveLevel: { type: import_genai.Type.STRING, enum: ["C1", "C2", "C3", "C4", "C5", "C6"] },
                indicator: { type: import_genai.Type.STRING },
                points: { type: import_genai.Type.INTEGER }
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
  const questions = (parsed.questions || []).map((q, idx) => ({
    id: `q_uploaded_${Date.now()}_${idx + 1}`,
    number: idx + 1,
    question: q.question || `Pertanyaan No. ${idx + 1}`,
    imageUrl: q.imageUrl || void 0,
    imageCaption: q.imageCaption || void 0,
    options: (q.options || []).map((opt, oIdx) => ({
      label: opt.label || ["A", "B", "C", "D", "E"][oIdx] || "A",
      text: (opt.text || "").replace(/(?:💡\s*)?(?:Tip\s+Guru|Catatan|NB:)[\s\S]*/i, "").trim()
    })),
    correctAnswer: q.correctAnswer || "A",
    explanation: (q.explanation || "Kunci jawaban sesuai format yang disiapkan guru.").replace(/(?:💡\s*)?(?:Tip\s+Guru|Catatan|NB:)[\s\S]*/i, "").trim(),
    difficulty: q.difficulty || "Sedang",
    cognitiveLevel: q.cognitiveLevel || "C3",
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
function runHeuristicAudit(params) {
  const audits = [];
  let distractorCount = 0;
  let longestKeyCount = 0;
  let hotsMismatchCount = 0;
  let ambiguityCount = 0;
  params.questions.forEach((q) => {
    const issues = [];
    const options = q.options || [];
    const correctOpt = options.find((o) => o.label === q.correctAnswer);
    const distractors = options.filter((o) => o.label !== q.correctAnswer);
    if (correctOpt && distractors.length > 0) {
      const keyLen = correctOpt.text.trim().length;
      const avgDistLen = distractors.reduce((sum, o) => sum + o.text.trim().length, 0) / distractors.length;
      if (keyLen > 25 && keyLen >= avgDistLen * 1.75) {
        issues.push({
          category: "longest_key",
          severity: "warning",
          label: "Kunci Jawaban Terlalu Panjang",
          description: `Opsi kunci (${q.correctAnswer}) memiliki panjang ${keyLen} karakter, jauh lebih panjang dari rata-rata pengecoh (${Math.round(avgDistLen)} karakter). Hal ini memicu siswa menebak opsi terpanjang.`
        });
        longestKeyCount++;
      }
    }
    distractors.forEach((d) => {
      const text = d.text.trim().toLowerCase();
      if (text === "tidak tahu" || text === "semua salah" || text === "semua jawaban salah" || text.length < 2 || /^(a|b|c|d)\s+(benar|salah)$/i.test(text)) {
        issues.push({
          category: "distractor_weak",
          severity: "critical",
          label: "Distraktor Terlalu Lemah / Klise",
          description: `Opsi ${d.label} ("${d.text}") tidak homogen dan terlalu mudah dieliminasi oleh peserta didik.`
        });
        distractorCount++;
      }
    });
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
        description: `Soal berlabel ${q.cognitiveLevel} (HOTS) tetapi formulasi pertanyaan lebih menguji ingatan / definisi faktual (LOTS C1-C2) tanpa stimulus penalaran kontekstual.`
      });
      hotsMismatchCount++;
    }
    if (/(bukan|tidak|kecuali).{1,25}(bukan|tidak|tanpa|salah)/i.test(qLower) || /(manakah yang tidak.*kecuali)/i.test(qLower)) {
      issues.push({
        category: "ambiguous_or_negative",
        severity: "critical",
        label: "Negatif Ganda / Kalimat Ambigu",
        description: "Terdeteksi pola kalimat negatif ganda ('bukan/tidak' + 'kecuali/tanpa') yang membingungkan siswa dalam mengidentifikasi instruksi soal."
      });
      ambiguityCount++;
    }
    let improvedQuestion = void 0;
    if (issues.length > 0) {
      const balancedOptions = options.map((opt) => {
        if (opt.label === q.correctAnswer) {
          return {
            ...opt,
            text: opt.text.length > 75 ? opt.text.substring(0, 70).trim() + "..." : opt.text
          };
        }
        if (opt.text.toLowerCase().includes("tidak tahu") || opt.text.length < 3) {
          return {
            ...opt,
            text: `Variasi alternatif konsep ${params.material || "terkait"}`
          };
        }
        return opt;
      });
      improvedQuestion = {
        question: q.question.replace(/bukan yang tidak/gi, "yang merupakan"),
        options: balancedOptions,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "Pembahasan terstandarisasi.",
        cognitiveLevel: isLabeledHots && hasLotsPhrase ? "C2" : q.cognitiveLevel,
        revisionNote: "Menyelaraskan panjang opsi jawaban dan memperjelas struktur kalimat pokok soal."
      };
    }
    audits.push({
      questionNumber: q.number,
      originalQuestionText: q.question,
      issues,
      hasIssue: issues.length > 0,
      improvedQuestion
    });
  });
  const totalIssues = distractorCount + longestKeyCount + hotsMismatchCount + ambiguityCount;
  const deduction = Math.min(totalIssues * 5, 45);
  const overallScore = Math.max(55, 100 - deduction);
  const ratingLabel = overallScore >= 90 ? "Sangat Baik (Siap Ujian)" : overallScore >= 75 ? "Baik (Perlu Sedikit Revisi)" : "Perlu Perbaikan Pedagogis";
  return {
    overallScore,
    ratingLabel,
    summary: totalIssues === 0 ? "Seluruh butir soal telah memenuhi kaidah penulisan asesmen standar nasional (opsi homogen, bebas negatif ganda, dan level kognitif sesuai)." : `Ditemukan ${totalIssues} catatan pedagogis pada naskah soal (${distractorCount} distraktor lemah, ${longestKeyCount} kunci dominan, ${hotsMismatchCount} evaluasi HOTS, dan ${ambiguityCount} kalimat ambigu).`,
    totalIssuesCount: totalIssues,
    distractorIssuesCount: distractorCount,
    longestKeyIssuesCount: longestKeyCount,
    hotsMismatchCount,
    ambiguityCount,
    questionAudits: audits,
    auditedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function auditQuestionsWithGemini(params) {
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
      difficulty: q.difficulty
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
          type: import_genai.Type.OBJECT,
          properties: {
            overallScore: { type: import_genai.Type.INTEGER },
            ratingLabel: { type: import_genai.Type.STRING },
            summary: { type: import_genai.Type.STRING },
            questionAudits: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  questionNumber: { type: import_genai.Type.INTEGER },
                  hasIssue: { type: import_genai.Type.BOOLEAN },
                  issues: {
                    type: import_genai.Type.ARRAY,
                    items: {
                      type: import_genai.Type.OBJECT,
                      properties: {
                        category: {
                          type: import_genai.Type.STRING,
                          enum: ["distractor_weak", "longest_key", "hots_mismatch", "ambiguous_or_negative", "grammar_clarity"]
                        },
                        severity: {
                          type: import_genai.Type.STRING,
                          enum: ["warning", "critical", "suggestion"]
                        },
                        label: { type: import_genai.Type.STRING },
                        description: { type: import_genai.Type.STRING }
                      },
                      required: ["category", "severity", "label", "description"]
                    }
                  },
                  improvedQuestion: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      question: { type: import_genai.Type.STRING },
                      options: {
                        type: import_genai.Type.ARRAY,
                        items: {
                          type: import_genai.Type.OBJECT,
                          properties: {
                            label: { type: import_genai.Type.STRING },
                            text: { type: import_genai.Type.STRING }
                          },
                          required: ["label", "text"]
                        }
                      },
                      correctAnswer: { type: import_genai.Type.STRING },
                      explanation: { type: import_genai.Type.STRING },
                      cognitiveLevel: { type: import_genai.Type.STRING },
                      revisionNote: { type: import_genai.Type.STRING }
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
    let distractorIssuesCount = 0;
    let longestKeyIssuesCount = 0;
    let hotsMismatchCount = 0;
    let ambiguityCount = 0;
    let totalIssuesCount = 0;
    const questionAudits = (parsed.questionAudits || []).map((item) => {
      const originalQ = params.questions.find((q) => q.number === item.questionNumber);
      const issues = (item.issues || []).map((iss) => {
        if (iss.category === "distractor_weak") distractorIssuesCount++;
        else if (iss.category === "longest_key") longestKeyIssuesCount++;
        else if (iss.category === "hots_mismatch") hotsMismatchCount++;
        else if (iss.category === "ambiguous_or_negative") ambiguityCount++;
        totalIssuesCount++;
        return {
          category: iss.category,
          severity: iss.severity || "warning",
          label: iss.label || "Catatan Soal",
          description: iss.description || ""
        };
      });
      let improvedQuestion = void 0;
      if (item.improvedQuestion && item.improvedQuestion.question) {
        const allowedLabels = originalQ?.options?.length === 5 ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
        improvedQuestion = {
          question: item.improvedQuestion.question,
          options: (item.improvedQuestion.options || []).map((opt, oIdx) => ({
            label: opt.label || allowedLabels[oIdx] || "A",
            text: opt.text || ""
          })),
          correctAnswer: item.improvedQuestion.correctAnswer || originalQ?.correctAnswer || "A",
          explanation: item.improvedQuestion.explanation || originalQ?.explanation || "",
          cognitiveLevel: item.improvedQuestion.cognitiveLevel || originalQ?.cognitiveLevel,
          revisionNote: item.improvedQuestion.revisionNote || "Perbaikan pedagogis terstandarisasi."
        };
      }
      return {
        questionNumber: item.questionNumber,
        originalQuestionText: originalQ?.question || `Soal No. ${item.questionNumber}`,
        issues,
        hasIssue: issues.length > 0,
        improvedQuestion
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
      auditedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (err) {
    console.warn("[Gemini Audit] AI API error, falling back to heuristic audit:", err?.message || err);
    return runHeuristicAudit(params);
  }
}

// server/forms.ts
function cleanGrade(val) {
  if (!val) return "";
  let clean = val.trim();
  clean = clean.replace(/^(kelas|tingkat|fase)\s+/gi, "").trim();
  clean = clean.replace(/^(kelas|tingkat|fase)\s+/gi, "").trim();
  return clean;
}
function cleanTitle(val) {
  if (!val) return "";
  let clean = val.trim();
  clean = clean.replace(/kelas\s+kelas\s+/gi, "Kelas ");
  clean = clean.replace(/tingkat\s+tingkat\s+/gi, "Tingkat ");
  return clean;
}
function stripQuestionNumber(questionText) {
  if (!questionText) return "";
  let clean = questionText.trim();
  clean = clean.replace(/^(?:\*\*|\*|__|_)?(?:(?:soal|nomor|no\.?)\s*\d+[\.\)\:\-\s]*|\d+[\.\)\:\-]\s*)(?:\*\*|\*|__|_)?\s*/i, "").trim();
  return clean || questionText.trim();
}
function stripOptionPrefix(optionText) {
  if (!optionText) return "";
  let clean = optionText.trim();
  clean = clean.replace(/^(?:\*\*|\*|__|_)?(?:\([A-Ea-e]\)|\[[A-Ea-e]\]|[A-Ea-e][\.\)\:\-])(?:\*\*|\*|__|_)?\s*/, "").trim();
  return clean || optionText.trim();
}
async function createGoogleFormQuiz(accessToken, req) {
  if (!accessToken) {
    throw new Error("Akses token Google tidak ditemukan. Silakan hubungkan Google terlebih dahulu.");
  }
  if (!req.questions || req.questions.length === 0) {
    throw new Error("Daftar soal kosong. Tidak dapat membuat Google Form.");
  }
  const rawGrade = cleanGrade(req.grade);
  const formattedTitle = cleanTitle(req.title) || (req.subject ? `Kuis ${req.subject}${rawGrade ? ` Kelas ${rawGrade}` : ""}` : "Kuis Ujian Pilihan Ganda");
  const createFormRes = await fetch("https://forms.googleapis.com/v1/forms", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      info: {
        title: formattedTitle,
        documentTitle: formattedTitle
      }
    })
  });
  if (!createFormRes.ok) {
    const errText = await createFormRes.text();
    console.error("Error creating Google Form:", createFormRes.status, errText);
    if (createFormRes.status === 401 || createFormRes.status === 403) {
      throw new Error("Izin akses Google kedaluwarsa atau tidak mencakup Google Forms. Silakan hubungkan ulang Google.");
    }
    throw new Error(`Gagal membuat Google Form: ${errText}`);
  }
  const formData = await createFormRes.json();
  const formId = formData.formId;
  const responderUrl = formData.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;
  const requests = [
    {
      updateSettings: {
        settings: {
          quizSettings: {
            isQuiz: true
          }
        },
        updateMask: "quizSettings.isQuiz"
      }
    },
    {
      updateFormInfo: {
        info: {
          description: req.description || `Mata Pelajaran: ${req.subject || "-"}
Kelas: ${rawGrade ? `Kelas ${rawGrade}` : "-"}
Total Soal: ${req.questions.length} butir (Skor Maksimal: ${req.questions.reduce((sum, q) => sum + (typeof q.points === "number" && q.points > 0 ? q.points : 1), 0)} Poin)
Petunjuk: Pilihlah satu jawaban yang paling tepat.`
        },
        updateMask: "description"
      }
    }
  ];
  let currentIndex = 0;
  const includeIdentity = req.includeIdentitySection !== false;
  if (includeIdentity) {
    requests.push({
      createItem: {
        item: {
          title: "Nama Lengkap Siswa",
          description: "Tuliskan nama lengkap Anda sesuai data absensi kelas.",
          questionItem: {
            question: {
              required: true,
              textQuestion: {
                paragraph: false
              }
            }
          }
        },
        location: {
          index: currentIndex++
        }
      }
    });
    requests.push({
      createItem: {
        item: {
          title: "Nomor Absen",
          description: "Tuliskan nomor urut absen Anda (contoh: 01, 15, 32).",
          questionItem: {
            question: {
              required: true,
              textQuestion: {
                paragraph: false
              }
            }
          }
        },
        location: {
          index: currentIndex++
        }
      }
    });
    const classOptions = req.classList && req.classList.length > 0 ? req.classList.map((c) => cleanTitle(c.trim())).filter(Boolean) : [];
    if (classOptions.length > 0) {
      requests.push({
        createItem: {
          item: {
            title: "Kelas",
            description: "Pilih kelas Anda dari daftar pilihan berikut.",
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: "DROP_DOWN",
                  shuffle: false,
                  options: classOptions.map((cls) => ({ value: cls }))
                }
              }
            }
          },
          location: {
            index: currentIndex++
          }
        }
      });
    } else {
      requests.push({
        createItem: {
          item: {
            title: "Kelas",
            description: "Tuliskan nama kelas Anda (contoh: 8A, VII B).",
            questionItem: {
              question: {
                required: true,
                textQuestion: {
                  paragraph: false
                }
              }
            }
          },
          location: {
            index: currentIndex++
          }
        }
      });
    }
    requests.push({
      createItem: {
        item: {
          title: "Naskah Soal & Lembar Pengerjaan",
          description: "Petunjuk: Pilihlah salah satu jawaban yang paling tepat pada setiap butir pertanyaan berikut.",
          pageBreakItem: {}
        },
        location: {
          index: currentIndex++
        }
      }
    });
  }
  let totalPoints = 0;
  req.questions.forEach((q, idx) => {
    const points = typeof q.points === "number" && q.points > 0 ? q.points : 1;
    totalPoints += points;
    const options = q.options.map((opt) => {
      const cleanText = stripOptionPrefix(opt.text);
      return {
        label: opt.label,
        value: cleanText
      };
    });
    const normalizedCorrect = String(q.correctAnswer || "").trim().toUpperCase();
    const correctOpt = options.find(
      (o) => o.label && o.label.toUpperCase() === normalizedCorrect || o.value && o.value.toUpperCase() === normalizedCorrect || stripOptionPrefix(o.value).toUpperCase() === stripOptionPrefix(String(q.correctAnswer || "")).toUpperCase()
    ) || options[0];
    const correctValue = correctOpt ? correctOpt.value : options[0]?.value || "";
    let feedbackText = "";
    if (q.explanation && q.explanation.trim()) {
      feedbackText += `Pembahasan: ${q.explanation.trim()}`;
    }
    if (q.indicator && q.indicator.trim()) {
      feedbackText += `${feedbackText ? "\n" : ""}Indikator: ${q.indicator.trim()}`;
    }
    if (q.difficulty) {
      feedbackText += `${feedbackText ? "\n" : ""}Tingkat: ${q.difficulty} (${q.cognitiveLevel || "C2"})`;
    }
    const cleanQuestionTitle = stripQuestionNumber(q.question);
    const itemObj = {
      title: cleanQuestionTitle,
      questionItem: {
        question: {
          required: true,
          grading: {
            pointValue: points,
            correctAnswers: {
              answers: [
                { value: correctValue }
              ]
            },
            ...feedbackText ? {
              whenRight: {
                text: feedbackText
              },
              whenWrong: {
                text: feedbackText
              }
            } : {}
          },
          choiceQuestion: {
            type: "RADIO",
            shuffle: Boolean(req.shuffleOptions),
            options: options.map((o) => ({ value: o.value }))
          }
        }
      }
    };
    if (q.imageUrl && (q.imageUrl.startsWith("https://") || q.imageUrl.startsWith("http://"))) {
      itemObj.questionItem.image = {
        sourceUri: q.imageUrl,
        altText: q.imageCaption || `Gambar Pendukung Soal`,
        properties: {
          alignment: "CENTER"
        }
      };
    }
    requests.push({
      createItem: {
        item: itemObj,
        location: {
          index: currentIndex++
        }
      }
    });
  });
  let batchRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requests })
  });
  if (!batchRes.ok) {
    const hasImages = req.questions.some((q) => q.imageUrl);
    if (hasImages) {
      console.warn("Batch update dengan gambar mengalami kendala, mencoba fallback tanpa atribut gambar...");
      const strippedRequests = requests.map((reqItem) => {
        if (reqItem.createItem?.item?.questionItem?.image) {
          const clone = JSON.parse(JSON.stringify(reqItem));
          delete clone.createItem.item.questionItem.image;
          return clone;
        }
        return reqItem;
      });
      const retryRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests: strippedRequests })
      });
      if (retryRes.ok) {
        batchRes = retryRes;
      }
    }
  }
  if (!batchRes.ok) {
    const batchErr = await batchRes.text();
    console.error("Error executing batchUpdate on Google Form:", batchRes.status, batchErr);
    throw new Error(`Google Form berhasil dibuat, namun gagal mengunggah butir soal: ${batchErr}`);
  }
  return {
    formId,
    title: req.title,
    editUrl,
    responderUrl,
    questionsCount: req.questions.length,
    totalPoints
  };
}

// server/bankSoalService.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var USER_BANKS_DIR = import_path.default.join(DATA_DIR, "user_banks");
function ensureDirExists() {
  if (!import_fs.default.existsSync(DATA_DIR)) {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!import_fs.default.existsSync(USER_BANKS_DIR)) {
    import_fs.default.mkdirSync(USER_BANKS_DIR, { recursive: true });
  }
}
function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function getUserFilePath(userId) {
  ensureDirExists();
  return import_path.default.join(USER_BANKS_DIR, `${sanitizeId(userId)}.json`);
}
function getIndexFilePath() {
  ensureDirExists();
  return import_path.default.join(USER_BANKS_DIR, "__users_index.json");
}
function readIndex() {
  try {
    const file = getIndexFilePath();
    if (import_fs.default.existsSync(file)) {
      const content = import_fs.default.readFileSync(file, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("Notice reading users index:", e);
  }
  return {};
}
function writeIndex(index) {
  try {
    const file = getIndexFilePath();
    import_fs.default.writeFileSync(file, JSON.stringify(index, null, 2), "utf-8");
  } catch (e) {
    console.warn("Notice writing users index:", e);
  }
}
function getUserBankSoal(userId, email) {
  ensureDirExists();
  if (!userId && !email) return [];
  const directPath = getUserFilePath(userId);
  if (import_fs.default.existsSync(directPath)) {
    try {
      const record = JSON.parse(import_fs.default.readFileSync(directPath, "utf-8"));
      return Array.isArray(record.bankSoal) ? record.bankSoal : [];
    } catch (e) {
      console.warn("Notice parsing user bank file:", e);
    }
  }
  if (email) {
    const index = readIndex();
    for (const entry of Object.values(index)) {
      if (entry.email && entry.email.toLowerCase() === email.toLowerCase()) {
        const altPath = getUserFilePath(entry.userId);
        if (import_fs.default.existsSync(altPath)) {
          try {
            const record = JSON.parse(import_fs.default.readFileSync(altPath, "utf-8"));
            return Array.isArray(record.bankSoal) ? record.bankSoal : [];
          } catch {
          }
        }
      }
    }
  }
  return [];
}
function saveUserBankSoal(userId, questionSet, email, name) {
  ensureDirExists();
  if (!userId) return [];
  const currentSets = getUserBankSoal(userId, email);
  const updatedSet = {
    ...questionSet,
    userId,
    authorEmail: email || questionSet.authorEmail,
    authorName: name || questionSet.authorName,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const existingIdx = currentSets.findIndex((s) => s.id === questionSet.id);
  if (existingIdx >= 0) {
    currentSets[existingIdx] = updatedSet;
  } else {
    currentSets.unshift(updatedSet);
  }
  const record = {
    userId,
    userEmail: email,
    userName: name,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    bankSoal: currentSets
  };
  import_fs.default.writeFileSync(getUserFilePath(userId), JSON.stringify(record, null, 2), "utf-8");
  const index = readIndex();
  index[userId] = {
    userId,
    email: email || index[userId]?.email || "",
    name: name || index[userId]?.name || "",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    setCount: currentSets.length
  };
  writeIndex(index);
  return currentSets;
}
function syncUserBankSoal(userId, incomingSets, email, name) {
  ensureDirExists();
  if (!userId) return [];
  const existingSets = getUserBankSoal(userId, email);
  const existingMap = /* @__PURE__ */ new Map();
  existingSets.forEach((s) => {
    if (s.id) existingMap.set(s.id, s);
  });
  if (Array.isArray(incomingSets)) {
    for (const set of incomingSets) {
      if (!set || !set.id) continue;
      const existing = existingMap.get(set.id);
      if (!existing) {
        existingMap.set(set.id, {
          ...set,
          userId,
          authorEmail: email || set.authorEmail,
          authorName: name || set.authorName
        });
      } else {
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const incomingTime = set.updatedAt ? new Date(set.updatedAt).getTime() : 0;
        if (incomingTime >= existingTime) {
          existingMap.set(set.id, {
            ...set,
            userId,
            authorEmail: email || set.authorEmail || existing.authorEmail,
            authorName: name || set.authorName || existing.authorName
          });
        }
      }
    }
  }
  const mergedSets = Array.from(existingMap.values());
  mergedSets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const record = {
    userId,
    userEmail: email,
    userName: name,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    bankSoal: mergedSets
  };
  import_fs.default.writeFileSync(getUserFilePath(userId), JSON.stringify(record, null, 2), "utf-8");
  const index = readIndex();
  index[userId] = {
    userId,
    email: email || index[userId]?.email || "",
    name: name || index[userId]?.name || "",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    setCount: mergedSets.length
  };
  writeIndex(index);
  return mergedSets;
}
function deleteUserBankSoal(userId, setId) {
  ensureDirExists();
  const sets = getUserBankSoal(userId);
  const filtered = sets.filter((s) => s.id !== setId);
  const directPath = getUserFilePath(userId);
  if (import_fs.default.existsSync(directPath)) {
    try {
      const record = JSON.parse(import_fs.default.readFileSync(directPath, "utf-8"));
      record.bankSoal = filtered;
      record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      import_fs.default.writeFileSync(directPath, JSON.stringify(record, null, 2), "utf-8");
    } catch {
    }
  }
  const index = readIndex();
  if (index[userId]) {
    index[userId].setCount = filtered.length;
    index[userId].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    writeIndex(index);
  }
  return filtered;
}
function getAllBankSoalForAdmin() {
  ensureDirExists();
  const allSets = [];
  const index = readIndex();
  const usersList = Object.values(index);
  try {
    const files = import_fs.default.readdirSync(USER_BANKS_DIR);
    for (const file of files) {
      if (file.endsWith(".json") && file !== "__users_index.json") {
        try {
          const filePath = import_path.default.join(USER_BANKS_DIR, file);
          const record = JSON.parse(import_fs.default.readFileSync(filePath, "utf-8"));
          if (Array.isArray(record.bankSoal)) {
            for (const s of record.bankSoal) {
              allSets.push({
                ...s,
                authorEmail: record.userEmail || s.authorEmail,
                authorName: record.userName || s.authorName,
                userId: record.userId || s.userId
              });
            }
          }
        } catch {
        }
      }
    }
  } catch (e) {
    console.warn("Notice reading all bank files:", e);
  }
  allSets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { sets: allSets, users: usersList };
}
function bulkDeleteBankSoalByAdmin(items) {
  ensureDirExists();
  if (!Array.isArray(items) || items.length === 0) return 0;
  const idSet = new Set(items.map((it) => it.id));
  let deletedCount = 0;
  try {
    const files = import_fs.default.readdirSync(USER_BANKS_DIR);
    const index = readIndex();
    let indexModified = false;
    for (const file of files) {
      if (file.endsWith(".json") && file !== "__users_index.json") {
        const filePath = import_path.default.join(USER_BANKS_DIR, file);
        try {
          const record = JSON.parse(import_fs.default.readFileSync(filePath, "utf-8"));
          if (Array.isArray(record.bankSoal)) {
            const initialCount = record.bankSoal.length;
            const remaining = record.bankSoal.filter((s) => !idSet.has(s.id));
            if (remaining.length < initialCount) {
              const diff = initialCount - remaining.length;
              deletedCount += diff;
              record.bankSoal = remaining;
              record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
              import_fs.default.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
              if (record.userId && index[record.userId]) {
                index[record.userId].setCount = remaining.length;
                index[record.userId].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
                indexModified = true;
              }
            }
          }
        } catch {
        }
      }
    }
    if (indexModified) {
      writeIndex(index);
    }
  } catch (e) {
    console.warn("Notice in bulkDeleteBankSoalByAdmin:", e);
  }
  return deletedCount;
}
function deleteBankSoalByAdmin(setId, userId) {
  if (userId) {
    deleteUserBankSoal(userId, setId);
    return true;
  }
  const count = bulkDeleteBankSoalByAdmin([{ id: setId, userId }]);
  return count > 0;
}

// server/app.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req._body = true;
  }
  next();
});
app.use(import_express.default.json({ limit: "25mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "25mb" }));
app.use((req, _res, next) => {
  const originalPath = req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"] || req.headers["x-original-url"] || req.headers["x-forwarded-uri"];
  if (typeof originalPath === "string" && originalPath.startsWith("/api/")) {
    req.url = originalPath;
  } else if (req.url && !req.url.startsWith("/api/") && req.url !== "/api") {
    const knownEndpoints = [
      "/health",
      "/generate-questions",
      "/regenerate-question",
      "/generate-question-image",
      "/auth/config",
      "/parse-material",
      "/parse-formatted-exam",
      "/google/forms/create",
      "/system-settings",
      "/audit-questions",
      "/auto-fix-questions"
    ];
    if (knownEndpoints.some((ep) => req.url.startsWith(ep))) {
      req.url = `/api${req.url}`;
    }
  }
  next();
});
var SYSTEM_SETTINGS_FILE = import_path2.default.join(process.cwd(), "data", "system-settings.json");
var SYSTEM_LOGO_FILE = import_path2.default.join(process.cwd(), "data", "active-logo.json");
var activeLogoCache = {
  appLogoUrl: "",
  updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
  version: 1
};
function loadPersistedSettings() {
  try {
    if (import_fs2.default.existsSync(SYSTEM_SETTINGS_FILE)) {
      const content = import_fs2.default.readFileSync(SYSTEM_SETTINGS_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("Could not read system settings file:", e);
  }
  return {};
}
function savePersistedSettings(settings) {
  try {
    const dir = import_path2.default.dirname(SYSTEM_SETTINGS_FILE);
    if (!import_fs2.default.existsSync(dir)) {
      import_fs2.default.mkdirSync(dir, { recursive: true });
    }
    import_fs2.default.writeFileSync(SYSTEM_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save system settings file:", e);
  }
}
function savePersistedLogo(logoState) {
  try {
    const dir = import_path2.default.dirname(SYSTEM_LOGO_FILE);
    if (!import_fs2.default.existsSync(dir)) {
      import_fs2.default.mkdirSync(dir, { recursive: true });
    }
    import_fs2.default.writeFileSync(SYSTEM_LOGO_FILE, JSON.stringify(logoState, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save active logo file:", e);
  }
}
function initLogoStorage() {
  try {
    if (import_fs2.default.existsSync(SYSTEM_LOGO_FILE)) {
      const content = import_fs2.default.readFileSync(SYSTEM_LOGO_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        activeLogoCache = {
          appLogoUrl: typeof parsed.appLogoUrl === "string" ? parsed.appLogoUrl : "",
          updatedAt: parsed.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
          version: typeof parsed.version === "number" ? parsed.version : 1
        };
        return;
      }
    }
    const sysSettings = loadPersistedSettings();
    if (sysSettings && typeof sysSettings.appLogoUrl === "string" && sysSettings.appLogoUrl) {
      activeLogoCache = {
        appLogoUrl: sysSettings.appLogoUrl,
        updatedAt: sysSettings.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
        version: 1
      };
      savePersistedLogo(activeLogoCache);
    }
  } catch (e) {
    console.warn("Could not initialize logo storage:", e);
  }
}
initLogoStorage();
app.get(["/api/health", "/health"], (_req, res) => {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY
  );
  res.json({
    status: "ok",
    service: "AI Pembuat Soal Guru",
    hasGeminiKey,
    environment: process.env.VERCEL ? "vercel" : "server"
  });
});
app.get(["/api/system-settings/logo", "/system-settings/logo"], (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    success: true,
    appLogoUrl: activeLogoCache.appLogoUrl || "",
    updatedAt: activeLogoCache.updatedAt,
    version: activeLogoCache.version
  });
});
app.post(["/api/system-settings/logo", "/system-settings/logo"], (req, res) => {
  try {
    const newLogoUrl = typeof req.body.appLogoUrl === "string" ? req.body.appLogoUrl : "";
    activeLogoCache = {
      appLogoUrl: newLogoUrl,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: (activeLogoCache.version || 0) + 1
    };
    savePersistedLogo(activeLogoCache);
    const currentSettings = loadPersistedSettings();
    currentSettings.appLogoUrl = newLogoUrl;
    currentSettings.updatedAt = activeLogoCache.updatedAt;
    savePersistedSettings(currentSettings);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      success: true,
      appLogoUrl: activeLogoCache.appLogoUrl,
      updatedAt: activeLogoCache.updatedAt,
      version: activeLogoCache.version
    });
  } catch (err) {
    console.error("Error saving active logo:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Gagal menyimpan logo ke database."
    });
  }
});
app.get(["/api/system-settings/version", "/system-settings/version"], (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    success: true,
    version: activeLogoCache.version,
    updatedAt: activeLogoCache.updatedAt,
    hasLogo: Boolean(activeLogoCache.appLogoUrl && activeLogoCache.appLogoUrl.trim().length > 0)
  });
});
app.get(["/api/system-settings", "/system-settings"], (_req, res) => {
  try {
    const settings = loadPersistedSettings();
    if (activeLogoCache.appLogoUrl !== void 0) {
      settings.appLogoUrl = activeLogoCache.appLogoUrl;
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      success: true,
      settings: settings || {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err?.message || "Gagal memuat pengaturan sistem."
    });
  }
});
app.post(["/api/system-settings", "/system-settings"], (req, res) => {
  try {
    const current = loadPersistedSettings();
    const newSettings = {
      ...current,
      ...req.body,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (typeof req.body.appLogoUrl === "string") {
      activeLogoCache = {
        appLogoUrl: req.body.appLogoUrl,
        updatedAt: newSettings.updatedAt,
        version: (activeLogoCache.version || 0) + 1
      };
      savePersistedLogo(activeLogoCache);
    }
    savePersistedSettings(newSettings);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      success: true,
      settings: newSettings
    });
  } catch (err) {
    console.error("Error in /api/system-settings:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Gagal menyimpan pengaturan sistem."
    });
  }
});
app.post(["/api/generate-question-image", "/generate-question-image"], async (req, res) => {
  try {
    const { subject, topic, questionText } = req.body;
    const visual = await generateQuestionVisualSuggestion({
      subject: subject || "Umum",
      topic: topic || "Pendidikan",
      questionText: questionText || ""
    });
    res.json({
      success: true,
      imageUrl: visual.imageUrl,
      caption: visual.caption
    });
  } catch (error) {
    console.error("Error in /api/generate-question-image:", error);
    res.status(500).json({
      error: error.message || "Gagal mendapatkan rekomendasi gambar visual."
    });
  }
});
app.get(["/api/auth/config", "/auth/config"], async (_req, res) => {
  let clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
  if (!clientId) {
    try {
      const fs3 = await import("fs");
      const configPath = import_path2.default.join(process.cwd(), "firebase-applet-config.json");
      if (fs3.existsSync(configPath)) {
        const cfg = JSON.parse(fs3.readFileSync(configPath, "utf-8"));
        clientId = cfg.oAuthClientId || "";
      }
    } catch (e) {
      console.warn("Could not read firebase-applet-config.json for client ID:", e);
    }
  }
  res.json({
    clientId,
    scopes: [
      "https://www.googleapis.com/auth/forms.body",
      "https://www.googleapis.com/auth/drive.file"
    ]
  });
});
async function extractPdfText(buffer, base64Data) {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map((item) => item?.str || "").filter((str) => str.trim().length > 0);
      if (pageStrings.length > 0) {
        fullText += `
--- Halaman / Slide ${i} ---
` + pageStrings.join(" ") + "\n";
      }
    }
    const cleanText = fullText.trim();
    if (cleanText.length > 25 && !isRawPdfBinary(cleanText)) {
      return cleanText;
    }
  } catch (pdfjsErr) {
    console.warn("Local pdfjs-dist legacy unavailable or failed. Trying next parser:", pdfjsErr);
  }
  try {
    const pdfParseModule = await import("pdf-parse");
    let localText = "";
    if (typeof pdfParseModule?.PDFParse === "function") {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      try {
        const res = await parser.getText();
        const rawText = res?.text || "";
        localText = rawText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim();
      } finally {
        try {
          await parser.destroy();
        } catch {
        }
      }
    } else {
      const pdfParserFn = typeof pdfParseModule === "function" ? pdfParseModule : typeof pdfParseModule?.default === "function" ? pdfParseModule.default : null;
      if (pdfParserFn) {
        const pdfData = await pdfParserFn(buffer);
        localText = (pdfData?.text || "").trim();
      }
    }
    if (localText && localText.length > 25 && !isRawPdfBinary(localText)) {
      return localText;
    }
  } catch (pdfErr) {
    console.warn("Local pdf-parse unavailable or failed. Using Gemini PDF processor:", pdfErr);
  }
  try {
    const b64 = base64Data || buffer.toString("base64");
    const geminiText = await extractPdfDocumentWithGemini(b64);
    if (geminiText && geminiText.length > 10 && !isRawPdfBinary(geminiText)) {
      return geminiText;
    }
  } catch (geminiErr) {
    console.error("Gemini PDF extraction error:", geminiErr?.message || geminiErr);
    throw new Error(geminiErr?.message || "Gagal memproses dokumen PDF dengan AI.");
  }
  throw new Error("Dokumen PDF tidak dapat diekstrak menjadi teks. Pastikan berkas PDF bukan hasil scan murni tanpa teks atau terproteksi sandi.");
}
app.post(["/api/parse-material", "/parse-material"], async (req, res) => {
  try {
    const { fileData, fileType, fileName } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "Data file tidak ditemukan." });
    }
    const rawBase64 = fileData.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");
    const headerSnippet = buffer.slice(0, 1024).toString("ascii");
    const hasPdfMagic = headerSnippet.includes("%PDF");
    const isPdf = hasPdfMagic || fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const isDocx = fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName?.toLowerCase().endsWith(".docx") || fileName?.toLowerCase().endsWith(".doc");
    const isText = !isPdf && (fileType === "text/plain" || fileName?.toLowerCase().endsWith(".txt") || fileName?.toLowerCase().endsWith(".md") || fileName?.toLowerCase().endsWith(".csv"));
    let extractedText = "";
    if (isPdf) {
      extractedText = await extractPdfText(buffer, rawBase64);
    } else if (isDocx) {
      const result = await import_mammoth.default.extractRawText({ buffer });
      extractedText = result.value || "";
    } else if (isText) {
      extractedText = buffer.toString("utf-8");
    } else {
      if (hasPdfMagic) {
        extractedText = await extractPdfText(buffer, rawBase64);
      } else {
        extractedText = buffer.toString("utf-8");
      }
    }
    if (isRawPdfBinary(extractedText)) {
      throw new Error("Hasil ekstraksi mengembalikan artefak biner dokumen PDF. Pemrosesan dibatalkan demi keamanan.");
    }
    const cleanText = extractedText.replace(/\r\n/g, "\n").trim();
    res.json({
      success: true,
      extractedLength: cleanText.length,
      text: cleanText.slice(0, 6e4)
    });
  } catch (error) {
    console.error("Error parsing material file:", error);
    res.status(500).json({
      error: error.message || "Gagal mengekstrak teks dari file materi."
    });
  }
});
app.post(["/api/parse-formatted-exam", "/parse-formatted-exam"], async (req, res) => {
  try {
    const { fileData, fileType, fileName, subject, grade, semester } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "Data file naskah soal tidak ditemukan." });
    }
    const isPdf = fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const isDocx = fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName?.toLowerCase().endsWith(".docx") || fileName?.toLowerCase().endsWith(".doc");
    const rawBase64 = fileData.replace(/^data:.*?;base64,/, "");
    let extractedText = "";
    if (isDocx) {
      const buffer = Buffer.from(rawBase64, "base64");
      const result = await import_mammoth.default.extractRawText({ buffer });
      extractedText = result.value;
    } else if (isPdf) {
      const buffer = Buffer.from(rawBase64, "base64");
      extractedText = await extractPdfText(buffer, rawBase64);
    } else {
      const buffer = Buffer.from(rawBase64, "base64");
      if (buffer.slice(0, 5).toString("ascii").startsWith("%PDF")) {
        extractedText = await extractPdfText(buffer, rawBase64);
      } else {
        extractedText = buffer.toString("utf-8");
      }
    }
    if (isRawPdfBinary(extractedText)) {
      return res.status(400).json({
        error: "Dokumen naskah soal PDF tidak dapat dibaca sebagai teks biasa."
      });
    }
    const cleanDocText = extractedText.replace(/\r\n/g, "\n").trim();
    if (!cleanDocText || cleanDocText.length < 20) {
      return res.status(400).json({
        error: "Dokumen naskah soal kosong atau tidak terbaca dengan benar."
      });
    }
    const parsedSet = await parseTeacherFormattedQuestions({
      rawDocText: cleanDocText,
      defaultSubject: subject,
      defaultGrade: grade,
      defaultSemester: semester
    });
    res.json({
      success: true,
      data: parsedSet
    });
  } catch (error) {
    console.error("Error in /api/parse-formatted-exam:", error);
    res.status(500).json({
      error: error.message || "Gagal memproses format naskah soal guru."
    });
  }
});
function isGeminiQuotaError(error) {
  if (!error) return false;
  const status = error.status || error.statusCode || error.response?.status;
  if (status === 429) return true;
  let text = "";
  try {
    text = `${error.message || ""} ${error.statusText || ""} ${JSON.stringify(error)}`.toLowerCase();
  } catch {
    text = String(error.message || error).toLowerCase();
  }
  return text.includes("429") || text.includes("resource_exhausted") || text.includes("quota") || text.includes("rate limit") || text.includes("too many requests") || text.includes("exhausted");
}
app.post(["/api/generate-questions", "/generate-questions"], async (req, res) => {
  try {
    const {
      subject,
      grade,
      level,
      semester,
      examType,
      material,
      learningObjective,
      questionCount,
      questionType,
      optionsCount,
      difficultyType,
      difficultyRatio,
      cognitiveFocus,
      includeImages,
      imageFrequency,
      onlyFromMaterial,
      manualMaterial,
      extractedMaterial,
      kisiKisi,
      includeHots,
      customPrompt,
      sourceMode,
      moduleFocusTopic
    } = req.body;
    if (!subject || !material) {
      return res.status(400).json({
        error: "Mohon lengkapi Mata Pelajaran dan Materi pembelajaran."
      });
    }
    const result = await generateQuestionsWithGemini({
      level: level || "SMP",
      subject,
      grade: grade || "VIII",
      semester: semester || "1",
      examType: examType || "Penilaian Harian",
      material,
      learningObjective,
      questionCount: Math.min(60, Math.max(1, Number(questionCount) || 10)),
      questionType: questionType || "Pilihan Ganda",
      optionsCount: optionsCount || 4,
      difficultyType: difficultyType || "Campuran",
      difficultyRatio,
      cognitiveFocus: cognitiveFocus || "BALANCED",
      includeImages: includeImages === true,
      imageFrequency: includeImages === true ? imageFrequency || "some" : "none",
      onlyFromMaterial: Boolean(onlyFromMaterial ?? true),
      manualMaterial,
      extractedMaterial,
      kisiKisi,
      includeHots,
      customPrompt,
      sourceMode,
      moduleFocusTopic
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error in /api/generate-questions:", error);
    if (isGeminiQuotaError(error)) {
      return res.status(429).json({
        error: "Batas kuota Gemini API atau batas harian telah tercapai. Sistem akan mengatur ulang kuota pada pukul 00:00 (Waktu Lokal).",
        isQuotaExceeded: true,
        code: "QUOTA_EXHAUSTED"
      });
    }
    res.status(500).json({
      error: error.message || "AI gagal membuat soal. Silakan periksa kunci API dan koneksi jaringan."
    });
  }
});
app.post(["/api/regenerate-question", "/regenerate-question"], async (req, res) => {
  try {
    const {
      subject,
      grade,
      material,
      currentQuestion,
      optionsCount,
      materialContext,
      onlyFromMaterial,
      existingQuestions
    } = req.body;
    if (!subject || !grade || !material || !currentQuestion) {
      return res.status(400).json({
        error: "Parameter tidak lengkap untuk meregenerasi soal."
      });
    }
    const newQuestion = await regenerateSingleQuestion({
      subject,
      grade,
      material,
      currentQuestion,
      optionsCount,
      materialContext,
      onlyFromMaterial,
      existingQuestions
    });
    res.json({
      success: true,
      question: newQuestion
    });
  } catch (error) {
    console.error("Error in /api/regenerate-question:", error);
    if (isGeminiQuotaError(error)) {
      return res.status(429).json({
        error: "Batas kuota Gemini API tercapai saat meregenerasi soal. Kuota akan diperbarui pada pukul 00:00.",
        isQuotaExceeded: true,
        code: "QUOTA_EXHAUSTED"
      });
    }
    res.status(500).json({
      error: error.message || "Gagal membuat ulang soal tersebut."
    });
  }
});
app.post(["/api/audit-questions", "/audit-questions"], async (req, res) => {
  try {
    const { questions, subject, grade, material } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: "Daftar butir soal tidak boleh kosong untuk diaudit."
      });
    }
    const auditResult = await auditQuestionsWithGemini({
      questions,
      subject: subject || "Mata Pelajaran",
      grade: grade || "Umum",
      material: material || "Materi Ujian"
    });
    res.json({
      success: true,
      data: auditResult
    });
  } catch (error) {
    console.error("Error in /api/audit-questions:", error);
    res.status(500).json({
      error: error.message || "Gagal melakukan audit kualitas soal."
    });
  }
});
app.post(["/api/google/forms/create", "/google/forms/create"], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    if (!accessToken) {
      return res.status(401).json({
        error: "Google belum terhubung. Hubungkan Google untuk membuat Form."
      });
    }
    const {
      title,
      description,
      questions,
      shuffleQuestions,
      shuffleOptions,
      subject,
      grade,
      includeIdentitySection,
      identityFields,
      classList
    } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: "Daftar butir soal tidak boleh kosong."
      });
    }
    const result = await createGoogleFormQuiz(accessToken, {
      title: title || `Kuis ${subject || ""} Kelas ${grade || ""}`,
      description,
      questions,
      shuffleQuestions,
      shuffleOptions,
      subject,
      grade,
      includeIdentitySection,
      identityFields,
      classList
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error in /api/google/forms/create:", error);
    res.status(500).json({
      error: error.message || "Google Form gagal dibuat. Soal Anda tetap tersimpan."
    });
  }
});
app.get(["/api/bank-soal", "/bank-soal"], (req, res) => {
  try {
    const userId = req.query.userId || "";
    const email = req.query.email || "";
    if (!userId && !email) {
      return res.status(400).json({ error: "userId atau email diperlukan." });
    }
    const bankSoal = getUserBankSoal(userId, email);
    res.json({
      success: true,
      bankSoal
    });
  } catch (err) {
    console.error("Error in GET /api/bank-soal:", err);
    res.status(500).json({ error: err.message || "Gagal mengambil bank soal." });
  }
});
app.post(["/api/bank-soal", "/bank-soal"], (req, res) => {
  try {
    const { questionSet, userId, userEmail, userName } = req.body;
    if (!userId || !questionSet || !questionSet.id) {
      return res.status(400).json({ error: "Parameter userId dan questionSet tidak lengkap." });
    }
    const updatedSets = saveUserBankSoal(userId, questionSet, userEmail, userName);
    res.json({
      success: true,
      bankSoal: updatedSets
    });
  } catch (err) {
    console.error("Error in POST /api/bank-soal:", err);
    res.status(500).json({ error: err.message || "Gagal menyimpan bank soal." });
  }
});
app.post(["/api/bank-soal/sync", "/bank-soal/sync"], (req, res) => {
  try {
    const { userId, userEmail, userName, bankSoal } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId diperlukan untuk sinkronisasi." });
    }
    const incomingSets = Array.isArray(bankSoal) ? bankSoal : [];
    const mergedSets = syncUserBankSoal(userId, incomingSets, userEmail, userName);
    res.json({
      success: true,
      count: mergedSets.length,
      bankSoal: mergedSets
    });
  } catch (err) {
    console.error("Error in POST /api/bank-soal/sync:", err);
    res.status(500).json({ error: err.message || "Gagal sinkronisasi bank soal." });
  }
});
app.delete(["/api/bank-soal", "/bank-soal"], (req, res) => {
  try {
    const { id, userId } = req.body;
    if (!id || !userId) {
      return res.status(400).json({ error: "id dan userId diperlukan." });
    }
    const remainingSets = deleteUserBankSoal(userId, id);
    res.json({
      success: true,
      bankSoal: remainingSets
    });
  } catch (err) {
    console.error("Error in DELETE /api/bank-soal:", err);
    res.status(500).json({ error: err.message || "Gagal menghapus paket soal." });
  }
});
app.get(["/api/bank-soal/all", "/bank-soal/all"], (_req, res) => {
  try {
    const data = getAllBankSoalForAdmin();
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    console.error("Error in GET /api/bank-soal/all:", err);
    res.status(500).json({ error: err.message || "Gagal mengambil semua bank soal." });
  }
});
app.delete(["/api/bank-soal/admin", "/bank-soal/admin"], (req, res) => {
  try {
    const { setId, userId } = req.body;
    if (!setId) {
      return res.status(400).json({ error: "setId diperlukan." });
    }
    const success = deleteBankSoalByAdmin(setId, userId);
    res.json({
      success,
      message: success ? "Berhasil menghapus paket soal dari server." : "Paket soal tidak ditemukan."
    });
  } catch (err) {
    console.error("Error in DELETE /api/bank-soal/admin:", err);
    res.status(500).json({ error: err.message || "Gagal menghapus paket soal admin." });
  }
});
app.post(["/api/bank-soal/admin/bulk-delete", "/bank-soal/admin/bulk-delete"], (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array diperlukan." });
    }
    const count = bulkDeleteBankSoalByAdmin(items);
    res.json({
      success: true,
      deletedCount: count,
      message: `Berhasil menghapus ${count} paket soal.`
    });
  } catch (err) {
    console.error("Error in POST /api/bank-soal/admin/bulk-delete:", err);
    res.status(500).json({ error: err.message || "Gagal menghapus paket soal massal." });
  }
});
app.use("/api/*", (_req, res) => {
  res.status(404).json({
    error: "Endpoint API tidak ditemukan."
  });
});
app.use((err, _req, res, _next) => {
  console.error("Global express error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Terjadi kesalahan internal pada server."
  });
});
var app_default = app;

// server.ts
async function startServer() {
  const PORT = 3e3;
  const httpServer = import_http.default.createServer(app_default);
  httpServer.keepAliveTimeout = 65e3;
  httpServer.headersTimeout = 66e3;
  httpServer.requestTimeout = 3e5;
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app_default.use(vite.middlewares);
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    app_default.use(import_express2.default.static(distPath));
    app_default.get("*", (_req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server AI Pembuat Soal Guru running on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
