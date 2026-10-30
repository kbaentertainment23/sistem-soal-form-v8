import type { Question } from "../types.js";

/**
 * Utility for detecting duplicate and near-duplicate exam questions.
 * Handles Indonesian question phrasing, prefixes, and semantic overlap.
 */

// Common introductory clauses in Indonesian exam questions
const INTRO_PREFIX_REGEX = /^(perhatikan|cermati|amati|simaklah|berdasarkan|pada|dalam|menurut)\s+[^:?!.\n]+[:.]\s*/gi;

// Common question starter phrases that do not contribute to topic uniqueness
const FILLER_PHRASE_REGEX = /\b(berikut\s+ini\s+yang\s+merupakan|berikut\s+ini\s+yang|berikut\s+yang\s+merupakan|berikut\s+yang|di\s+bawah\s+ini\s+yang|manakah\s+yang\s+merupakan|manakah\s+yang|pernyataan\s+yang\s+benar\s+adalah|pernyataan\s+yang\s+tepat|hal\s+yang\s+merupakan|apa\s+yang\s+dimaksud\s+dengan|faktor\s+yang\s+mempengaruhi|pada\s+dasarnya)\b/gi;

// Indonesian stop words for exam stem comparison
const INDONESIA_STOPWORDS = new Set([
  "yang", "di", "ke", "dari", "ini", "itu", "dan", "atau", "pada", "untuk", "dengan",
  "adalah", "merupakan", "yaitu", "sebagai", "dalam", "bisa", "dapat", "akan", "oleh",
  "antara", "salah", "satu", "apakah", "apa", "bagaimana", "mengapa", "kenapa", "siapa",
  "dimana", "kapan", "manakah", "sebutkan", "jelaskan", "tersebut", "paling", "sangat",
  "lebih", "telah", "sudah", "jika", "karena", "sehingga", "tentang", "terhadap",
  "secara", "suatu", "sebuah", "para", "agar", "supaya", "yaitu", "yakni"
]);

/**
 * Normalizes question stem by removing decorative intros, punctuation, and multiple spaces.
 */
export function normalizeQuestionStem(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(INTRO_PREFIX_REGEX, "")
    .replace(FILLER_PHRASE_REGEX, "")
    .replace(/[^\w\s\d]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts substantive keywords from a question text.
 */
export function getQuestionKeywords(text: string): Set<string> {
  const norm = normalizeQuestionStem(text);
  const words = norm.split(" ").filter((w) => w.length > 2 && !INDONESIA_STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Computes Jaccard similarity index between two keyword sets (0.0 to 1.0).
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks whether two questions are identical or duplicate.
 */
export function checkQuestionsDuplicate(
  q1: any,
  q2: any
): { isDuplicate: boolean; similarity: number; reason?: string } {
  const text1 = (q1?.question || "").trim();
  const text2 = (q2?.question || "").trim();
  if (!text1 || !text2) return { isDuplicate: false, similarity: 0 };

  const norm1 = normalizeQuestionStem(text1);
  const norm2 = normalizeQuestionStem(text2);

  // 1. Exact or near-exact normalized match
  if (norm1 === norm2 && norm1.length >= 6) {
    return {
      isDuplicate: true,
      similarity: 1.0,
      reason: "Teks pertanyaan identik",
    };
  }

  // 2. Substring containment for substantial stems
  if (norm1.length >= 25 && norm2.length >= 25) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return {
        isDuplicate: true,
        similarity: 0.95,
        reason: "Teks pertanyaan mencakup satu sama lain",
      };
    }
  }

  const kw1 = getQuestionKeywords(text1);
  const kw2 = getQuestionKeywords(text2);
  const jaccard = calculateJaccardSimilarity(kw1, kw2);

  // 3. High keyword similarity (>= 62% content-word overlap)
  if (jaccard >= 0.62 && kw1.size >= 3 && kw2.size >= 3) {
    return {
      isDuplicate: true,
      similarity: jaccard,
      reason: `Inti pertanyaan dan konsep serupa (${Math.round(jaccard * 100)}% kemiripan kata kunci)`,
    };
  }

  // Helper to extract correct answer text
  const getAnswerText = (q: any): string => {
    if (!q?.options || !Array.isArray(q.options)) return "";
    const correctOpt = q.options.find((o: any) => o.label === q.correctAnswer);
    return correctOpt ? (correctOpt.text || "").toLowerCase().trim() : "";
  };

  const ans1 = getAnswerText(q1);
  const ans2 = getAnswerText(q2);

  // 4. Identical correct answer text + Moderate question overlap (>= 40%)
  if (ans1 && ans2 && ans1.length > 2 && (ans1 === ans2 || ans1.includes(ans2) || ans2.includes(ans1))) {
    if (jaccard >= 0.40) {
      return {
        isDuplicate: true,
        similarity: jaccard,
        reason: "Kunci jawaban identik dan topik pertanyaan bertumpuk",
      };
    }
  }

  // 5. Option list overlap (>= 3 options identical with question overlap)
  if (Array.isArray(q1?.options) && Array.isArray(q2?.options) && q1.options.length > 0) {
    const opts1 = new Set(
      q1.options.map((o: any) => (o.text || "").toLowerCase().trim()).filter(Boolean)
    );
    const opts2 = new Set(
      q2.options.map((o: any) => (o.text || "").toLowerCase().trim()).filter(Boolean)
    );
    let matchingOpts = 0;
    for (const opt of opts1) {
      if (opts2.has(opt)) matchingOpts++;
    }
    if (matchingOpts >= 3 && jaccard >= 0.35) {
      return {
        isDuplicate: true,
        similarity: 0.85,
        reason: "Pilihan opsi jawaban dan konsep soal identik",
      };
    }
  }

  return { isDuplicate: false, similarity: jaccard };
}

/**
 * Scans a list of questions and finds all duplicate pairs.
 */
export function findDuplicateQuestionPairs(questions: Question[]): {
  indexA: number;
  indexB: number;
  numA: number;
  numB: number;
  reason: string;
}[] {
  const duplicates: {
    indexA: number;
    indexB: number;
    numA: number;
    numB: number;
    reason: string;
  }[] = [];

  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const qA = questions[i];
      const qB = questions[j];
      const check = checkQuestionsDuplicate(qA, qB);
      if (check.isDuplicate) {
        duplicates.push({
          indexA: i,
          indexB: j,
          numA: qA.number || i + 1,
          numB: qB.number || j + 1,
          reason: check.reason || "Pertanyaan serupa",
        });
      }
    }
  }

  return duplicates;
}

/**
 * Filters a raw list of questions, retaining only strictly unique questions.
 */
export function filterUniqueQuestions(rawQuestions: any[]): {
  unique: any[];
  duplicates: { question: any; duplicateOfIndex: number; reason: string }[];
} {
  const unique: any[] = [];
  const duplicates: { question: any; duplicateOfIndex: number; reason: string }[] = [];

  for (const q of rawQuestions) {
    let dupFound = false;
    for (let uIdx = 0; uIdx < unique.length; uIdx++) {
      const check = checkQuestionsDuplicate(q, unique[uIdx]);
      if (check.isDuplicate) {
        duplicates.push({
          question: q,
          duplicateOfIndex: uIdx,
          reason: check.reason || "Duplikat",
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
