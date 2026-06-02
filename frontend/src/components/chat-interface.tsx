"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send, Square, Sparkles,
  Loader2, ChevronRight, RotateCcw, Paperclip,
  Bot,
} from "lucide-react";
import type { ChatMessage, Citation } from "@/lib/types";
import ReactMarkdown from "react-markdown";

interface ChatInterfaceProps {
  analysisId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  statusMessage: string;
  error: string | null;
  sendMessage: (content: string) => void;
  stopStreaming: () => void;
  clearMessages: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Compare the engagement rates of both videos",
  "Which video has a stronger opening hook and why?",
  "Why did one video outperform the other?",
  "Compare storytelling techniques and pacing",
  "What actionable improvements can each creator make?",
];

const getMockTimestampForChunk = (chunkNum: number) => {
  const startSec = (chunkNum - 1) * 15;
  const endSec = chunkNum * 15;
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };
  return `${formatTime(startSec)} – ${formatTime(endSec)}`;
};

const getMockTagsForVideo = (label: string, chunkNum: number) => {
  if (label === "A") {
    if (chunkNum === 1) return "High Energy • Direct Address";
    return "Actionable Hook • High Retention";
  } else {
    if (chunkNum === 1) return "Slow Pacing • Generic Intro";
    return "Branded Intro • Low Engagement";
  }
};

export default function ChatInterface({
  analysisId,
  messages,
  isStreaming,
  statusMessage,
  error,
  sendMessage,
  stopStreaming,
  clearMessages,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming) {
      sendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleSuggestion = (q: string) => {
    if (!isStreaming) sendMessage(q);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">

      {/* ── Session header (only when messages exist) ── */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-[10px] font-extrabold text-violet-600 uppercase tracking-wider select-none">
              Active Session
            </span>
          </div>
          <button
            onClick={clearMessages}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* ── Scrollable area for empty state or message thread ── */}
      <div className="flex-1 overflow-y-auto p-5 min-h-0 space-y-5">
        {messages.length === 0 ? (
          <div className="w-full flex flex-col items-center py-4 px-2">

            <h3 className="text-[16px] font-black text-slate-900 mb-2 text-center leading-snug px-6 pt-4">
              Ask Anything About These Videos
            </h3>
            <p className="text-[12px] text-slate-400 mb-6 text-center max-w-sm leading-relaxed select-none px-6 pb-2">
              Query hooks, pacing, transcripts, engagement metrics, and content
              strategy — backed by direct transcript citations.
            </p>

            {/* Suggestion chips */}
            <div className="w-full max-w-[550px] flex flex-col gap-3">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  disabled={isStreaming}
                  className="group w-full flex items-center justify-between gap-3 text-left cursor-pointer rounded-2xl px-6 py-3.5 text-[13px] font-semibold"
                  style={{
                    background: "#ffffff",
                    border: "1.5px solid #e2e8f0",
                    color: "#475569",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    transition: "all 0.18s ease",
                    animationDelay: `${i * 50}ms`,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "#f5f3ff";
                    el.style.borderColor = "#c4b5fd";
                    el.style.color = "#6d28d9";
                    el.style.boxShadow = "0 3px 10px rgba(124,58,237,0.08)";
                    el.style.transform = "translateX(3px)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "#ffffff";
                    el.style.borderColor = "#e2e8f0";
                    el.style.color = "#475569";
                    el.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
                    el.style.transform = "translateX(0)";
                  }}
                >
                  <span>{q}</span>
                  <ChevronRight
                    className="w-3.5 h-3.5 shrink-0 transition-colors duration-150 text-slate-300 group-hover:text-violet-500"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Message thread ── */
          <div className="w-full flex flex-col gap-5">
            {messages.map((msg, index) => {
              if (msg.role === "user") {
                return (
                  <React.Fragment key={msg.id || index}>
                    {/* User bubble */}
                    <div className="flex justify-end w-full">
                      <div
                        className="text-white rounded-2xl rounded-tr-sm px-5 py-3.5 text-[13px] font-semibold max-w-[80%] leading-relaxed select-text"
                        style={{
                          background: "linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)",
                          boxShadow: "0 4px 16px rgba(109,40,217,0.28)",
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>

                    {/* Streaming indicator */}
                    {isStreaming && index === messages.length - 1 && (
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "linear-gradient(135deg,#6d28d9,#4f46e5)" }}
                        >
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div
                          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold text-violet-700"
                          style={{ background: "#f5f3ff", border: "1px solid #ddd6fe" }}
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />
                          <span>{statusMessage || "Retrieving transcript chunks..."}</span>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              } else {
                return (
                  <div key={msg.id || index} className="w-full animate-fade-in">
                    {/* AI avatar + card */}
                    <div className="flex gap-3 items-start">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1"
                        style={{ background: "linear-gradient(135deg,#6d28d9,#4f46e5)" }}
                      >
                        <Bot className="w-4 h-4 text-white" />
                      </div>

                      <div
                        className="flex-1 rounded-2xl rounded-tl-sm border p-5 flex flex-col gap-4"
                        style={{
                          background: "linear-gradient(135deg,#fafbff 0%,#f8fafc 100%)",
                          borderColor: "#e8edf5",
                          boxShadow: "0 2px 12px rgba(79,70,229,0.05)",
                        }}
                      >
                        {/* Reasoning */}
                        <div className="space-y-2">
                          <p className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest">
                            ⚙ Reasoning
                          </p>
                          <p
                            className="text-[12px] text-slate-500 leading-relaxed px-3 py-2.5 rounded-lg"
                            style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}
                          >
                            {msg.isStreaming && !msg.content ? (
                              <span className="flex items-center gap-1.5 text-violet-600 animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Analyzing hook pacing and semantic vector alignments...
                              </span>
                            ) : (
                              "Analyzing the first 10 seconds of both transcripts and visual pacing data. Video A immediately addresses a common viewer pain point, while Video B spends 8 seconds on a branded intro sequence."
                            )}
                          </p>
                        </div>

                        <div className="border-t border-slate-100" />

                        {/* Answer */}
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <p className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest">
                              📋 Answer
                            </p>
                            {msg.isStreaming && (
                              <span
                                className="ml-auto flex items-center gap-1 text-[8.5px] text-violet-600 font-bold px-2.5 py-0.5 rounded-full"
                                style={{ background: "#f5f3ff", border: "1px solid #ddd6fe" }}
                              >
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Streaming
                              </span>
                            )}
                          </div>

                          <div className="chat-markdown text-slate-700 text-[13px] leading-relaxed max-w-none">
                            {msg.content ? (
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                                  li: ({ children }) => <li className="mb-1.5 list-disc ml-4">{children}</li>,
                                  ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="mb-3 list-decimal ml-4 space-y-1">{children}</ol>,
                                  a: ({ children }) => (
                                    <span className="inline-flex items-center mx-0.5 px-2 py-0.5 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100 rounded-md">
                                      {children}
                                    </span>
                                  ),
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            ) : (
                              <div className="flex gap-1.5 py-1 items-center">
                                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div
                            className="rounded-xl p-4 space-y-3"
                            style={{ background: "#f8fafc", border: "1px solid #e8edf5" }}
                          >
                            <p className="text-[9.5px] font-extrabold uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-200 select-none">
                              ▤ Cited Evidence
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {msg.citations.slice(0, 2).map((cit, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="bg-white rounded-xl p-3.5 flex flex-col gap-2.5"
                                  style={{
                                    border: "1px solid #e2e8f0",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                                    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    const el = e.currentTarget as HTMLDivElement;
                                    el.style.borderColor = "#c4b5fd";
                                    el.style.boxShadow = "0 4px 12px rgba(124,58,237,0.1)";
                                  }}
                                  onMouseLeave={(e) => {
                                    const el = e.currentTarget as HTMLDivElement;
                                    el.style.borderColor = "#e2e8f0";
                                    el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
                                  }}
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <p className="text-[11.5px] italic text-slate-500 leading-relaxed flex-1">
                                      &ldquo;{cit.chunk_text_preview.trim()}...&rdquo;
                                    </p>
                                    <span
                                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-slate-400 font-mono select-none"
                                      style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                                    >
                                      {getMockTimestampForChunk(cit.chunk_number)}
                                    </span>
                                  </div>

                                  <div
                                    className="text-[9.5px] font-extrabold uppercase tracking-wider pt-2 border-t border-slate-100"
                                    style={{ color: "#6d28d9" }}
                                  >
                                    Video {cit.video_label} · {getMockTagsForVideo(cit.video_label, cit.chunk_number)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            })}

            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── CARD-CONTAINED INPUT BAR ── */}
      <div className="shrink-0 p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col items-center w-full">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[800px] flex items-center gap-2.5 bg-white rounded-2xl px-3 py-2.5"
          style={{
            border: "1.5px solid #e2e8f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          {/* Paperclip */}
          <button
            type="button"
            onClick={() => alert("Attachment support is coming soon!")}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all shrink-0 cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about retention, hooks, pacing, or specific quotes..."
            className="flex-1 bg-transparent outline-none text-[13px] font-medium placeholder:text-slate-400"
            style={{ color: "#1e293b" }}
            disabled={isStreaming}
            id="chat-input"
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer shrink-0 transition-all"
              style={{
                background: "#fff1f2",
                border: "1.5px solid #fecaca",
                color: "#ef4444",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fee2e2")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fff1f2")}
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              id="chat-send"
              className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0 cursor-pointer transition-all disabled:cursor-not-allowed"
              style={{
                background: input.trim()
                  ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                  : "#ede9fe",
                boxShadow: input.trim() ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
                color: input.trim() ? "#ffffff" : "#c4b5fd",
              }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        <p className="text-[9px] text-slate-400 mt-2 font-semibold tracking-wide uppercase select-none">
          AI can make mistakes. Always verify claims against the transcript.
        </p>
      </div>

    </div>
  );
}
