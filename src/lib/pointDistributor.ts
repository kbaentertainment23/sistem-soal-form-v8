import type { Question } from "../types.js";

/**
 * Bobot proporsional kesulitan soal:
 * - Mudah (C1, C2) = 1.0
 * - Sedang (C3, C4) = 1.5
 * - Sulit / HOTS (C5, C6) = 2.0
 */
export function getDifficultyWeight(difficulty?: string, cognitiveLevel?: string): number {
  const diff = (difficulty || "").toLowerCase();
  const cog = (cognitiveLevel || "").toUpperCase();

  if (diff.includes("sulit") || diff.includes("hots") || ["C5", "C6"].includes(cog)) {
    return 2.0;
  }
  if (diff.includes("sedang") || ["C3", "C4"].includes(cog)) {
    return 1.5;
  }
  return 1.0;
}

/**
 * Mendistribusikan poin bilangan bulat (integer) ke daftar soal terpilih
 * dengan bobot tingkat kesulitan, sehingga total poin tepat bernilai `targetTotal` (default: 100).
 *
 * Algoritma:
 * 1. Hitung bobot setiap soal (Mudah: 1, Sedang: 1.5, Sulit: 2).
 * 2. Hitung porsi poin proporsional: r_i = (w_i / total_bobot) * targetTotal.
 * 3. Berikan floor integer minimal 1: base_i = max(1, floor(r_i)).
 * 4. Hitung sisa poin: remainder = targetTotal - sum(base_i).
 * 5. Bagikan sisa poin satu demi satu kepada soal dengan sisa desimal terbesar (prioritas soal lebih sulit jika desimal sama)
 *    hingga total tepat 100.
 */
export function calculateDifficultyWeightedPoints(
  questions: Question[],
  targetTotal: number = 100
): number[] {
  const n = questions.length;
  if (n === 0) return [];
  if (n >= targetTotal) {
    // Jika jumlah soal >= target, berikan minimal 1 poin per soal
    return new Array(n).fill(1);
  }

  // 1. Hitung bobot per soal
  const weights = questions.map((q) =>
    getDifficultyWeight(q.difficulty, q.cognitiveLevel)
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // 2. Hitung poin ideal dan floor base
  const items = questions.map((q, idx) => {
    const w = weights[idx];
    const raw = (w / totalWeight) * targetTotal;
    const base = Math.max(1, Math.floor(raw));
    const remainderFraction = raw - base;
    return {
      index: idx,
      weight: w,
      raw,
      base,
      remainderFraction,
    };
  });

  let currentSum = items.reduce((sum, it) => sum + it.base, 0);
  let remainder = targetTotal - currentSum;

  if (remainder > 0) {
    // Urutkan berdasarkan sisa desimal terbesar (jika seri, dahulukan bobot kesulitan tertinggi)
    const sortedIndices = [...items]
      .sort((a, b) => {
        if (Math.abs(b.remainderFraction - a.remainderFraction) > 0.00001) {
          return b.remainderFraction - a.remainderFraction;
        }
        return b.weight - a.weight;
      })
      .map((it) => it.index);

    for (let i = 0; i < remainder; i++) {
      const targetIdx = sortedIndices[i % n];
      items[targetIdx].base += 1;
    }
  } else if (remainder < 0) {
    // Jika karena clamp max(1) melebihi 100, kurangi dari poin terbesar
    const sortedByPoints = [...items]
      .sort((a, b) => b.base - a.base)
      .map((it) => it.index);

    let toReduce = Math.abs(remainder);
    for (let i = 0; i < sortedByPoints.length && toReduce > 0; i++) {
      const targetIdx = sortedByPoints[i];
      if (items[targetIdx].base > 1) {
        items[targetIdx].base -= 1;
        toReduce--;
      }
    }
  }

  return items.map((it) => it.base);
}

/**
 * Menerapkan pembagian poin 100 secara otomatis ke butir soal yang dipilih.
 * Soal yang tidak terpilih tetap mempertahankan poin proporsional dasar.
 */
export function applyAutoPointsToQuestionSet(
  allQuestions: Question[],
  selectedNumbers: Set<number> | number[],
  targetTotal: number = 100
): Question[] {
  const selectedSet = selectedNumbers instanceof Set ? selectedNumbers : new Set(selectedNumbers);
  const selectedQuestions = allQuestions.filter((q) => selectedSet.has(q.number));

  if (selectedQuestions.length === 0) {
    // Jika tidak ada yang dipilih, hitung untuk seluruh soal
    const allPoints = calculateDifficultyWeightedPoints(allQuestions, targetTotal);
    return allQuestions.map((q, idx) => ({
      ...q,
      points: allPoints[idx],
    }));
  }

  // Hitung poin khusus untuk soal yang dipilih agar totalnya persis 100
  const distributedPoints = calculateDifficultyWeightedPoints(selectedQuestions, targetTotal);

  // Buat map number -> points
  const pointsMap = new Map<number, number>();
  selectedQuestions.forEach((q, idx) => {
    pointsMap.set(q.number, distributedPoints[idx]);
  });

  // Untuk soal yang tidak dipilih, beri bobot standar proporsional
  const unselectedQuestions = allQuestions.filter((q) => !selectedSet.has(q.number));
  const fallbackPoints = calculateDifficultyWeightedPoints(
    unselectedQuestions.length > 0 ? unselectedQuestions : allQuestions,
    targetTotal
  );
  unselectedQuestions.forEach((q, idx) => {
    pointsMap.set(q.number, fallbackPoints[idx] || 2);
  });

  return allQuestions.map((q) => ({
    ...q,
    points: pointsMap.get(q.number) ?? (q.points || 2),
    isSelected: selectedSet.has(q.number),
  }));
}
