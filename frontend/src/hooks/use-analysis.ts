/* ─── Custom hook for polling analysis status ─── */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { AnalysisDetail } from "@/lib/types";

export function useAnalysis(analysisId: string) {
  const [data, setData] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalysis = useCallback(async () => {
    try {
      const result = await api.getAnalysis(analysisId);
      setData(result);
      setError(null);

      // Stop polling when complete or failed
      if (
        result.status === "completed" ||
        result.status === "failed"
      ) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch analysis");
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    fetchAnalysis();

    // Poll every 2 seconds while processing
    intervalRef.current = setInterval(fetchAnalysis, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchAnalysis]);

  return { data, loading, error, refetch: fetchAnalysis };
}
