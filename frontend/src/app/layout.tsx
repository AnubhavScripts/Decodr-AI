import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/header";

export const metadata: Metadata = {
  title: "Decodr.ai — AI-Powered Creator Intelligence Platform",
  description:
    "Compare any two YouTube or Instagram videos with AI-powered analytics. Analyze hooks, engagement, content strategy, and chat with an AI analyst about performance insights.",
  keywords: [
    "video analytics",
    "creator tools",
    "engagement analysis",
    "hook analysis",
    "AI video comparison",
    "content strategy",
    "YouTube analytics",
    "Instagram analytics",
    "Decodr.ai",
  ],
  openGraph: {
    title: "Decodr.ai — AI-Powered Creator Intelligence Platform",
    description:
      "Paste two video links, get instant AI-powered comparison. Hooks, retention, pacing, and chat with your content.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">
        <Header />
        <main className="pt-[60px]">{children}</main>
      </body>
    </html>
  );
}
