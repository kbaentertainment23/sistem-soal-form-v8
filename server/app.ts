import express from "express";
import path from "path";
import fs from "fs";
import mammoth from "mammoth";
import dotenv from "dotenv";
import {
  generateQuestionsWithGemini,
  regenerateSingleQuestion,
  generateQuestionVisualSuggestion,
  parseTeacherFormattedQuestions,
  extractPdfDocumentWithGemini,
  isRawPdfBinary,
  auditQuestionsWithGemini
} from "./gemini.js";
import { createGoogleFormQuiz } from "./forms.js";

dotenv.config();

const app = express();

// Enable CORS for external / serverless environments
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Support pre-parsed bodies (e.g. on Vercel) and standard Express stream parsing
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    (req as any)._body = true;
  }
  next();
});

// Increase payload limit for document uploads (25MB)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Normalize incoming request URLs for both standalone and serverless (Vercel) environments
app.use((req, _res, next) => {
  const originalPath =
    req.headers["x-matched-path"] ||
    req.headers["x-vercel-matched-path"] ||
    req.headers["x-original-url"] ||
    req.headers["x-forwarded-uri"];

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
    if (knownEndpoints.some(ep => req.url.startsWith(ep))) {
      req.url = `/api${req.url}`;
    }
  }
  next();
});

// Storage path for persistent system settings (app logo, school profile, branding)
const SYSTEM_SETTINGS_FILE = path.join(process.cwd(), "data", "system-settings.json");
const SYSTEM_LOGO_FILE = path.join(process.cwd(), "data", "active-logo.json");

interface LogoState {
  appLogoUrl: string;
  updatedAt: string;
  version: number;
}

let activeLogoCache: LogoState = {
  appLogoUrl: "",
  updatedAt: new Date().toISOString(),
  version: 1
};

function loadPersistedSettings(): Record<string, any> {
  try {
    if (fs.existsSync(SYSTEM_SETTINGS_FILE)) {
      const content = fs.readFileSync(SYSTEM_SETTINGS_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("Could not read system settings file:", e);
  }
  return {};
}

function savePersistedSettings(settings: Record<string, any>): void {
  try {
    const dir = path.dirname(SYSTEM_SETTINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SYSTEM_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save system settings file:", e);
  }
}

function savePersistedLogo(logoState: LogoState): void {
  try {
    const dir = path.dirname(SYSTEM_LOGO_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SYSTEM_LOGO_FILE, JSON.stringify(logoState, null, 2), "utf-8");
  } catch (e) {
    console.warn("Could not save active logo file:", e);
  }
}

function initLogoStorage(): void {
  try {
    if (fs.existsSync(SYSTEM_LOGO_FILE)) {
      const content = fs.readFileSync(SYSTEM_LOGO_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === "object") {
        activeLogoCache = {
          appLogoUrl: typeof parsed.appLogoUrl === "string" ? parsed.appLogoUrl : "",
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          version: typeof parsed.version === "number" ? parsed.version : 1
        };
        return;
      }
    }
    // Fallback: check system-settings.json for existing logo
    const sysSettings = loadPersistedSettings();
    if (sysSettings && typeof sysSettings.appLogoUrl === "string" && sysSettings.appLogoUrl) {
      activeLogoCache = {
        appLogoUrl: sysSettings.appLogoUrl,
        updatedAt: sysSettings.updatedAt || new Date().toISOString(),
        version: 1
      };
      savePersistedLogo(activeLogoCache);
    }
  } catch (e) {
    console.warn("Could not initialize logo storage:", e);
  }
}

// Initialize active logo storage on startup
initLogoStorage();

// API Health Check
app.get(["/api/health", "/health"], (_req, res) => {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY
  );
  res.json({
    status: "ok",
    service: "AI Pembuat Soal Guru",
    hasGeminiKey,
    environment: process.env.VERCEL ? "vercel" : "server"
  });
});

// GET Active Logo (Fast, authoritative database source for all devices)
app.get(["/api/system-settings/logo", "/system-settings/logo"], (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    success: true,
    appLogoUrl: activeLogoCache.appLogoUrl || "",
    updatedAt: activeLogoCache.updatedAt,
    version: activeLogoCache.version
  });
});

// POST Active Logo (Admin updates or resets the institutional logo)
app.post(["/api/system-settings/logo", "/system-settings/logo"], (req, res) => {
  try {
    const newLogoUrl = typeof req.body.appLogoUrl === "string" ? req.body.appLogoUrl : "";
    activeLogoCache = {
      appLogoUrl: newLogoUrl,
      updatedAt: new Date().toISOString(),
      version: (activeLogoCache.version || 0) + 1
    };
    savePersistedLogo(activeLogoCache);

    // Also update system-settings.json to keep both files in sync
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
  } catch (err: any) {
    console.error("Error saving active logo:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Gagal menyimpan logo ke database."
    });
  }
});

// GET System Settings Version (Ultra-lightweight ~30 bytes for instant cross-device polling)
app.get(["/api/system-settings/version", "/system-settings/version"], (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({
    success: true,
    version: activeLogoCache.version,
    updatedAt: activeLogoCache.updatedAt,
    hasLogo: Boolean(activeLogoCache.appLogoUrl && activeLogoCache.appLogoUrl.trim().length > 0)
  });
});

// GET Global System Settings (Logo, school info, branding for all devices)
app.get(["/api/system-settings", "/system-settings"], (_req, res) => {
  try {
    const settings = loadPersistedSettings();
    if (activeLogoCache.appLogoUrl !== undefined) {
      settings.appLogoUrl = activeLogoCache.appLogoUrl;
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      success: true,
      settings: settings || {}
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || "Gagal memuat pengaturan sistem."
    });
  }
});

// POST Global System Settings (Admin updates logo, school info, branding)
app.post(["/api/system-settings", "/system-settings"], (req, res) => {
  try {
    const current = loadPersistedSettings();
    const newSettings = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString()
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
  } catch (err: any) {
    console.error("Error in /api/system-settings:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Gagal menyimpan pengaturan sistem."
    });
  }
});

// Visual Image Suggestion for a Question
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
  } catch (error: any) {
    console.error("Error in /api/generate-question-image:", error);
    res.status(500).json({
      error: error.message || "Gagal mendapatkan rekomendasi gambar visual."
    });
  }
});

// Get OAuth Client ID or configuration for frontend
app.get(["/api/auth/config", "/auth/config"], async (_req, res) => {
  let clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
  if (!clientId) {
    try {
      const fs = await import("fs");
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
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

// Helper to extract text from PDF buffer using legacy pdfjs, pdf-parse, or Gemini Multimodal Document Processing
async function extractPdfText(buffer: Buffer, base64Data?: string): Promise<string> {
  // 1. First try standalone pdfjs-dist legacy (robust on Node, Vercel Serverless, and Cloud without worker threads)
  try {
    const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item: any) => item?.str || "")
        .filter((str: string) => str.trim().length > 0);
      if (pageStrings.length > 0) {
        fullText += `\n--- Halaman / Slide ${i} ---\n` + pageStrings.join(" ") + "\n";
      }
    }
    const cleanText = fullText.trim();
    if (cleanText.length > 25 && !isRawPdfBinary(cleanText)) {
      return cleanText;
    }
  } catch (pdfjsErr) {
    console.warn("Local pdfjs-dist legacy unavailable or failed. Trying next parser:", pdfjsErr);
  }

  // 2. Try pdf-parse (local parser fallback)
  try {
    const pdfParseModule: any = await import("pdf-parse");
    let localText = "";

    // Support pdf-parse v2 (exports PDFParse class)
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
          // ignore parser destroy errors
        }
      }
    } else {
      // Support pdf-parse v1 or default export function
      const pdfParserFn = typeof pdfParseModule === "function"
        ? pdfParseModule
        : typeof pdfParseModule?.default === "function"
        ? pdfParseModule.default
        : null;

      if (pdfParserFn) {
        const pdfData = await pdfParserFn(buffer);
        localText = (pdfData?.text || "").trim();
      }
    }

    // Verify that local text is valid, meaningful, and NOT raw PDF binary
    if (localText && localText.length > 25 && !isRawPdfBinary(localText)) {
      return localText;
    }
  } catch (pdfErr) {
    console.warn("Local pdf-parse unavailable or failed. Using Gemini PDF processor:", pdfErr);
  }

  // 3. High-accuracy Gemini Multimodal Document Extraction
  // Strictly treats the PDF as application/pdf binary, never as raw string
  try {
    const b64 = base64Data || buffer.toString("base64");
    const geminiText = await extractPdfDocumentWithGemini(b64);
    if (geminiText && geminiText.length > 10 && !isRawPdfBinary(geminiText)) {
      return geminiText;
    }
  } catch (geminiErr: any) {
    console.error("Gemini PDF extraction error:", geminiErr?.message || geminiErr);
    throw new Error(geminiErr?.message || "Gagal memproses dokumen PDF dengan AI.");
  }

  // NEVER return raw buffer.toString("utf-8") - which leaks %PDF-1.4 raw binary stream
  throw new Error("Dokumen PDF tidak dapat diekstrak menjadi teks. Pastikan berkas PDF bukan hasil scan murni tanpa teks atau terproteksi sandi.");
}

// Parse document / material (DOCX / PDF / TXT / etc.)
app.post(["/api/parse-material", "/parse-material"], async (req, res) => {
  try {
    const { fileData, fileType, fileName } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "Data file tidak ditemukan." });
    }

    const rawBase64 = fileData.replace(/^data:.*?;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");

    // Check magic bytes in buffer header (first 1024 bytes for %PDF)
    const headerSnippet = buffer.slice(0, 1024).toString("ascii");
    const hasPdfMagic = headerSnippet.includes("%PDF");

    const isPdf = hasPdfMagic || fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const isDocx =
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName?.toLowerCase().endsWith(".docx") ||
      fileName?.toLowerCase().endsWith(".doc");
    const isText =
      !isPdf &&
      (fileType === "text/plain" ||
        fileName?.toLowerCase().endsWith(".txt") ||
        fileName?.toLowerCase().endsWith(".md") ||
        fileName?.toLowerCase().endsWith(".csv"));

    let extractedText = "";

    if (isPdf) {
      // PDF Processing Pipeline:
      // Strictly maintain binary buffer/base64 with application/pdf MIME type
      extractedText = await extractPdfText(buffer, rawBase64);
    } else if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || "";
    } else if (isText) {
      extractedText = buffer.toString("utf-8");
    } else {
      // Generic fallback - verify header is not PDF
      if (hasPdfMagic) {
        extractedText = await extractPdfText(buffer, rawBase64);
      } else {
        extractedText = buffer.toString("utf-8");
      }
    }

    // Safety validation: Ensure no raw PDF binary leaked
    if (isRawPdfBinary(extractedText)) {
      throw new Error("Hasil ekstraksi mengembalikan artefak biner dokumen PDF. Pemrosesan dibatalkan demi keamanan.");
    }

    // Clean up extracted text
    const cleanText = extractedText.replace(/\r\n/g, "\n").trim();

    res.json({
      success: true,
      extractedLength: cleanText.length,
      text: cleanText.slice(0, 60000)
    });
  } catch (error: any) {
    console.error("Error parsing material file:", error);
    res.status(500).json({
      error: error.message || "Gagal mengekstrak teks dari file materi."
    });
  }
});

// Parse formatted teacher exam (DOCX, Word, or text) directly into QuestionSet
app.post(["/api/parse-formatted-exam", "/parse-formatted-exam"], async (req, res) => {
  try {
    const { fileData, fileType, fileName, subject, grade, semester } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "Data file naskah soal tidak ditemukan." });
    }

    const isPdf = fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const isDocx =
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName?.toLowerCase().endsWith(".docx") ||
      fileName?.toLowerCase().endsWith(".doc");

    const rawBase64 = fileData.replace(/^data:.*?;base64,/, "");
    let extractedText = "";

    if (isDocx) {
      const buffer = Buffer.from(rawBase64, "base64");
      const result = await mammoth.extractRawText({ buffer });
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
  } catch (error: any) {
    console.error("Error in /api/parse-formatted-exam:", error);
    res.status(500).json({
      error: error.message || "Gagal memproses format naskah soal guru."
    });
  }
});

function isGeminiQuotaError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.response?.status;
  if (status === 429) return true;
  let text = "";
  try {
    text = `${error.message || ""} ${error.statusText || ""} ${JSON.stringify(error)}`.toLowerCase();
  } catch {
    text = String(error.message || error).toLowerCase();
  }
  return (
    text.includes("429") ||
    text.includes("resource_exhausted") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("exhausted")
  );
}

// Generate Questions via Gemini
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
      imageFrequency: includeImages === true ? (imageFrequency || "some") : "none",
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
  } catch (error: any) {
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

// Regenerate a single question
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
  } catch (error: any) {
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

// Quality Audit & Pedagogical Reviewer via Gemini
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
  } catch (error: any) {
    console.error("Error in /api/audit-questions:", error);
    res.status(500).json({
      error: error.message || "Gagal melakukan audit kualitas soal."
    });
  }
});

// Create Google Form Quiz
app.post(["/api/google/forms/create", "/google/forms/create"], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : "";

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
  } catch (error: any) {
    console.error("Error in /api/google/forms/create:", error);
    res.status(500).json({
      error: error.message || "Google Form gagal dibuat. Soal Anda tetap tersimpan."
    });
  }
});

// --- SERVER-BACKED PERSISTENT BANK SOAL API (CROSS-DEVICE SYNC) ---

import {
  getUserBankSoal,
  saveUserBankSoal,
  syncUserBankSoal,
  deleteUserBankSoal,
  getAllBankSoalForAdmin,
  deleteBankSoalByAdmin,
  bulkDeleteBankSoalByAdmin
} from "./bankSoalService.js";

// Fetch user's question sets from server storage
app.get(["/api/bank-soal", "/bank-soal"], (req, res) => {
  try {
    const userId = (req.query.userId as string) || "";
    const email = (req.query.email as string) || "";

    if (!userId && !email) {
      return res.status(400).json({ error: "userId atau email diperlukan." });
    }

    const bankSoal = getUserBankSoal(userId, email);
    res.json({
      success: true,
      bankSoal
    });
  } catch (err: any) {
    console.error("Error in GET /api/bank-soal:", err);
    res.status(500).json({ error: err.message || "Gagal mengambil bank soal." });
  }
});

// Save single question set to server storage
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
  } catch (err: any) {
    console.error("Error in POST /api/bank-soal:", err);
    res.status(500).json({ error: err.message || "Gagal menyimpan bank soal." });
  }
});

// Bulk sync question sets from client device to server storage
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
  } catch (err: any) {
    console.error("Error in POST /api/bank-soal/sync:", err);
    res.status(500).json({ error: err.message || "Gagal sinkronisasi bank soal." });
  }
});

// Delete question set from server storage
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
  } catch (err: any) {
    console.error("Error in DELETE /api/bank-soal:", err);
    res.status(500).json({ error: err.message || "Gagal menghapus paket soal." });
  }
});

// Admin: Get all bank soal across all users
app.get(["/api/bank-soal/all", "/bank-soal/all"], (_req, res) => {
  try {
    const data = getAllBankSoalForAdmin();
    res.json({
      success: true,
      ...data
    });
  } catch (err: any) {
    console.error("Error in GET /api/bank-soal/all:", err);
    res.status(500).json({ error: err.message || "Gagal mengambil semua bank soal." });
  }
});

// Admin: Delete bank soal by setId
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
  } catch (err: any) {
    console.error("Error in DELETE /api/bank-soal/admin:", err);
    res.status(500).json({ error: err.message || "Gagal menghapus paket soal admin." });
  }
});

// Admin: Bulk delete bank soal
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
  } catch (err: any) {
    console.error("Error in POST /api/bank-soal/admin/bulk-delete:", err);
    res.status(500).json({ error: err.message || "Gagal menghapus paket soal massal." });
  }
});

// Catch-all API 404 handler for API routes to always return clean JSON
app.use("/api/*", (_req, res) => {
  res.status(404).json({
    error: "Endpoint API tidak ditemukan."
  });
});

// Global error handler to guarantee JSON response on server errors
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Global express error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Terjadi kesalahan internal pada server."
  });
});

export default app;
