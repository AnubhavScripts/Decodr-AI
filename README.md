# Decodr.ai — Creator Intelligence Platform

A production-grade full-stack application for comparing social media videos with an AI-powered RAG chatbot. Built for creators, agencies, and anyone who wants to understand what makes one video outperform another.

Users paste two video URLs. The platform extracts metadata, transcripts, and engagement metrics automatically. Then they can chat with an AI analyst that uses LangGraph-powered retrieval-augmented generation to answer questions about hooks, content strategy, engagement, and storytelling — backed by actual transcript data with source citations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 15)                        │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ URL Form │  │ Video Cards  │  │  Engagement  │  │  Streaming   │ │
│  │  Input   │  │  Comparison  │  │   Metrics    │  │    Chat      │ │
│  └────┬─────┘  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘ │
│       │               │                 │                 │         │
│       └───────────────┼─────────────────┼─────────────────┘         │
│                       │          SSE Stream                         │
└───────────────────────┼─────────────────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────┼─────────────────────────────────────────────┐
│                  Backend (FastAPI)                                   │
│  ┌────────────────────┼──────────────────────────────────────────┐  │
│  │              API Layer (/analyze, /chat, /analysis/{id})      │  │
│  └──────┬─────────────┼──────────────────────────────┬───────────┘  │
│         │             │                              │              │
│  ┌──────▼──────┐ ┌────▼─────────┐  ┌────────────────▼───────────┐  │
│  │  Ingestion  │ │  Transcript  │  │      LangGraph Agent       │  │
│  │  Pipeline   │ │   Pipeline   │  │  ┌────────┐ ┌───────────┐  │  │
│  │             │ │              │  │  │ Intent │→│ Retrieval │  │  │
│  │ ┌────────┐  │ │ ┌──────────┐ │  │  └────┬───┘ └─────┬─────┘  │  │
│  │ │YouTube │  │ │ │ YT-Trans │ │  │       │           │        │  │
│  │ │Provider│  │ │ │   API    │ │  │  ┌────▼───┐ ┌─────▼─────┐  │  │
│  │ ├────────┤  │ │ ├──────────┤ │  │  │Metadata│ │  Hooks /  │  │  │
│  │ │  Insta │  │ │ │ Faster   │ │  │  │Retrieve│ │Comparison │  │  │
│  │ │Provider│  │ │ │ Whisper  │ │  │  └────┬───┘ └─────┬─────┘  │  │
│  │ └────────┘  │ │ └──────────┘ │  │       │           │        │  │
│  └─────────────┘ └──────────────┘  │  ┌────▼───────────▼─────┐  │  │
│                                    │  │   Answer Generator    │  │  │
│                                    │  │  (Gemini 2.5 Flash)   │  │  │
│                                    │  └───────────────────────┘  │  │
│                                    └─────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────────┐
│              PostgreSQL + pgvector                                  │
│  ┌──────────────┐ ┌────────┐ ┌──────────────────┐ ┌─────────────┐  │
│  │  analysis_   │ │ videos │ │transcript_chunks │ │chat_sessions│  │
│  │  sessions    │ │        │ │  + embeddings    │ │+ messages   │  │
│  └──────────────┘ └────────┘ └──────────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## System Design

### Why This Architecture

I designed Decodr.ai as a clean separation of concerns:

**Frontend** handles presentation and streaming. It doesn't know about embeddings, LangGraph, or database schemas. It just calls the API and renders SSE events.

**Backend** owns all the intelligence. The FastAPI server orchestrates ingestion, runs the LangGraph agent, and manages state. Everything runs through a single backend process — no microservices overhead for a system at this scale.

**Database** is PostgreSQL with pgvector, not a separate vector database. This was intentional — I didn't want to manage two persistence layers when pgvector handles the vector volume we're dealing with perfectly well (details in Scaling Strategy below).

### Provider Adapter Pattern

The ingestion layer uses a strategy pattern. Each platform implements `BaseVideoProvider`:

```python
class BaseVideoProvider(ABC):
    @classmethod
    def can_handle(cls, url: str) -> bool: ...
    async def extract_metadata(self, url: str) -> VideoMetadata: ...
    async def extract_transcript(self, url: str) -> str | None: ...
    async def download_audio(self, url: str, output_dir: str) -> str: ...
```

`ProviderRegistry.detect(url)` iterates registered providers and returns the first one that can handle the URL. Adding TikTok is literally:

1. Create `tiktok.py` implementing `BaseVideoProvider`
2. Append `TikTokProvider` to `_PROVIDERS` in `registry.py`

Zero changes to ingestion, API, or frontend code.

### LangGraph Agent Design

The agent uses a stateful `StateGraph` with intent-based conditional routing:

```
START → Intent Detection → Metadata Load → (conditional routing)
                                              │
                   ┌──────────────────────────┤
                   │                          │
            metadata_only              transcript_search / comparison / hooks / recommendations
                   │                          │
                   │                    Vector Retrieval
                   │                          │
                   │              ┌───────────┤
                   │              │           │
                   │         Specialized    Citations
                   │          Analysis        │
                   │              │           │
                   └──────────────┴───────────┘
                                  │
                           Answer Generator → END
```

Every query always loads metadata first. Then the intent classifier decides whether to also search transcripts, run hook analysis, generate comparisons, or produce recommendations. The answer generator has full context from whatever nodes ran before it.

This means a simple "How many views does Video A have?" skips vector retrieval entirely and answers directly from metadata. A complex "Compare the storytelling approaches and suggest improvements" runs retrieval, comparison, and recommendations before generating the final answer.

---

## Database Schema

```sql
-- Tracks the lifecycle of a two-video analysis
analysis_sessions (
  id          UUID PRIMARY KEY,
  status      VARCHAR(20),    -- pending | processing | completed | failed
  error_message TEXT,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)

-- One row per video, always two per analysis
videos (
  id          UUID PRIMARY KEY,
  analysis_id UUID REFERENCES analysis_sessions(id),
  video_label CHAR(1),        -- A or B
  platform    VARCHAR(20),    -- youtube | instagram
  original_url TEXT,
  title       TEXT,
  creator     VARCHAR(255),
  follower_count BIGINT,
  views       BIGINT,
  likes       BIGINT,
  comments_count BIGINT,
  hashtags    JSONB,
  upload_date TIMESTAMPTZ,
  duration    FLOAT,
  thumbnail_url TEXT,
  video_url   TEXT,
  transcript_text TEXT,
  engagement_rate FLOAT,
  comment_rate FLOAT,
  like_rate   FLOAT,
  engagement_per_follower FLOAT
)

-- Chunked transcript with pgvector embeddings
transcript_chunks (
  id          UUID PRIMARY KEY,
  analysis_id UUID REFERENCES analysis_sessions(id),
  video_id    UUID REFERENCES videos(id),
  chunk_number INTEGER,
  chunk_text  TEXT,
  embedding   VECTOR(384)     -- BAAI/bge-small-en-v1.5
)

-- Chat session grouping
chat_sessions (
  id          UUID PRIMARY KEY,
  analysis_id UUID REFERENCES analysis_sessions(id),
  created_at  TIMESTAMPTZ
)

-- Individual chat messages with citation storage
chat_messages (
  id          UUID PRIMARY KEY,
  session_id  UUID REFERENCES chat_sessions(id),
  role        VARCHAR(10),    -- user | assistant
  content     TEXT,
  citations   JSONB,
  created_at  TIMESTAMPTZ
)
```

---

## API Documentation

### `POST /api/analyze`

Submit two video URLs for comparison.

**Request:**
```json
{
  "video_url_a": "https://youtube.com/watch?v=abc123",
  "video_url_b": "https://instagram.com/reel/xyz789"
}
```

**Response:** `202`
```json
{
  "analysis_id": "uuid-string",
  "status": "processing",
  "message": "Analysis started. Poll GET /analysis/{id} for results."
}
```

### `GET /api/analysis/{id}`

Retrieve analysis results.

**Response:** `200`
```json
{
  "id": "uuid",
  "status": "completed",
  "videos": [
    {
      "video_label": "A",
      "platform": "youtube",
      "title": "...",
      "creator": "...",
      "views": 1500000,
      "likes": 85000,
      "engagement_rate": 6.33,
      "transcript_available": true
    }
  ]
}
```

### `POST /api/chat`

Chat with the AI analyst. Returns Server-Sent Events.

**Request:**
```json
{
  "analysis_id": "uuid",
  "session_id": "uuid-or-null",
  "message": "Compare the hooks of both videos"
}
```

**Response:** `200 text/event-stream`
```
data: {"type": "session", "content": "session-uuid"}
data: {"type": "status", "content": "Understanding your question..."}
data: {"type": "status", "content": "Searching transcripts..."}
data: {"type": "token", "content": "Based on"}
data: {"type": "token", "content": " the analysis"}
data: {"type": "citations", "content": "[...]"}
data: {"type": "done", "content": ""}
```

### `GET /api/health`

**Response:** `200`
```json
{
  "status": "ok",
  "database": "connected",
  "embedding_model": "BAAI/bge-small-en-v1.5",
  "version": "1.0.0"
}
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 15, TypeScript, Tailwind CSS | App Router, SSR, streaming-native |
| Backend | FastAPI, Python 3.12 | Async-first, type-safe, auto-docs |
| Agent | LangGraph, LangChain | Stateful graph execution with conditional routing |
| LLM | Gemini 2.5 Flash | Fast, cost-effective, supports streaming |
| Embeddings | BAAI/bge-small-en-v1.5 | 384-dim, runs locally, top-tier for its size class |
| Vector Store | PostgreSQL + pgvector | Single DB for relational + vector data |
| Transcription | youtube-transcript-api, yt-dlp, faster-whisper | Multi-fallback pipeline |
| ORM | SQLAlchemy 2.0 (async) | Mature, full-featured async support |

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql+asyncpg://hookiq:hookiq@localhost:5432/hookiq
GOOGLE_API_KEY=your-gemini-api-key
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
WHISPER_MODEL=small
CHUNK_SIZE=500
CHUNK_OVERLAP=100
CORS_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8023/api
```

---

## Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker & Docker Compose
- FFmpeg (`brew install ffmpeg` on macOS)
- A Google AI API key (for Gemini 2.5 Flash)

### 1. Clone and setup

```bash
git clone https://github.com/youruser/decodr.git
cd decodr
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL 16 with pgvector pre-installed on port 5432.

### 3. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set your GOOGLE_API_KEY

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8023
```

On first startup, the server will:
- Create the pgvector extension
- Create all database tables
- Pre-load the BGE embedding model (~90MB download on first run)

### 4. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local

# Start dev server
npm run dev
```

### 5. Open the app

Navigate to `http://localhost:3000`, paste two video URLs, and hit Analyze.

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
```

Set `NEXT_PUBLIC_API_URL` to your Railway backend URL in Vercel environment variables.

### Backend → Railway

1. Connect your GitHub repo to Railway
2. Set root directory to `backend`
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add all environment variables from `.env.example`

### Database → Supabase

1. Create a Supabase project
2. Enable the `vector` extension in SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Use the connection string as `DATABASE_URL` in your backend

---

## Cost Analysis

### Per-analysis cost (two videos)

| Component | Cost |
|-----------|------|
| Gemini 2.5 Flash (intent + analysis) | ~$0.003 |
| BGE embedding (local) | $0.00 |
| Whisper transcription (local) | $0.00 |
| Supabase DB (free tier) | $0.00 |

**Total per analysis: ~$0.003** (essentially free for the LLM calls)

### Per-chat-message cost

| Component | Cost |
|-----------|------|
| Gemini 2.5 Flash (2-5 node calls) | ~$0.001-0.004 |
| BGE embedding (1 query) | $0.00 |

### Monthly infrastructure

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | $0 |
| Railway | Starter | ~$5/mo |
| Supabase | Free | $0 |

**Total: ~$5/mo** + LLM usage (~$3-10/mo at 1000 analyses/month)

---

## Scaling Strategy

### Current design: PostgreSQL + pgvector

I chose pgvector over a dedicated vector database (Pinecone, Qdrant, Weaviate) because:

1. **Operational simplicity.** One database for everything. No vector DB to provision, monitor, and pay for separately.
2. **Transactional consistency.** Chunks are stored in the same transaction as video metadata. No eventual consistency issues.
3. **Query flexibility.** I can join transcript chunks with video metadata in a single SQL query, filter by analysis_id, and combine vector similarity with relational predicates.
4. **Scale fit.** At 1000 analyses/day × 2 videos × ~15 chunks each = ~30,000 vectors/day. pgvector with HNSW indexing handles this comfortably up to tens of millions of vectors.

### When to migrate

If vector volume exceeds ~50M rows or if query latency at the 99th percentile exceeds 100ms, I'd migrate the vector search to Qdrant or Milvus while keeping the relational data in PostgreSQL. The `EmbeddingService.similarity_search` method is the only place that queries vectors, so the migration surface is a single function.

### Horizontal scaling

- **Backend:** FastAPI is async and stateless. Scale horizontally behind a load balancer. The embedding model loads into memory per-process (~170MB), so size instances accordingly.
- **Database:** Read replicas for analytics queries. Connection pooling via PgBouncer if connection counts become an issue.
- **Whisper:** The heaviest operation. For high throughput, offload to a GPU-backed worker queue (Celery + Redis) instead of running in the API process.

---

## Engineering Tradeoffs

| Decision | Tradeoff | Why |
|----------|----------|-----|
| pgvector over Qdrant | Slightly slower ANN at huge scale | Operational simplicity, transactional integrity |
| BGE-small over OpenAI embeddings | 384-dim vs 1536-dim, slightly less semantic nuance | Runs locally, zero API cost, no rate limits |
| faster-whisper over OpenAI Whisper API | Requires CPU/GPU on server | No per-minute charges, works offline, data stays local |
| Background tasks over Celery | No retry/dead-letter queue | Simpler deployment, sufficient for single-server scale |
| SSE over WebSockets | Unidirectional only | Simpler, HTTP-native, sufficient for streaming text |
| LangGraph over plain chains | More complexity in graph setup | Conditional routing, state management, extensibility |

---

## Future Enhancements

- **TikTok, LinkedIn, X providers** — just new adapter files
- **Batch analysis** — compare 5+ videos in a single session
- **Scheduled monitoring** — track a creator's metrics over time
- **GPU-accelerated Whisper** — CUDA support for faster transcription
- **Multi-language transcripts** — auto-detect language, translate before embedding
- **Custom embedding fine-tuning** — train domain-specific embeddings on creator content
- **A/B test predictor** — predict which thumbnail/hook will perform better
- **Export reports** — PDF/Notion export of analysis results
- **Team workspaces** — shared analyses with role-based access
- **Webhook notifications** — notify when analysis completes

---

## Interview Talking Points

**On system design:**
"I built Decodr.ai as a RAG system with a twist — instead of documents, the retrieval corpus is video transcripts. The LangGraph agent uses intent classification to decide whether a query needs metadata, transcript search, or both, which avoids wasting tokens on unnecessary retrieval."

**On the adapter pattern:**
"Adding a new platform is a single-file change. The provider registry does URL-based routing, so the ingestion pipeline doesn't know or care what platform it's talking to. I've seen too many systems where adding a new data source requires touching five files."

**On pgvector vs. dedicated vector DBs:**
"For our vector volume — maybe 50K vectors per day at peak — pgvector with HNSW indexing is more than sufficient. The real win is transactional consistency. When I store chunks and metadata in the same commit, I never have a state where the vector DB has embeddings for chunks that don't exist in the relational store."

**On streaming:**
"The chat endpoint uses Server-Sent Events with LangGraph's astream_events API. I filter events by node name so the frontend only sees tokens from the answer generator, not internal planning calls. Status updates for each node ('Searching transcripts...') come through as custom events."

**On the transcript pipeline:**
"YouTube has a native transcript API that's fast but doesn't always have data. Instagram has nothing. So I built a three-tier fallback: native API → yt-dlp audio download → faster-whisper transcription. The provider abstraction means each platform defines its own fallback chain."

---

## Architecture Decisions

1. **Monorepo with separate frontend/backend** — easier to deploy independently (Vercel + Railway) while keeping code colocated
2. **Async SQLAlchemy** — FastAPI is async-first, so the ORM should be too. Avoids blocking the event loop during DB calls.
3. **Singleton embedding model** — loaded once at startup, shared across requests. The BGE model is ~170MB in memory, so we don't want to load it per-request.
4. **Lazy Whisper loading** — only loaded when the first transcription is needed, since many YouTube videos have native transcripts
5. **UUID primary keys** — avoids sequential ID guessing, makes IDs safe to expose in URLs
6. **JSON columns for hashtags and citations** — these are variable-length arrays that don't need their own tables at this scale

---

## Production Considerations

- **Rate limiting:** Add FastAPI middleware or use Cloudflare's rate limiting in front of the API
- **Input sanitization:** URLs are validated but should also be sanitized against SSRF
- **Secrets management:** Use Railway/Vercel secret management, not .env files in production
- **Monitoring:** Add structured logging + Sentry for error tracking
- **Connection pooling:** PgBouncer in front of Supabase for connection management at scale
- **CDN:** Vercel handles frontend CDN automatically. Consider caching `/analysis/{id}` responses for completed analyses
- **Data retention:** Implement TTL on analyses to manage storage growth. Audio files are already cleaned up after transcription.

### YouTube Transcript & Audio Retrieval Limitations

A practical limitation encountered during deployment is YouTube's anti-bot protection on cloud-hosted environments.

While transcript extraction and audio downloads generally work during local development, cloud providers such as Render, Railway, AWS, GCP, and Azure frequently use IP ranges that are flagged by YouTube. As a result:

* `youtube-transcript-api` may return IP blocked or request blocked errors.
* `yt-dlp` may return "Sign in to confirm you're not a bot" errors.
* Some videos may therefore be unable to provide transcripts even when metadata remains accessible.

To handle this gracefully, Decodr.ai implements a degradation strategy:

1. Attempt native transcript retrieval.
2. Attempt audio download and transcription fallback.
3. If transcript retrieval fails entirely, continue processing metadata.
4. Mark the analysis session as `partial_success`.
5. Allow metadata-based comparisons and chat functionality to continue operating.

This ensures that creator analytics, engagement calculations, and metadata-driven insights remain available even when transcript retrieval is restricted by platform-level protections.

For authenticated retrieval, optional YouTube cookies can be configured in self-hosted deployments. Cookies are intentionally not bundled with the application and are not required for core functionality.

