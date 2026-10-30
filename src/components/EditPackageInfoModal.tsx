import React, { useState, useEffect } from "react";
import { X, Check, BookOpen, Layers, Sparkles } from "lucide-react";
import type { QuestionSet } from "../types.js";
import { cleanGrade, cleanExamTitle } from "../lib/classUtils.js";

interface EditPackageInfoModalProps {
  isOpen: boolean;
  questionSet: QuestionSet | null;
  onClose: () => void;
  onSave: (updatedMeta: {
    title: string;
    subject: string;
    grade: string;
    semester: string;
    material: string;
  }) => void;
}

export const EditPackageInfoModal: React.FC<EditPackageInfoModalProps> = ({
  isOpen,
  questionSet,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [semester, setSemester] = useState("1");
  const [material, setMaterial] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (questionSet) {
      setTitle(cleanExamTitle(questionSet.title || ""));
      setSubject(questionSet.subject || "");
      setGrade(cleanGrade(questionSet.grade) || "");
      setSemester(questionSet.semester || "1");
      setMaterial(questionSet.material || "");
      setErrorMsg(null);
    }
  }, [questionSet, isOpen]);

  if (!isOpen || !questionSet) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedTitle = cleanExamTitle(title.trim());
    const sanitizedGrade = cleanGrade(grade.trim());

    if (!sanitizedTitle) {
      setErrorMsg("Judul paket soal tidak boleh kosong.");
      return;
    }
    if (!subject.trim()) {
      setErrorMsg("Mata pelajaran tidak boleh kosong.");
      return;
    }
    if (!sanitizedGrade) {
      setErrorMsg("Tingkat kelas tidak boleh kosong.");
      return;
    }
    if (!material.trim()) {
      setErrorMsg("Materi pembelajaran tidak boleh kosong.");
      return;
    }

    onSave({
      title: sanitizedTitle,
      subject: subject.trim(),
      grade: sanitizedGrade,
      semester: semester.trim(),
      material: material.trim(),
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col card-shadow border border-slate-200 overflow-hidden relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                Edit Info Paket Soal
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Sesuaikan judul, mata pelajaran, jenjang kelas, dan materi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 min-h-0">
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200">
              {errorMsg}
            </div>
          )}
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Judul Paket Soal:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Asesmen Formatif Bab 1 IPA"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {/* Subject & Grade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Mata Pelajaran:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Contoh: IPA, Matematika..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Kelas:
                </label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="Contoh: VIII / 8"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Semester:
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
                >
                  <option value="1">1 (Ganjil)</option>
                  <option value="2">2 (Genap)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Topik / Materi Pokok:
            </label>
            <textarea
              rows={3}
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Contoh: Sistem Ekskresi Manusia & Fungsi Ginjal"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors uppercase tracking-wider"
            >
              Batal
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
