"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send, Square, Sparkles,
  Loader2, ChevronRight, RotateCcw, Paperclip,
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
  return `${formatTime(startSec)} - ${formatTime(endSec)}`;
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

  const handleAttachment = () => {
    alert("Attachment support is coming soon!");
  };

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Chat Header (only when active) ── */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white shrink-0 select-none">
          <span className="text-[10px] font-extrabold text-violet-600 bg-violet-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Active Session
          </span>
          <button
            onClick={clearMessages}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200"
          >
            <RotateCcw className="w-3 h-3" />
            Clear Chat
          </button>
        </div>
      )}

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0 px-6 py-6">
        {messages.length === 0 ? (

          /* ── Empty State ── */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
            <div className="flex flex-col items-center w-full text-center">

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
              >
                <Sparkles className="w-6 h-6 text-white" />
              </div>

              {/* Heading */}
              <h3 className="text-base font-extrabold text-gray-900 mb-2 tracking-tight">
                Ask Anything About These Videos
              </h3>
              <p className="text-sm text-gray-500 mb-7 leading-relaxed font-medium max-w-sm">
                Query hooks, pacing, transcripts, engagement metrics, and content strategy — backed by direct transcript citations.
              </p>

              {/* Suggestion chips */}
              <div className="flex flex-col gap-2 w-full px-4">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestion(q)}
                    className="group text-sm text-left px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50/30 transition-all flex items-center justify-between gap-3 font-semibold shadow-xs"
                  >
                    <span className="line-clamp-1">{q}</span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-gray-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>

            </div>
          </div>

        ) : (

          /* ── Active Chat Thread ── */
          <div className="px-5 py-5 space-y-5">
            {messages.map((msg, index) => {
              if (msg.role === "user") {
                return (
                  <React.Fragment key={msg.id || index}>
                    {/* User bubble — full width */}
                    <div className="w-full bg-violet-700 text-white rounded-2xl px-5 py-3.5 text-sm font-semibold leading-relaxed animate-fade-in">
                      {msg.content}
                    </div>

                    {/* Streaming status pill */}
                    {isStreaming && index === messages.length - 1 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-gray-500 animate-pulse w-fit">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />
                        <span>{statusMessage || "Retrieving transcript chunks..."}</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              } else {
                return (
                  <div key={msg.id || index} className="w-full animate-fade-in">

                    {/* Unified assistant card */}
                    <div className="w-full bg-white border border-gray-200/80 rounded-2xl shadow-xs overflow-hidden">

                      {/* Reasoning */}
                      <div className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 select-none">
                          <span>⚙</span> Reasoning
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          {msg.isStreaming && !msg.content ? (
                            <span className="flex items-center gap-1.5 text-violet-600 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Analyzing hook pacing and semantic vector alignments...
                            </span>
                          ) : (
                            "Analyzing the first 10 seconds of both transcripts and visual pacing data. Video A immediately addresses a common viewer pain point, while Video B spends 8 seconds on a branded intro sequence."
                          )}
                        </p>
                      </div>

                      {/* Answer */}
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest pb-2.5 border-b border-gray-100 mb-3 select-none">
                          <span>▤</span> Answer
                          {msg.isStreaming && (
                            <span className="ml-auto flex items-center gap-1 text-[8px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-bold">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              Streaming
                            </span>
                          )}
                        </div>

                        <div className="chat-markdown text-gray-800 text-sm leading-relaxed prose prose-violet max-w-none font-medium">
                          {msg.content ? (
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                                li: ({ children }) => <li className="mb-1.5 last:mb-0 list-disc ml-4">{children}</li>,
                                ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-3 list-decimal ml-4 space-y-1">{children}</ol>,
                                a: ({ href, children }) => (
                                  <span className="inline-flex items-center mx-0.5 px-2 py-0.5 text-[10px] font-bold text-violet-700 bg-violet-100/80 rounded-lg pointer-events-none select-none">
                                    {children}
                                  </span>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <div className="flex gap-1 py-1 items-center">
                              <span className="w-1.5 h-1.5 bg-violet-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1.5 h-1.5 bg-violet-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1.5 h-1.5 bg-violet-600 rounded-full animate-bounce" />
                            </div>
                          )}
                        </div>

                        {/* Cited Evidence — inset inside the card */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-4 rounded-xl border border-gray-200/80 bg-slate-50 p-3.5 space-y-3">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 pb-2 border-b border-gray-200/60 select-none">
                              <span>▤</span> Cited Evidence
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {msg.citations.slice(0, 2).map((cit, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="bg-white border border-gray-200/80 rounded-xl p-3 flex flex-col gap-2.5 shadow-xs"
                                >
                                  <p className="text-xs italic text-gray-600 leading-relaxed font-medium">
                                    &ldquo;{cit.chunk_text_preview.trim()}...&rdquo;
                                  </p>
                                  <div className="inline-block bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-[9px] font-bold text-gray-400 w-fit font-mono">
                                    {getMockTimestampForChunk(cit.chunk_number)}
                                  </div>
                                  <div className="text-[10px] font-extrabold text-violet-600 pt-1.5 border-t border-gray-100">
                                    Video {cit.video_label} • {getMockTagsForVideo(cit.video_label, cit.chunk_number)}
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

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

        )}
      </div>

      {/* ── Input Bar ── */}
      <div className="shrink-0 px-5 py-4 bg-white border-t border-gray-100 select-none">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">

          {/* Attachment button */}
          <button
            type="button"
            onClick={handleAttachment}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Input */}
          <div className="flex-1 flex items-center border border-gray-200 rounded-xl bg-white focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all px-4 py-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about retention, hooks, pacing, or specific quotes..."
              className="flex-1 bg-transparent outline-none text-xs text-gray-800 placeholder:text-gray-400 font-medium"
              disabled={isStreaming}
              id="chat-input"
            />
          </div>

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-red-500" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
              }}
              id="chat-send"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        <p className="text-[10px] text-center text-gray-400 mt-3 font-medium tracking-wide">
          AI can make mistakes. Always verify claims against the transcript.
        </p>
      </div>

    </div>
  );
}