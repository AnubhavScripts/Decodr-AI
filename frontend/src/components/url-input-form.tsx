"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Link2, Zap, Play, Camera } from "lucide-react";
import { api } from "@/lib/api";
import { detectPlatform } from "@/lib/utils";

export default function UrlInputForm() {
  const router = useRouter();
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformA = urlA ? detectPlatform(urlA) : null;
  const platformB = urlB ? detectPlatform(urlB) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlA.trim() || !urlB.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await api.analyze(urlA.trim(), urlB.trim());
      router.push(`/analysis/${result.analysis_id}`);
    } catch (err: unknown) {
      setError((err as Error).message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const PlatformIcon = ({ platform }: { platform: string | null }) => {
    if (platform === "youtube") return <Play size={15} color="#ef4444" style={{ flexShrink: 0 }} />;
    if (platform === "instagram") return <Camera size={15} color="#ec4899" style={{ flexShrink: 0 }} />;
    return <Link2 size={15} color="#9ca3af" style={{ flexShrink: 0 }} />;
  };

  const inputWrapperStyle = (hasValue: boolean, color: "violet" | "blue"): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    padding: "0.75rem 1rem",
    borderRadius: "0.625rem",
    border: `1px solid ${hasValue ? (color === "violet" ? "#a78bfa" : "#93c5fd") : "#e5e7eb"}`,
    background: hasValue ? "#ffffff" : "#f9fafb",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  });

  const labelStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "0.4rem",
    display: "block",
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Video A */}
        <div>
          <label htmlFor="url-input-a" style={labelStyle}>Video A URL</label>
          <div style={inputWrapperStyle(!!urlA, "violet")}>
            <PlatformIcon platform={platformA} />
            <input
              id="url-input-a"
              type="url"
              value={urlA}
              onChange={(e) => setUrlA(e.target.value)}
              placeholder="https://youtube.com/..."
              disabled={loading}
              required
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "0.875rem",
                color: "#0f172a",
              }}
            />
          </div>
        </div>

        {/* Video B */}
        <div>
          <label htmlFor="url-input-b" style={labelStyle}>Video B URL</label>
          <div style={inputWrapperStyle(!!urlB, "blue")}>
            <PlatformIcon platform={platformB} />
            <input
              id="url-input-b"
              type="url"
              value={urlB}
              onChange={(e) => setUrlB(e.target.value)}
              placeholder="https://instagram.com/..."
              disabled={loading}
              required
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "0.875rem",
                color: "#0f172a",
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: "flex", gap: "0.625rem", padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.625rem", fontSize: "0.875rem", color: "#dc2626" }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          id="analyze-button"
          disabled={loading || !urlA.trim() || !urlB.trim()}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.875rem 1.5rem",
            borderRadius: "0.625rem",
            border: "none",
            background: loading || !urlA.trim() || !urlB.trim()
              ? "#c4b5fd"
              : "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
            color: "#ffffff",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: loading || !urlA.trim() || !urlB.trim() ? "not-allowed" : "pointer",
            boxShadow: loading || !urlA.trim() || !urlB.trim() ? "none" : "0 4px 16px rgba(109,40,217,0.3)",
            transition: "background 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              Analyzing Videos...
            </>
          ) : (
            <>
              <Zap size={16} />
              Analyze Videos
            </>
          )}
        </button>

        <p style={{ fontSize: "0.75rem", color: "#9ca3af", textAlign: "center" }}>
          AI can make mistakes. Always verify claims against the transcript.
        </p>
      </div>
    </form>
  );
}
