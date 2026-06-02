"use client";

import React from "react";
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";

/* ─── Skeleton ─── */
export function AnalysisSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Standalone video cards loader */}
      <div className="flex flex-col lg:flex-row items-stretch gap-6 w-full">
        <SkeletonVideoCard />
        <SkeletonVideoCard />
      </div>

      {/* Insight chips loader */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200/70 p-4 flex items-center gap-4"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <div className="skeleton w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-2 w-16 rounded" />
              <div className="skeleton h-3.5 w-28 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Chat section */}
      <div
        className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.05)", minHeight: "280px" }}
      >
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2.5">
          <div className="skeleton w-2 h-2 rounded-full" />
          <div className="skeleton h-2.5 w-24 rounded" />
        </div>
        <div className="p-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton h-11 w-full rounded-xl"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonVideoCard() {
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="skeleton h-11 w-full rounded-none" style={{ borderRadius: 0 }} />
      <div className="p-4 space-y-4">
        <div className="flex gap-4">
          <div className="skeleton w-28 aspect-video rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-full rounded" />
            <div className="skeleton h-3.5 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Processing ─── */
const STEPS = [
  "Downloading audio tracks",
  "Transcribing with Whisper",
  "Computing engagement metrics",
  "Building pgvector embeddings",
];

export function ProcessingState({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 max-w-md mx-auto text-center animate-fade-in">

      {/* Animated icon */}
      <div className="relative mb-7">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
        >
          <Loader2 className="w-9 h-9 text-white animate-spin" />
        </div>
        {/* Pulsing ring */}
        <div
          className="absolute inset-0 rounded-3xl border-2 border-violet-300 animate-ping opacity-60"
          style={{ animationDuration: "1.8s" }}
        />
      </div>

      <h2 className="text-2xl font-black text-slate-900 mb-2">Analyzing Your Videos</h2>
      <p className="text-sm text-slate-500 leading-relaxed mb-8 max-w-xs">
        Extracting audio, transcribing speech, computing engagement metrics, and building vector
        embeddings. This usually takes 30–90 seconds.
      </p>

      {/* Steps */}
      <div className="w-full max-w-xs space-y-3.5 text-left bg-slate-50/60 border border-slate-100 rounded-2xl p-5 shadow-sm">
        {STEPS.map((step) => (
          <div key={step} className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-600">
              {step}
            </span>
          </div>
        ))}
      </div>

      {/* Status pill */}
      <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-full text-xs text-violet-700 font-semibold">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping" />
        Status: {status}
      </div>

      <style>{`
        @keyframes progressGrow {
          from { width: 20%; }
          to   { width: 75%; }
        }
      `}</style>
    </div>
  );
}

/* ─── Error ─── */
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 max-w-md mx-auto text-center animate-fade-in">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 border border-red-200 shadow-sm"
        style={{ background: "linear-gradient(135deg, #fff1f2, #ffe4e6)" }}
      >
        <AlertTriangle className="w-9 h-9 text-red-500" />
      </div>

      <h2 className="text-2xl font-black text-slate-900 mb-2">Analysis Failed</h2>
      <p className="text-sm text-red-600 leading-relaxed mb-8 bg-red-50 border border-red-200 rounded-xl px-5 py-4 max-w-xs">
        {message}
      </p>

      <a href="/" className="btn-primary flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Try Again
      </a>
    </div>
  );
}
