import type { Question, QuestionSet, Difficulty, CognitiveLevel } from "../types.js";
import mammoth from "mammoth";
import { isRawPdfBinary, isPdfFileByMagic } from "./fileParser.js";

export interface ParsedExamResult {
  title: string;
  subject: string;
  grade: string;
  semester: string;
  examType?: string;
  material: string;
  questions: Question[];
}

/**
 * Extracts questions and metadata from teacher-prepared DOCX/TXT/Word files.
 * Uses both client-side deterministic parsing and server AI fallback for 100% accuracy.
 */
export async function parseTeacherExamFile(
  file: File,
  fallbackMeta: {
    subject?: string;
    grade?: string;
    semester?: string;
    examType?: string;
  } = {}
): Promise<ParsedExamResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  let rawText = "";

  const isPdfByMagic = await isPdfFileByMagic(file);
  const isPdf = isPdfByMagic || extension === "pdf" || file.type === "application/pdf";

  // For PDF files: Never read with readAsText. Send directly to server for high-accuracy multimodal extraction.
  if (isPdf) {
    try {
      const base64Data = await fileToBase64(file);
      const res = await fetch("/api/parse-formatted-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          fileType: "application/pdf",
          fileName: file.name,
          subject: fallbackMeta.subject,
          grade: fallbackMeta.grade,
          semester: fallbackMeta.semester,
        }),
      });

      const data = await res.json();
      if (res.ok && data.data && data.data.questions?.length > 0) {
        return data.data;
      }
      throw new Error(data.error || "Gagal memproses dokumen soal format PDF.");
    } catch (err: any) {
      throw new Error(err.message || "Gagal memproses dokumen soal format PDF.");
    }
  }

  if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      rawText = result.value || "";
    } catch (e) {
      console.warn("Client mammoth extraction failed, using FileReader fallback:", e);
    }
  }

  if (!rawText) {
    // Ensure file is not PDF before running readAsText
    if (await isPdfFileByMagic(file)) {
      throw new Error("Berkas format soal terdeteksi sebagai dokumen PDF. Gunakan alur PDF.");
    }
    rawText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || "";
        if (isRawPdfBinary(text)) {
          reject(new Error("Berkas mengandung data biner PDF yang tidak valid sebagai teks naskah soal."));
        } else {
          resolve(text);
        }
      };
      reader.onerror = () => reject(new Error("Gagal membaca berkas dokumen."));
      reader.readAsText(file);
    });
  }

  if (isRawPdfBinary(rawText)) {
    throw new Error("Dokumen format soal menghasilkan artefak biner mentah. Sistem menolak berkas ini.");
  }

  const cleanText = rawText.replace(/\r\n/g, "\n").trim();
  if (!cleanText || cleanText.length < 15) {
    throw new Error("Dokumen format soal kosong atau tidak terbaca.");
  }

  // Attempt Client-Side Deterministic Extraction first
  const clientParsed = parseQuestionsFromTextLocal(cleanText, fallbackMeta);
  if (clientParsed && clientParsed.questions.length >= 1) {
    return clientParsed;
  }

  // If local parser found 0 questions (e.g. non-standard syntax), call server parser with Gemini AI
  try {
    const base64Data = await fileToBase64(file);
    const res = await fetch("/api/parse-formatted-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileData: base64Data,
        fileType: file.type,
        fileName: file.name,
        subject: fallbackMeta.subject,
        grade: fallbackMeta.grade,
        semester: fallbackMeta.semester,
      }),
    });

    const data = await res.json();
    if (res.ok && data.data && data.data.questions?.length > 0) {
      return data.data;
    }
  } catch (err) {
    console.warn("Server parse fallback failed:", err);
  }

  if (clientParsed && clientParsed.questions.length > 0) {
    return clientParsed;
  }

  throw new Error("Tidak dapat menemukan butir soal yang sesuai format pada berkas ini. Pastikan format penomoran soal dan pilihan jawaban (A, B, C, D) sudah tepat.");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Robust deterministic local text parser for standard Indonesian exam formats
 */
export function parseQuestionsFromTextLocal(
  text: string,
  fallbackMeta: {
    subject?: string;
    grade?: string;
    semester?: string;
    examType?: string;
  } = {}
): ParsedExamResult | null {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Extract Header Info
  let subject = fallbackMeta.subject || "Mata Pelajaran";
  let grade = fallbackMeta.grade || "VIII";
  let semester = fallbackMeta.semester || "1";
  let examType = fallbackMeta.examType || "Penilaian Harian";
  let title = `Paket Soal ${subject} Kelas ${grade}`;
  let material = `Materi ${subject}`;

  for (const line of lines.slice(0, 30)) {
    const lower = line.toLowerCase();
    if (lower.includes("mata pelajaran") || lower.includes("mapel")) {
      const match = line.split(/[:=]/)[1];
      if (match && match.trim()) subject = match.trim();
    } else if (lower.includes("kelas")) {
      const match = line.split(/[:=]/)[1];
      if (match && match.trim()) {
        const grMatch = match.match(/(VII|VIII|IX|X|XI|XII|I|II|III|IV|V|VI|\d+)/i);
        if (grMatch) grade = grMatch[0].toUpperCase();
      }
    } else if (lower.includes("semester")) {
      const match = line.split(/[:=]/)[1];
      if (match && match.trim()) {
        if (match.includes("2") || match.toLowerCase().includes("genap")) semester = "2";
        else semester = "1";
      }
    } else if (lower.includes("jenis asesmen") || lower.includes("penilaian")) {
      const match = line.split(/[:=]/)[1];
      if (match && match.trim()) examType = match.trim();
    }
  }

  title = `${examType} ${subject} - Kelas ${grade}`;

  // Find question list start marker if available to skip headers/guidelines
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toUpperCase();
    if (l.includes("DAFTAR BUTIR SOAL") || l.includes("DAFTAR SOAL") || l.includes("AWAL DAFTAR SOAL")) {
      startIndex = i + 1;
      break;
    }
  }

  const candidateLines = startIndex > 0 ? lines.slice(startIndex) : lines;

  // Split questions based on numbering like "1. ", "1) ", "No. 1 ", "Soal 1"
  const questionBlocks: string[] = [];
  let currentBlock: string[] = [];

  const questionNumRegex = /^(?:No\.?\s*|Soal\s*)?(\d+)[\.\)]\s+(.+)/i;

  // Helper to detect non-question lines (guidelines, tips, headers, footers, signatures)
  const isIgnoredLine = (line: string): boolean => {
    const l = line.trim();
    const lower = l.toLowerCase();
    return (
      l.includes("FORMAT STANDAR") ||
      l.includes("PETUNJUK PENGISIAN") ||
      l.includes("PETUNJUK UMUM") ||
      l.includes("PETUNJUK KHUSUS") ||
      l.includes("TATA TERTIB") ||
      l.includes("DAFTAR BUTIR SOAL") ||
      l.includes("💡") ||
      lower.includes("tip guru") ||
      lower.startsWith("tip:") ||
      lower.startsWith("tip ") ||
      lower.startsWith("catatan:") ||
      lower.startsWith("catatan akhir") ||
      lower.startsWith("catatan ") ||
      lower.startsWith("nb:") ||
      lower.includes("anda dapat menambah nomor soal") ||
      lower.includes("simpan file docx ini") ||
      lower.includes("unggah kembali ke aplikasi") ||
      lower.startsWith("mengetahui,") ||
      lower.includes("kepala sekolah") ||
      lower.includes("guru mata pelajaran") ||
      lower.startsWith("nip.") ||
      lower.includes("lanjutkan butir soal") ||
      lower.includes("hapus teks contoh") ||
      l.startsWith("---") ||
      l.startsWith("===") ||
      l.startsWith("***")
    );
  };

  for (const line of candidateLines) {
    // Skip guide, header markers, tip guru, notes, or borders
    if (isIgnoredLine(line)) {
      continue;
    }

    if (questionNumRegex.test(line)) {
      if (currentBlock.length > 0) {
        questionBlocks.push(currentBlock.join("\n"));
        currentBlock = [];
      }
      currentBlock.push(line);
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    questionBlocks.push(currentBlock.join("\n"));
  }

  const questions: Question[] = [];

  for (const block of questionBlocks) {
    const bLines = block.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (bLines.length === 0) continue;

    const firstLine = bLines[0];
    const match = firstLine.match(questionNumRegex);
    let questionText = match ? match[2] : firstLine;

    const options: { label: "A" | "B" | "C" | "D" | "E"; text: string }[] = [];
    let correctAnswer: "A" | "B" | "C" | "D" | "E" = "A";
    let explanation = "Kunci jawaban sesuai format yang disiapkan guru.";
    let difficulty: Difficulty = "Sedang";
    let cognitiveLevel: CognitiveLevel = "C3";
    let points = 10;
    let questionMaterial: string | undefined = undefined;
    let indicatorText: string | undefined = undefined;

    let readingQuestionText = true;
    let optionsReadingClosed = false;

    for (let i = 1; i < bLines.length; i++) {
      const line = bLines[i];
      if (isIgnoredLine(line)) {
        continue;
      }

      const optMatch = line.match(/^([A-E])[\.\)]\s*(.+)/i) || line.match(/^\(([A-E])\)\s*(.+)/i);
      const keyMatch = line.match(/(?:\[|\b)(?:Kunci(?:\s+Jawaban)?|Jawaban\s+Benar|Key)\s*[:=]?\s*([A-E])\b/i);
      const materiMatch = line.match(/(?:Materi(?:\s+Pokok)?|Sub[- ]?Materi|Topik)\s*[:=]\s*([^|;\n\]]+)/i);
      const indMatch = line.match(/(?:Indikator(?:\s+Soal)?|Indikator)\s*[:=]\s*([^|;\n\]]+)/i);
      const explMatch = line.match(/(?:Pembahasan|Penjelasan|Alasan|Uraian)\s*[:=]\s*(.+)/i);
      const diffMatch = line.match(/(?:Tingkat\s+Kesulitan|Kesulitan)\s*[:=]?\s*(Mudah|Sedang|Sulit|Sukar)/i) ||
                        line.match(/\((Mudah|Sedang|Sulit|Sukar)\)/i);
      const levelMatch = line.match(/(?:Level(?:\s+Kognitif)?|Kognitif)\s*[:=]?\s*(C[1-6])/i) ||
                         line.match(/\b(C[1-6])\b/i);
      const pointsMatch = line.match(/(?:Poin|Bobot|Nilai)\s*[:=]\s*(\d+)/i);

      if (keyMatch) {
        correctAnswer = keyMatch[1].toUpperCase() as any;
        readingQuestionText = false;
        optionsReadingClosed = true;
      }

      if (materiMatch) {
        questionMaterial = materiMatch[1].replace(/\]$/, "").trim();
        readingQuestionText = false;
        optionsReadingClosed = true;
      }

      if (indMatch) {
        indicatorText = indMatch[1].replace(/\]$/, "").trim();
        readingQuestionText = false;
        optionsReadingClosed = true;
      }
      
      if (explMatch) {
        explanation = explMatch[1].replace(/\]$/, "").trim();
        readingQuestionText = false;
        optionsReadingClosed = true;
      }
      
      if (diffMatch) {
        const dVal = diffMatch[1].toLowerCase();
        difficulty = dVal.includes("mudah") ? "Mudah" : dVal.includes("sulit") || dVal.includes("sukar") ? "Sulit" : "Sedang";
        readingQuestionText = false;
        optionsReadingClosed = true;
      }
      
      if (levelMatch) {
        cognitiveLevel = levelMatch[1].toUpperCase() as any;
        readingQuestionText = false;
        optionsReadingClosed = true;
      }
      
      if (pointsMatch) {
        points = parseInt(pointsMatch[1], 10) || 10;
        readingQuestionText = false;
        optionsReadingClosed = true;
      }
      
      if (optMatch) {
        readingQuestionText = false;
        let optText = optMatch[2].trim();
        
        // Detect if answer key marker is embedded in the option line, e.g. "★ (Kunci Jawaban)"
        if (/★|\(Kunci(?:\s+Jawaban)?\)/i.test(optText)) {
          correctAnswer = optMatch[1].toUpperCase() as any;
          optText = optText.replace(/★\s*(?:\(Kunci(?:\s+Jawaban)?\))?/gi, "").trim();
          optText = optText.replace(/\(Kunci(?:\s+Jawaban)?\)/gi, "").trim();
        }

        options.push({
          label: optMatch[1].toUpperCase() as any,
          text: optText,
        });
      } else if (readingQuestionText && !keyMatch && !explMatch && !diffMatch && !levelMatch && !materiMatch && !indMatch) {
        questionText += " " + line;
      } else if (options.length > 0 && !optionsReadingClosed && !keyMatch && !explMatch && !diffMatch && !levelMatch && !materiMatch && !indMatch && !line.toLowerCase().startsWith("kunci") && !line.toLowerCase().startsWith("pembahasan")) {
        // Multi-line option text (strictly only before answer key / explanation / meta)
        options[options.length - 1].text += " " + line;
      } else if (optionsReadingClosed && !keyMatch && !diffMatch && !levelMatch && !pointsMatch && !explMatch && !materiMatch && !indMatch) {
        // Continuation of explanation text
        explanation += " " + line;
      }
    }

    // Clean up options text: strip any stray tips or notes if present
    options.forEach((opt) => {
      opt.text = opt.text
        .replace(/(?:💡\s*)?(?:Tip\s+Guru|Catatan|NB:)[\s\S]*/i, "")
        .replace(/\s+/g, " ")
        .trim();
    });

    // Clean up explanation text: strip any stray tips or notes
    explanation = explanation
      .replace(/(?:💡\s*)?(?:Tip\s+Guru|Catatan|NB:)[\s\S]*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    // STRICT VALIDATION: A valid multiple choice question MUST have at least 2 options (A & B)
    // This strictly prevents instruction lines, table notes, or guidelines from being parsed as questions!
    if (options.length < 2) {
      continue;
    }

    const qNum = questions.length + 1;
    const finalMaterial = questionMaterial || material;
    const finalIndicator = indicatorText || (questionMaterial ? `Memahami dan menerapkan konsep ${questionMaterial}` : `Materi ${subject}`);

    questions.push({
      id: `q_parsed_${Date.now()}_${qNum}`,
      number: qNum,
      question: questionText.trim(),
      options,
      correctAnswer,
      explanation,
      difficulty,
      cognitiveLevel,
      material: finalMaterial,
      indicator: finalIndicator,
      points,
    });
  }

  if (questions.length === 0) return null;

  return {
    title,
    subject,
    grade,
    semester,
    examType,
    material,
    questions,
  };
}
