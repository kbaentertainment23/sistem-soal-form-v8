/**
 * Utility functions for smart grade parsing and class matching
 */

/**
 * Removes any redundant "Kelas " / "kelas " prefix from a grade string.
 * Example: "Kelas VII" -> "VII", "kelas 7" -> "7", "VIII" -> "VIII"
 */
export function cleanGrade(grade?: string): string {
  if (!grade) return "";
  return grade.trim().replace(/^(kelas\s*)+/i, "").trim();
}

/**
 * Returns a standardized display label for grade.
 * Example: "VII" -> "Kelas VII", "Kelas VII" -> "Kelas VII", "7" -> "Kelas 7"
 */
export function formatGradeDisplay(grade?: string): string {
  const cleaned = cleanGrade(grade);
  return cleaned ? `Kelas ${cleaned}` : "";
}

/**
 * Cleans duplicate "Kelas Kelas" from titles or strings.
 * Example: "Soal IPA Kelas Kelas VII" -> "Soal IPA Kelas VII"
 */
export function cleanExamTitle(title?: string): string {
  if (!title) return "";
  return title
    .replace(/kelas\s+kelas\s+/gi, "Kelas ")
    .replace(/kelas\s+kelas\b/gi, "Kelas")
    .trim();
}

const ROMAN_TO_ARABIC: Record<string, string> = {
  "I": "1",
  "II": "2",
  "III": "3",
  "IV": "4",
  "V": "5",
  "VI": "6",
  "VII": "7",
  "VIII": "8",
  "IX": "9",
  "X": "10",
  "XI": "11",
  "XII": "12"
};

const ARABIC_TO_ROMAN: Record<string, string> = {
  "1": "I",
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  "6": "VI",
  "7": "VII",
  "8": "VIII",
  "9": "IX",
  "10": "X",
  "11": "XI",
  "12": "XII"
};

/**
 * Returns all equivalent tokens for a given grade string.
 * Example for "VIII": ["VIII", "8"]
 * Example for "7": ["VII", "7"]
 * Example for "Kelas 10": ["X", "10"]
 */
export function getGradeTokens(grade: string): string[] {
  if (!grade) return [];
  const clean = grade.trim().toUpperCase().replace(/^KELAS\s*/i, "").trim();
  const tokens = new Set<string>();
  
  if (clean) {
    tokens.add(clean);
  }

  // Check Roman to Arabic
  if (ROMAN_TO_ARABIC[clean]) {
    tokens.add(ROMAN_TO_ARABIC[clean]);
  }

  // Check Arabic to Roman
  if (ARABIC_TO_ROMAN[clean]) {
    tokens.add(ARABIC_TO_ROMAN[clean]);
  }

  // Extract digits if mixed like "7A" -> "7", "VII A" -> "VII"
  const digitMatch = clean.match(/\b([1-9]|1[0-2])\b/);
  if (digitMatch && digitMatch[1]) {
    tokens.add(digitMatch[1]);
    if (ARABIC_TO_ROMAN[digitMatch[1]]) {
      tokens.add(ARABIC_TO_ROMAN[digitMatch[1]]);
    }
  }

  const romanMatch = clean.match(/\b(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/);
  if (romanMatch && romanMatch[1]) {
    tokens.add(romanMatch[1]);
    if (ROMAN_TO_ARABIC[romanMatch[1]]) {
      tokens.add(ROMAN_TO_ARABIC[romanMatch[1]]);
    }
  }

  return Array.from(tokens);
}

/**
 * Checks if a class name matches a specific grade.
 * E.g., className "VIII A" matches grade "8" or "VIII".
 * E.g., className "7.1" matches grade "VII" or "7".
 * E.g., className "X MIPA 1" matches grade "10" or "X".
 */
export function isClassMatchingGrade(className: string, grade: string): boolean {
  if (!grade || !className) return true;
  const gradeTokens = getGradeTokens(grade);
  if (gradeTokens.length === 0) return true;

  const upperClass = className.trim().toUpperCase();

  // Check each token
  for (const token of gradeTokens) {
    // Exact word boundary or prefix match (e.g., "VIII A", "VIII-A", "8A", "8-A", "8.1", "Kelas 8")
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Pattern 1: Token as distinct word (e.g., "VII A", "Kelas 7", "VII - 1")
    const wordPattern = new RegExp(`(^|\\s|[._\\/-])${escaped}($|\\s|[._\\/-])`, 'i');
    if (wordPattern.test(upperClass)) {
      return true;
    }

    // Pattern 2: Token attached to a letter suffix (e.g., "7A", "8B", "VIIA", "VIIIB", "10A", "XA")
    const attachedPattern = new RegExp(`(^|\\s|[._\\/-])${escaped}[A-Z]`, 'i');
    if (attachedPattern.test(upperClass)) {
      return true;
    }

    // Pattern 3: Simple string contains if token is unique like "VIII" or "VII" or "XII"
    if (token.length >= 3 && upperClass.includes(token)) {
      return true;
    }
  }

  return false;
}

/**
 * Filters a full class list down to only those matching the target grade.
 */
export function filterClassesByGrade(classList: string[], grade: string): string[] {
  if (!grade || !classList || classList.length === 0) {
    return classList || [];
  }
  return classList.filter(cls => isClassMatchingGrade(cls, grade));
}
