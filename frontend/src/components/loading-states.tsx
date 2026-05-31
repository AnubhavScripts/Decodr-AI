"use client";

import React from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

/* ─── Skeleton ─── */
export function AnalysisSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top row: two video card skeletons + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <SkeletonVideoCard />
            <SkeletonVideoCard />
          </div>
        </div>
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-5 space-y-4">
            <div className="skeleton h-3 w-28 rounded" />
            <div className="skeleton h-14 w-full rounded-xl" />
            <div className="skeleton h-14 w-full rounded-xl" />
          </div>
          <div className="card p-5 space-y-3">
            <div className="skeleton h-3 w-28 rounded" />
            <div className="skeleton h-7 w-full rounded-full" />
            <div className="skeleton h-7 w-3/4 rounded-full" />
          </div>
        </div>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5 flex items-center gap-4">
            <div className="skeleton w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-4 w-full rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Chat section */}
      <div className="card" style={{ minHeight: "300px" }}>
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <div className="skeleton w-8 h-8 rounded-xl shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="skeleton h-3.5 w-24 rounded" />
            <div className="skeleton h-2.5 w-36 rounded" />
          </div>
        </div>
        <div className="p-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-12 w-full rounded-xl" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonVideoCard() {
  return (
    <div className="card overflow-hidden">
      {/* Label bar */}
      <div className="skeleton h-12 w-full rounded-none" style={{ borderRadius: 0 }} />
      <div className="p-5 space-y-4">
        <div className="flex gap-4">
          <div className="skeleton w-36 aspect-video rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-full rounded" />
            <div className="skeleton h-3.5 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

/* ─── Processing ─── */
export function ProcessingState({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 max-w-md mx-auto text-center animate-fade-in">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
      >
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2.5">Analyzing Your Videos</h2>
      <p className="text-sm text-gray-500 leading-relaxed mb-8 max-w-xs">
        Extracting audio, transcribing speech, computing engagement metrics, and building vector embeddings.
        This usually takes 30–90 seconds.
      </p>

      <div className="w-full max-w-xs space-y-3">
        {[
          "Downloading audio tracks",
          "Transcribing with Whisper",
          "Computing engagement metrics",
          "Building pgvector embeddings",
        ].map((step, i) => (
          <div key={step} className="flex items-center gap-3 text-sm">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: i === 0 ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : undefined,
                backgroundColor: i !== 0 ? "rgba(109,40,217,0.1)" : undefined,
              }}
            >
              {i === 0 ? (
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-violet-300" />
              )}
            </div>
            <span className={i === 0 ? "text-gray-900 font-medium" : "text-gray-400"}>
              {step}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-full text-xs text-violet-700 font-semibold">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping" />
        Status: {status}
      </div>
    </div>
  );
}

/* ─── Error ─── */
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 max-w-md mx-auto text-center animate-fade-in">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 bg-red-50 border border-red-200 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-red-500" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2.5">Analysis Failed</h2>
      <p className="text-sm text-red-600 leading-relaxed mb-8 bg-red-50 border border-red-200 rounded-xl px-5 py-4 max-w-xs">
        {message}
      </p>

      <a
        href="/"
        className="btn-secondary flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </a>
    </div>
  );
}
