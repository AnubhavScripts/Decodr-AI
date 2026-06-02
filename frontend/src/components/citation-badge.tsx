"use client";

import React, { useState } from "react";
import { FileText } from "lucide-react";
import type { Citation } from "@/lib/types";

interface CitationBadgeProps {
  citation: Citation;
}

export default function CitationBadge({ citation }: CitationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const labelColor = citation.video_label === "A" ? "#7c3aed" : "#2563eb";

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-all hover:scale-105 cursor-default"
        style={{
          background: `${labelColor}15`,
          color: labelColor,
          border: `1px solid ${labelColor}30`,
        }}
      >
        <FileText className="w-3 h-3" />
        Video {citation.video_label} · Chunk {citation.chunk_number}
        {citation.start_time !== undefined && citation.start_time !== null && citation.end_time !== undefined && citation.end_time !== null && (
          <span> · {citation.start_time.toFixed(1)}s–{citation.end_time.toFixed(1)}s</span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && citation.chunk_text_preview && (
        <div
          className="absolute bottom-full left-0 mb-2 w-64 p-3 rounded-lg text-xs z-50 animate-fade-in shadow-lg bg-white border border-gray-200 text-gray-700"
        >
          <p className="font-semibold mb-1" style={{ color: labelColor }}>
            Video {citation.video_label}, Chunk {citation.chunk_number}
            {citation.start_time !== undefined && citation.start_time !== null && citation.end_time !== undefined && citation.end_time !== null && (
              <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                Timestamp: {citation.start_time.toFixed(1)}s – {citation.end_time.toFixed(1)}s
              </span>
            )}
          </p>
          <p className="leading-relaxed line-clamp-4 text-gray-600">
            &ldquo;{citation.chunk_text_preview}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
