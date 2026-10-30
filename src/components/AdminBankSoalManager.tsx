import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  Search,
  Filter,
  Users,
  User,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Calendar,
  Layers,
  HardDrive,
  Clock,
  Sparkles,
  BookOpen,
  HelpCircle,
  Award
} from "lucide-react";
import type { AdminBankSoalItem, AdminDatabaseStats } from "../lib/adminBankSoal.js";
import {
  fetchAllBankSoalForAdmin,
  deleteBankSoalByAdmin,
  bulkDeleteBankSoalByAdmin,
  deleteUserAllBankSoalByAdmin
} from "../lib/adminBankSoal.js";
import { downloadFile } from "../lib/exportUtils.js";

interface AdminBankSoalManagerProps {
  onBankChanged?: () => void;
}

export const AdminBankSoalManager: React.FC<AdminBankSoalManagerProps> = ({ onBankChanged }) => {
  const [items, setItems] = useState<AdminBankSoalItem[]>([]);
  const [stats, setStats] = useState<AdminDatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("ALL");
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "questions" | "size">("newest");

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [previewItem, setPreviewItem] = useState<AdminBankSoalItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBankSoalItem | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const [userWipeTarget, setUserWipeTarget] = useState<{ userId: string; userLabel: string; count: number } | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState<boolean>(false);

  // Load Data
  const loadData = async (showLoadingState = true) => {
    if (showLoadingState) setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchAllBankSoalForAdmin();
      setItems(result.items);
      setStats(result.stats);
      if (result.error) {
        console.info("Info sinkronisasi data:", result.error);
      }
    } catch (err: any) {
      console.error("Gagal memuat bank soal admin:", err);
      setErrorMessage(err?.message || "Gagal mengambil data dari database Firestore.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  // Compute Unique Users for dropdown
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, { userId: string; label: string; email: string; count: number }>();
    items.forEach((item) => {
      const label = item.userDisplayName || item.userEmail || (item.userId === "guest" ? "Pengguna Tamu" : `User: ${item.userId.slice(0, 8)}...`);
      const existing = map.get(item.userId);
      if (existing) {
        existing.count++;
      } else {
        map.set(item.userId, {
          userId: item.userId,
          label,
          email: item.userEmail,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [items]);

  // Compute Unique Subjects for dropdown
  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.set.subject) set.add(item.set.subject.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered and Sorted Items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // User Filter
        if (selectedUserFilter !== "ALL" && item.userId !== selectedUserFilter) {
          return false;
        }
        // Subject Filter
        if (selectedSubjectFilter !== "ALL" && item.set.subject !== selectedSubjectFilter) {
          return false;
        }
        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.set.title?.toLowerCase().includes(q);
          const matchSubject = item.set.subject?.toLowerCase().includes(q);
          const matchMaterial = item.set.material?.toLowerCase().includes(q);
          const matchEmail = item.userEmail?.toLowerCase().includes(q);
          const matchName = item.userDisplayName?.toLowerCase().includes(q);
          const matchGrade = item.set.grade?.toLowerCase().includes(q);
          if (!matchTitle && !matchSubject && !matchMaterial && !matchEmail && !matchName && !matchGrade) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === "questions") {
          return b.questionCount - a.questionCount;
        }
        if (sortBy === "size") {
          return b.approximateSizeKb - a.approximateSizeKb;
        }
        return 0;
      });
  }, [items, selectedUserFilter, selectedSubjectFilter, searchQuery, sortBy]);

  // Handle single item deletion (optimistic & instant)
  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null); // Close modal instantly

    // Optimistic state update: card vanishes in 0ms!
    setItems((prev) => prev.filter((it) => it.id !== target.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(target.id);
      return next;
    });

    // Update stats locally
    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalSets: Math.max(0, prev.totalSets - 1),
            totalQuestions: Math.max(0, prev.totalQuestions - target.questionCount),
            totalSizeKb: Math.max(
              0,
              Math.round((prev.totalSizeKb - target.approximateSizeKb) * 10) / 10
            ),
            lastRefreshed: new Date().toLocaleTimeString("id-ID"),
          }
        : prev
    );

    setActionNotice({
      type: "success",
      text: `Paket soal "${target.set.title}" berhasil dihapus dari database!`,
    });

    try {
      await deleteBankSoalByAdmin(target);
      if (onBankChanged) onBankChanged();
    } catch (err: any) {
      // Revert if severe failure
      setItems((prev) => [target, ...prev]);
      setActionNotice({
        type: "error",
        text: `Gagal menghapus paket soal: ${err?.message || "Kesalahan server"}`,
      });
    }
  };

  // Handle bulk delete (optimistic & batch)
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const itemsToDelete = items.filter((it) => selectedIds.has(it.id));
    const count = itemsToDelete.length;
    setShowBulkDeleteConfirm(false); // Close modal instantly

    // Optimistic removal
    setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
    setSelectedIds(new Set());

    // Update stats locally
    const removedQuestions = itemsToDelete.reduce((acc, it) => acc + it.questionCount, 0);
    const removedSize = itemsToDelete.reduce((acc, it) => acc + it.approximateSizeKb, 0);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalSets: Math.max(0, prev.totalSets - count),
            totalQuestions: Math.max(0, prev.totalQuestions - removedQuestions),
            totalSizeKb: Math.max(
              0,
              Math.round((prev.totalSizeKb - removedSize) * 10) / 10
            ),
            lastRefreshed: new Date().toLocaleTimeString("id-ID"),
          }
        : prev
    );

    setActionNotice({
      type: "success",
      text: `Berhasil menghapus ${count} paket soal dari database server!`,
    });

    try {
      await bulkDeleteBankSoalByAdmin(itemsToDelete);
      if (onBankChanged) onBankChanged();
    } catch (err: any) {
      setActionNotice({
        type: "error",
        text: `Gagal menghapus massal: ${err?.message || "Kesalahan server"}`,
      });
    }
  };

  // Handle wiping all bank soal for a user (optimistic)
  const handleConfirmUserWipe = async () => {
    if (!userWipeTarget) return;
    const target = userWipeTarget;
    setUserWipeTarget(null); // Close modal instantly

    const itemsToWipe = items.filter((it) => it.userId === target.userId);
    const count = itemsToWipe.length;

    // Optimistic removal
    setItems((prev) => prev.filter((it) => it.userId !== target.userId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      itemsToWipe.forEach((it) => next.delete(it.id));
      return next;
    });

    // Update stats locally
    const removedQuestions = itemsToWipe.reduce((acc, it) => acc + it.questionCount, 0);
    const removedSize = itemsToWipe.reduce((acc, it) => acc + it.approximateSizeKb, 0);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            totalSets: Math.max(0, prev.totalSets - count),
            totalQuestions: Math.max(0, prev.totalQuestions - removedQuestions),
            totalSizeKb: Math.max(
              0,
              Math.round((prev.totalSizeKb - removedSize) * 10) / 10
            ),
            lastRefreshed: new Date().toLocaleTimeString("id-ID"),
          }
        : prev
    );

    setActionNotice({
      type: "success",
      text: `Berhasil membersihkan seluruh ${count} paket soal milik ${target.userLabel}!`,
    });

    try {
      await deleteUserAllBankSoalByAdmin(target.userId, items);
      if (onBankChanged) onBankChanged();
    } catch (err: any) {
      setActionNotice({
        type: "error",
        text: `Gagal membersihkan data user: ${err?.message || "Kesalahan server"}`,
      });
    }
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all filtered
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((it) => it.id)));
    }
  };

  // Export JSON of a single item
  const handleExportSingleJson = (item: AdminBankSoalItem) => {
    const dataStr = JSON.stringify(item.set, null, 2);
    const safeTitle = (item.set.title || "bank_soal").toLowerCase().replace(/[^a-z0-9]/g, "_");
    downloadFile(dataStr, `arsip_admin_${safeTitle}.json`, "application/json");
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Kelola Bank Soal Semua Pengguna
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Monitor dan hapus paket bank soal milik pengguna lain di database Cloud Firestore untuk mencegah kepenuhan kuota.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            title="Muat ulang data database terkini"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* NOTICE BANNER */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            actionNotice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : actionNotice.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {actionNotice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : actionNotice.type === "error" ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="truncate">{actionNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ERROR BANNER IF FETCH FAILED */}
      {errorMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs font-semibold flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-bold">Perhatian:</span> {errorMessage}
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-[11px] font-bold shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Paket Soal</span>
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalSets}</span>
              <span className="text-xs text-slate-500 font-medium">Paket</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{stats.firestoreSetsCount} Cloud Firestore • {stats.localSetsCount} Lokal</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Butir Soal</span>
              <HelpCircle className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalQuestions}</span>
              <span className="text-xs text-slate-500 font-medium">Butir Soal</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 font-medium">
              Terdistribusi di semua paket
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Guru / Akun Aktif</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalUsers}</span>
              <span className="text-xs text-slate-500 font-medium">Pengguna</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 font-medium">
              Pemilik bank soal tersimpan
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Ukuran Database</span>
              <HardDrive className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">
                {stats.totalSizeKb >= 1024
                  ? `${(stats.totalSizeKb / 1024).toFixed(2)} MB`
                  : `${stats.totalSizeKb} KB`}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-slate-500 font-medium">
              Diperbarui pkl {stats.lastRefreshed}
            </div>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-4 border border-slate-200/80 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul soal, materi pokok, mapel, atau email guru..."
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* User Filter Dropdown */}
          <div className="min-w-[180px]">
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm cursor-pointer"
            >
              <option value="ALL">Semua Guru / Akun ({items.length})</option>
              {uniqueUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.label} ({u.count} paket)
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter Dropdown */}
          <div className="min-w-[150px]">
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm cursor-pointer"
            >
              <option value="ALL">Semua Mapel</option>
              {uniqueSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="min-w-[140px]">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm cursor-pointer"
            >
              <option value="newest">Waktu: Terbaru</option>
              <option value="oldest">Waktu: Terlama</option>
              <option value="questions">Soal Terbanyak</option>
              <option value="size">Ukuran Terbesar</option>
            </select>
          </div>
        </div>

        {/* ACTIVE FILTER BAR & BULK ACTION STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 shadow-sm transition-all cursor-pointer text-[11px]"
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {selectedIds.size === filteredItems.length && filteredItems.length > 0
                  ? "Batal Pilih Semua"
                  : `Pilih Semua (${filteredItems.length})`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-[11px] font-black">
                {selectedIds.size} paket dipilih
              </span>
            )}

            {/* Quick wipe for selected user if filtered by single user */}
            {selectedUserFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => {
                  const u = uniqueUsers.find((x) => x.userId === selectedUserFilter);
                  if (u) {
                    setUserWipeTarget({
                      userId: u.userId,
                      userLabel: u.label,
                      count: u.count,
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-[11px] transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-rose-600" />
                <span>Hapus Semua Soal Guru Ini</span>
              </button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg text-[11px] shadow-sm transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {selectedIds.size} Paket Terpilih</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ITEMS LIST */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Menghubungkan ke Database Cloud...</p>
          <p className="text-xs text-slate-500 mt-1">Mengambil data bank soal semua pengguna dari Firestore.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Database className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-800">Tidak Ada Paket Soal Ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || selectedUserFilter !== "ALL" || selectedSubjectFilter !== "ALL"
              ? "Tidak ada bank soal yang cocok dengan filter atau kata kunci pencarian Anda."
              : "Database saat ini bersih. Belum ada paket soal yang disimpan di server."}
          </p>
          {(searchQuery || selectedUserFilter !== "ALL" || selectedSubjectFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedUserFilter("ALL");
                setSelectedSubjectFilter("ALL");
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-500 px-1">
            Menampilkan {filteredItems.length} dari {items.length} paket soal di database
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const authorLabel = item.userDisplayName || item.userEmail || (item.userId === "guest" ? "Mode Tamu" : `User ID: ${item.userId.slice(0, 8)}...`);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-400/50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Left Column: Selection Checkbox & Main Info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.id)}
                      className="mt-1 p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors shrink-0 cursor-pointer"
                      title={isSelected ? "Batal pilih" : "Pilih paket ini"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Author & Storage Source Header */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold border border-slate-200">
                          <User className="w-3 h-3 text-slate-500" />
                          <span className="truncate max-w-[180px]">{authorLabel}</span>
                        </span>

                        {item.userEmail && item.userDisplayName && (
                          <span className="text-slate-400 text-[11px] truncate max-w-[200px]">
                            ({item.userEmail})
                          </span>
                        )}

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            item.source === "firestore"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.source === "synced"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <Database className="w-2.5 h-2.5" />
                          <span>{item.source === "firestore" ? "Cloud Firestore" : item.source === "synced" ? "Cloud + Sinkron" : "Lokal"}</span>
                        </span>

                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(item.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </span>

                        <span className="text-slate-400 text-[11px]">
                          • ~{item.approximateSizeKb} KB
                        </span>
                      </div>

                      {/* Package Title */}
                      <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                        {item.set.title || "Paket Soal Tanpa Judul"}
                      </h4>

                      {/* Subject, Grade, Material */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold">
                          {item.set.subject || "Umum"}
                        </span>
                        <span>Kelas {item.set.grade || "-"}</span>
                        <span>Semester {item.set.semester || "1"}</span>
                        {item.set.material && (
                          <span className="text-slate-500 truncate max-w-[300px]">
                            • {item.set.material}
                          </span>
                        )}
                      </div>

                      {/* Badges: Question Count & Points */}
                      <div className="flex items-center gap-3 pt-1 text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.questionCount} Butir Soal</span>
                        </span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>Total {item.totalPoints} Poin</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full md:w-auto justify-end">
                    {/* Preview Questions Button */}
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                      title="Lihat butir soal di paket ini"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Lihat Soal</span>
                    </button>

                    {/* Export JSON Backup Button */}
                    <button
                      type="button"
                      onClick={() => handleExportSingleJson(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                      title="Unduh cadangan JSON paket ini sebelum dihapus"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Cadangkan</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-xl text-xs transition-all cursor-pointer"
                      title="Hapus paket soal ini dari database server"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: PREVIEW QUESTION SET DETAILS                          */}
      {/* ============================================================== */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase">
                    {previewItem.set.subject || "Umum"}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Kelas {previewItem.set.grade || "-"} • Semester {previewItem.set.semester || "1"}
                  </span>
                  <span className="text-xs text-slate-400 font-mono text-[10px]">
                    ID: {previewItem.id}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                  {previewItem.set.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pembuat: <span className="font-bold text-slate-700">{previewItem.userDisplayName || previewItem.userEmail || previewItem.userId}</span> • {previewItem.questionCount} Butir Soal • {previewItem.totalPoints} Poin
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Questions Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 divide-y divide-slate-100">
              {Array.isArray(previewItem.set.questions) && previewItem.set.questions.length > 0 ? (
                previewItem.set.questions.map((q, idx) => (
                  <div key={q.id || idx} className="pt-4 first:pt-0 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                          {q.number || idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                          {q.difficulty || "Sedang"}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">
                          {q.cognitiveLevel || "C2"}
                        </span>
                      </div>
                      <span className="text-xs font-black text-amber-600">
                        {q.points || 1} Poin
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-800 leading-relaxed pl-8">
                      {q.question}
                    </p>

                    {/* Image stimulus if any */}
                    {q.imageUrl && (
                      <div className="pl-8 my-2 max-w-sm">
                        <img
                          src={q.imageUrl}
                          alt="Stimulus Soal"
                          referrerPolicy="no-referrer"
                          className="rounded-xl border border-slate-200 max-h-48 object-cover"
                        />
                      </div>
                    )}

                    {/* Options list */}
                    {Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {q.options.map((opt) => {
                          const isCorrect = opt.label === q.correctAnswer;
                          return (
                            <div
                              key={opt.label}
                              className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                                isCorrect
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                                  isCorrect
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {opt.label}
                              </span>
                              <span className="leading-snug">{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="pl-8 pt-1 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="font-bold text-slate-700">Pembahasan: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-slate-400 py-8">
                  Tidak ada butir soal dalam paket ini.
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleExportSingleJson(previewItem)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Berkas JSON</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(previewItem);
                    setPreviewItem(null);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Paket Ini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: CONFIRM SINGLE DELETE                                 */}
      {/* ============================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                Hapus Paket Soal Ini?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Anda akan menghapus paket soal{" "}
                <span className="font-bold text-slate-900">"{deleteTarget.set.title}"</span>{" "}
                milik guru{" "}
                <span className="font-bold text-slate-900">
                  {deleteTarget.userDisplayName || deleteTarget.userEmail || deleteTarget.userId}
                </span>{" "}
                secara permanen dari database Cloud Firestore server.
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-900">
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Penghematan Ruang Database</span>
              </div>
              <p className="text-[11px] leading-snug">
                Data dokumen dan {deleteTarget.questionCount} butir soal (~{deleteTarget.approximateSizeKb} KB) akan dihapus dari server dan tidak dapat dikembalikan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isProcessingDelete}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={isProcessingDelete}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessingDelete ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: CONFIRM BULK DELETE                                   */}
      {/* ============================================================== */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                Hapus {selectedIds.size} Paket Soal Terpilih?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tindakan ini akan menghapus seluruh <span className="font-bold text-slate-900">{selectedIds.size} paket soal</span> yang Anda pilih secara permanen dari database server.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
              <p className="leading-snug">
                Pastikan Anda telah mencadangkan data jika masih diperlukan. Penghapusan massal ini akan langsung membebaskan ruang kuota di Firestore.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isProcessingDelete}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isProcessingDelete}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessingDelete ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus {selectedIds.size} Paket...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Semua yang Dipilih</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: CONFIRM USER WIPE                                     */}
      {/* ============================================================== */}
      {userWipeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                Bersihkan Semua Soal Guru Ini?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Anda akan menghapus seluruh <span className="font-bold text-slate-900">{userWipeTarget.count} paket soal</span> milik akun{" "}
                <span className="font-bold text-slate-900">"{userWipeTarget.userLabel}"</span> dari database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserWipeTarget(null)}
                disabled={isProcessingDelete}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmUserWipe}
                disabled={isProcessingDelete}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessingDelete ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Membersihkan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Bersihkan Data Pengguna</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
