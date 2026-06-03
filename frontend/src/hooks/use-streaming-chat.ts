/* ─── Custom hook for SSE streaming chat ─── */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { generateId } from "@/lib/utils";
import type { ChatMessage, Citation, ChatStreamEvent } from "@/lib/types";

export function useStreamingChat(analysisId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load chat history on mount or when analysisId changes
  const loadHistory = useCallback(async () => {
    if (!analysisId) return;
    try {
      const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8023/api";
      const trimmedApiUrl = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;
      const apiBase = trimmedApiUrl.endsWith("/api") ? trimmedApiUrl : `${trimmedApiUrl}/api`;

      const response = await fetch(`${apiBase}/chat/history/${analysisId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.session_id) {
          sessionIdRef.current = data.session_id;
        }
        if (data.messages) {
          const formatted = data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            citations: msg.citations || undefined,
          }));
          setMessages(formatted);
        }
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }, [analysisId]);

  useEffect(() => {
    loadHistory();
  }, [analysisId, loadHistory]);


  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      setError(null);

      // Add user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: content.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add empty assistant message for streaming
      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      setIsStreaming(true);
      setStatusMessage("Connecting...");

      try {
        // Create abort controller for cancellation
        const controller = new AbortController();
        abortRef.current = controller;

        const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8023/api";
        const trimmedApiUrl = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;
        const apiBase = trimmedApiUrl.endsWith("/api") ? trimmedApiUrl : `${trimmedApiUrl}/api`;

        const response = await fetch(
          `${apiBase}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              analysis_id: analysisId,
              session_id: sessionIdRef.current,
              message: content.trim(),
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let citations: Citation[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const event: ChatStreamEvent = JSON.parse(
                trimmed.slice(6)
              );

              switch (event.type) {
                case "session":
                  sessionIdRef.current = event.content;
                  break;

                case "status":
                  setStatusMessage(event.content);
                  break;

                case "token":
                  let tokenText = "";
                  if (typeof event.content === "string") {
                    tokenText = event.content;
                  } else if (Array.isArray(event.content)) {
                    tokenText = event.content
                      .map((part) => {
                        if (typeof part === "string") return part;
                        if (part && typeof part === "object" && "text" in part) return String(part.text);
                        return "";
                      })
                      .join("");
                  } else if (event.content && typeof event.content === "object" && "text" in event.content) {
                    tokenText = String((event.content as any).text);
                  } else {
                    tokenText = String(event.content || "");
                  }
                  fullContent += tokenText;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: fullContent }
                        : m
                    )
                  );
                  break;

                case "citations":
                  try {
                    citations = JSON.parse(event.content);
                  } catch {
                    // ignore malformed citations
                  }
                  break;

                case "done":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                          ...m,
                          content: fullContent || m.content,
                          citations,
                          isStreaming: false,
                        }
                        : m
                    )
                  );
                  setStatusMessage("");
                  break;

                case "error":
                  setError(event.content);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                          ...m,
                          content:
                            fullContent ||
                            "Sorry, an error occurred.",
                          isStreaming: false,
                        }
                        : m
                    )
                  );
                  break;
              }
            } catch {
              // Ignore malformed JSON lines
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          const errMsg = err.message || "Failed to connect";
          setError(errMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                  ...m,
                  content: "Sorry, something went wrong. Please try again.",
                  isStreaming: false,
                }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        setStatusMessage("");
        abortRef.current = null;
      }
    },
    [analysisId, isStreaming]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    statusMessage,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
