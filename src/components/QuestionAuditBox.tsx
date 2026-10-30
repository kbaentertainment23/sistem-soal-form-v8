import React, { useState } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Wand2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Scale, 
  Flame, 
  Brain, 
  MessageSquareWarning,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import type { QuestionAuditItem, QuestionAuditIssue, IssueCategory } from "../types.js";

interface QuestionAuditBoxProps {
  auditItem: QuestionAuditItem;
  isApplied: boolean;
  onApplyRevision: () => void;
}

export const QuestionAuditBox: React.FC<QuestionAuditBoxProps> = ({
  auditItem,
  isApplied,
  onApplyRevision,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { issues, hasIssue, improvedQuestion, questionNumber } = auditItem;

  if (!hasIssue && issues.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Kaidah Asesmen Terverifikasi (Distraktor & Kunci Seimbang)</span>
      </div>
    );
  }

  const getCategoryMeta = (cat: IssueCategory) => {
    switch (cat) {
      case "distractor_weak":
        return {
          icon: <Scale className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
          badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
        };
      case "longest_key":
        return {
          icon: <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
          badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        };
      case "hots_mismatch":
        return {
          icon: <Brain className="w-3.5 h-3.5 text-purple-600 shrink-0" />,
          badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
        };
      case "ambiguous_or_negative":
        return {
          icon: <MessageSquareWarning className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
          badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
        };
      default:
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-slate-600 shrink-0" />,
          badgeClass: "bg-slate-50 text-slate-800 border-slate-200",
        };
    }
  };

  return (
    <div className={`rounded-2xl p-4 border transition-all space-y-3 ${
      isApplied 
        ? "bg-emerald-50/70 border-emerald-200" 
        : "bg-amber-50/60 border-amber-200/90 shadow-2xs"
    }`}>
      {/* Box Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-slate-800">
            {isApplied ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>Audit Pedagogis:</span>
          </div>

          {issues.map((iss, iIdx) => {
            const meta = getCategoryMeta(iss.category);
            return (
              <span
                key={iIdx}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}
              >
                {meta.icon}
                <span>{iss.label}</span>
              </span>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {improvedQuestion && !isApplied && (
            <button
              type="button"
              id={`btn-apply-ai-revision-${questionNumber}`}
              onClick={onApplyRevision}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              title="Terapkan perbaikan kata, opsi seimbang, dan kunci jawaban dari AI"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-300" />
              <span>🪄 Terapkan Revisi AI</span>
            </button>
          )}

          {isApplied && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider rounded-xl border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>✓ Revisi AI Diterapkan</span>
            </span>
          )}

          {improvedQuestion && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title={showDetails ? "Sembunyikan pratinjau revisi" : "Lihat pratinjau revisi AI"}
            >
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Issue Descriptions */}
      <div className="space-y-1.5 text-xs text-slate-700">
        {issues.map((iss, iIdx) => (
          <div key={iIdx} className="flex items-start gap-2 bg-white/70 p-2 rounded-xl border border-slate-200/60">
            <span className="text-amber-700 font-bold">•</span>
            <p className="leading-relaxed">{iss.description}</p>
          </div>
        ))}
      </div>

      {/* Detailed Improved Version Preview */}
      {improvedQuestion && (showDetails || !isApplied) && (
        <div className="pt-2 border-t border-amber-200/60 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-purple-900">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Rekomendasi Perbaikan Soal oleh AI:</span>
            </div>
            {improvedQuestion.revisionNote && (
              <span className="text-[11px] text-purple-700 italic font-medium">
                {improvedQuestion.revisionNote}
              </span>
            )}
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-purple-200 space-y-2 text-xs">
            <div className="font-semibold text-slate-900 leading-relaxed">
              {improvedQuestion.question}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {improvedQuestion.options.map((opt) => {
                const isKey = opt.label === improvedQuestion.correctAnswer;
                return (
                  <div
                    key={opt.label}
                    className={`flex items-start gap-2 p-1.5 rounded-lg border text-xs ${
                      isKey 
                        ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-950" 
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${
                      isKey ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                    }`}>
                      {opt.label}
                    </span>
                    <span className="leading-snug">{opt.text}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-1.5">
              <span className="font-bold text-slate-700">Pembahasan Baru:</span>
              <span className="italic">{improvedQuestion.explanation}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
