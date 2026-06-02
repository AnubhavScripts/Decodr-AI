/* ─── TypeScript interfaces matching backend schemas ─── */

export interface AnalyzeRequest {
  video_url_a: string;
  video_url_b: string;
}

export interface AnalyzeResponse {
  analysis_id: string;
  status: string;
  message: string;
}

export interface VideoSummary {
  id: string;
  video_label: "A" | "B";
  platform: "youtube" | "instagram";
  title: string;
  creator: string;
  follower_count: number | null;
  views: number;
  likes: number;
  comments_count: number;
  hashtags: string[] | null;
  upload_date: string | null;
  duration: number;
  thumbnail_url: string | null;
  video_url: string;
  transcript_available: boolean;
  engagement_rate: number;
  comment_rate: number;
  like_rate: number;
  engagement_per_follower: number | null;
}

export interface AnalysisDetail {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "partial_success";
  error_message: string | null;
  created_at: string;
  updated_at: string;
  videos: VideoSummary[];
}

export interface ChatStreamEvent {
  type: "token" | "citation" | "citations" | "status" | "session" | "done" | "error";
  content: string;
}

export interface Citation {
  video_label: string;
  chunk_number: number;
  chunk_text_preview: string;
  video_id: string;
  relevance_distance: number;
  start_time?: number | null;
  end_time?: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

export interface HealthResponse {
  status: string;
  database: string;
  embedding_model: string;
  version: string;
}
