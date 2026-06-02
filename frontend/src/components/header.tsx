"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Zap, Search, User, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isDashboard = pathname.startsWith("/analysis/");

  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Add scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleQuickAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const parts = inputVal.split(/\s+vs\s+/i);
    if (parts.length < 2) {
      alert("Please paste two video URLs separated by 'vs'. Example: URL1 vs URL2");
      return;
    }

    const urlA = parts[0].trim();
    const urlB = parts[1].trim();

    if (!urlA || !urlB) {
      alert("Both video URLs are required.");
      return;
    }

    try {
      setLoading(true);
      const result = await api.analyze(urlA, urlB);
      router.push(`/analysis/${result.analysis_id}`);
      setInputVal("");
    } catch (err: any) {
      alert(err.message || "Failed to start analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || isDashboard
          ? "bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm"
          : "bg-white/80 backdrop-blur-sm border-b border-transparent"
        }`}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-10 lg:px-16 py-3 h-[60px]">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-tr from-violet-600 to-indigo-600">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-extrabold text-gray-900 tracking-tight">
            Decodr.ai
          </span>
        </Link>

        {/* ── Center: Search or Nav ── */}
        {isDashboard ? (
          <div className="hidden md:flex items-center justify-center flex-1 mx-6">
            <form
              onSubmit={handleQuickAnalyze}
              className="flex items-center gap-2 max-w-[420px] w-full relative"
            >
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Compare another... paste 'URL1 vs URL2'"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={loading}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-9 py-2 text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100/60 transition-all"
                />
                {loading ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-violet-600" />
                ) : (
                  inputVal && (
                    <button
                      type="button"
                      onClick={() => setInputVal("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </form>
          </div>
        ) : (
          <nav className="hidden md:flex items-center gap-7">
            <a
              href="#features"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              How It Works
            </a>
            <a
              href="#analyze"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Try It
            </a>
          </nav>
        )}

        {/* ── Right Actions ── */}
        <div className="flex items-center gap-3 shrink-0">
          {!isDashboard ? (
            <>
              <Link
                href="#analyze"
                className="hidden md:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="#analyze"
                className="btn-primary text-sm py-2 px-4 rounded-lg"
              >
                Get Started
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-4">
              {/* Video A / B indicators */}
              <div className="hidden sm:flex items-center gap-4 select-none">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-600" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Video A
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Video B
                  </span>
                </div>
              </div>

              {/* User avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 cursor-pointer transition-colors hover:bg-gray-100 border border-gray-200 bg-gray-50"
                title="Account"
              >
                <User className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
