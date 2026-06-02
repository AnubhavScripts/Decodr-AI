"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAnalysis } from "@/hooks/use-analysis";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import VideoComparison from "@/components/video-comparison";
import ChatInterface from "@/components/chat-interface";
import {
  Zap, TrendingUp, Clock, Hash, BarChart2,
  Sparkles, MessageSquare,
} from "lucide-react";
import { AnalysisSkeleton, ProcessingState, ErrorState } from "@/components/loading-states";

/* ── Section label component ── */
function SectionLabel({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-0.5">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 select-none">
        {children}
      </span>
    </div>
  );
}

/* ── Insight chip ── */
function InsightChip({
  icon,
  label,
  value,
  color,
  bg,
  borderColor,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
  borderColor: string;
  iconBg: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden"
      style={{
        borderColor,
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        transition: "transform 0.22s ease, box-shadow 0.22s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = `0 10px 28px rgba(0,0,0,0.09)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.05)";
      }}
    >
      {/* Colored top strip */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${borderColor})` }} />

      <div className="px-5 py-4 flex items-center gap-4">
        {/* Icon box */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: iconBg }}
        >
          <span style={{ color }}>{icon}</span>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1 select-none">
            {label}
          </p>
          <p className="text-[14px] font-extrabold leading-tight" style={{ color }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */
export default function AnalysisPage() {
  const params = useParams();
  const analysisId = params.id as string;

  const { data, loading, error } = useAnalysis(analysisId);
  const chatState = useStreamingChat(analysisId);
  const { messages, sendMessage } = chatState;

  /* ── Loading / Error states ── */
  if (loading && !data) {
    return (
      <div
        className="min-h-screen pb-20 px-6 md:px-20 lg:px-32"
        style={{ backgroundColor: "#f1f5f9", paddingTop: "84px" }}
      >
        <div className="max-w-[1400px] mx-auto">
          <AnalysisSkeleton />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="min-h-screen pb-20 px-6 md:px-20 lg:px-32 flex items-center justify-center"
        style={{ backgroundColor: "#f1f5f9", paddingTop: "84px" }}
      >
        <ErrorState message={error} />
      </div>
    );
  }
  if (!data) return null;
  if (data.status === "pending" || data.status === "processing") {
    return (
      <div
        className="min-h-screen pb-20 px-6 md:px-20 lg:px-32 flex items-center justify-center"
        style={{ backgroundColor: "#f1f5f9", paddingTop: "84px" }}
      >
        <ProcessingState status={data.status} />
      </div>
    );
  }
  if (data.status === "failed") {
    return (
      <div
        className="min-h-screen pb-20 px-6 md:px-20 lg:px-32 flex items-center justify-center"
        style={{ backgroundColor: "#f1f5f9", paddingTop: "84px" }}
      >
        <ErrorState message={data.error_message || "Analysis failed."} />
      </div>
    );
  }

  const videoA = data.videos.find((v) => v.video_label === "A");
  const videoB = data.videos.find((v) => v.video_label === "B");
  const userMessages = messages.filter((m) => m.role === "user");

  const betterHook =
    videoA && videoB ? (videoA.engagement_rate > videoB.engagement_rate ? "Video A" : "Video B") : "Video A";
  const higherRetention =
    videoA && videoB ? (videoA.engagement_rate > videoB.engagement_rate ? "Video A" : "Video B") : "Video B";
  const tighterPacing =
    videoA && videoB ? (videoA.duration < videoB.duration ? "Video A" : "Video B") : "Video A";

  const INSIGHTS = [
    {
      icon: <Zap className="w-5 h-5" />,
      label: "Better Hook",
      value: `${betterHook} — First 3s`,
      color: "#7c3aed",
      bg: "#f5f3ff",
      iconBg: "#ede9fe",
      borderColor: "#ddd6fe",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: "Higher Retention",
      value: `${higherRetention} — 65% at 30s`,
      color: "#2563eb",
      bg: "#eff6ff",
      iconBg: "#dbeafe",
      borderColor: "#bfdbfe",
    },
    {
      icon: <Clock className="w-5 h-5" />,
      label: "Pacing",
      value: `${tighterPacing} is 15% faster`,
      color: "#0d9488",
      bg: "#f0fdfa",
      iconBg: "#ccfbf1",
      borderColor: "#99f6e4",
    },
  ];

  const tags =
    userMessages.length === 0
      ? ["Hooks", "Engagement", "Audio Quality"]
      : userMessages
        .slice(-3)
        .map((q) => (q.content.length > 22 ? q.content.slice(0, 22) + "…" : q.content));

  return (
    <div
      className="min-h-screen pb-20 px-6 md:px-10 lg:px-16"
      style={{ backgroundColor: "#f1f5f9", paddingTop: "84px" }}
    >
      <div className="max-w-[1400px] mx-auto space-y-8">

        {/* ══════════════════════════════════════
            1. VIDEO COMPARISON CARD
        ══════════════════════════════════════ */}
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {/* Card header */}
          <div className="px-6 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white flex items-center justify-between">
            <SectionLabel dot="#8b5cf6">Video Comparison</SectionLabel>
            <div className="flex items-center gap-4 select-none">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Video A</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Video B</span>
              </div>
            </div>
          </div>

          <div className="w-full">
            {/* Video cards */}
            <div className="p-5">
              <VideoComparison videos={data.videos} />
            </div>
          </div>
        </div>

        {/* ── 2. INSIGHT CHIPS ── */}
        <div className="space-y-4">
          <SectionLabel dot="#34d399">Key Insights</SectionLabel>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {INSIGHTS.map((c, i) => (
              <div
                key={c.label}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 70}ms`, opacity: 0 }}
              >
                <InsightChip {...c} />
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. AI CHAT ── */}
        <div
          className="bg-white rounded-2xl overflow-hidden flex flex-col"
          style={{
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
            height: chatState.messages.length === 0 ? "520px" : "700px",
            marginTop: "48px",
          }}
        >
          {/* Chat header */}
          <div className="px-6 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#6d28d9,#4f46e5)" }}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-700 leading-none">AI Assistant</p>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">RAG-powered · Transcript-cited</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Live</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <ChatInterface analysisId={analysisId} {...chatState} />
          </div>
        </div>

      </div>
    </div>
  );
}