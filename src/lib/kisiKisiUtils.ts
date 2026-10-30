import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { QuestionSet, Question } from "../types.js";
import { getAppSettings } from "./storage.js";
import { formatGradeDisplay, cleanExamTitle } from "./classUtils.js";

export interface FormattedKisiKisiItem {
  no: number;
  questionNumber: number;
  material: string;
  indicator: string;
  cognitiveLevel: string;
  cognitiveCategory: "LOTS" | "MOTS" | "HOTS";
  cognitiveVerb: string;
  difficulty: "Mudah" | "Sedang" | "Sulit";
  questionType: string;
  points: number;
  studyTip: string;
  questionSnippet: string;
}

export interface A4PageSegment {
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  items: FormattedKisiKisiItem[];
  hasKop: boolean;
  hasMetadata: boolean;
  hasStudyGuide: boolean;
  hasSignatures: boolean;
}

/**
 * Calculates estimated row height in pixels for A4 landscape paper simulation
 */
export function estimateRowHeightPx(item: FormattedKisiKisiItem): number {
  const indLen = item.indicator?.length || 0;
  const tipLen = item.studyTip?.length || 0;
  const totalChars = indLen + tipLen;
  
  // Base padding + badges + minimum cell spacing
  let baseHeight = 58;
  if (totalChars > 160) {
    baseHeight += Math.ceil((totalChars - 160) / 45) * 16;
  }
  return Math.min(180, baseHeight);
}

/**
 * Smart Layout Content Height & Pagination Engine for A4 Landscape
 * Accurately partitions rows into separate A4 paper pages preventing any overflow
 */
export function paginateKisiKisiItems(
  items: FormattedKisiKisiItem[],
  options: {
    showKop?: boolean;
    showSignatures?: boolean;
    showStats?: boolean;
    customPageBudget?: number;
  } = {}
): A4PageSegment[] {
  const { showKop = true, showSignatures = true } = options;
  
  // Target printable height in CSS pixels for Landscape A4 (297mm x 210mm with margins)
  const MAX_PAGE_1_BUDGET = 640; // Total height budget for page 1
  const MAX_PAGE_N_BUDGET = 640; // Total height budget for subsequent pages
  
  const kopHeight = showKop ? 100 : 0;
  const metadataHeight = 92;
  const tableHeaderHeight = 42;
  const studyGuideHeight = 84;
  const signaturesHeight = showSignatures ? 150 : 0;

  if (items.length === 0) {
    return [
      {
        pageNumber: 1,
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        items: [],
        hasKop: showKop,
        hasMetadata: true,
        hasStudyGuide: true,
        hasSignatures: showSignatures,
      },
    ];
  }

  const rawPages: {
    items: FormattedKisiKisiItem[];
    hasKop: boolean;
    hasMetadata: boolean;
    hasStudyGuide: boolean;
    hasSignatures: boolean;
  }[] = [];

  let currentPageItems: FormattedKisiKisiItem[] = [];
  let isFirstPage = true;
  let currentUsedHeight = (isFirstPage ? kopHeight + metadataHeight : 36) + tableHeaderHeight;
  const maxBudget = isFirstPage ? MAX_PAGE_1_BUDGET : MAX_PAGE_N_BUDGET;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowH = estimateRowHeightPx(item);
    const budget = isFirstPage ? MAX_PAGE_1_BUDGET : MAX_PAGE_N_BUDGET;

    // Check if adding this row exceeds page capacity (with at least 1 item per page)
    if (currentPageItems.length > 0 && currentUsedHeight + rowH > budget - 20) {
      // Finalize current page without end blocks yet
      rawPages.push({
        items: [...currentPageItems],
        hasKop: isFirstPage && showKop,
        hasMetadata: isFirstPage,
        hasStudyGuide: false,
        hasSignatures: false,
      });

      // Start new page
      currentPageItems = [item];
      isFirstPage = false;
      currentUsedHeight = 36 + tableHeaderHeight + rowH; // mini-header + table header + current row
    } else {
      currentPageItems.push(item);
      currentUsedHeight += rowH;
    }
  }

  // Handle the last page of items
  const closingHeight = studyGuideHeight + signaturesHeight;
  const remainingBudget = MAX_PAGE_N_BUDGET - currentUsedHeight;

  if (remainingBudget >= closingHeight) {
    // Both study guide and signatures fit comfortably on the last items page!
    rawPages.push({
      items: currentPageItems,
      hasKop: isFirstPage && showKop,
      hasMetadata: isFirstPage,
      hasStudyGuide: true,
      hasSignatures: showSignatures,
    });
  } else if (remainingBudget >= studyGuideHeight && remainingBudget < closingHeight) {
    // Study guide fits, but signatures need a dedicated sign-off page
    rawPages.push({
      items: currentPageItems,
      hasKop: isFirstPage && showKop,
      hasMetadata: isFirstPage,
      hasStudyGuide: true,
      hasSignatures: false,
    });

    if (showSignatures) {
      rawPages.push({
        items: [],
        hasKop: false,
        hasMetadata: false,
        hasStudyGuide: false,
        hasSignatures: true,
      });
    }
  } else {
    // Neither fits comfortably; wrap items on this page, and create dedicated closure page
    rawPages.push({
      items: currentPageItems,
      hasKop: isFirstPage && showKop,
      hasMetadata: isFirstPage,
      hasStudyGuide: false,
      hasSignatures: false,
    });

    rawPages.push({
      items: [],
      hasKop: false,
      hasMetadata: false,
      hasStudyGuide: true,
      hasSignatures: showSignatures,
    });
  }

  const totalPages = rawPages.length;
  return rawPages.map((p, idx) => ({
    pageNumber: idx + 1,
    totalPages,
    isFirstPage: idx === 0,
    isLastPage: idx === totalPages - 1,
    items: p.items,
    hasKop: p.hasKop,
    hasMetadata: p.hasMetadata,
    hasStudyGuide: p.hasStudyGuide,
    hasSignatures: p.hasSignatures,
  }));
}

/**
 * Derives a human-friendly action verb based on Bloom's taxonomy level
 */
export function getBloomVerb(level: string): string {
  switch (level?.toUpperCase()) {
    case "C1":
      return "Mengingat (Menghafal)";
    case "C2":
      return "Memahami (Menjelaskan)";
    case "C3":
      return "Menerapkan (Menghitung/Praktik)";
    case "C4":
      return "Menganalisis (Menelaah/HOTS)";
    case "C5":
      return "Mengevaluasi (Menilai/HOTS)";
    case "C6":
      return "Mencipta (Merancang/HOTS)";
    default:
      return "Memahami";
  }
}

/**
 * Categorize into LOTS, MOTS, or HOTS
 */
export function getCognitiveCategory(level: string): "LOTS" | "MOTS" | "HOTS" {
  const lvl = level?.toUpperCase();
  if (lvl === "C1" || lvl === "C2") return "LOTS";
  if (lvl === "C3") return "MOTS";
  return "HOTS"; // C4, C5, C6
}

/**
 * Extracts a clean, natural topic from the indicator or question,
 * stripping away bureaucratic teacher/kurikulum jargon.
 */
export function extractCleanTopic(rawText: string, materialDefault: string): string {
  if (!rawText || rawText.trim().length === 0) {
    return materialDefault || "materi pokok";
  }

  let cleaned = rawText.trim();

  // Remove common administrative kurikulum prefixes
  cleaned = cleaned
    .replace(/^disajikan stimulus(?: berupa [^,]+)?,?\s*/i, "")
    .replace(/^disajikan wacana(?: tentang [^,]+)?,?\s*/i, "")
    .replace(/^disajikan teks(?: bacaan)?,?\s*/i, "")
    .replace(/^disajikan gambar(?: ilustrasi)?,?\s*/i, "")
    .replace(/^disajikan ilustrasi(?: kasus)?,?\s*/i, "")
    .replace(/^disajikan butir soal materi [^,]+,?\s*/i, "")
    .replace(/^disajikan tabel(?: data)?,?\s*/i, "")
    .replace(/^disajikan beberapa pernyataan,?\s*/i, "")
    .replace(/^disajikan data,?\s*/i, "")
    .replace(/^peserta didik dapat\s+/i, "")
    .replace(/^peserta didik mampu\s+/i, "")
    .replace(/^siswa dapat\s+/i, "")
    .replace(/^siswa mampu\s+/i, "")
    .replace(/^dapat\s+/i, "")
    .replace(/^mampu\s+/i, "");

  // Remove leading operational verbs if they would cause awkward double verbs in study guide
  cleaned = cleaned
    .replace(/^(?:menerangkan|menjelaskan|mengidentifikasi|menganalisis|menentukan|membedakan|menyebutkan|menghitung|mengevaluasi|merancang|membandingkan|mengklasifikasikan|menyimpulkan)\s+/i, "")
    .trim();

  // Remove trailing dots or punctuation
  cleaned = cleaned.replace(/[.:;,\s]+$/, "").trim();

  if (cleaned.length < 4) {
    return materialDefault || "materi ini";
  }

  return cleaned;
}

/**
 * Creates a clear, concise, and natural Indicator statement (free from heavy teacher jargon)
 */
export function formatFriendlyIndicator(rawIndicator: string | undefined, material: string, cognitiveLevel: string): string {
  const level = cognitiveLevel?.toUpperCase() || "C2";

  if (!rawIndicator || rawIndicator.trim().length === 0) {
    switch (level) {
      case "C1":
        return `Menyebutkan dan mengidentifikasi konsep dasar seputar ${material}.`;
      case "C2":
        return `Menjelaskan konsep utama dan prinsip kerja ${material}.`;
      case "C3":
        return `Menerapkan konsep atau menghitung persoalan terkait ${material}.`;
      case "C4":
        return `Menganalisis kasus, perbandingan, atau hubungan sebab-akibat pada ${material}.`;
      case "C5":
        return `Mengevaluasi dan menentukan pilihan solusi terbaik terkait ${material}.`;
      case "C6":
        return `Merancang ide atau solusi kreatif untuk permasalahan ${material}.`;
      default:
        return `Memahami konsep pokok terkait ${material}.`;
    }
  }

  let text = rawIndicator.trim();

  // If it starts with heavy bureaucratic jargon like "Disajikan stimulus...", make it cleaner
  text = text
    .replace(/^disajikan stimulus(?: berupa [^,]+)?,?\s*/i, "")
    .replace(/^disajikan wacana(?: tentang [^,]+)?,?\s*/i, "")
    .replace(/^disajikan teks(?: bacaan)?,?\s*/i, "")
    .replace(/^disajikan gambar(?: ilustrasi)?,?\s*/i, "")
    .replace(/^disajikan ilustrasi(?: kasus)?,?\s*/i, "")
    .replace(/^disajikan tabel(?: data)?,?\s*/i, "")
    .replace(/^peserta didik dapat\s+/i, "")
    .replace(/^peserta didik mampu\s+/i, "")
    .replace(/^siswa dapat\s+/i, "")
    .replace(/^siswa mampu\s+/i, "")
    .replace(/^dapat\s+/i, "")
    .replace(/^mampu\s+/i, "");

  // Capitalize first letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Ensure it ends with a period
  if (!text.endsWith(".")) {
    text += ".";
  }

  return text;
}

/**
 * Generates an easy-to-understand, student-friendly study tip (NO academic jargon, NO answer leaks)
 */
export function generateStudentStudyTip(q: Question, materialDefault: string): string {
  const level = q.cognitiveLevel?.toUpperCase() || "C2";
  const rawInd = q.indicator?.trim() || "";
  const topic = extractCleanTopic(rawInd, materialDefault);

  // Friendly, simple, actionable tips for students
  switch (level) {
    case "C1":
      return `Hafalkan pengertian, istilah kunci, dan contoh dasar seputar ${topic}.`;
    case "C2":
      return `Pahami cara kerja, fungsi, dan perbedaan pada ${topic} agar bisa menjelaskannya dengan bahasamu sendiri.`;
    case "C3":
      return `Latihan langkah-langkah perhitungan atau cara menerapkan konsep ${topic} pada soal cerita.`;
    case "C4":
      return `Cermati hubungan sebab-akibat, perbandingan, serta kelebihan dan kekurangan pada ${topic}. Baca soal dengan teliti!`;
    case "C5":
      return `Pelajari cara menilai pilihan solusi yang paling tepat dan berikan alasan logis terkait ${topic}.`;
    case "C6":
      return `Pikirkan cara menyusun ide kreatif atau langkah pemecahan masalah untuk situasi seputar ${topic}.`;
    default:
      return `Pelajari dan pahami konsep utama mengenai ${topic}.`;
  }
}

/**
 * Format questions into structured Kisi-Kisi matrix items without revealing answers
 */
export function getFormattedKisiKisiItems(set: QuestionSet): FormattedKisiKisiItem[] {
  return set.questions.map((q, idx) => {
    const cogCategory = getCognitiveCategory(q.cognitiveLevel);
    const cogVerb = getBloomVerb(q.cognitiveLevel);
    const itemMaterial = q.material || extractCleanTopic(q.indicator, set.material) || set.material;
    const friendlyIndicator = formatFriendlyIndicator(q.indicator, itemMaterial, q.cognitiveLevel || "C2");
    const friendlyTip = generateStudentStudyTip(q, itemMaterial);

    return {
      no: idx + 1,
      questionNumber: q.number || idx + 1,
      material: itemMaterial,
      indicator: friendlyIndicator,
      cognitiveLevel: q.cognitiveLevel || "C2",
      cognitiveCategory: cogCategory,
      cognitiveVerb: cogVerb,
      difficulty: q.difficulty || "Sedang",
      questionType: "Pilihan Ganda (PG)",
      points: q.points || 1,
      studyTip: friendlyTip,
      questionSnippet: q.question.length > 80 ? `${q.question.slice(0, 77)}...` : q.question,
    };
  });
}

/**
 * Generate student-safe formatted text for Kisi-Kisi copying
 */
export function exportKisiKisiText(set: QuestionSet): string {
  const settings = getAppSettings();
  const items = getFormattedKisiKisiItems(set);
  
  let text = `========================================================================\n`;
  text += `KISI-KISI ASESMEN / UJIAN & PANDUAN BELAJAR SISWA\n`;
  text += `${settings.schoolName.toUpperCase()}\n`;
  text += `========================================================================\n\n`;
  text += `Mata Pelajaran    : ${set.subject}\n`;
  text += `Kelas / Semester  : ${formatGradeDisplay(set.grade)} / Semester ${set.semester || "1"}\n`;
  text += `Materi Pokok      : ${set.material}\n`;
  text += `Bentuk Soal       : Pilihan Ganda (${items.length} Butir)\n`;
  text += `Total Skor        : ${set.totalPoints || items.length} Poin\n`;
  text += `Tahun Pelajaran   : ${settings.academicYear || "2026/2027"}\n\n`;
  text += `------------------------------------------------------------------------\n`;
  text += `TABEL KISI-KISI & INDIKATOR SOAL (PANDUAN BELAJAR SISWA)\n`;
  text += `------------------------------------------------------------------------\n\n`;

  items.forEach((item) => {
    text += `No. ${item.no}\n`;
    text += `• Materi Pokok     : ${item.material}\n`;
    text += `• Indikator Soal   : ${item.indicator}\n`;
    text += `• Panduan Belajar  : ${item.studyTip}\n`;
    text += `• Level Kognitif   : ${item.cognitiveLevel} (${item.cognitiveCategory} - ${item.cognitiveVerb})\n`;
    text += `• Tingkat Kesukaran: ${item.difficulty}\n`;
    text += `• Bentuk Soal      : ${item.questionType} (${item.points} Poin)\n`;
    text += `\n`;
  });

  text += `------------------------------------------------------------------------\n`;
  text += `PETUNJUK BELAJAR MANDIRI SISWA:\n`;
  text += `1. Pelajari ringkasan materi dan panduan belajar pada setiap nomor butir soal di atas.\n`;
  text += `2. Soal bertanda HOTS (C4–C6) melatih kemampuan analisis kasus dan berpikir kritis.\n`;
  text += `3. Soal bertanda LOTS/MOTS (C1–C3) menguji pemahaman definisi, rumus, dan konsep dasar.\n`;
  text += `4. Nomor urut butir soal pada lembar ujian akan diacak otomatis oleh sistem.\n`;
  text += `\n`;
  text += `Mengetahui,\n`;
  text += `Kepala Satuan Pendidikan: ${settings.principalName || "Kepala Sekolah, M.Pd."} (NIP. ${settings.principalNip || "-"})\n`;
  text += `Guru Mata Pelajaran     : ${settings.teacherName || "Guru Pengampu, S.Pd."} (NIP. ${settings.teacherNip || "-"})\n`;

  return text;
}

/**
 * Generate Word (.doc) formatted Kisi-Kisi table matching standard font size 12
 * Landscape A4 layout with standard 12pt typography, clean borders, and blank/dash randomized question numbers
 */
/**
 * Direct High-Definition Print / Save as PDF function for Smart Layout
 * Generates an isolated printable document with 100% exact CSS, Dark Header,
 * Blue Left-Border Callout Card, Pill Badges, and A4 Landscape page breaks.
 */
export function printSmartLayoutKisiKisi(set: QuestionSet): void {
  const settings = getAppSettings();
  const items = getFormattedKisiKisiItems(set);
  const cleanTitle = cleanExamTitle(set.title);
  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Calculate summary stats
  const totalQuestions = items.length;
  const hotsCount = items.filter(i => i.cognitiveCategory === "HOTS").length;
  const hotsPercent = totalQuestions > 0 ? Math.round((hotsCount / totalQuestions) * 100) : 0;
  const easyCount = items.filter(i => i.difficulty === "Mudah").length;
  const medCount = items.filter(i => i.difficulty === "Sedang").length;
  const hardCount = items.filter(i => i.difficulty === "Sulit").length;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Kisi-Kisi Asesmen - ${set.subject}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 14mm 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }
    .kop-container {
      text-align: center;
      padding-bottom: 8px;
      margin-bottom: 10px;
      border-bottom: 2.5px solid #0f172a;
    }
    .kop-school {
      font-size: 13pt;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 2px 0;
    }
    .kop-main-title {
      font-size: 14pt;
      font-weight: 900;
      color: #1e3a8a;
      text-transform: uppercase;
      margin: 0 0 2px 0;
    }
    .kop-sub {
      font-size: 9.5pt;
      color: #475569;
      font-weight: 600;
      margin: 0;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr 1fr;
      gap: 8px;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-size: 10pt;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 8pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .meta-val {
      font-weight: 800;
      color: #0f172a;
    }
    .stats-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 12px;
      margin-bottom: 10px;
      font-size: 9.5pt;
      font-weight: 700;
      color: #334155;
    }
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1.5px solid #0f172a;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .matrix-table thead {
      display: table-header-group;
    }
    .matrix-table th {
      background-color: #0f172a !important;
      color: #ffffff !important;
      padding: 8px 5px;
      font-size: 9.5pt;
      font-weight: 900;
      text-transform: uppercase;
      text-align: center;
      vertical-align: middle;
      border-right: 1px solid #334155;
      letter-spacing: 0.4px;
    }
    .matrix-table th:last-child {
      border-right: none;
    }
    .matrix-table tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .matrix-table td {
      padding: 8px 8px;
      font-size: 10pt;
      border-top: 1px solid #cbd5e1;
      border-right: 1px solid #cbd5e1;
      vertical-align: top;
    }
    .matrix-table td:last-child {
      border-right: none;
    }
    .matrix-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .callout-box {
      margin-top: 6px;
      padding: 7px 10px;
      background-color: #f1f5f9;
      border-left: 3.5px solid #2563eb;
      border-radius: 4px;
      font-size: 9.5pt;
      color: #1e293b;
      line-height: 1.4;
    }
    .callout-label {
      font-weight: 800;
      color: #1e40af;
    }
    .badge-pill {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .badge-lots {
      background-color: #dbeafe;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    .badge-mots {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .badge-hots {
      background-color: #f3e8ff;
      color: #6b21a8;
      border: 1px solid #d8b4fe;
    }
    .badge-diff {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 9.5pt;
      font-weight: 800;
    }
    .diff-mudah {
      background-color: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .diff-sedang {
      background-color: #fffbeb;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .diff-sulit {
      background-color: #fff1f2;
      color: #be123c;
      border: 1px solid #fecdd3;
    }
    .study-notes {
      padding: 8px 12px;
      background-color: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 9pt;
      color: #065f46;
      page-break-inside: avoid;
    }
    .study-notes-title {
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .sign-table {
      width: 100%;
      margin-top: 14px;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    .sign-table td {
      width: 50%;
      text-align: center;
      font-size: 10pt;
      vertical-align: top;
      line-height: 1.4;
    }
    .sign-space {
      height: 48px;
    }
    .sign-name {
      font-weight: 800;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="kop-container">
    <div class="kop-school">${settings.schoolName || "SATUAN PENDIDIKAN FORMAL"}</div>
    <div class="kop-main-title">KISI-KISI ASESMEN / UJIAN & PANDUAN BELAJAR SISWA</div>
    <div class="kop-sub">Tahun Ajaran ${settings.academicYear || "2026/2027"} • Kurikulum Merdeka & Kurikulum Nasional</div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Mata Pelajaran & Materi</span>
      <span class="meta-val">${set.subject} — ${set.material || cleanTitle}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Kelas / Semester</span>
      <span class="meta-val">${formatGradeDisplay(set.grade)} • Semester ${set.semester || "1"}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Bentuk & Total Skor</span>
      <span class="meta-val">Pilihan Ganda (${totalQuestions} Butir) • ${set.totalPoints || totalQuestions} Poin</span>
    </div>
  </div>

  <div class="stats-bar">
    <div>Distribusi Kognitif: <strong>HOTS: ${hotsCount} (${hotsPercent}%)</strong> | <strong>LOTS/MOTS: ${totalQuestions - hotsCount} (${100 - hotsPercent}%)</strong></div>
    <div>Tingkat Kesukaran: <strong>Mudah: ${easyCount}</strong> • <strong>Sedang: ${medCount}</strong> • <strong>Sulit: ${hardCount}</strong></div>
  </div>

  <table class="matrix-table">
    <thead>
      <tr>
        <th style="width: 4%;">No</th>
        <th style="width: 17%;">Materi Pokok</th>
        <th style="width: 48%;">Indikator Soal & Panduan Belajar Siswa</th>
        <th style="width: 12%;">Level Kognitif</th>
        <th style="width: 10%;">Kesukaran</th>
        <th style="width: 5%;">Bentuk</th>
        <th style="width: 4%;">Skor</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item) => {
        const isHots = item.cognitiveCategory === "HOTS";
        const isMots = item.cognitiveCategory === "MOTS";
        const isMudah = item.difficulty === "Mudah";
        const isSedang = item.difficulty === "Sedang";

        return `
        <tr>
          <td style="text-align: center; font-weight: 800; color: #64748b; vertical-align: middle;">${item.no}</td>
          <td style="font-weight: 800; color: #0f172a;">${item.material}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a; line-height: 1.45;">${item.indicator}</div>
            <div class="callout-box">
              <span class="callout-label">💡 Panduan Belajar:</span> ${item.studyTip}
            </div>
          </td>
          <td style="text-align: center; vertical-align: middle;">
            <div style="font-weight: 900; font-size: 11pt; color: #0f172a;">${item.cognitiveLevel}</div>
            <span class="badge-pill ${isHots ? 'badge-hots' : isMots ? 'badge-mots' : 'badge-lots'}">
              ${item.cognitiveCategory}
            </span>
          </td>
          <td style="text-align: center; vertical-align: middle;">
            <span class="badge-diff ${isMudah ? 'diff-mudah' : isSedang ? 'diff-sedang' : 'diff-sulit'}">
              ${item.difficulty}
            </span>
          </td>
          <td style="text-align: center; font-weight: 700; color: #475569; vertical-align: middle;">PG</td>
          <td style="text-align: center; font-weight: 800; color: #0f172a; vertical-align: middle;">${item.points}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>

  <div class="study-notes">
    <div class="study-notes-title">PETUNJUK BELAJAR MANDIRI SISWA:</div>
    <div>1. Pelajari indikator soal dan panduan belajar di atas secara terstruktur sebelum hari pelaksanaan asesmen.</div>
    <div>2. Soal bertanda <strong>HOTS (C4-C6)</strong> menguji analisis mendalam dan pemecahan masalah; soal <strong>LOTS/MOTS (C1-C3)</strong> menguji pemahaman konsep dasar.</div>
  </div>

  ${settings.enableSignatures ? `
  <table class="sign-table">
    <tr>
      <td>
        Mengetahui,<br/>
        Kepala Satuan Pendidikan
        <div class="sign-space"></div>
        <div class="sign-name">( ${settings.principalName || "Kepala Sekolah, M.Pd."} )</div>
        <div>NIP. ${settings.principalNip || "................................................"}</div>
      </td>
      <td>
        ${settings.schoolCity || "Kota"}, ${currentDate}<br/>
        Guru Mata Pelajaran
        <div class="sign-space"></div>
        <div class="sign-name">( ${settings.teacherName || "Guru Pengampu, S.Pd."} )</div>
        <div>NIP. ${settings.teacherNip || "................................................"}</div>
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

  // Create an iframe to print cleanly without leaving the application
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
      // Fallback
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 350);
}

/**
 * Generate Word (.doc) formatted Kisi-Kisi table matching standard font size 12
 * Landscape A4 layout with standard 12pt typography, clean borders, and Smart Layout styling
 */
export function exportKisiKisiWord(set: QuestionSet): void {
  const settings = getAppSettings();
  const items = getFormattedKisiKisiItems(set);
  const cleanTitle = cleanExamTitle(set.title);
  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Calculate summary stats matching the UI header
  const totalQuestions = items.length;
  const hotsCount = items.filter(i => i.cognitiveCategory === "HOTS").length;
  const hotsPercent = totalQuestions > 0 ? Math.round((hotsCount / totalQuestions) * 100) : 0;
  const easyCount = items.filter(i => i.difficulty === "Mudah").length;
  const medCount = items.filter(i => i.difficulty === "Sedang").length;
  const hardCount = items.filter(i => i.difficulty === "Sulit").length;

  const htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Kisi-Kisi Asesmen Siswa - ${set.subject}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 841.9pt 595.3pt; /* A4 Landscape */
      mso-page-orientation: landscape;
      margin: 25.0pt 25.0pt 25.0pt 25.0pt;
      mso-header-margin: 15.0pt;
      mso-footer-margin: 15.0pt;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: 'Calibri', 'Times New Roman', 'Segoe UI', Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #0f172a;
      margin: 0;
      padding: 0;
    }
    .kop-wrapper {
      text-align: center;
      margin-bottom: 10pt;
      border-bottom: 2pt double #0f172a;
      padding-bottom: 6pt;
    }
    .kop-title {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
    }
    .kop-subtitle {
      font-size: 15pt;
      font-weight: 900;
      color: #1e3a8a;
      margin: 3pt 0;
      text-transform: uppercase;
    }
    .kop-meta {
      font-size: 11pt;
      color: #475569;
      margin: 0;
      font-weight: 600;
    }
    table.meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10pt;
      background-color: #f8fafc;
      border: 1pt solid #cbd5e1;
    }
    table.meta-table td {
      padding: 5pt 7pt;
      font-size: 12pt;
      border: 0.5pt solid #e2e8f0;
      color: #1e293b;
      vertical-align: middle;
    }
    .stats-bar {
      margin-bottom: 10pt;
      padding: 5pt 9pt;
      background-color: #f1f5f9;
      border: 1pt solid #cbd5e1;
      font-size: 11.5pt;
      font-weight: bold;
      color: #334155;
    }
    table.matrix-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 12pt;
      border: 1pt solid #cbd5e1;
      page-break-inside: auto;
    }
    table.matrix-table thead {
      display: table-header-group;
    }
    table.matrix-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table.matrix-table th {
      background-color: #0f172a;
      color: #ffffff;
      padding: 6.5pt 4pt;
      font-size: 12pt;
      font-weight: 800;
      text-align: center;
      vertical-align: middle;
      border: 0.75pt solid #334155;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
    }
    table.matrix-table td {
      padding: 5.5pt 6pt;
      font-size: 12pt;
      border: 0.5pt solid #cbd5e1;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .center {
      text-align: center;
    }
    .badge-lots {
      display: inline-block;
      padding: 2pt 5pt;
      background-color: #dbeafe;
      color: #1e40af;
      border: 0.5pt solid #bfdbfe;
      font-size: 10pt;
      font-weight: bold;
      border-radius: 3pt;
      margin-top: 2pt;
    }
    .badge-mots {
      display: inline-block;
      padding: 2pt 5pt;
      background-color: #e0f2fe;
      color: #0369a1;
      border: 0.5pt solid #bae6fd;
      font-size: 10pt;
      font-weight: bold;
      border-radius: 3pt;
      margin-top: 2pt;
    }
    .badge-hots {
      display: inline-block;
      padding: 2pt 5pt;
      background-color: #f3e8ff;
      color: #6b21a8;
      border: 0.5pt solid #d8b4fe;
      font-size: 10pt;
      font-weight: bold;
      border-radius: 3pt;
      margin-top: 2pt;
    }
    .badge-mudah {
      display: inline-block;
      padding: 2pt 6pt;
      background-color: #ecfdf5;
      color: #047857;
      border: 0.5pt solid #a7f3d0;
      font-weight: bold;
      font-size: 11pt;
      border-radius: 3pt;
    }
    .badge-sedang {
      display: inline-block;
      padding: 2pt 6pt;
      background-color: #fffbeb;
      color: #b45309;
      border: 0.5pt solid #fde68a;
      font-weight: bold;
      font-size: 11pt;
      border-radius: 3pt;
    }
    .badge-sulit {
      display: inline-block;
      padding: 2pt 6pt;
      background-color: #fff1f2;
      color: #be123c;
      border: 0.5pt solid #fecdd3;
      font-weight: bold;
      font-size: 11pt;
      border-radius: 3pt;
    }
    .focus-box {
      font-size: 11.5pt;
      color: #334155;
      background-color: #f8fafc;
      padding: 4pt 6pt;
      border-left: 3pt solid #2563eb;
      border-top: 0.5pt solid #e2e8f0;
      border-right: 0.5pt solid #e2e8f0;
      border-bottom: 0.5pt solid #e2e8f0;
      margin-top: 4pt;
      line-height: 1.35;
    }
    .study-box {
      margin-top: 10pt;
      padding: 7pt 10pt;
      background-color: #ecfdf5;
      border: 1pt solid #a7f3d0;
      border-radius: 4pt;
    }
    .study-box-title {
      font-size: 12pt;
      font-weight: bold;
      color: #065f46;
      margin: 0 0 3pt 0;
      text-transform: uppercase;
    }
    .study-box-text {
      font-size: 12pt;
      color: #047857;
      margin: 2pt 0;
      line-height: 1.4;
    }
    table.sign-table {
      width: 100%;
      margin-top: 16pt;
      border-collapse: collapse;
    }
    table.sign-table td {
      width: 50%;
      text-align: center;
      font-size: 12pt;
      vertical-align: top;
      line-height: 1.4;
      border: none;
    }
  </style>
</head>
<body>
<div class="Section1">
  <div class="kop-wrapper">
    <div class="kop-title">${settings.schoolName.toUpperCase()}</div>
    <div class="kop-subtitle">KISI-KISI ASESMEN / UJIAN & PANDUAN BELAJAR SISWA</div>
    <div class="kop-meta">Tahun Pelajaran ${settings.academicYear || "2026/2027"} • Kurikulum Merdeka & Kurikulum Nasional</div>
  </div>

  <table class="meta-table">
    <tr>
      <td width="15%"><strong>Mata Pelajaran</strong></td>
      <td width="35%">: ${set.subject}</td>
      <td width="15%"><strong>Kelas / Sem</strong></td>
      <td width="35%">: ${formatGradeDisplay(set.grade)} / Semester ${set.semester || "1"}</td>
    </tr>
    <tr>
      <td><strong>Materi Pokok</strong></td>
      <td>: ${set.material}</td>
      <td><strong>Total Skor</strong></td>
      <td>: ${set.totalPoints || items.length} Poin</td>
    </tr>
    <tr>
      <td><strong>Bentuk Soal</strong></td>
      <td>: Pilihan Ganda (${items.length} Butir)</td>
      <td><strong>Penyusun</strong></td>
      <td>: ${settings.teacherName || "Guru Pengampu, S.Pd."}</td>
    </tr>
  </table>

  <div class="stats-bar">
    <strong>Distribusi Kognitif:</strong> HOTS: ${hotsCount} Soal (${hotsPercent}%) | LOTS/MOTS: ${totalQuestions - hotsCount} Soal (${100 - hotsPercent}%) &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Kesukaran:</strong> Mudah: ${easyCount} • Sedang: ${medCount} • Sulit: ${hardCount}
  </div>

  <table class="matrix-table">
    <thead>
      <tr>
        <th style="width: 5%;">No</th>
        <th style="width: 17%;">Materi Pokok</th>
        <th style="width: 48%;">Indikator Soal & Panduan Belajar Siswa</th>
        <th style="width: 12%;">Level Kognitif</th>
        <th style="width: 9%;">Kesukaran</th>
        <th style="width: 5%;">Bentuk</th>
        <th style="width: 4%;">Skor</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, idx) => `
        <tr style="background-color: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
          <td class="center" style="font-weight: bold; color: #64748b; background-color: #f8fafc; font-size: 12pt;">${item.no}</td>
          <td style="font-weight: bold; color: #1e293b; vertical-align: top; font-size: 12pt;">${item.material}</td>
          <td style="vertical-align: top;">
            <div style="font-weight: 700; color: #0f172a; line-height: 1.4; font-size: 12pt;">${item.indicator}</div>
            <div class="focus-box">
              <strong style="color: #1d4ed8;">Panduan Belajar:</strong> ${item.studyTip}
            </div>
          </td>
          <td class="center" style="vertical-align: middle;">
            <strong style="color: #0f172a; font-size: 12pt; display: block;">${item.cognitiveLevel}</strong>
            <span class="${item.cognitiveCategory === 'HOTS' ? 'badge-hots' : item.cognitiveCategory === 'MOTS' ? 'badge-mots' : 'badge-lots'}">
              ${item.cognitiveCategory}
            </span>
          </td>
          <td class="center" style="vertical-align: middle;">
            <span class="${
              item.difficulty === 'Mudah' ? 'badge-mudah' : item.difficulty === 'Sedang' ? 'badge-sedang' : 'badge-sulit'
            }">
              ${item.difficulty}
            </span>
          </td>
          <td class="center" style="color: #475569; font-weight: 600; vertical-align: middle; font-size: 12pt;">PG</td>
          <td class="center" style="font-weight: bold; color: #334155; vertical-align: middle; font-size: 12pt;">${item.points}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="study-box">
    <div class="study-box-title">PETUNJUK BELAJAR MANDIRI SISWA:</div>
    <div class="study-box-text">1. Pelajari target indikator dan panduan belajar pada tabel kisi-kisi di atas secara runtut sebelum hari asesmen.</div>
    <div class="study-box-text">2. Soal bertanda <strong>HOTS (C4 - C6)</strong> menguji analisis kasus dan pemikiran kritis; soal <strong>LOTS/MOTS (C1 - C3)</strong> menguji pemahaman konsep dasar.</div>
    <div class="study-box-text">3. Nomor urut butir soal pada lembar ujian sebenarnya tidak dicantumkan pada kisi-kisi karena akan diacak oleh sistem.</div>
  </div>

  ${settings.enableSignatures ? `
  <table class="sign-table">
    <tr>
      <td>
        Mengetahui,<br/>
        Kepala Satuan Pendidikan
        <br/><br/><br/>
        <strong><u>( ${settings.principalName || "Kepala Sekolah, M.Pd."} )</u></strong><br/>
        NIP. ${settings.principalNip || "................................................"}
      </td>
      <td>
        ${settings.schoolCity || "Kota"}, ${currentDate}<br/>
        Guru Mata Pelajaran
        <br/><br/><br/>
        <strong><u>( ${settings.teacherName || "Guru Pengampu, S.Pd."} )</u></strong><br/>
        NIP. ${settings.teacherNip || "................................................"}
      </td>
    </tr>
  </table>` : ""}
</div>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Kisi_Kisi_Siswa_${(set.subject || "Ujian").replace(/\s+/g, "_")}_Kelas_${set.grade || "X"}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate official Indonesian Examination Matrix (Kisi-Kisi) PDF using jsPDF + jspdf-autotable (A4 Landscape)
 * High-precision vector formatting matching the UI design: Slate-900 headers, custom badge color-coding,
 * exact column proportions, zero text overflow, no corrupt Unicode characters, and synchronized signatures.
 */
export function exportKisiKisiPDF(set: QuestionSet): void {
  const settings = getAppSettings();
  const items = getFormattedKisiKisiItems(set);
  const cleanTitle = cleanExamTitle(set.title);
  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Landscape A4: 297mm x 210mm
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 273mm
  let currentY = 11;

  // 1. HEADER / KOP SURAT
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(settings.schoolName.toUpperCase(), pageWidth / 2, currentY, { align: "center" });
  currentY += 4.5;

  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138); // Blue 900
  doc.text("KISI-KISI ASESMEN / UJIAN & PANDUAN BELAJAR SISWA", pageWidth / 2, currentY, { align: "center" });
  currentY += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tahun Pelajaran ${settings.academicYear || "2026/2027"} • Kurikulum Merdeka & Kurikulum 2013`, pageWidth / 2, currentY, { align: "center" });
  currentY += 3;

  // Double divider line
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 0.6;
  doc.setLineWidth(0.2);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 3;

  // 2. METADATA INFORMATION BOX (Matching UI Grid)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, currentY, contentWidth, 12.5, 1.2, 1.2, "FD");

  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.text("Mata Pelajaran :", margin + 3, currentY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`${set.subject}`, margin + 25, currentY + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Kelas / Sem :", margin + 95, currentY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`${formatGradeDisplay(set.grade)} / Semester ${set.semester || "1"}`, margin + 114, currentY + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Bentuk Soal :", margin + 185, currentY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`Pilihan Ganda (${items.length} Butir)`, margin + 204, currentY + 4);

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.text("Materi Pokok :", margin + 3, currentY + 9);
  doc.setFont("helvetica", "normal");
  const matText = doc.splitTextToSize(set.material || cleanTitle, 65);
  doc.text(matText[0] || set.material, margin + 25, currentY + 9);

  doc.setFont("helvetica", "bold");
  doc.text("Total Skor :", margin + 95, currentY + 9);
  doc.setFont("helvetica", "normal");
  doc.text(`${set.totalPoints || items.length} Poin`, margin + 114, currentY + 9);

  doc.setFont("helvetica", "bold");
  doc.text("Penyusun :", margin + 185, currentY + 9);
  doc.setFont("helvetica", "normal");
  doc.text(`${settings.teacherName || "Guru Pengampu, S.Pd."}`, margin + 204, currentY + 9);

  currentY += 14.5;

  // 3. TABLE MATRIX VIA JSPDF-AUTOTABLE (Slate-900 Header, zero text overflow, flexible across multiple pages)
  const tableHeaders = [
    [
      { content: "No", styles: { halign: "center" as const } },
      { content: "Materi Pokok", styles: { halign: "left" as const } },
      { content: "Indikator Soal & Panduan Belajar Siswa", styles: { halign: "left" as const } },
      { content: "Level Kognitif", styles: { halign: "center" as const } },
      { content: "Kesukaran", styles: { halign: "center" as const } },
      { content: "Bentuk", styles: { halign: "center" as const } },
      { content: "Skor", styles: { halign: "center" as const } },
    ],
  ];

  // Helper to sanitize any strange unicode/emoji to prevent jsPDF font corruption
  const cleanStr = (val: string): string => {
    if (!val) return "";
    return val
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, "")
      .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, "")
      .trim();
  };

  // Prepare table data with clean, well-formatted text (7 columns)
  const tableData = items.map((item) => [
    item.no.toString(),
    cleanStr(item.material),
    `${cleanStr(item.indicator)}\n\nPanduan Belajar: ${cleanStr(item.studyTip)}`,
    `${item.cognitiveLevel}\n[${item.cognitiveCategory}]`,
    item.difficulty,
    "PG",
    item.points.toString(),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: tableHeaders,
    body: tableData,
    theme: "grid",
    rowPageBreak: "avoid",       // CRITICAL: Avoid splitting individual question rows across pages!
    showHead: "everyPage",        // CRITICAL: Repeat headers at the top of every subsequent page!
    pageBreak: "auto",
    margin: { left: margin, right: margin, bottom: 14, top: 12 },
    styles: {
      font: "helvetica",
      fontSize: 7,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225], // Slate 300
      lineWidth: 0.2,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.2, right: 2.2 },
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900 matching UI exactly
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
      minCellHeight: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center", fontStyle: "bold", textColor: [100, 116, 139] },
      1: { cellWidth: 42, fontStyle: "bold", textColor: [30, 41, 59] },
      2: { cellWidth: 142 }, // Generous width for Indicator and Study Tip
      3: { cellWidth: 23, halign: "center" },
      4: { cellWidth: 23, halign: "center" },
      5: { cellWidth: 16, halign: "center", textColor: [71, 85, 105] },
      6: { cellWidth: 18, halign: "center", fontStyle: "bold", textColor: [51, 65, 85] },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const item = items[data.row.index];
        if (!item) return;

        // Level Kognitif styling (Col 3)
        if (data.column.index === 3) {
          data.cell.styles.halign = "center";
          data.cell.styles.valign = "middle";
          data.cell.styles.fontStyle = "bold";
          if (item.cognitiveCategory === "HOTS") {
            data.cell.styles.textColor = [126, 34, 206]; // Purple
          } else if (item.cognitiveCategory === "MOTS") {
            data.cell.styles.textColor = [3, 105, 161];  // Sky
          } else {
            data.cell.styles.textColor = [30, 64, 175];  // Blue
          }
        }

        // Kesukaran styling (Col 4)
        if (data.column.index === 4) {
          data.cell.styles.halign = "center";
          data.cell.styles.valign = "middle";
          data.cell.styles.fontStyle = "bold";
          if (item.difficulty === "Mudah") {
            data.cell.styles.textColor = [4, 120, 87];   // Emerald
          } else if (item.difficulty === "Sedang") {
            data.cell.styles.textColor = [180, 83, 9];   // Amber
          } else {
            data.cell.styles.textColor = [190, 18, 60];  // Rose
          }
        }

        // Skor styling (Col 6)
        if (data.column.index === 6) {
          data.cell.styles.halign = "center";
          data.cell.styles.valign = "middle";
        }

        // Vertical centering for metadata columns (0: No, 5: Bentuk, 6: Skor)
        if (data.column.index === 0 || data.column.index === 5 || data.column.index === 6) {
          data.cell.styles.valign = "middle";
        }
      }
    },
  });

  // 4. AFTER TABLE: PETUNJUK & SIGNATURE BLOCK
  // Get final Y from autotable
  const lastTableY = (doc as any).lastAutoTable?.finalY || currentY + 50;
  let endY = lastTableY + 4;

  // If remaining page height is less than 38mm, add a clean new page for notes & signatures
  if (endY + 38 > pageHeight - margin) {
    doc.addPage();
    endY = 12;
  }

  // Petunjuk Belajar Mandiri Box (Emerald styling matching UI - NO corrupted unicode characters)
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.setDrawColor(167, 243, 208); // Emerald 200
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, endY, contentWidth, 12.5, 1.2, 1.2, "FD");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(6, 95, 70); // Emerald 800
  doc.text("PETUNJUK BELAJAR MANDIRI SISWA:", margin + 3, endY + 3.6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(4, 120, 87); // Emerald 700
  doc.text("1. Pelajari indikator soal dan panduan belajar di atas secara runtut sebagai persiapan sebelum asesmen berlangsung.", margin + 3, endY + 6.8);
  doc.text("2. Soal HOTS (C4-C6) melatih ketelitian analisis dan logika; soal LOTS/MOTS (C1-C3) menguji konsep dasar serta rumus.", margin + 3, endY + 9.8);

  endY += 16.5;

  // 5. SIGN-OFF BLOCK (Synchronized with Settings - Hanya jika diaktifkan)
  if (settings.enableSignatures) {
    // Check if sign-off block fits
    if (endY + 22 > pageHeight - margin) {
      doc.addPage();
      endY = 12;
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);

    const leftSignX = margin + 40;
    const rightSignX = pageWidth - margin - 50;

    doc.text("Mengetahui,", leftSignX, endY, { align: "center" });
    doc.text(`${settings.schoolCity || "Kota"}, ${currentDate}`, rightSignX, endY, { align: "center" });
    endY += 3.8;

    doc.text("Kepala Satuan Pendidikan", leftSignX, endY, { align: "center" });
    doc.text("Guru Mata Pelajaran", rightSignX, endY, { align: "center" });

    endY += 14;
    doc.setFont("helvetica", "bold");
    doc.text(`( ${settings.principalName || "Kepala Sekolah, M.Pd."} )`, leftSignX, endY, { align: "center" });
    doc.text(`( ${settings.teacherName || "Guru Pengampu, S.Pd."} )`, rightSignX, endY, { align: "center" });
    endY += 3.6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`NIP. ${settings.principalNip || "................................................"}`, leftSignX, endY, { align: "center" });
    doc.text(`NIP. ${settings.teacherNip || "................................................"}`, rightSignX, endY, { align: "center" });
  }

  // 6. FOOTER WITH PAGE NUMBERS ACROSS ALL PAGES
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Dokumen Kisi-Kisi Resmi • Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: "right" });
    doc.text(`${settings.schoolName} • ${set.subject} Kelas ${set.grade}`, margin, pageHeight - 4, { align: "left" });
  }

  // Save PDF
  const filename = `Kisi_Kisi_Siswa_${(set.subject || "Ujian").replace(/\s+/g, "_")}_Kelas_${set.grade || "X"}.pdf`;
  doc.save(filename);
}
