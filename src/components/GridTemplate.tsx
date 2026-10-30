import React from "react";
import {
  FileSpreadsheet,
  FileDown,
  FileText,
  Printer,
  Copy,
  Check,
  School,
  Sparkles,
  BookOpen,
  Layers,
  BarChart3,
  ChevronRight,
  Info,
  Maximize2
} from "lucide-react";
import type { QuestionSet } from "../types.js";
import { formatGradeDisplay, cleanExamTitle } from "../lib/classUtils.js";
import {
  getFormattedKisiKisiItems,
  exportKisiKisiPDF,
  exportKisiKisiWord,
  exportKisiKisiText,
  paginateKisiKisiItems,
  type FormattedKisiKisiItem,
  type A4PageSegment
} from "../lib/kisiKisiUtils.js";
import { getAppSettings } from "../lib/storage.js";

export interface GridTemplateProps {
  questionSet: QuestionSet;
  showKop?: boolean;
  showSignatures?: boolean;
  showStats?: boolean;
  showToolbar?: boolean;
  filteredItems?: FormattedKisiKisiItem[];
  customTitle?: string;
  className?: string;
  defaultSmartLayout?: boolean;
}

/**
 * GridTemplate: Komponen CSS Grid presisi tinggi dengan Fitur 'Smart Layout A4'
 * Menggunakan deteksi tinggi konten untuk otomatis membagi data ke lembar halaman A4 (Landscape)
 * sehingga 100% mencegah teks/baris tabel terpotong canggung atau keluar dari batas kertas.
 */
export const GridTemplate: React.FC<GridTemplateProps> = ({
  questionSet,
  showKop = true,
  showSignatures = true,
  showStats = true,
  showToolbar = false,
  filteredItems: customFilteredItems,
  customTitle,
  className = "",
  defaultSmartLayout = true,
}) => {
  const [smartLayout, setSmartLayout] = React.useState(defaultSmartLayout);
  const [activePageTab, setActivePageTab] = React.useState<number | "ALL">("ALL");
  const [copiedToast, setCopiedToast] = React.useState(false);
  
  const settings = getAppSettings();
  const cleanTitle = customTitle || cleanExamTitle(questionSet.title);
  const allItems = getFormattedKisiKisiItems(questionSet);
  const items = customFilteredItems || allItems;

  // Calculate stats
  const totalQuestions = allItems.length;
  const totalPoints = questionSet.totalPoints || allItems.reduce((sum, item) => sum + item.points, 0);
  const hotsCount = allItems.filter((i) => i.cognitiveCategory === "HOTS").length;
  const hotsPercent = totalQuestions > 0 ? Math.round((hotsCount / totalQuestions) * 100) : 0;
  const easyCount = allItems.filter((i) => i.difficulty === "Mudah").length;
  const medCount = allItems.filter((i) => i.difficulty === "Sedang").length;
  const hardCount = allItems.filter((i) => i.difficulty === "Sulit").length;

  const isSignatureEnabled = showSignatures && (settings.enableSignatures === true);

  // Smart Layout: Partition rows into A4 pages based on content height
  const a4Pages: A4PageSegment[] = React.useMemo(() => {
    return paginateKisiKisiItems(items, {
      showKop,
      showSignatures: isSignatureEnabled,
      showStats,
    });
  }, [items, showKop, isSignatureEnabled, showStats]);

  const handleCopy = async () => {
    try {
      const txt = exportKisiKisiText(questionSet);
      await navigator.clipboard.writeText(txt);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Render Table Header Row (7 columns: No, Materi Pokok, Indikator & Panduan, Level Kognitif, Kesukaran, Bentuk, Skor)
  const renderTableHeader = () => (
    <div
      id="grid-template-header"
      className="grid grid-cols-[44px_140px_1fr_95px_85px_55px_55px] bg-slate-900 text-white text-[12px] font-black uppercase tracking-wider text-center divide-x divide-slate-800 print:bg-black print:divide-black"
    >
      <div className="py-2.5 px-1.5 flex items-center justify-center">No</div>
      <div className="py-2.5 px-2 text-left flex items-center">Materi Pokok</div>
      <div className="py-2.5 px-3 text-left flex items-center">Indikator Soal & Panduan Belajar Siswa</div>
      <div className="py-2.5 px-1 flex items-center justify-center">Level Kognitif</div>
      <div className="py-2.5 px-1 flex items-center justify-center">Kesukaran</div>
      <div className="py-2.5 px-1 flex items-center justify-center">Bentuk</div>
      <div className="py-2.5 px-1 flex items-center justify-center">Skor</div>
    </div>
  );

  // Render Table Row (7 columns)
  const renderTableRow = (item: FormattedKisiKisiItem, idx: number) => {
    const isHots = item.cognitiveCategory === "HOTS";
    const isEven = idx % 2 === 1;

    return (
      <div
        key={item.no}
        id={`grid-row-${item.no}`}
        className={`grid grid-cols-[44px_140px_1fr_95px_85px_55px_55px] divide-x divide-slate-300 items-stretch transition-colors ${
          isEven ? "bg-slate-50/70" : "bg-white"
        } hover:bg-blue-50/50 print:bg-white print:divide-slate-400 print:break-inside-avoid`}
      >
        {/* 1. No */}
        <div className="p-2 flex items-center justify-center font-bold text-slate-500 bg-slate-100/60 print:bg-transparent text-[12px]">
          {item.no}
        </div>

        {/* 2. Materi Pokok */}
        <div className="p-2.5 font-bold text-slate-900 leading-snug flex items-start text-[12px]">
          {item.material}
        </div>

        {/* 3. Indikator Soal & Panduan Belajar */}
        <div className="p-2.5 space-y-1.5 text-left">
          <p className="font-semibold text-slate-900 leading-relaxed text-[12px]">
            {item.indicator}
          </p>
          <div className="text-[12px] text-slate-800 bg-slate-100/90 p-2 rounded-md border-l-3 border-blue-600 print:bg-transparent print:border-l-2 print:border-black">
            <span className="font-bold text-blue-900 print:text-black">💡 Panduan Belajar:</span> {item.studyTip}
          </div>
        </div>

        {/* 4. Level Kognitif */}
        <div className="p-2 flex flex-col items-center justify-center text-center">
          <span className="font-black text-slate-900 text-[12px]">{item.cognitiveLevel}</span>
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold mt-0.5 uppercase ${
              isHots
                ? "bg-purple-100 text-purple-800 border border-purple-300"
                : "bg-blue-100 text-blue-800 border border-blue-300"
            }`}
          >
            {item.cognitiveCategory}
          </span>
        </div>

        {/* 5. Tingkat Kesukaran */}
        <div className="p-2 flex items-center justify-center text-center">
          <span
            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
              item.difficulty === "Mudah"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : item.difficulty === "Sedang"
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-rose-100 text-rose-800 border border-rose-300"
            }`}
          >
            {item.difficulty}
          </span>
        </div>

        {/* 6. Bentuk */}
        <div className="p-2 flex items-center justify-center text-center font-bold text-slate-600 text-[12px]">
          PG
        </div>

        {/* 7. Skor */}
        <div className="p-2 flex items-center justify-center text-center font-bold text-slate-800 text-[12px]">
          {item.points}
        </div>
      </div>
    );
  };

  // Render Metadata block
  const renderMetadata = () => (
    <div
      id="grid-template-metadata"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-300 text-[12px]"
    >
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Mata Pelajaran</span>
        <span className="font-extrabold text-slate-900">{questionSet.subject}</span>
      </div>
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Kelas / Semester</span>
        <span className="font-extrabold text-slate-900">
          {formatGradeDisplay(questionSet.grade)} / Semester {questionSet.semester || "1"}
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Bentuk & Jumlah Soal</span>
        <span className="font-extrabold text-slate-900">
          Pilihan Ganda ({totalQuestions} Butir • {totalPoints} Poin)
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Alokasi Waktu</span>
        <span className="font-extrabold text-slate-900">60 - 90 Menit</span>
      </div>
      <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] text-slate-700">
          <span className="font-bold text-slate-900">Materi Pokok:</span> {questionSet.material}
        </div>
        <div className="text-[12px] text-slate-500 font-semibold">
          Kurikulum: <span className="text-slate-800 font-bold">Kurikulum Merdeka / Nasional</span>
        </div>
      </div>
    </div>
  );

  // Render Petunjuk Belajar block
  const renderStudyGuide = () => (
    <div
      id="grid-template-study-guide"
      className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-900 space-y-1.5 text-[12px] print:break-inside-avoid"
    >
      <div className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-emerald-950 text-[12px]">
        <BookOpen className="w-4 h-4 text-emerald-700" />
        Petunjuk Belajar Mandiri Bagi Siswa:
      </div>
      <ul className="list-disc list-inside space-y-1 text-[12px] text-emerald-900 font-medium leading-relaxed pl-1">
        <li>Pelajari materi dan <strong>Panduan Belajar</strong> pada setiap butir soal di atas sebagai persiapan utama sebelum ujian.</li>
        <li>Soal bertanda <strong>HOTS (C4–C6)</strong> membutuhkan ketelitian membaca kasus dan berpikir kritis, bukan hanya hafalan.</li>
        <li>Soal bertanda <strong>LOTS/MOTS (C1–C3)</strong> menguji pemahaman konsep dasar, definisi, dan penerapan rumus.</li>
        <li>Nomor soal pada saat ujian akan diacak secara dinamis oleh sistem.</li>
      </ul>
    </div>
  );

  // Render Signatures block
  const renderSignatures = () => (
    <div
      id="grid-template-signatures"
      className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-[12px] text-slate-800 print:pt-4 print:break-inside-avoid"
    >
      {/* Kepala Sekolah */}
      <div className="space-y-1">
        <p className="text-slate-500 text-[12px]">Mengetahui,</p>
        <p className="font-bold text-slate-900 text-[12px]">Kepala Satuan Pendidikan</p>
        <div className="h-12 flex items-center justify-center">
          <span className="text-[11px] text-slate-300 italic select-none print:hidden">[Tanda Tangan & Cap]</span>
        </div>
        <p className="font-black text-slate-900 underline text-[12px]">
          ( {settings.principalName || "Kepala Sekolah, M.Pd."} )
        </p>
        <p className="text-[11.5px] text-slate-600">
          NIP. {settings.principalNip || "...................................."}
        </p>
      </div>

      {/* Guru Pengampu */}
      <div className="space-y-1">
        <p className="text-slate-500 text-[12px]">
          {settings.schoolCity || "Kota"}, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <p className="font-bold text-slate-900 text-[12px]">Guru Mata Pelajaran</p>
        <div className="h-12 flex items-center justify-center">
          <span className="text-[11px] text-slate-300 italic select-none print:hidden">[Tanda Tangan]</span>
        </div>
        <p className="font-black text-slate-900 underline text-[12px]">
          ( {settings.teacherName || "Guru Pengampu, S.Pd."} )
        </p>
        <p className="text-[11.5px] text-slate-600">
          NIP. {settings.teacherNip || "...................................."}
        </p>
      </div>
    </div>
  );

  return (
    <div id="grid-template-container" className={`space-y-4 ${className}`}>
      
      {/* ========================================================================= */}
      {/* SMART LAYOUT CONTROLS & STATUS BAR                                         */}
      {/* ========================================================================= */}
      <div
        id="smart-layout-control-bar"
        className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                Smart Layout A4
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                  {smartLayout ? "Aktif" : "Nonaktif"}
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {smartLayout
                ? `Deteksi tinggi otomatis • Terbagi ke ${a4Pages.length} Halaman A4 Landscape (Bebas Potong Canggung)`
                : "Mode Tampilan Dokumen Utuh Bersambung (Continuous View)"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Layout Toggle */}
          <button
            type="button"
            onClick={() => setSmartLayout(!smartLayout)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              smartLayout
                ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-xs"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{smartLayout ? "Smart Layout: ON" : "Smart Layout: OFF"}</span>
          </button>

          {/* Quick Page Jump Tabs (if Smart Layout is ON & multiple pages exist) */}
          {smartLayout && a4Pages.length > 1 && (
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActivePageTab("ALL")}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  activePageTab === "ALL" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Semua ({a4Pages.length})
              </button>
              {a4Pages.map((page) => (
                <button
                  key={page.pageNumber}
                  type="button"
                  onClick={() => setActivePageTab(page.pageNumber)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activePageTab === page.pageNumber ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Hal {page.pageNumber}
                </button>
              ))}
            </div>
          )}

          {/* Export action triggers */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Cetak format Smart Layout"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={() => exportKisiKisiPDF(questionSet)}
              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              title="Unduh PDF Resmi"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => exportKisiKisiWord(questionSet)}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              title="Unduh Word .doc"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Word</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
            >
              {copiedToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedToast ? "Tersalin" : "Salin"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: SMART LAYOUT A4 PAGINATED VIEW                                    */}
      {/* ========================================================================= */}
      {smartLayout ? (
        <div id="smart-layout-pages-container" className="space-y-6 print:space-y-0">
          {a4Pages.map((page) => {
            // If user selected a specific page tab, hide others in UI preview (print shows all)
            const isVisibleInPreview = activePageTab === "ALL" || activePageTab === page.pageNumber;
            if (!isVisibleInPreview) return null;

            return (
              <div
                key={`a4-page-${page.pageNumber}`}
                id={`grid-a4-page-${page.pageNumber}`}
                className="bg-white rounded-2xl border-2 border-slate-300 shadow-md p-6 sm:p-8 space-y-4 relative print:shadow-none print:border-none print:m-0 print:p-0 print:rounded-none print:break-after-page"
                style={{ breakAfter: "page", pageBreakAfter: "always" }}
              >
                {/* Visual Sheet Badge (Screen Only) */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-bold text-slate-500 print:hidden">
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="font-extrabold uppercase tracking-wide">
                      Lembar Kertas A4 Landscape • Halaman {page.pageNumber} dari {page.totalPages}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px]">
                      {page.items.length} Butir Soal pada Lembar ini
                    </span>
                  </div>
                </div>

                {/* 1. KOP SURAT (Shown on Page 1) */}
                {page.hasKop && (
                  <div id="grid-template-kop" className="text-center space-y-1 pb-3 border-b-2 border-slate-900 relative">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-900 text-white flex items-center justify-center shrink-0 font-black text-sm print:border print:border-black">
                        <School className="w-4 h-4" />
                      </div>
                      <div>
                        <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                          {settings.schoolName || "SATUAN PENDIDIKAN FORMAL"}
                        </h1>
                        <h2 className="text-base font-black text-blue-950 uppercase tracking-tight">
                          KISI-KISI PENULISAN SOAL ASESMEN / UJIAN
                        </h2>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Tahun Ajaran {settings.academicYear || "2026/2027"} • Wilayah {settings.schoolCity || "Pendidikan Nasional"}
                    </p>
                  </div>
                )}

                {/* 1b. SUB-HEADER FOR SUBSEQUENT PAGES */}
                {!page.isFirstPage && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-900 text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-blue-900 uppercase">
                        KISI-KISI PENULISAN SOAL (LANJUTAN)
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-700">{questionSet.subject} ({formatGradeDisplay(questionSet.grade)})</span>
                    </div>
                    <div className="font-extrabold text-slate-600">
                      Halaman {page.pageNumber} / {page.totalPages}
                    </div>
                  </div>
                )}

                {/* 2. METADATA (Shown on Page 1) */}
                {page.hasMetadata && renderMetadata()}

                {/* 3. TABLE MATRIX FOR THIS PAGE */}
                {page.items.length > 0 && (
                  <div
                    id={`grid-matrix-page-${page.pageNumber}`}
                    className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-xs print:border-black print:rounded-none"
                  >
                    {renderTableHeader()}
                    <div className="divide-y divide-slate-300 text-xs bg-white">
                      {page.items.map((item, idx) => renderTableRow(item, idx))}
                    </div>
                  </div>
                )}

                {/* 4. PETUNJUK BELAJAR (If placed on this page) */}
                {page.hasStudyGuide && renderStudyGuide()}

                {/* 5. LEMBAR PENGESAHAN (If placed on this page) */}
                {page.hasSignatures && renderSignatures()}

                {/* Official Page Footer Watermark */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-semibold print:text-black">
                  <span>{settings.schoolName || "Dokumen Resmi Kisi-Kisi Asesmen"}</span>
                  <span>
                    Smart Layout A4 • Halaman {page.pageNumber} dari {page.totalPages}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: CLASSIC CONTINUOUS MATRIX VIEW                                     */
        /* ========================================================================= */
        <div
          id="grid-template-document"
          className="bg-white rounded-2xl border-2 border-slate-300 shadow-sm p-6 sm:p-8 space-y-5 print:shadow-none print:border-none print:m-0 print:p-0"
        >
          {showKop && (
            <div id="grid-template-kop" className="text-center space-y-1 pb-4 border-b-2 border-slate-900 relative">
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-900 text-white flex items-center justify-center shrink-0 font-black text-sm">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wide">
                    {settings.schoolName || "SATUAN PENDIDIKAN FORMAL"}
                  </h1>
                  <h2 className="text-base sm:text-lg font-black text-blue-950 uppercase tracking-tight">
                    KISI-KISI PENULISAN SOAL ASESMEN / UJIAN
                  </h2>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 font-medium">
                Tahun Ajaran {settings.academicYear || "2026/2027"} • Wilayah {settings.schoolCity || "Pendidikan Nasional"}
              </p>
            </div>
          )}

          {renderMetadata()}

          {showStats && (
            <div
              id="grid-template-stats-bar"
              className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-100/90 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 print:hidden"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                <span className="font-bold text-slate-900">Distribusi Kognitif:</span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-bold border border-purple-200 text-[11px]">
                  HOTS: {hotsCount} ({hotsPercent}%)
                </span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold border border-blue-200 text-[11px]">
                  LOTS/MOTS: {totalQuestions - hotsCount} ({100 - hotsPercent}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="font-bold text-slate-600">Kesukaran:</span>
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">Mudah: {easyCount}</span>
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">Sedang: {medCount}</span>
                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-bold">Sulit: {hardCount}</span>
              </div>
            </div>
          )}

          <div
            id="grid-template-matrix-wrapper"
            className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-xs print:border-black print:rounded-none"
          >
            {renderTableHeader()}
            <div id="grid-template-rows" className="divide-y divide-slate-300 text-xs bg-white">
              {items.map((item, idx) => renderTableRow(item, idx))}
            </div>
          </div>

          {renderStudyGuide()}
          {isSignatureEnabled && renderSignatures()}
        </div>
      )}
    </div>
  );
};
