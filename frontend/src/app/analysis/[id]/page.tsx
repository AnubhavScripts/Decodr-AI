"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAnalysis } from "@/hooks/use-analysis";
import { useStreamingChat } from "@/hooks/use-streaming-chat";
import VideoComparison from "@/components/video-comparison";
import ChatInterface from "@/components/chat-interface";
import { Zap, TrendingUp, Clock, Hash, BarChart2 } from "lucide-react";
import { AnalysisSkeleton, ProcessingState, ErrorState } from "@/components/loading-states";

function InsightChip({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 border border-slate-100/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-200 cursor-default"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: bg, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1 select-none">{label}</p>
        <p className="text-[13.5px] font-extrabold truncate" style={{ color: color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const params = useParams();
  const analysisId = params.id as string;

  const { data, loading, error } = useAnalysis(analysisId);
  const chatState = useStreamingChat(analysisId);
  const { messages, sendMessage } = chatState;

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] px-6 py-10 max-w-[1400px] mx-auto">
        <AnalysisSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-6">
        <ErrorState message={error} />
      </div>
    );
  }

  if (!data) return null;

  if (data.status === "pending" || data.status === "processing") {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-6">
        <ProcessingState status={data.status} />
      </div>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-6">
        <ErrorState message={data.error_message || "Analysis failed."} />
      </div>
    );
  }

  const videoA = data.videos.find((v) => v.video_label === "A");
  const videoB = data.videos.find((v) => v.video_label === "B");

  const userMessages = messages.filter((m) => m.role === "user");

  const betterHook = videoA && videoB ? (videoA.engagement_rate > videoB.engagement_rate ? "Video A" : "Video B") : "Video A";
  const higherRetention = videoA && videoB ? (videoA.engagement_rate > videoB.engagement_rate ? "Video A" : "Video B") : "Video B";
  const tighterPacing = videoA && videoB ? (videoA.duration < videoB.duration ? "Video A" : "Video B") : "Video A";

  const INSIGHTS = [
    { icon: <Zap className="w-5 h-5" />, label: "Better Hook", value: `${betterHook} (First 3s)`, color: "#7c3aed", bg: "#f5f3ff" },
    { icon: <TrendingUp className="w-5 h-5" />, label: "Higher Retention", value: `${higherRetention} (65% at 30s)`, color: "#2563eb", bg: "#eff6ff" },
    { icon: <Clock className="w-5 h-5" />, label: "Pacing", value: `${tighterPacing} is 15% faster`, color: "#0d9488", bg: "#f0fdfa" },
  ];

  const tags =
    userMessages.length === 0
      ? ["Hooks", "Engagement", "Audio Quality"]
      : userMessages.slice(-3).map((q) => (q.content.length > 24 ? q.content.slice(0, 24) + "…" : q.content));

  return (
    <div className="min-h-screen pb-40" style={{ backgroundColor: "#f8fafc", paddingTop: "96px" }}>
      <div className="max-w-[1400px] mx-auto px-6 space-y-6">
        
        {/* Main Video Comparison Card */}
        <div
          className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
        >
          <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 select-none">Video Comparison</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="w-2 h-2 rounded-full bg-blue-400" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px]">
            {/* Left: Video Comparison Only */}
            <div className="pl-6 pr-6 pt-6 pb-6 border-b lg:border-b-0 lg:border-r border-slate-100">
              <VideoComparison videos={data.videos} />
            </div>

            {/* Right Sidebar */}
            <div className="flex flex-col divide-y divide-slate-100 min-h-0">
              <div className="p-5 space-y-3 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 select-none">
                    {userMessages.length === 0 ? "Quick Topics" : "Previously Discussed"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        sendMessage(
                          userMessages.length === 0 ? `Compare ${tag.toLowerCase()} of both videos` : userMessages[userMessages.length - 1 - i]?.content ?? tag
                        )
                      }
                      className="text-[9px] font-extrabold tracking-wider uppercase px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-500 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-600 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                    >
                      # {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 pt-5 pb-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50/50 border border-slate-100/80 px-4 py-3 flex flex-col gap-1 hover:border-violet-100 hover:bg-violet-50/10 transition-all duration-350">
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-violet-500">
                    <Hash className="w-3.5 h-3.5 text-violet-400" /> Chunks
                  </div>
                  <span className="text-xl font-extrabold text-slate-800">48</span>
                </div>
                <div className="rounded-2xl bg-slate-50/50 border border-slate-100/80 px-4 py-3 flex flex-col gap-1 hover:border-blue-100 hover:bg-blue-50/10 transition-all duration-350">
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-500">
                    <BarChart2 className="w-3.5 h-3.5 text-blue-400" /> Q&A
                  </div>
                  <span className="text-xl font-extrabold text-slate-800">{userMessages.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Context Section - SEPARATE from main card */}
        {videoA && videoB && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 select-none">Current Context</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className="rounded-xl border border-violet-100 border-l-4 border-l-violet-500 overflow-hidden transition-all duration-300 hover:shadow-md hover:border-violet-200" 
                style={{ boxShadow: "0 2px 8px rgba(124,58,237,0.03)" }}
              >
                <div className="px-3 py-1 bg-violet-50/70 text-[8px] font-black tracking-widest text-violet-600 uppercase border-b border-violet-100/40">
                  Video A
                </div>
                <div className="px-4 py-3 text-[11.5px] font-semibold text-slate-600 leading-normal bg-white">
                  {videoA.title}
                </div>
              </div>

              <div 
                className="rounded-xl border border-blue-100 border-l-4 border-l-blue-500 overflow-hidden transition-all duration-300 hover:shadow-md hover:border-blue-200" 
                style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.03)" }}
              >
                <div className="px-3 py-1 bg-blue-50/70 text-[8px] font-black tracking-widest text-blue-600 uppercase border-b border-blue-100/40">
                  Video B
                </div>
                <div className="px-4 py-3 text-[11.5px] font-semibold text-slate-600 leading-normal bg-white">
                  {videoB.title}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Insight Chips */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {INSIGHTS.map((c) => (
            <InsightChip key={c.label} {...c} />
          ))}
        </section>

        {/* Chat Interface */}
        <ChatInterface analysisId={analysisId} {...chatState} />
      </div>
    </div>
  );
}