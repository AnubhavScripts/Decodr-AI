"use client";

import React, { useState } from "react";
import {
  FileText, ChevronDown, ChevronUp, PlaySquare,
} from "lucide-react";
import { formatNumber, formatDuration, formatRate } from "@/lib/utils";
import type { VideoSummary } from "@/lib/types";

interface VideoComparisonProps {
  videos: VideoSummary[];
}

export default function VideoComparison({ videos }: VideoComparisonProps) {
  const videoA = videos.find((v) => v.video_label === "A");
  const videoB = videos.find((v) => v.video_label === "B");

  if (!videoA || !videoB) return null;

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 w-full">
      <VideoCard video={videoA} label="A" />
      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-extrabold text-gray-400 shrink-0 select-none shadow-xs">
        VS
      </div>
      <VideoCard video={videoB} label="B" />
    </div>
  );
}

function VideoCard({
  video,
  label,
}: {
  video: VideoSummary;
  label: string;
}) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="flex-1 w-full min-w-0 bg-white border border-gray-200/85 rounded-2xl p-5 flex flex-col gap-5 shadow-xs relative">
      
      {/* Thumbnail + Info row */}
      <div className="flex flex-row gap-5 items-start">
        
        {/* Left: Thumbnail Image */}
        {video.thumbnail_url && (
          <div className="relative rounded-xl overflow-hidden shrink-0 w-32 h-32 border border-gray-100 shadow-xs">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1.5 right-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-black/75 text-white backdrop-blur-xs select-none">
              {formatDuration(video.duration)}
            </div>
          </div>
        )}

        {/* Right: Meta & Metrics */}
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            {/* Title with inline video/play icon */}
            <h3 className="text-sm font-extrabold text-gray-900 leading-snug line-clamp-1 flex items-center gap-1.5">
              {video.title}
              <PlaySquare className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </h3>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              @{video.creator || "creator"}
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-3 border-t border-gray-100">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Views</span>
              <span className="text-sm font-extrabold text-gray-900">{formatNumber(video.views)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Engagement</span>
              <span className="text-sm font-extrabold text-violet-600">{formatRate(video.engagement_rate)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Likes</span>
              <span className="text-sm font-extrabold text-gray-900">{formatNumber(video.likes)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Comments</span>
              <span className="text-sm font-extrabold text-gray-900">{formatNumber(video.comments_count)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Action Toggle Button */}
      {video.transcript_available && (
        <div className="w-full">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-all bg-white"
          >
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span>View Transcript</span>
            {showTranscript ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
            )}
          </button>

          {showTranscript && (
            <div className="mt-3 rounded-xl p-3.5 border border-violet-100 bg-violet-50/30 animate-fade-in space-y-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">
                Transcript Indexed
              </p>
              <p className="text-xs text-gray-600 leading-relaxed font-normal">
                Audio parsed via Whisper, embedded via BGE, and stored in pgvector for instant RAG responses.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
