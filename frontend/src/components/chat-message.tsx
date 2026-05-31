"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { User, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import CitationBadge from "@/components/citation-badge";

interface ChatMessageProps {
  message: ChatMessage;
}

export default function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Avatar — assistant only */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 bg-gradient-to-br from-violet-700 to-indigo-600 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? "chat-bubble-user" : "chat-bubble-assistant"} px-4 py-3`}>
        {/* Message content */}
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="chat-markdown text-sm">
            {message.content ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : message.isStreaming ? (
              <div className="typing-dots py-1">
                <span /><span /><span />
              </div>
            ) : null}
          </div>
        )}

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-200">
            {message.citations.map((c, i) => (
              <CitationBadge key={i} citation={c} />
            ))}
          </div>
        )}

        {/* Streaming cursor */}
        {message.isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm bg-violet-700"
            style={{ verticalAlign: "text-bottom" }}
          />
        )}
      </div>

      {/* Avatar — user only */}
      {isUser && (
        <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 bg-gray-100 border border-gray-200 text-gray-600"
        >
          <User className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
