import React, { useState, useEffect } from "react";
import { 
  X, 
  Check, 
  Sparkles, 
  HelpCircle, 
  Layers, 
  Plus, 
  Trash2,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  RefreshCw,
  Eye,
  Link2
} from "lucide-react";
import type { Question, QuestionOption, Difficulty, CognitiveLevel } from "../types.js";

interface EditQuestionModalProps {
  isOpen: boolean;
  question: Question | null;
  onClose: () => void;
  onSave: (updatedQuestion: Question) => void;
  onAIAssistNewQuestion?: () => Promise<void>;
  isNewQuestion?: boolean;
}

export const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  isOpen,
  question,
  onClose,
  onSave,
  isNewQuestion = false,
}) => {
  const [formData, setFormData] = useState<Question | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuggestingImage, setIsSuggestingImage] = useState(false);

  useEffect(() => {
    if (question) {
      setFormData(JSON.parse(JSON.stringify(question)));
      setErrorMsg(null);
    }
  }, [question, isOpen]);

  if (!isOpen || !formData) return null;

  const handleOptionTextChange = (index: number, text: string) => {
    const updatedOptions = [...formData.options];
    updatedOptions[index] = { ...updatedOptions[index], text };
    setFormData({ ...formData, options: updatedOptions });
  };

  const handleAddOption = () => {
    if (formData.options.length >= 5) return;
    const nextLabel = formData.options.length === 4 ? "E" : "D";
    setFormData({
      ...formData,
      options: [...formData.options, { label: nextLabel as any, text: "" }],
    });
  };

  const handleRemoveOption = (index: number) => {
    if (formData.options.length <= 2) return;
    const updated = formData.options.filter((_, i) => i !== index);
    // Re-label A, B, C, D...
    const labels = ["A", "B", "C", "D", "E"] as const;
    const reLabeled = updated.map((opt, i) => ({
      ...opt,
      label: labels[i] || "A",
    }));

    // If deleted option was the correct answer, reset to A
    let newCorrect = formData.correctAnswer;
    if (!reLabeled.some((o) => o.label === newCorrect)) {
      newCorrect = "A";
    }

    setFormData({
      ...formData,
      options: reLabeled,
      correctAnswer: newCorrect,
    });
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Ukuran file gambar maksimal 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData({
        ...formData,
        imageUrl: reader.result as string,
        imageCaption: formData.imageCaption || `Gambar: ${file.name.replace(/\.[^/.]+$/, "")}`
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAutoSuggestImage = async () => {
    try {
      setIsSuggestingImage(true);
      setErrorMsg(null);
      const res = await fetch("/api/generate-question-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Pendidikan",
          topic: formData.indicator || "Materi Pelajaran",
          questionText: formData.question
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mendapatkan rekomendasi gambar.");
      }

      setFormData({
        ...formData,
        imageUrl: data.imageUrl,
        imageCaption: data.caption || "Diagram & Ilustrasi Edukatif"
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyematkan gambar rekomendasi AI.");
    } finally {
      setIsSuggestingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question.trim()) {
      setErrorMsg("Pertanyaan tidak boleh kosong.");
      return;
    }

    const emptyOpt = formData.options.find((o) => !o.text.trim());
    if (emptyOpt) {
      setErrorMsg(`Pilihan ${emptyOpt.label} masih kosong. Harap isi teks opsi jawaban.`);
      return;
    }

    if (!formData.correctAnswer) {
      setErrorMsg("Harap pilih satu Kunci Jawaban yang benar.");
      return;
    }

    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col card-shadow border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
              #{formData.number}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                {isNewQuestion ? "Tambah Butir Soal Baru" : `Edit Soal Nomor ${formData.number}`}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Sesuaikan pertanyaan, opsi jawaban, skor, dan pembahasan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pertanyaan */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              TEKS PERTANYAAN <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden text-sm"
              placeholder="Tuliskan butir soal di sini..."
            />
          </div>

          {/* Stimulus Visual / Gambar Soal */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Stimulus Visual / Gambar Soal (Opsional)
                </span>
              </div>

              <button
                type="button"
                disabled={isSuggestingImage}
                onClick={handleAutoSuggestImage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black transition-colors"
                title="Rekomendasikan diagram/gambar berbasis materi soal dengan AI"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${isSuggestingImage ? "animate-spin" : ""}`} />
                <span>{isSuggestingImage ? "Mencari Gambar..." : "Rekomendasi Gambar AI"}</span>
              </button>
            </div>

            {formData.imageUrl ? (
              <div className="space-y-3 pt-1">
                <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-white max-h-56 flex items-center justify-center p-2">
                  <img
                    src={formData.imageUrl}
                    alt={formData.imageCaption || "Stimulus Soal"}
                    className="max-h-48 max-w-full object-contain rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageUrl: undefined, imageCaption: undefined })}
                    className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-xl shadow-lg hover:bg-rose-700 transition-colors"
                    title="Hapus Gambar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">Teks Keterangan / Caption</label>
                    <input
                      type="text"
                      value={formData.imageCaption || ""}
                      onChange={(e) => setFormData({ ...formData, imageCaption: e.target.value })}
                      placeholder="Contoh: Gambar 1. Topologi Jaringan Bintang"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">URL Gambar (HTTPS)</label>
                    <input
                      type="url"
                      value={formData.imageUrl || ""}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Upload Local Image */}
                <label className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-slate-100 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors text-center">
                  <Upload className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Unggah Gambar / Diagram</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="hidden"
                  />
                </label>

                {/* Paste URL */}
                <button
                  type="button"
                  onClick={() => {
                    const url = prompt("Masukkan tautan URL Gambar (HTTPS):");
                    if (url && url.trim()) {
                      setFormData({
                        ...formData,
                        imageUrl: url.trim(),
                        imageCaption: "Gambar Stimulus Soal"
                      });
                    }
                  }}
                  className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-slate-100 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                >
                  <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Input Tautan URL Gambar</span>
                </button>
              </div>
            )}
          </div>

          {/* Opsi Pilihan Jawaban */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                PILIHAN JAWABAN & KUNCI JAWABAN <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-blue-600 font-bold">
                Pilih tombol huruf untuk kunci benar
              </span>
            </div>

            <div className="space-y-3">
              {formData.options.map((opt, idx) => {
                const isCorrect = formData.correctAnswer === opt.label;
                return (
                  <div
                    key={opt.label}
                    className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                      isCorrect
                        ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-300"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Radio Button for Correct Answer */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, correctAnswer: opt.label })}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 transition-all ${
                        isCorrect
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-300 hover:border-blue-400"
                      }`}
                      title={`Jadikan pilihan ${opt.label} sebagai kunci jawaban benar`}
                    >
                      {isCorrect ? <Check className="w-5 h-5 stroke-[3]" /> : opt.label}
                    </button>

                    {/* Option Text Input */}
                    <input
                      type="text"
                      required
                      placeholder={`Teks pilihan ${opt.label}...`}
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      className="flex-1 px-3 py-2 bg-transparent border-0 text-slate-900 text-sm font-medium focus:outline-hidden"
                    />

                    {/* Delete Option button (if more than 2) */}
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                        title="Hapus opsi ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {formData.options.length < 5 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 pt-1 uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Pilihan ({formData.options.length === 4 ? "Opsi E" : "Opsi D"})
              </button>
            )}
          </div>

          {/* Metadata Grid: Skor, Kesulitan, Level Kognitif */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            {/* Skor */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                SKOR / POIN
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: Math.max(1, Number(e.target.value)) })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden text-sm"
              />
            </div>

            {/* Tingkat Kesulitan */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                TINGKAT KESULITAN
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as Difficulty })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden text-sm uppercase"
              >
                <option value="Mudah">Mudah</option>
                <option value="Sedang">Sedang</option>
                <option value="Sulit">Sulit</option>
              </select>
            </div>

            {/* Level Kognitif */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                LEVEL KOGNITIF
              </label>
              <select
                value={formData.cognitiveLevel}
                onChange={(e) => setFormData({ ...formData, cognitiveLevel: e.target.value as CognitiveLevel })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden text-sm"
              >
                <option value="C1">C1 - Mengingat</option>
                <option value="C2">C2 - Memahami</option>
                <option value="C3">C3 - Menerapkan</option>
                <option value="C4">C4 - Menganalisis (HOTS)</option>
                <option value="C5">C5 - Mengevaluasi (HOTS)</option>
                <option value="C6">C6 - Mencipta (HOTS)</option>
              </select>
            </div>
          </div>

          {/* Indikator & Pembahasan */}
          <div className="space-y-4">
            {/* Materi Pokok / Sub-Materi Soal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  MATERI POKOK / SUB-MATERI SOAL
                </label>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Untuk Kisi-Kisi Otomatis
                </span>
              </div>
              <input
                type="text"
                value={formData.material || ""}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                placeholder="Contoh: Topologi Jaringan Komputer, Siklus Air, Aljabar Linear..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden text-sm"
              />
              <p className="text-[11px] text-slate-500">
                Topik/sub-materi ini digunakan otomatis dalam penyusunan tabel Kisi-Kisi Ujian dan indikator capaian per butir soal.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                INDIKATOR SOAL
              </label>
              <input
                type="text"
                value={formData.indicator || ""}
                onChange={(e) => setFormData({ ...formData, indicator: e.target.value })}
                placeholder="Contoh: Siswa mampu menjelaskan cara kerja router..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                PEMBAHASAN SOAL
              </label>
              <textarea
                rows={2}
                value={formData.explanation || ""}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="Tuliskan penjelasan dan alasan jawaban yang benar..."
                className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white focus:outline-hidden text-sm"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 text-slate-600 hover:text-slate-900 font-black rounded-2xl text-xs uppercase tracking-wider transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl transition-all flex items-center gap-2 uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98]"
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
