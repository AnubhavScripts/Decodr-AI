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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || isDashboard
          ? "bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm"
          : "bg-white/80 backdrop-blur-sm border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3 h-[60px]">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-6 h-6 rounded bg-violet-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-extrabold text-gray-900 tracking-tight">
            HookIQ
          </span>
        </Link>

        {/* ── Center: Nav or Search ── */}
        {!isDashboard ? (
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
        ) : (
          <form
            onSubmit={handleQuickAnalyze}
            className="flex-1 max-w-md mx-6 hidden sm:block"
          >
            <div className="relative flex items-center bg-gray-50 border border-gray-250/70 rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all">
              <span className="text-gray-400 text-xs mr-2 select-none">🔗</span>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="https://youtube.com/v1 vs https://youtube.com/v2"
                className="flex-1 bg-transparent outline-none text-xs text-gray-800 placeholder:text-gray-400 font-medium"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-3.5 py-1 text-[10px] font-extrabold text-white bg-violet-650 rounded-lg hover:bg-violet-750 disabled:opacity-50 transition-colors ml-2 uppercase tracking-wide"
              >
                {loading ? "..." : "Analyze"}
              </button>
            </div>
          </form>
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
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 cursor-pointer transition-colors hover:bg-gray-100 border border-gray-200 bg-gray-50"
              title="Account"
            >
              <User className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
