"use client";

import React, { useState } from "react";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Play,
  Eye,
  Heart,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { formatNumber, formatDuration, formatRate } from "@/lib/utils";
import type { VideoSummary } from "@/lib/types";

interface VideoComparisonProps {
  videos: VideoSummary[];
}

function MetricCell({
  icon,
  label,
  value,
  accent,
  accentColor,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  accentColor: string;
  border: string;
}) {
  return (
    <div 
      className="flex flex-col gap-1 px-5 py-4 transition-colors duration-250 hover:bg-slate-50/45" 
      style={{ borderRight: border }}
    >
      <div
        className="flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-widest"
        style={{ color: accent ? accentColor : "#64748b" }}
      >
        <span style={{ color: accent ? accentColor : "#94a3b8" }}>{icon}</span>
        {label}
      </div>
      <span
        className="text-xl font-black leading-none tracking-tight"
        style={{ color: accent ? accentColor : "#0f172a" }}
      >
        {value}
      </span>
    </div>
  );
}

function VideoCard({
  video,
  label,
  accent,
}: {
  video: VideoSummary;
  label: string;
  accent: { color: string; light: string; gradient: string };
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden border border-gray-100 bg-white"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      <div className="px-5 py-3.5 flex items-center gap-3 border-b border-slate-100/50" style={{ background: accent.light }}>
        <span
          className="text-[9px] font-black uppercase tracking-widest text-white px-3 py-1.5 rounded-full"
          style={{ background: accent.gradient }}
        >
          Video {label}
        </span>
        <span className="text-[12px] font-semibold text-slate-500 truncate">
          @{video.creator || "creator"}
        </span>
      </div>

      <div className="flex gap-4 p-5">
        <div className="relative shrink-0 w-28 h-20 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-100/50">
          {video.thumbnail_url && !imgError ? (
            <img 
              src={video.thumbnail_url} 
              alt={video.title} 
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center transition-colors duration-300 hover:bg-slate-50"
              style={{ background: `linear-gradient(135deg, ${accent.color}22, ${accent.color}44)` }}
            >
              <Play className="w-7 h-7" style={{ color: accent.color }} />
            </div>
          )}
          <div className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm select-none">
            {formatDuration(video.duration)}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex items-start pt-0.5">
          <h3 className="text-[13px] font-bold text-slate-900 leading-snug line-clamp-3">{video.title}</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-slate-100 mt-auto">
        <MetricCell
          icon={<Eye className="w-3 h-3" />}
          label="Views"
          value={formatNumber(video.views)}
          accentColor={accent.color}
          border="1px solid #f1f5f9"
        />
        <MetricCell
          icon={<TrendingUp className="w-3 h-3" />}
          label="Engagement"
          value={formatRate(video.engagement_rate)}
          accent
          accentColor={accent.color}
          border="none"
        />
        <div className="col-span-2 border-t border-slate-100 grid grid-cols-2">
          <MetricCell
            icon={<Heart className="w-3 h-3" />}
            label="Likes"
            value={formatNumber(video.likes)}
            accentColor={accent.color}
            border="1px solid #f1f5f9"
          />
          <MetricCell
            icon={<MessageCircle className="w-3 h-3" />}
            label="Comments"
            value={formatNumber(video.comments_count)}
            accentColor={accent.color}
            border="none"
          />
        </div>
      </div>

      {video.transcript_available && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-center gap-2 py-3 text-[11px] font-bold text-slate-400 hover:text-violet-600 hover:bg-slate-50/80 transition-colors duration-200"
          >
            <FileText className="w-3.5 h-3.5" />
            {showTranscript ? "Hide" : "View"} Transcript
            {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showTranscript && (
            <div
              className="mx-4 mb-4 p-4 rounded-xl border animate-fade-in"
              style={{ borderColor: `${accent.color}33`, background: `${accent.color}08` }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: accent.color }}>
                ✦ Transcript Indexed
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Parsed via Whisper · Embedded via BGE · Stored in pgvector for instant RAG retrieval.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VideoComparison({ videos }: VideoComparisonProps) {
  const videoA = videos.find((v) => v.video_label === "A");
  const videoB = videos.find((v) => v.video_label === "B");
  if (!videoA || !videoB) return null;

  return (
    <div className="flex flex-col lg:flex-row items-stretch gap-4 w-full">
      <VideoCard
        video={videoA}
        label="A"
        accent={{ color: "#7c3aed", light: "#f5f3ff", gradient: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}
      />

      <div className="hidden lg:flex flex-col items-center justify-center gap-3 shrink-0 py-6">
        <div className="w-px flex-1" style={{ background: "linear-gradient(to bottom, transparent, #e2e8f0, transparent)" }} />
        <div className="w-9 h-9 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center text-[9px] font-black text-slate-400 shadow-sm select-none">
          VS
        </div>
        <div className="w-px flex-1" style={{ background: "linear-gradient(to bottom, transparent, #e2e8f0, transparent)" }} />
      </div>

      <div className="flex lg:hidden items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
          VS
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <VideoCard
        video={videoB}
        label="B"
        accent={{ color: "#2563eb", light: "#eff6ff", gradient: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}
      />
    </div>
  );
}