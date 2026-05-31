/* ─── Backend API client ─── */

import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AnalysisDetail,
  HealthResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8023/api";

async function fetchJSON<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  /** Submit two video URLs for analysis */
  analyze(urlA: string, urlB: string): Promise<AnalyzeResponse> {
    return fetchJSON<AnalyzeResponse>(`${API_BASE}/analyze`, {
      method: "POST",
      body: JSON.stringify({
        video_url_a: urlA,
        video_url_b: urlB,
      } satisfies AnalyzeRequest),
    });
  },

  /** Get analysis results */
  getAnalysis(id: string): Promise<AnalysisDetail> {
    return fetchJSON<AnalysisDetail>(`${API_BASE}/analysis/${id}`);
  },

  /** Stream chat with the AI analyst — returns the raw Response for SSE consumption */
  async chatStream(
    analysisId: string,
    sessionId: string | null,
    message: string
  ): Promise<Response> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis_id: analysisId,
        session_id: sessionId,
        message,
      }),
    });
    if (!res.ok) {
      throw new Error(`Chat request failed: HTTP ${res.status}`);
    }
    return res;
  },

  /** Health check */
  health(): Promise<HealthResponse> {
    return fetchJSON<HealthResponse>(`${API_BASE}/health`);
  },
};
