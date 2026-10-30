export type Difficulty = 'Mudah' | 'Sedang' | 'Sulit';
export type DifficultyOption = Difficulty | 'Campuran';

export type CognitiveLevel = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';
export type EducationLevel = 'SD' | 'SMP' | 'SMA' | 'SMK';

export interface QuestionOption {
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
}

export interface Question {
  id?: string;
  number: number;
  question: string;
  options: QuestionOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  explanation: string;
  difficulty: Difficulty;
  cognitiveLevel: CognitiveLevel;
  indicator: string;
  points: number;
  material?: string;
  imageUrl?: string;
  imageCaption?: string;
  isSelected?: boolean;
}

export interface DifficultyRatio {
  easy: number; // percentage, e.g. 30
  medium: number; // percentage, e.g. 50
  hard: number; // percentage, e.g. 20
}

export type DifficultyDistribution = DifficultyRatio;

export interface GenerateRequest {
  title?: string;
  level?: EducationLevel;
  subject: string;
  grade: string;
  semester: string;
  examType?: string;
  material: string;
  learningObjective?: string;
  kisiKisiText?: string;
  questionCount: number;
  questionType?: 'Pilihan Ganda';
  optionsCount?: 4 | 5; // A-D or A-E
  difficultyType?: DifficultyOption;
  difficultyRatio?: DifficultyRatio;
  cognitiveFocus?: 'HOTS' | 'LOTS' | 'BALANCED';
  includeImages?: boolean;
  imageFrequency?: 'none' | 'some' | 'all';
  onlyFromMaterial: boolean;
  manualMaterial?: string;
  extractedMaterial?: string;
  kisiKisi?: string;
  includeHots?: boolean;
  customPrompt?: string;
  sourceMode?: 'manual' | 'upload' | 'docx-format';
  moduleFocusTopic?: string;
}

export interface QuestionSet {
  id: string;
  userId?: string;
  title: string;
  subject: string;
  grade: string;
  semester: string;
  material: string;
  learningObjective?: string;
  difficultyType?: DifficultyOption;
  difficultyRatio?: DifficultyRatio;
  questionType?: string;
  onlyFromMaterial: boolean;
  questions: Question[];
  createdAt: string;
  updatedAt?: string;
  totalPoints: number;
  authorEmail?: string;
  authorName?: string;
  selectedQuestionNumbers?: number[];
}

export interface GoogleFormHistoryItem {
  id: string;
  userId?: string;
  formId: string;
  title: string;
  subject: string;
  grade: string;
  questionsCount: number;
  totalPoints: number;
  createdAt: string;
  editUrl: string;
  responderUrl: string;
}

export interface GoogleFormCreateRequest {
  title: string;
  description?: string;
  questions: Question[];
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  requireEmail?: boolean;
  subject?: string;
  grade?: string;
  includeIdentitySection?: boolean;
  identityFields?: string[];
  classList?: string[];
}

export interface GoogleFormCreateResult {
  formId: string;
  title: string;
  editUrl: string;
  responderUrl: string;
  questionsCount: number;
  totalPoints: number;
}

export const SUBJECT_PRESETS: string[] = [
  "Informatika",
  "Matematika",
  "Ilmu Pengetahuan Alam (IPA)",
  "Ilmu Pengetahuan Sosial (IPS)",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "Pendidikan Pancasila (PPKn)",
  "Pendidikan Agama Islam (PAI)",
  "Pendidikan Agama Kristen",
  "Pendidikan Jasmani & Kesehatan (PJOK)",
  "Seni Budaya & Prakarya",
  "Fisika",
  "Biologi",
  "Kimia",
  "Ekonomi",
  "Geografi",
  "Sosiologi",
  "Sejarah Indonesia",
  "Bimbingan Konseling"
];

export const GRADE_OPTIONS: Record<EducationLevel, string[]> = {
  SD: ["I", "II", "III", "IV", "V", "VI"],
  SMP: ["VII", "VIII", "IX"],
  SMA: ["X", "XI", "XII"],
  SMK: ["X", "XI", "XII"],
};

// Pedagogical Quality Audit Types
export type IssueSeverity = 'warning' | 'critical' | 'suggestion';
export type IssueCategory = 
  | 'distractor_weak'        // Pilihan pengecoh terlalu lemah / mudah ditebak
  | 'longest_key'            // Kunci jawaban paling panjang / mencolok
  | 'hots_mismatch'          // Klaim HOTS tapi faktanya hafalan (LOTS)
  | 'ambiguous_or_negative'  // Kalimat ambigu, negatif ganda, atau rancu
  | 'grammar_clarity';       // Tata bahasa / stimulus kurang jelas

export interface QuestionAuditIssue {
  category: IssueCategory;
  severity: IssueSeverity;
  label: string;
  description: string;
}

export interface QuestionAuditItem {
  questionNumber: number;
  originalQuestionText: string;
  issues: QuestionAuditIssue[];
  hasIssue: boolean;
  improvedQuestion?: {
    question: string;
    options: QuestionOption[];
    correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
    explanation: string;
    cognitiveLevel?: CognitiveLevel;
    revisionNote: string;
  };
}

export interface ExamAuditResult {
  overallScore: number; // 0 - 100
  ratingLabel: string;  // e.g. "Sangat Baik", "Baik", "Perlu Perbaikan"
  summary: string;
  totalIssuesCount: number;
  distractorIssuesCount: number;
  longestKeyIssuesCount: number;
  hotsMismatchCount: number;
  ambiguityCount: number;
  questionAudits: QuestionAuditItem[];
  auditedAt: string;
}

