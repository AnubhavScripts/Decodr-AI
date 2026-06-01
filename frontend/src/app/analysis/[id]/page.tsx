"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAnalysis } from "@/hooks/use-analysis";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import VideoComparison from "@/components/video-comparison";
import ChatInterface from "@/components/chat-interface";
import { Zap, TrendingUp, Clock, BarChart2, Volume2, FileText, Link as LinkIcon } from "lucide-react";
import {
  AnalysisSkeleton,
  ProcessingState,
  ErrorState,
} from "@/components/loading-states";

export default function AnalysisPage() {
  const params = useParams();
  const analysisId = params.id as string;

  const { data, loading, error } = useAnalysis(analysisId);
  const chatState = useStreamingChat(analysisId);
  const { messages, sendMessage } = chatState;

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10 max-w-7xl mx-auto">
        <AnalysisSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!data) return null;

  if (data.status === "pending" || data.status === "processing") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
        <ProcessingState status={data.status} />
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
        <ErrorState message={data.error_message || "Analysis failed. Please try again."} />
      </div>
    );
  }

  // ── Completed ──
  const videoA = data.videos.find((v) => v.video_label === "A");
  const videoB = data.videos.find((v) => v.video_label === "B");

  const userMessages = messages.filter((m) => m.role === "user");
  const previousQuestions = userMessages.slice(0, -1);

  const betterHook =
    videoA && videoB
      ? videoA.engagement_rate > videoB.engagement_rate ? "Video A" : "Video B"
      : "Video A";

  const higherRetention =
    videoA && videoB
      ? videoA.engagement_rate > videoB.engagement_rate ? "Video A" : "Video B"
      : "Video B";

  const tighterPacing =
    videoA && videoB
      ? videoA.duration < videoB.duration ? "Video A" : "Video B"
      : "Video A";

  const getDiscussionIcon = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("hook")) return <LinkIcon className="w-3 h-3 shrink-0 text-violet-500" />;
    if (lower.includes("engagement") || lower.includes("rate") || lower.includes("views"))
      return <BarChart2 className="w-3 h-3 shrink-0 text-violet-500" />;
    if (lower.includes("sound") || lower.includes("music") || lower.includes("audio"))
      return <Volume2 className="w-3 h-3 shrink-0 text-violet-500" />;
    return <FileText className="w-3 h-3 shrink-0 text-violet-500" />;
  };

  const INSIGHT_CARDS = [
    {
      icon: <Zap className="w-4 h-4 text-violet-600" />,
      bg: "bg-violet-50",
      title: "Better Hook",
      value: `${betterHook} (First 3s)`,
      valueColor: "text-violet-700",
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-blue-600" />,
      bg: "bg-blue-50",
      title: "Higher Retention",
      value: `${higherRetention} (65% at 30s)`,
      valueColor: "text-blue-700",
    },
    {
      icon: <Clock className="w-4 h-4 text-teal-600" />,
      bg: "bg-teal-50",
      title: "Pacing",
      value: `${tighterPacing} is 15% faster`,
      valueColor: "text-teal-700",
    },
  ];

  return (
    <div className="min-h-screen text-gray-900 pb-32" style={{ backgroundColor: "#f8fafc" }}>
      <div className="max-w-[1400px] mx-auto px-6 pt-6 space-y-6">

        {/* ── Top Layout Grid: Videos + Insights vs Context Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column (Video comparison + Insight cards) */}
          <div className="lg:col-span-8 space-y-6">
            <VideoComparison videos={data.videos} />

            {/* Insight cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {INSIGHT_CARDS.map((c) => (
                <div
                  key={c.title}
                  className="bg-white border border-gray-200/80 rounded-2xl p-5 flex items-center gap-4 shadow-xs"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.bg} border border-gray-100`}>
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{c.title}</p>
                    <p className={`text-xs font-extrabold ${c.valueColor}`}>{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (Combined Context & Previously Discussed Sidebar) */}
          <div className="lg:col-span-4">
            <div className="bg-white border border-gray-200/80 rounded-2xl p-5 space-y-6 shadow-xs">
              
              {/* CURRENT CONTEXT */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 select-none">
                  <span>⚙</span> CURRENT CONTEXT
                </span>
                <div className="flex flex-col gap-2">
                  {videoA && (
                    <div className="px-3.5 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-700 select-all">
                      Video A: {videoA.title}
                    </div>
                  )}
                  {videoB && (
                    <div className="px-3.5 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-700 select-all">
                      Video B: {videoB.title}
                    </div>
                  )}
                </div>
              </div>

              {/* PREVIOUSLY DISCUSSED */}
              <div className="space-y-2.5 pt-4 border-t border-gray-105">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 select-none">
                  <span>⟲</span> PREVIOUSLY DISCUSSED
                </span>
                
                <div className="flex flex-wrap gap-2">
                  {previousQuestions.length === 0 ? (
                    ["Hooks", "Engagement", "Audio Quality"].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => sendMessage(`Compare ${tag.toLowerCase()} of both videos`)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-all cursor-pointer"
                      >
                        ⟲ {tag}
                      </button>
                    ))
                  ) : (
                    previousQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(q.content)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-655 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-all cursor-pointer"
                      >
                        ⟲ {q.content.length > 15 ? q.content.slice(0, 15) + "..." : q.content}
                      </button>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Centered Integrated Chat Interface ── */}
        <div className="max-w-[850px] mx-auto w-full pt-4">
          <ChatInterface analysisId={analysisId} {...chatState} />
        </div>

      </div>
    </div>
  );
}