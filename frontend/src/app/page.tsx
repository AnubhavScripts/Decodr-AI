import UrlInputForm from "@/components/url-input-form";
import {
  ArrowLeftRight,
  BarChart2,
  MessageSquare,
  Zap,
  TrendingUp,
  Shield,
  ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: <ArrowLeftRight size={22} color="#6d28d9" />,
    title: "Compare Winning Content",
    desc: "Analyze high-performing videos side-by-side to reverse-engineer their success and apply proven structures to your own content.",
  },
  {
    icon: <BarChart2 size={22} color="#6d28d9" />,
    title: "Analyze Hooks & Engagement",
    desc: "Identify the exact moments viewers engage or drop off. Our AI breaks down pacing, visual cues, and hook effectiveness.",
  },
  {
    icon: <MessageSquare size={22} color="#6d28d9" />,
    title: "Chat With Your Content",
    desc: "Ask specific questions about your video comparisons. Uncover nuanced insights about audience retention and tone.",
  },
  {
    icon: <TrendingUp size={22} color="#6d28d9" />,
    title: "Hook & Retention Intelligence",
    desc: "Pinpoint the exact moments that capture or lose your audience's attention and improve future content.",
  },
  {
    icon: <Zap size={22} color="#6d28d9" />,
    title: "YouTube & Instagram Ready",
    desc: "Works across platforms — Shorts, Reels, long-form videos, and everything in between.",
  },
  {
    icon: <Shield size={22} color="#6d28d9" />,
    title: "Powered by Gemini 2.5 Flash",
    desc: "State-of-the-art AI for nuanced comparative insights you won't find anywhere else.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Paste two video URLs",
    desc: "Drop any YouTube or Instagram video links into the form.",
  },
  {
    step: "02",
    title: "AI processes everything",
    desc: "Transcription, embedding, metadata and metrics are computed automatically.",
  },
  {
    step: "03",
    title: "Explore the analysis",
    desc: "Review side-by-side cards with engagement data and AI-generated insights.",
  },
  {
    step: "04",
    title: "Chat for deeper insights",
    desc: "Ask specific questions and get cited, data-backed answers from our RAG assistant.",
  },
];

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#0f172a", display: "flex", flexDirection: "column" }}>

      {/* ── HERO ── */}
      <section
        style={{
          background: "#f5f3ff",
          width: "100%",
          padding: "5rem 1.5rem 4rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: "42rem", marginBottom: "1.25rem", color: "#0f172a" }}>
          Decode Why One Video{" "}
          <span className="gradient-text-animated">Outperforms</span>{" "}
          Another
        </h1>

        <p style={{ fontSize: "1.0625rem", color: "#6b7280", maxWidth: "36rem", lineHeight: 1.7, marginBottom: "2.25rem" }}>
          Paste any two YouTube or Instagram videos and get AI-powered insights into engagement,
          hooks, storytelling, audience targeting, and content strategy.
        </p>

        <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", justifyContent: "center" }}>
          <a href="#analyze" className="btn-primary" style={{ fontSize: "0.9375rem", padding: "0.75rem 1.5rem", borderRadius: "0.625rem", gap: "0.375rem" }}>
            Start Comparing
            <ChevronRight size={16} />
          </a>
          <a href="#how-it-works" className="btn-secondary" style={{ fontSize: "0.9375rem", padding: "0.75rem 1.5rem", borderRadius: "0.625rem" }}>
            See How It Works
          </a>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        style={{ width: "100%", background: "#ffffff", padding: "4rem 1.5rem" }}
      >
        <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
          <div className="features-grid">
            {FEATURES.slice(0, 3).map((f) => (
              <div
                key={f.title}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.875rem",
                  padding: "1.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  background: "#ffffff",
                  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
                }}
                className="card-hover"
              >
                <div
                  style={{
                    width: "2.75rem",
                    height: "2.75rem",
                    borderRadius: "0.625rem",
                    background: "#ede9fe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>{f.title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "#6b7280", lineHeight: 1.65 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANALYZE FORM ── */}
      <section
        id="analyze"
        style={{
          width: "100%",
          background: "#f5f3ff",
          padding: "4rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "36rem",
            background: "#ffffff",
            borderRadius: "1rem",
            border: "1px solid #e5e7eb",
            padding: "2.25rem 2rem",
            boxShadow: "0 4px 24px rgba(109,40,217,0.07), 0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", textAlign: "center", marginBottom: "0.5rem" }}>
            Try Decodr.ai
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#6b7280", textAlign: "center", marginBottom: "1.75rem", lineHeight: 1.6 }}>
            Paste two video links below to see the AI analysis in action.
          </p>
          <UrlInputForm />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        id="how-it-works"
        style={{ width: "100%", background: "#ffffff", padding: "4rem 1.5rem" }}
      >
        <div style={{ maxWidth: "44rem", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
              Up and Running in 4 Steps
            </h2>
            <p style={{ fontSize: "0.9375rem", color: "#6b7280" }}>No setup, no API keys, no friction.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.step}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1.25rem",
                  padding: "1.25rem 1.5rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.875rem",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {step.step}
                </div>
                <div>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>{step.title}</h4>
                  <p style={{ fontSize: "0.85rem", color: "#6b7280", lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section style={{ width: "100%", padding: "4rem 1.5rem", background: "#f5f3ff" }}>
        <div
          style={{
            maxWidth: "44rem",
            margin: "0 auto",
            borderRadius: "1.25rem",
            padding: "3rem 2.5rem",
            textAlign: "center",
            color: "#ffffff",
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)",
            boxShadow: "0 16px 48px rgba(109,40,217,0.25)",
            position: "relative",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute", inset: 0, borderRadius: "1.25rem", pointerEvents: "none",
              backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.07) 0%, transparent 50%)",
            }}
          />
          <h2 style={{ position: "relative", fontSize: "clamp(1.5rem, 4vw, 2.25rem)", fontWeight: 800, marginBottom: "0.75rem", lineHeight: 1.2 }}>
            Ready to Decode the Formula<br />Behind Viral Content?
          </h2>
          <p style={{ position: "relative", color: "#c4b5fd", fontSize: "0.9375rem", marginBottom: "2rem", lineHeight: 1.6, maxWidth: "28rem", marginLeft: "auto", marginRight: "auto" }}>
            Join creators who reverse-engineer their competitors&apos; success with Decodr.ai.
          </p>
          <a
            href="#analyze"
            style={{
              position: "relative",
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              padding: "0.875rem 1.75rem", borderRadius: "0.75rem",
              background: "#ffffff", color: "#7c3aed",
              fontWeight: 700, fontSize: "0.9375rem",
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            <Zap size={16} />
            Analyze My First Video
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ width: "100%", background: "#ffffff", borderTop: "1px solid #f1f5f9", padding: "1.75rem 1.5rem", marginTop: "auto" }}>
        <div style={{ maxWidth: "56rem", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{ width: "1.75rem", height: "1.75rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", background: "#7c3aed" }}>
              <Zap size={14} color="#ffffff" />
            </div>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>Decodr.ai</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            © 2026 Decodr.ai. All rights reserved.
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {["Privacy Policy", "Terms of Service", "Support"].map((l) => (
              <a key={l} href="#" style={{ fontSize: "0.75rem", color: "#9ca3af", textDecoration: "none" }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}