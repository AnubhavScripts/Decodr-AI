"use client";

import React, { useState } from "react";
import {
  FileText, ChevronDown, ChevronUp,
  Play, Eye, Heart, MessageCircle, TrendingUp,
} from "lucide-react";
import { formatNumber, formatDuration, formatRate } from "@/lib/utils";
import type { VideoSummary } from "@/lib/types";

interface VideoComparisonProps {
  videos: VideoSummary[];
}

/** Strip emojis / special characters from API-returned titles */
function cleanTitle(title: string): string {
  return title
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[✅❌🔗✏️⚡🎯🚀💡🔥⭐🏆🎉🎊]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function MetricCell({
  icon,
  label,
  value,
  accent,
  accentColor,
  showRightBorder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  accentColor: string;
  showRightBorder?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 px-5 py-4.5 hover:bg-slate-50/60 transition-colors duration-150 cursor-default"
      style={{ borderRight: showRightBorder ? "1px solid #f1f5f9" : "none" }}
    >
      <div
        className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: accent ? accentColor : "#94a3b8" }}
      >
        <span style={{ color: accent ? accentColor : "#cbd5e1" }}>{icon}</span>
        {label}
      </div>
      <span
        className="text-[20px] font-black leading-none tracking-tight"
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
  accent: { color: string; lightBg: string; gradient: string; borderColor: string; labelText: string };
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [imgError, setImgError] = useState(false);
  const cleanedTitle = cleanTitle(video.title);

  return (
    <div
      className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden bg-white"
      style={{
        border: `1.5px solid ${accent.borderColor}`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.06), 0 0 0 0 ${accent.color}`,
        transition: "box-shadow 0.25s ease, transform 0.25s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 28px rgba(0,0,0,0.09), 0 0 0 1px ${accent.borderColor}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.06)`;
      }}
    >
      {/* ── Coloured header bar ── */}
      <div
        className="px-5 py-3.5 flex items-center gap-3.5 rounded-t-2xl"
        style={{
          background: accent.lightBg,
          borderBottom: `1.5px solid ${accent.borderColor}`,
        }}
      >
        <span
          className="inline-flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-white px-3 py-1.5 rounded-full shrink-0 select-none"
          style={{ background: accent.gradient }}
        >
          Video {label}
        </span>
        <span className="text-[12px] font-bold truncate flex-1 min-w-0" style={{ color: accent.labelText }}>
          @{video.creator || "creator"}
        </span>
      </div>

      {/* ── Thumbnail + Title ── */}
      <div className="flex gap-4 p-5 pb-4">
        {/* Thumbnail */}
        <div
          className="relative shrink-0 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center"
          style={{ width: 108, height: 76, border: `1px solid ${accent.borderColor}` }}
        >
          {video.thumbnail_url && !imgError ? (
            <img
              src={video.thumbnail_url}
              alt={cleanedTitle}
              className="w-full h-full object-cover"
              style={{ transition: "transform 0.4s ease" }}
              onError={() => setImgError(true)}
              onMouseEnter={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1.06)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLImageElement).style.transform = "scale(1)")}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accent.color}15, ${accent.color}30)` }}
            >
              <Play className="w-6 h-6" style={{ color: accent.color }} />
            </div>
          )}
          {/* Duration badge */}
          <div className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded select-none">
            {formatDuration(video.duration)}
          </div>
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3
            className="text-[12.5px] font-bold text-slate-900 leading-snug"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {cleanedTitle}
          </h3>
        </div>
      </div>

      {/* ── Metrics grid ── */}
      <div className="grid grid-cols-2 border-t border-slate-100 mt-auto">
        <MetricCell
          icon={<Eye className="w-3 h-3" />}
          label="Views"
          value={formatNumber(video.views)}
          accentColor={accent.color}
          showRightBorder
        />
        <MetricCell
          icon={<TrendingUp className="w-3 h-3" />}
          label="Engagement"
          value={formatRate(video.engagement_rate)}
          accent
          accentColor={accent.color}
        />
        <div className="col-span-2 border-t border-slate-100 grid grid-cols-2">
          <MetricCell
            icon={<Heart className="w-3 h-3" />}
            label="Likes"
            value={formatNumber(video.likes)}
            accentColor={accent.color}
            showRightBorder
          />
          <MetricCell
            icon={<MessageCircle className="w-3 h-3" />}
            label="Comments"
            value={formatNumber(video.comments_count)}
            accentColor={accent.color}
          />
        </div>
      </div>

      {/* ── Transcript toggle ── */}
      {video.transcript_available && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold text-slate-400 hover:text-violet-600 hover:bg-slate-50/70 transition-all duration-200 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            {showTranscript ? "Hide" : "View"} Transcript
            {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showTranscript && (
            <div
              className="mx-3.5 mb-3.5 p-3.5 rounded-xl border animate-fade-in"
              style={{ borderColor: `${accent.color}22`, background: `${accent.color}05` }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: accent.color }}>
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
    <div className="flex flex-col lg:flex-row items-stretch gap-6 w-full">
      <VideoCard
        video={videoA}
        label="A"
        accent={{
          color: "#7c3aed",
          lightBg: "#f5f3ff",
          gradient: "linear-gradient(135deg,#7c3aed,#6d28d9)",
          borderColor: "#ddd6fe",
          labelText: "#6d28d9",
        }}
      />

      {/* ── VS divider — desktop ── */}
      <div className="hidden lg:flex flex-col items-center justify-center gap-2 shrink-0 py-4">
        <div className="w-px flex-1 bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
        <div
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[9px] font-black text-slate-500 select-none"
          style={{
            border: "2px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          VS
        </div>
        <div className="w-px flex-1 bg-gradient-to-b from-transparent via-slate-300 to-transparent" />
      </div>

      {/* ── VS divider — mobile ── */}
      <div className="flex lg:hidden items-center gap-3 my-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
          VS
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <VideoCard
        video={videoB}
        label="B"
        accent={{
          color: "#2563eb",
          lightBg: "#eff6ff",
          gradient: "linear-gradient(135deg,#2563eb,#1d4ed8)",
          borderColor: "#bfdbfe",
          labelText: "#1d4ed8",
        }}
      />
    </div>
  );
}