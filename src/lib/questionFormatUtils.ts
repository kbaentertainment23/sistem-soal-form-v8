import type { Question, QuestionSet, QuestionOption, CognitiveLevel, Difficulty } from "../types.js";
import { checkQuestionsDuplicate, normalizeQuestionStem } from "./questionDeduplicator.js";

export interface QuestionPackageExport {
  schema: "ai-soal-format-v1";
  version: "1.0";
  exportedAt: string;
  title: string;
  subject: string;
  grade: string;
  semester: string;
  material: string;
  totalQuestions: number;
  questions: Question[];
}

export interface ParseResult {
  success: boolean;
  format: "json" | "csv" | "text" | "unknown";
  questions: Question[];
  metadata?: {
    title?: string;
    subject?: string;
    grade?: string;
    semester?: string;
    material?: string;
  };
  errors?: string[];
  warnings?: string[];
}

export interface MergeResult {
  mergedQuestions: Question[];
  addedCount: number;
  duplicateCount: number;
  duplicateDetails: Array<{
    incomingIndex: number;
    incomingQuestion: string;
    existingNumber: number;
    existingQuestion: string;
    reason: string;
  }>;
}

/**
 * Clean & normalize a question object to ensure standard fields
 */
export function normalizeQuestionObject(q: Partial<Question>, index: number): Question {
  const options: QuestionOption[] = (q.options || []).map((opt, oIdx) => {
    const defaultLabels: Array<'A' | 'B' | 'C' | 'D' | 'E'> = ['A', 'B', 'C', 'D', 'E'];
    const label = (opt.label ? String(opt.label).toUpperCase() : defaultLabels[oIdx] || 'A') as 'A' | 'B' | 'C' | 'D' | 'E';
    return {
      label: ['A', 'B', 'C', 'D', 'E'].includes(label) ? label : (defaultLabels[oIdx] || 'A'),
      text: String(opt.text || "").trim(),
    };
  });

  // Ensure at least 4 options if fewer exist
  if (options.length < 4) {
    const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
    while (options.length < 4) {
      const lbl = labels[options.length];
      options.push({ label: lbl, text: `Pilihan ${lbl}` });
    }
  }

  // Validate correctAnswer
  let validAnswer: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
  const rawAns = String(q.correctAnswer || '').toUpperCase().trim();
  if (['A', 'B', 'C', 'D', 'E'].includes(rawAns)) {
    validAnswer = rawAns as any;
  }

  // Validate difficulty
  let difficulty: Difficulty = 'Sedang';
  const rawDiff = String(q.difficulty || '').toLowerCase();
  if (rawDiff.includes('mudah') || rawDiff === 'easy') difficulty = 'Mudah';
  else if (rawDiff.includes('sulit') || rawDiff.includes('sukar') || rawDiff === 'hard') difficulty = 'Sulit';

  // Validate cognitive level
  let cognitiveLevel: CognitiveLevel = 'C2';
  const rawCog = String(q.cognitiveLevel || '').toUpperCase();
  if (['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].includes(rawCog)) {
    cognitiveLevel = rawCog as CognitiveLevel;
  } else if (rawCog.includes('HOTS') || rawCog.includes('ANALISIS')) {
    cognitiveLevel = 'C4';
  }

  return {
    id: q.id || `q_${Date.now()}_${index + 1}_${Math.random().toString(36).substring(2, 6)}`,
    number: index + 1,
    question: String(q.question || "").trim(),
    options,
    correctAnswer: validAnswer,
    explanation: String(q.explanation || "").trim(),
    difficulty,
    cognitiveLevel,
    indicator: String(q.indicator || "").trim(),
    points: typeof q.points === 'number' && q.points > 0 ? q.points : 1,
    material: q.material ? String(q.material).trim() : undefined,
    imageUrl: q.imageUrl || undefined,
    imageCaption: q.imageCaption || undefined,
    isSelected: q.isSelected !== false,
  };
}

// ==========================================
// 1. JSON EXPORT & IMPORT
// ==========================================

export function exportQuestionsToJSON(data: {
  title: string;
  subject: string;
  grade: string;
  semester: string;
  material?: string;
  questions: Question[];
}): string {
  const pkg: QuestionPackageExport = {
    schema: "ai-soal-format-v1",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    title: data.title || "Paket Soal",
    subject: data.subject || "Umum",
    grade: data.grade || "X",
    semester: data.semester || "1",
    material: data.material || "",
    totalQuestions: data.questions.length,
    questions: data.questions.map((q, idx) => normalizeQuestionObject(q, idx)),
  };
  return JSON.stringify(pkg, null, 2);
}

export function parseQuestionsFromJSON(jsonText: string): ParseResult {
  try {
    const parsed = JSON.parse(jsonText);
    let rawList: any[] = [];
    const metadata: any = {};

    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.questions)) {
        rawList = parsed.questions;
      } else if (Array.isArray(parsed.data)) {
        rawList = parsed.data;
      }
      metadata.title = parsed.title;
      metadata.subject = parsed.subject;
      metadata.grade = parsed.grade;
      metadata.semester = parsed.semester;
      metadata.material = parsed.material;
    }

    if (!rawList || rawList.length === 0) {
      return {
        success: false,
        format: "json",
        questions: [],
        errors: ["File JSON tidak berisi daftar butir pertanyaan yang valid."],
      };
    }

    const questions: Question[] = [];
    const warnings: string[] = [];

    rawList.forEach((item, idx) => {
      if (!item || (!item.question && !item.soal)) {
        warnings.push(`Baris/objek ke-${idx + 1} dilewati karena tidak memiliki teks soal.`);
        return;
      }

      // Handle custom or alternate property names
      const qText = item.question || item.soal || item.pertanyaan || "";
      let options = item.options || item.pilihan || item.opsi || [];

      // If options is object { A: '...', B: '...' }
      if (options && !Array.isArray(options) && typeof options === "object") {
        options = Object.entries(options).map(([k, v]) => ({
          label: k.toUpperCase(),
          text: String(v),
        }));
      }

      const qObj = normalizeQuestionObject(
        {
          ...item,
          question: qText,
          options,
          correctAnswer: item.correctAnswer || item.kunci || item.jawaban || item.kunciJawaban || "A",
          explanation: item.explanation || item.pembahasan || item.penjelasan || "",
          difficulty: item.difficulty || item.kesulitan || "Sedang",
          cognitiveLevel: item.cognitiveLevel || item.tingkatKognitif || item.kognitif || "C2",
          indicator: item.indicator || item.indikator || "",
          points: item.points || item.poin || item.skor || 1,
        },
        questions.length
      );

      questions.push(qObj);
    });

    return {
      success: questions.length > 0,
      format: "json",
      questions,
      metadata,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      format: "json",
      questions: [],
      errors: [`Format JSON tidak valid: ${err?.message || "Kesalahan sintaks JSON"}`],
    };
  }
}

// ==========================================
// 2. CSV / EXCEL EXPORT & IMPORT
// ==========================================

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportQuestionsToCSV(data: {
  title?: string;
  subject?: string;
  grade?: string;
  questions: Question[];
}): string {
  // UTF-8 BOM so Excel opens indonesian characters properly
  const BOM = "\uFEFF";
  const headers = [
    "Nomor",
    "Pertanyaan",
    "Pilihan A",
    "Pilihan B",
    "Pilihan C",
    "Pilihan D",
    "Pilihan E",
    "Kunci Jawaban",
    "Pembahasan",
    "Tingkat Kognitif",
    "Tingkat Kesulitan",
    "Indikator",
    "Skor Poin",
  ];

  const rows: string[] = [headers.map(escapeCSV).join(",")];

  data.questions.forEach((q, idx) => {
    const optA = q.options.find((o) => o.label === "A")?.text || "";
    const optB = q.options.find((o) => o.label === "B")?.text || "";
    const optC = q.options.find((o) => o.label === "C")?.text || "";
    const optD = q.options.find((o) => o.label === "D")?.text || "";
    const optE = q.options.find((o) => o.label === "E")?.text || "";

    const row = [
      escapeCSV(idx + 1),
      escapeCSV(q.question),
      escapeCSV(optA),
      escapeCSV(optB),
      escapeCSV(optC),
      escapeCSV(optD),
      escapeCSV(optE),
      escapeCSV(q.correctAnswer),
      escapeCSV(q.explanation || ""),
      escapeCSV(q.cognitiveLevel || "C2"),
      escapeCSV(q.difficulty || "Sedang"),
      escapeCSV(q.indicator || ""),
      escapeCSV(q.points || 1),
    ];
    rows.push(row.join(","));
  });

  return BOM + rows.join("\r\n");
}

/**
 * Robust CSV parser that handles multiline cells, quotes, and commas
 */
function parseCSVRows(csvText: string): string[][] {
  const cleanText = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === ';') {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

export function parseQuestionsFromCSV(csvText: string): ParseResult {
  try {
    const rows = parseCSVRows(csvText);
    if (rows.length < 2) {
      return {
        success: false,
        format: "csv",
        questions: [],
        errors: ["File CSV harus memiliki baris judul kolom (header) dan minimal 1 baris soal."],
      };
    }

    const header = rows[0].map((h) => h.toLowerCase().trim());

    // Map column indices flexibly
    const findCol = (...keywords: string[]) => {
      return header.findIndex((h) => keywords.some((k) => h.includes(k)));
    };

    const qCol = findCol("pertanyaan", "soal", "question");
    const aCol = findCol("pilihan a", "opsi a", "jawaban a", "opt a", "a");
    const bCol = findCol("pilihan b", "opsi b", "jawaban b", "opt b", "b");
    const cCol = findCol("pilihan c", "opsi c", "jawaban c", "opt c", "c");
    const dCol = findCol("pilihan d", "opsi d", "jawaban d", "opt d", "d");
    const eCol = findCol("pilihan e", "opsi e", "jawaban e", "opt e", "e");
    const keyCol = findCol("kunci", "jawaban benar", "correct", "key");
    const expCol = findCol("pembahasan", "penjelasan", "explanation", "alasan");
    const cogCol = findCol("kognitif", "cognitive", "tingkat kognitif");
    const diffCol = findCol("kesulitan", "difficulty", "tingkat kesulitan");
    const indCol = findCol("indikator", "indicator");
    const ptsCol = findCol("skor", "poin", "points", "bobot");

    if (qCol === -1) {
      return {
        success: false,
        format: "csv",
        questions: [],
        errors: ["Kolom 'Pertanyaan' atau 'Soal' tidak ditemukan dalam file CSV."],
      };
    }

    const questions: Question[] = [];

    for (let rIdx = 1; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const qText = (row[qCol] || "").trim();
      if (!qText) continue;

      const options: QuestionOption[] = [];
      if (aCol !== -1 && row[aCol]) options.push({ label: "A", text: row[aCol].trim() });
      if (bCol !== -1 && row[bCol]) options.push({ label: "B", text: row[bCol].trim() });
      if (cCol !== -1 && row[cCol]) options.push({ label: "C", text: row[cCol].trim() });
      if (dCol !== -1 && row[dCol]) options.push({ label: "D", text: row[dCol].trim() });
      if (eCol !== -1 && row[eCol] && row[eCol].trim()) options.push({ label: "E", text: row[eCol].trim() });

      const rawKey = keyCol !== -1 ? (row[keyCol] || "").toUpperCase().trim() : "A";
      const exp = expCol !== -1 ? (row[expCol] || "").trim() : "";
      const cog = cogCol !== -1 ? (row[cogCol] || "").trim() : "C2";
      const diff = diffCol !== -1 ? (row[diffCol] || "").trim() : "Sedang";
      const ind = indCol !== -1 ? (row[indCol] || "").trim() : "";
      const pts = ptsCol !== -1 ? parseFloat(row[ptsCol]) || 1 : 1;

      questions.push(
        normalizeQuestionObject(
          {
            question: qText,
            options,
            correctAnswer: rawKey as any,
            explanation: exp,
            cognitiveLevel: cog as any,
            difficulty: diff as any,
            indicator: ind,
            points: pts,
          },
          questions.length
        )
      );
    }

    return {
      success: questions.length > 0,
      format: "csv",
      questions,
    };
  } catch (err: any) {
    return {
      success: false,
      format: "csv",
      questions: [],
      errors: [`Gagal membaca CSV: ${err?.message || "Format CSV tidak valid"}`],
    };
  }
}

// ==========================================
// 3. TEXT FORMAT GURU (.TXT) EXPORT & IMPORT
// ==========================================

export function exportQuestionsToText(data: {
  title: string;
  subject: string;
  grade: string;
  semester: string;
  material?: string;
  questions: Question[];
}): string {
  let out = `[NASKAH_SOAL_FORMAT_GURU]\n`;
  out += `JUDUL: ${data.title || "Paket Soal Ujian"}\n`;
  out += `MATA_PELAJARAN: ${data.subject || "Umum"}\n`;
  out += `KELAS: ${data.grade || "X"}\n`;
  out += `SEMESTER: ${data.semester || "1"}\n`;
  if (data.material) out += `MATERI: ${data.material}\n`;
  out += `JUMLAH_SOAL: ${data.questions.length}\n`;
  out += `========================================================================\n\n`;

  data.questions.forEach((q, idx) => {
    out += `--- SOAL NO. ${idx + 1} ---\n`;
    out += `Pertanyaan: ${q.question}\n`;
    q.options.forEach((opt) => {
      out += `${opt.label}. ${opt.text}\n`;
    });
    out += `Kunci: ${q.correctAnswer}\n`;
    if (q.explanation) out += `Pembahasan: ${q.explanation}\n`;
    out += `Tingkat: ${q.cognitiveLevel || "C2"}\n`;
    out += `Kesulitan: ${q.difficulty || "Sedang"}\n`;
    if (q.indicator) out += `Indikator: ${q.indicator}\n`;
    out += `Skor: ${q.points || 1}\n\n`;
  });

  return out;
}

export function parseQuestionsFromText(text: string): ParseResult {
  try {
    const lines = text.split(/\r?\n/);
    const metadata: any = {};
    const questions: Question[] = [];

    // Parse header lines if any
    for (const line of lines) {
      const matchMeta = line.match(/^(JUDUL|MATA_PELAJARAN|MAPEL|KELAS|SEMESTER|MATERI)\s*:\s*(.+)$/i);
      if (matchMeta) {
        const key = matchMeta[1].toUpperCase();
        const val = matchMeta[2].trim();
        if (key === "JUDUL") metadata.title = val;
        if (key === "MATA_PELAJARAN" || key === "MAPEL") metadata.subject = val;
        if (key === "KELAS") metadata.grade = val;
        if (key === "SEMESTER") metadata.semester = val;
        if (key === "MATERI") metadata.material = val;
      }
    }

    // Split text into question blocks
    // Supports:
    // "--- SOAL NO. 1 ---"
    // "No. 1" / "1. "
    // "---"
    const blocks: string[] = [];
    let currentBlock: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isBlockSeparator =
        /^(---|===|___)/.test(line) ||
        /^---\s*soal\s+no\.\s*\d+/i.test(line) ||
        /^(soal\s+no\.\s*\d+|no\.\s*\d+[:.]?)/i.test(line);

      // Check for standalone numbered questions like "1. " when preceding line is empty
      const isNumberedStart = /^\d+[\.\)]\s+/.test(line);

      if ((isBlockSeparator || isNumberedStart) && currentBlock.length > 0) {
        // Only split if current block already contains question content
        const blockHasContent = currentBlock.some((l) =>
          /pertanyaan|kunci|[a-d][\.\)]/i.test(l)
        );
        if (blockHasContent) {
          blocks.push(currentBlock.join("\n"));
          currentBlock = [];
        }
      }

      currentBlock.push(lines[i]);
    }

    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join("\n"));
    }

    // Parse each block
    blocks.forEach((block) => {
      const blockLines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (blockLines.length === 0) return;

      let questionText = "";
      const options: QuestionOption[] = [];
      let correctAnswer: any = "A";
      let explanation = "";
      let cognitiveLevel: any = "C2";
      let difficulty: any = "Sedang";
      let indicator = "";
      let points = 1;

      let capturingQuestion = false;

      for (const line of blockLines) {
        // Skip purely decorative lines
        if (/^(---|===|___|\*\*\*)/.test(line)) continue;
        if (/^\[NASKAH_SOAL_FORMAT_GURU\]/i.test(line)) continue;
        if (/^(JUDUL|MATA_PELAJARAN|MAPEL|KELAS|SEMESTER|MATERI|JUMLAH_SOAL)\s*:/i.test(line)) continue;

        // Key answer
        const keyMatch = line.match(/^(?:kunci|kunci\s*jawaban|jawaban|key|ans)\s*[:=]\s*([A-Ea-e])/i);
        if (keyMatch) {
          correctAnswer = keyMatch[1].toUpperCase();
          capturingQuestion = false;
          continue;
        }

        // Explanation
        const expMatch = line.match(/^(?:pembahasan|penjelasan|alasan|explanation)\s*[:=]\s*(.+)$/i);
        if (expMatch) {
          explanation = expMatch[1].trim();
          capturingQuestion = false;
          continue;
        }

        // Cognitive Level
        const cogMatch = line.match(/^(?:tingkat|kognitif|level|tingkat\s*kognitif)\s*[:=]\s*([C1-6c1-6]|hots|lots)/i);
        if (cogMatch) {
          const raw = cogMatch[1].toUpperCase();
          if (['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].includes(raw)) {
            cognitiveLevel = raw;
          } else if (raw === 'HOTS') {
            cognitiveLevel = 'C4';
          }
          capturingQuestion = false;
          continue;
        }

        // Difficulty
        const diffMatch = line.match(/^(?:kesulitan|tingkat\s*kesulitan|difficulty)\s*[:=]\s*(mudah|sedang|sulit|sukar)/i);
        if (diffMatch) {
          const raw = diffMatch[1].toLowerCase();
          if (raw.includes("mudah")) difficulty = "Mudah";
          else if (raw.includes("sulit") || raw.includes("sukar")) difficulty = "Sulit";
          else difficulty = "Sedang";
          capturingQuestion = false;
          continue;
        }

        // Indicator
        const indMatch = line.match(/^(?:indikator|indicator)\s*[:=]\s*(.+)$/i);
        if (indMatch) {
          indicator = indMatch[1].trim();
          capturingQuestion = false;
          continue;
        }

        // Points / Score
        const ptsMatch = line.match(/^(?:skor|poin|points|bobot)\s*[:=]\s*(\d+(?:\.\d+)?)/i);
        if (ptsMatch) {
          points = parseFloat(ptsMatch[1]) || 1;
          capturingQuestion = false;
          continue;
        }

        // Options A-E
        const optMatch = line.match(/^([A-Ea-e])[\.\)]\s+(.+)$/);
        if (optMatch) {
          const lbl = optMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
          options.push({
            label: lbl,
            text: optMatch[2].trim(),
          });
          capturingQuestion = false;
          continue;
        }

        // Question stem start
        const qStartMatch = line.match(/^(?:soal\s+no\.\s*\d+[:.]?\s*|no\.\s*\d+[:.]?\s*|\d+[\.\)]\s*|pertanyaan\s*[:.]\s*)(.+)$/i);
        if (qStartMatch) {
          questionText = qStartMatch[1].trim();
          capturingQuestion = true;
          continue;
        }

        // Continuation of question or text line
        if (capturingQuestion) {
          questionText += " " + line;
        } else if (!questionText && line.length > 5 && !line.includes(":")) {
          // Fallback first substantial text line
          questionText = line;
          capturingQuestion = true;
        }
      }

      if (questionText && options.length >= 2) {
        questions.push(
          normalizeQuestionObject(
            {
              question: questionText,
              options,
              correctAnswer,
              explanation,
              cognitiveLevel,
              difficulty,
              indicator,
              points,
            },
            questions.length
          )
        );
      }
    });

    return {
      success: questions.length > 0,
      format: "text",
      questions,
      metadata,
    };
  } catch (err: any) {
    return {
      success: false,
      format: "text",
      questions: [],
      errors: [`Gagal memproses naskah teks: ${err?.message || "Format teks tidak valid"}`],
    };
  }
}

// ==========================================
// 4. UNIVERSAL DETECTOR & PARSER
// ==========================================

export function parseQuestionsUniversal(rawContent: string, filename?: string): ParseResult {
  const trimmed = rawContent.trim();
  const lowerName = (filename || "").toLowerCase();

  // Try JSON first if ends with .json or starts with { or [
  if (lowerName.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const jsonRes = parseQuestionsFromJSON(trimmed);
    if (jsonRes.success) return jsonRes;
    if (lowerName.endsWith(".json")) return jsonRes; // If explicit .json file, return its error
  }

  // Try CSV if ends with .csv or first line has standard CSV columns
  if (lowerName.endsWith(".csv") || /pertanyaan|pilihan\s*a|nomor|soal/i.test(trimmed.slice(0, 300))) {
    const csvRes = parseQuestionsFromCSV(trimmed);
    if (csvRes.success) return csvRes;
  }

  // Fallback to structured text
  const textRes = parseQuestionsFromText(trimmed);
  if (textRes.success) return textRes;

  return {
    success: false,
    format: "unknown",
    questions: [],
    errors: [
      "Tidak dapat membaca butir soal dari konten ini. Pastikan format file sesuai dengan template (JSON, CSV, atau Teks Guru).",
    ],
  };
}

// ==========================================
// 5. MERGE ENGINE WITH DEDUPLICATION
// ==========================================

export function mergeQuestions(
  existingQuestions: Question[],
  incomingQuestions: Question[],
  options?: { skipDuplicates?: boolean }
): MergeResult {
  const skipDuplicates = options?.skipDuplicates ?? true;
  const merged: Question[] = [...existingQuestions];
  const duplicateDetails: MergeResult["duplicateDetails"] = [];
  let addedCount = 0;

  incomingQuestions.forEach((incomingQ, inIdx) => {
    // Check against existing and previously merged questions
    let isDup = false;
    let matchedNum = -1;
    let matchedText = "";
    let dupReason = "";

    for (let i = 0; i < merged.length; i++) {
      const existQ = merged[i];
      const check = checkQuestionsDuplicate(incomingQ, existQ);
      if (check.isDuplicate) {
        isDup = true;
        matchedNum = existQ.number || i + 1;
        matchedText = existQ.question;
        dupReason = check.reason || "Pertanyaan serupa";
        break;
      }
    }

    if (isDup) {
      duplicateDetails.push({
        incomingIndex: inIdx,
        incomingQuestion: incomingQ.question,
        existingNumber: matchedNum,
        existingQuestion: matchedText,
        reason: dupReason,
      });

      if (skipDuplicates) {
        // Skip adding this duplicate question
        return;
      }
    }

    // Add question with updated sequential number
    const newNumber = merged.length + 1;
    const normalized = normalizeQuestionObject(
      {
        ...incomingQ,
        id: `q_merged_${Date.now()}_${newNumber}`,
        number: newNumber,
        isSelected: true,
      },
      merged.length
    );

    merged.push(normalized);
    addedCount++;
  });

  // Re-number entire list sequentially 1 to N
  const renumbered = merged.map((q, idx) => ({
    ...q,
    number: idx + 1,
  }));

  return {
    mergedQuestions: renumbered,
    addedCount,
    duplicateCount: duplicateDetails.length,
    duplicateDetails,
  };
}

// ==========================================
// 6. SAMPLE TEMPLATES FOR DOWNLOAD
// ==========================================

export function getSampleJSONTemplate(): string {
  const samplePkg: QuestionPackageExport = {
    schema: "ai-soal-format-v1",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    title: "Contoh Penilaian Harian IPA Bab 1",
    subject: "Ilmu Pengetahuan Alam",
    grade: "VII",
    semester: "1",
    material: "Struktur dan Fungsi Sel",
    totalQuestions: 2,
    questions: [
      {
        number: 1,
        question: "Bagian sel yang bertindak sebagai pusat pengendali seluruh aktivitas sel adalah...",
        options: [
          { label: "A", text: "Nukleus (inti sel)" },
          { label: "B", text: "Mitokondria" },
          { label: "C", text: "Ribosom" },
          { label: "D", text: "Badan Golgi" },
        ],
        correctAnswer: "A",
        explanation: "Nukleus menyimpan materi genetik (DNA) dan mengoordinasikan seluruh metabolisme sel.",
        difficulty: "Sedang",
        cognitiveLevel: "C2",
        indicator: "Menyebutkan fungsi organel sel dengan tepat",
        points: 1,
        isSelected: true,
      },
      {
        number: 2,
        question: "Perbedaan utama antara sel tumbuhan dan sel hewan yang benar adalah...",
        options: [
          { label: "A", text: "Sel tumbuhan memiliki dinding sel dan plastida, sel hewan tidak" },
          { label: "B", text: "Sel hewan memiliki vakuola besar di tengah sel" },
          { label: "C", text: "Sel tumbuhan tidak memiliki membran sel" },
          { label: "D", text: "Sel hewan memiliki kloroplas untuk berfotosintesis" },
        ],
        correctAnswer: "A",
        explanation: "Dinding sel (dari selulosa) dan plastida (kloroplas) hanya terdapat pada sel tumbuhan.",
        difficulty: "Sedang",
        cognitiveLevel: "C3",
        indicator: "Membandingkan karakteristik sel tumbuhan dan sel hewan",
        points: 1,
        isSelected: true,
      },
    ],
  };

  return JSON.stringify(samplePkg, null, 2);
}

export function getSampleCSVTemplate(): string {
  const BOM = "\uFEFF";
  const rows = [
    `"Nomor","Pertanyaan","Pilihan A","Pilihan B","Pilihan C","Pilihan D","Pilihan E","Kunci Jawaban","Pembahasan","Tingkat Kognitif","Tingkat Kesulitan","Indikator","Skor Poin"`,
    `"1","Bagian sel yang bertindak sebagai pusat pengendali seluruh aktivitas sel adalah...","Nukleus (inti sel)","Mitokondria","Ribosom","Badan Golgi","","A","Nukleus mengendalikan seluruh aktivitas hidup sel.","C2","Sedang","Menyebutkan organel sel","1"`,
    `"2","Organel sel tumbuhan yang berfungsi sebagai tempat fotosintesis adalah...","Kloroplas","Sentrosom","Lisosom","Vakuola","","A","Kloroplas mengandung pigmen klorofil untuk menangkap cahaya matahari.","C2","Mudah","Menjelaskan fotosintesis","1"`,
  ];
  return BOM + rows.join("\r\n");
}

export function getSampleTextTemplate(): string {
  return `[NASKAH_SOAL_FORMAT_GURU]
JUDUL: Penilaian Harian IPA
MATA_PELAJARAN: Ilmu Pengetahuan Alam
KELAS: VII
SEMESTER: 1
MATERI: Organisasi Kehidupan

--- SOAL NO. 1 ---
Pertanyaan: Bagian sel yang bertindak sebagai pusat pengendali seluruh aktivitas sel adalah...
A. Nukleus (inti sel)
B. Mitokondria
C. Ribosom
D. Badan Golgi
Kunci: A
Pembahasan: Nukleus mengandung DNA dan mengontrol seluruh metabolisme kehidupan sel.
Tingkat: C2
Kesulitan: Sedang
Indikator: Menyebutkan fungsi organel sel
Skor: 1

--- SOAL NO. 2 ---
Pertanyaan: Organel sel tumbuhan yang berfungsi sebagai tempat berlangsungnya fotosintesis adalah...
A. Kloroplas
B. Sentriol
C. Lisosom
D. Retikulum Endoplasma
Kunci: A
Pembahasan: Kloroplas memiliki klorofil yang menyerap energi cahaya matahari untuk fotosintesis.
Tingkat: C2
Kesulitan: Mudah
Indikator: Menyebutkan tempat terjadinya fotosintesis
Skor: 1
`;
}
