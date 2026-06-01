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
    <div className="w-full flex flex-col gap-6">

      {/* Thread Actions Header (only when messages exist) */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between py-2 border-b border-gray-100 bg-transparent shrink-0 select-none">
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

      {/* Thread Container */}
      {messages.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center py-16 px-6 bg-white border border-gray-200/80 rounded-2xl shadow-xs">
          
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-violet-600 to-indigo-600 flex-shrink-0 shadow-sm">
            <Sparkles className="w-6 h-6 text-white" />
          </div>

          <h3 className="text-[15px] font-extrabold text-gray-900 mb-1.5 text-center">
            Ask Anything About These Videos
          </h3>
          <p className="text-xs text-gray-400 mb-6 text-center max-w-[340px] leading-relaxed font-semibold">
            Query hooks, pacing, transcripts, engagement metrics, and content strategy — backed by direct transcript citations.
          </p>

          {/* Suggested question chips */}
          <div className="w-full max-w-[480px] flex flex-col gap-2.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSuggestion(q)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:border-violet-300 hover:bg-violet-50/20 hover:text-violet-750 transition-all cursor-pointer text-left shadow-2xs"
              >
                <span className="truncate">{q}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>

        </div>
      ) : (
        <div className="w-full flex flex-col gap-6">
          {messages.map((msg, index) => {
            if (msg.role === "user") {
              return (
                <React.Fragment key={msg.id || index}>
                  {/* Right-aligned vibrant User speech bubble */}
                  <div className="flex justify-end w-full">
                    <div className="bg-[#4f46e5] text-white rounded-2xl px-5 py-3.5 shadow-sm text-sm font-semibold max-w-[85%] leading-relaxed select-all">
                      {msg.content}
                    </div>
                  </div>

                  {/* Active streaming loader */}
                  {isStreaming && index === messages.length - 1 && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 select-none animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-650" />
                      <span>{statusMessage || "Retrieving transcript chunks..."}</span>
                    </div>
                  )}
                </React.Fragment>
              );
            } else {
              return (
                <div key={msg.id || index} className="w-full animate-fade-in">
                  <div className="w-full bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6 flex flex-col gap-5">
                    
                    {/* 1. Reasoning section */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-gray-450 uppercase tracking-widest select-none">
                        <span>⚙</span> REASONING
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                        {msg.isStreaming && !msg.content ? (
                          <span className="flex items-center gap-1.5 text-violet-650 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Analyzing hook pacing and semantic vector alignments...
                          </span>
                        ) : (
                          "Analyzing the first 10 seconds of both transcripts and visual pacing data. Video A immediately addresses a common viewer pain point, while Video B spends 8 seconds on a branded intro sequence."
                        )}
                      </p>
                    </div>

                    <div className="border-t border-gray-100" />

                    {/* 2. Answer section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-gray-450 uppercase tracking-widest select-none">
                        <span>📋</span> Answer
                        {msg.isStreaming && (
                          <span className="ml-auto flex items-center gap-1 text-[8px] text-violet-650 bg-violet-50 px-2 py-0.5 rounded-full font-bold">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Streaming
                          </span>
                        )}
                      </div>
                      
                      <div className="chat-markdown text-gray-805 text-sm leading-relaxed prose prose-violet max-w-none font-semibold">
                        {msg.content ? (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              li: ({ children }) => <li className="mb-1.5 last:mb-0 list-disc ml-4">{children}</li>,
                              ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-3 list-decimal ml-4 space-y-1">{children}</ol>,
                              a: ({ href, children }) => (
                                <span className="inline-flex items-center mx-0.5 px-2 py-0.5 text-[10px] font-bold text-violet-750 bg-violet-50 border border-violet-100 rounded-lg pointer-events-none select-none">
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
                    </div>

                    {/* 3. Cited Evidence quotes */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="rounded-xl border border-gray-150 bg-slate-50/50 p-4 space-y-3.5">
                        <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-gray-400 pb-1.5 border-b border-gray-200/50 select-none">
                          <span>▤</span> Cited Evidence
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {msg.citations.slice(0, 2).map((cit, cIdx) => (
                            <div key={cIdx} className="bg-white border border-gray-150 rounded-xl p-3.5 flex flex-col gap-3 shadow-2xs">
                              
                              {/* Header quote with right-aligned timestamp pill */}
                              <div className="flex justify-between items-start gap-2.5">
                                <p className="text-xs italic text-gray-655 leading-relaxed font-semibold flex-1">
                                  &ldquo;{cit.chunk_text_preview.trim()}...&rdquo;
                                </p>
                                <span className="shrink-0 bg-gray-50 border border-gray-200/60 rounded px-1.5 py-0.5 text-[9px] font-bold text-gray-400 font-mono select-none">
                                  {getMockTimestampForChunk(cit.chunk_number)}
                                </span>
                              </div>

                              {/* Footer video labeling */}
                              <div className="text-[10px] font-extrabold text-[#4f46e5] pt-2 border-t border-gray-100 uppercase tracking-wider">
                                Video {cit.video_label} • {getMockTagsForVideo(cit.video_label, cit.chunk_number)}
                              </div>

                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            }
          })}

          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold shadow-2xs">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Fixed Floating Bottom Chat Input Capsule ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/95 to-transparent pt-10 pb-6 px-6 pointer-events-none flex justify-center">
        <div className="w-full max-w-[850px] flex flex-col items-center pointer-events-auto">
          <form onSubmit={handleSubmit} className="w-full bg-white border border-gray-200/95 rounded-2xl shadow-lg p-2.5 flex items-center gap-3.5">
            
            {/* Paperclip trigger */}
            <button
              type="button"
              onClick={handleAttachment}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0"
              title="Attachment"
            >
              <Paperclip className="w-4.5 h-4.5" />
            </button>

            {/* Input field */}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about retention, hooks, pacing, or specific quotes..."
              className="flex-1 bg-transparent outline-none text-xs text-gray-805 placeholder:text-gray-400 font-semibold"
              disabled={isStreaming}
              id="chat-input"
            />

            {/* Control buttons */}
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 transition-colors cursor-pointer shrink-0"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#4f46e5] hover:bg-indigo-750 text-white disabled:opacity-40 disabled:hover:bg-[#4f46e5] transition-all shadow-xs cursor-pointer shrink-0"
                id="chat-send"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* AI Accuracy Warning */}
          <p className="text-[9px] text-gray-405 mt-2.5 font-bold tracking-wide uppercase select-none">
            AI can make mistakes. Always verify claims against the transcript.
          </p>
          
        </div>
      </div>

    </div>
  );
}
