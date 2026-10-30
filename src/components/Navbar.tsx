import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  LayoutDashboard, 
  PlusCircle, 
  BookOpen, 
  FileText, 
  Settings as SettingsIcon, 
  GraduationCap,
  LogIn,
  LogOut,
  ChevronDown,
  User as UserIcon,
  CheckCircle2,
  RefreshCw,
  Shield
} from "lucide-react";
import type { UserProfile } from "../lib/googleAuth.js";

interface NavbarProps {
  activeTab: "dashboard" | "create" | "bank" | "history" | "settings" | "admin";
  setActiveTab: (tab: "dashboard" | "create" | "bank" | "history" | "settings" | "admin") => void;
  isGoogleConnected: boolean;
  userEmail?: string | null;
  userProfile?: UserProfile | null;
  onConnectGoogle: () => void;
  onLogoutGoogle?: () => void;
  onSwitchGoogleAccount?: () => void;
  logoUrl?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isGoogleConnected,
  userEmail,
  userProfile,
  onConnectGoogle,
  onLogoutGoogle,
  onSwitchGoogleAccount,
  logoUrl,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navItems: { id: "dashboard" | "create" | "bank" | "history" | "settings" | "admin"; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: "create", label: "Buat Soal", icon: <PlusCircle className="w-4 h-4 shrink-0" /> },
    { id: "bank", label: "Bank Soal", icon: <BookOpen className="w-4 h-4 shrink-0" /> },
    { id: "history", label: "Google Form", icon: <FileText className="w-4 h-4 shrink-0" /> },
    { id: "settings", label: "Pengaturan", icon: <SettingsIcon className="w-4 h-4 shrink-0" /> },
    { id: "admin", label: "Admin", icon: <Shield className="w-4 h-4 shrink-0" /> },
  ];

  const displayName = userProfile?.displayName || (userEmail ? userEmail.split("@")[0] : "Guru");
  const email = userProfile?.email || userEmail || "";
  const photoURL = userProfile?.photoURL;

  return (
    <>
      {/* Top Header Bar - Always fixed at top during scroll */}
      <header id="main-app-header" className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl text-white border-b border-slate-800/90 shadow-xl shadow-slate-950/20 w-full max-w-full">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6 xl:px-10 2xl:px-12 w-full">
          <div className="flex items-center justify-between h-15 sm:h-16 lg:h-16 gap-2 sm:gap-3 lg:gap-4 w-full min-w-0">
            
            {/* Brand Logo & Title */}
            <div 
              className="flex items-center gap-2 sm:gap-2.5 lg:gap-3.5 cursor-pointer select-none group shrink-0 min-w-0"
              onClick={() => setActiveTab("dashboard")}
              id="brand-logo-button"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-white shadow-md shadow-blue-600/30 border border-blue-400/30 group-hover:scale-105 group-active:scale-95 transition-all shrink-0 overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
                )}
              </div>
              
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="font-black text-base sm:text-lg lg:text-xl text-white tracking-tight uppercase font-outfit whitespace-nowrap">
                    SOAL GURU
                  </span>
                  <span className="hidden xl:inline-flex items-center px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 rounded-md border border-blue-400/30 shrink-0">
                    AI EDUTECH
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-semibold tracking-normal hidden 2xl:block truncate">
                  Platform Asesmen Kurikulum Merdeka & K13
                </p>
              </div>
            </div>

            {/* Desktop & Tablet Navigation Menu */}
            <nav 
              aria-label="Navigasi Utama"
              className="hidden md:flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-800/90 shadow-xs shrink-0"
            >
              {navItems.map((item, index) => {
                const isActive = activeTab === item.id;
                const isCreate = item.id === "create";
                return (
                  <React.Fragment key={item.id}>
                    {/* Visual separation before settings & admin tabs */}
                    {index === 4 && (
                      <div className="h-4.5 w-px bg-slate-800/90 mx-0.5 shrink-0" />
                    )}
                    <button
                      id={`nav-tab-${item.id}`}
                      onClick={() => setActiveTab(item.id)}
                      title={item.label}
                      className={`group flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 xl:px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-normal transition-all relative cursor-pointer select-none whitespace-nowrap ${
                        isActive
                          ? isCreate
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-xs shadow-blue-500/25 ring-1 ring-blue-400/30"
                            : "bg-blue-600 text-white font-bold shadow-xs shadow-blue-500/25 ring-1 ring-blue-400/30"
                          : isCreate
                          ? "text-blue-300 hover:text-white hover:bg-slate-800/70 active:bg-slate-800"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 active:bg-slate-800"
                      }`}
                    >
                      <span className={`shrink-0 transition-colors ${
                        isActive 
                          ? "text-white" 
                          : isCreate 
                          ? "text-blue-400 group-hover:text-blue-300" 
                          : "text-slate-400 group-hover:text-slate-200"
                      }`}>
                        {item.icon}
                      </span>
                      <span className="font-semibold text-xs tracking-tight">
                        {item.label}
                      </span>
                      {item.id === "admin" && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-black tracking-wider uppercase ml-0.5 ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
                        }`}>
                          ADM
                        </span>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Right Actions: Google Connection Status & Quick CTA */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Google Profile & Auth Menu */}
              {isGoogleConnected ? (
                <div className="relative" ref={dropdownRef}>
                  <button 
                    type="button"
                    id="navbar-user-profile-btn"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-1.5 p-1 sm:p-1.5 xl:px-3 xl:py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-slate-700/80 rounded-xl text-xs xl:text-sm font-semibold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                    title={`Akun: ${displayName} (${email})`}
                  >
                    {photoURL ? (
                      <img 
                        src={photoURL} 
                        alt={displayName} 
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 sm:w-7 sm:h-7 xl:w-6 xl:h-6 rounded-lg object-cover border border-emerald-400 shrink-0" 
                      />
                    ) : (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 xl:w-6 xl:h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs border border-blue-400 shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden xl:inline-block font-bold text-xs xl:text-sm max-w-[130px] 2xl:max-w-[160px] truncate text-slate-200">
                      {displayName}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden xl:block transition-transform duration-200 shrink-0" />
                  </button>

                  {/* Profile Dropdown Menu */}
                  {isDropdownOpen && (
                    <div 
                      id="navbar-user-dropdown"
                      className="absolute right-0 mt-2 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      {/* User Header */}
                      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center gap-3">
                        {photoURL ? (
                          <img 
                            src={photoURL} 
                            alt={displayName} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shrink-0" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base border border-blue-400 shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-white truncate">{displayName}</p>
                          <p className="text-xs text-slate-400 truncate">{email}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                            <span>Akun Google Aktif</span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Navigation Items */}
                      <div className="py-1">
                        <button
                          type="button"
                          id="nav-dropdown-bank"
                          onClick={() => {
                            setActiveTab("bank");
                            setIsDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>Bank Soal Pribadi</span>
                        </button>

                        <button
                          type="button"
                          id="nav-dropdown-history"
                          onClick={() => {
                            setActiveTab("history");
                            setIsDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Riwayat Google Form</span>
                        </button>

                        <button
                          type="button"
                          id="nav-dropdown-settings"
                          onClick={() => {
                            setActiveTab("settings");
                            setIsDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                        >
                          <SettingsIcon className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>Pengaturan Akun & Sekolah</span>
                        </button>

                        <button
                          type="button"
                          id="nav-dropdown-admin"
                          onClick={() => {
                            setActiveTab("admin");
                            setIsDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-amber-300 hover:text-amber-200 hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                        >
                          <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Menu Administrator</span>
                        </button>
                      </div>

                      {/* Account Switching & Logout Actions */}
                      <div className="border-t border-slate-800/80 pt-1 mt-1">
                        {onSwitchGoogleAccount && (
                          <button
                            type="button"
                            id="navbar-switch-account-btn"
                            onClick={() => {
                              setIsDropdownOpen(false);
                              onSwitchGoogleAccount();
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 transition-colors text-left cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4 shrink-0" />
                            <span>Ganti Akun Google</span>
                          </button>
                        )}
                        <button
                          type="button"
                          id="navbar-logout-btn"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            onLogoutGoogle?.();
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          <span>Keluar / Logout</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  id="google-connect-button-nav"
                  onClick={onConnectGoogle}
                  className="flex items-center gap-1.5 p-1.5 sm:p-2 xl:px-3.5 xl:py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 border border-slate-200 hover:shadow-md"
                  title="Masuk dengan Akun Google (@gmail.com, @belajar.id, dsb)"
                >
                  <LogIn className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-bold hidden xl:inline">Masuk Google</span>
                  <span className="font-bold hidden sm:inline md:hidden xl:hidden">Masuk</span>
                </button>
              )}

              {/* Quick Action Button: Buat Soal - Visible only on mobile screens where desktop nav is hidden */}
              <button
                type="button"
                id="cta-buat-soal-header"
                onClick={() => setActiveTab("create")}
                className={`flex md:hidden items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-black tracking-wide shadow-md shadow-blue-900/40 hover:shadow-lg hover:shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all border border-blue-400/30 cursor-pointer shrink-0 ${
                  activeTab === "create" ? "ring-2 ring-amber-300/60" : ""
                }`}
                title="Mulai buat naskah soal ujian baru"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
                <span className="uppercase font-black text-xs sm:text-sm">Buat Soal</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Visible strictly on small screens < md) */}
      <nav 
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 text-white md:hidden shadow-2xl py-1 px-1.5 no-print safe-area-pb w-full max-w-full"
      >
        <div className="grid grid-cols-6 gap-0.5 items-center max-w-lg mx-auto w-full">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all relative cursor-pointer min-w-0 ${
                  isActive
                    ? "text-blue-400 font-black"
                    : "text-slate-400 hover:text-slate-200 active:scale-95"
                }`}
              >
                {item.id === "create" ? (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center -mt-2 shadow-lg transition-transform ${
                    isActive 
                      ? "bg-blue-600 text-white shadow-blue-500/40 ring-2 ring-blue-300 scale-105" 
                      : "bg-slate-800 text-amber-300 border border-slate-700"
                  }`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                ) : (
                  <div className={`p-1 rounded-lg transition-colors ${isActive ? "bg-blue-500/10 text-blue-400" : ""}`}>
                    {item.icon}
                  </div>
                )}
                <span className={`text-[10px] tracking-tight truncate w-full text-center mt-0.5 ${isActive ? "font-black text-blue-400" : "font-medium text-slate-400"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

