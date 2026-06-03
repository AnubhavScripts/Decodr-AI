"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAnalysis } from "@/hooks/use-analysis";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import VideoComparison from "@/components/video-comparison";
import ChatInterface from "@/components/chat-interface";
import {
  Zap, TrendingUp, Clock, Hash, BarChart2,
  Sparkles, MessageSquare, AlertTriangle,
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

        {/* Warning banner for partial success (missing transcripts) */}
        {data.status === "partial_success" && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-5 py-4 rounded-2xl flex items-start gap-3.5 shadow-sm animate-fade-in-up">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-800 uppercase tracking-wider">Partial Analysis Successful</p>
              <p className="text-slate-600 font-medium">
                {data.error_message || "Transcript unavailable due to platform restrictions."}
              </p>
              <p className="text-slate-500 font-semibold text-[10px]">
                You can still view video metadata, compare performance/engagement metrics, and chat with the AI about stats. Semantic transcript search and hook breakdown are disabled for unavailable videos.
              </p>
            </div>
          </div>
        )}

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