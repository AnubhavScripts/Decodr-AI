# Decodr.ai — Creator Intelligence Platform

Paste two video URLs. Get a full breakdown of why one outperforms the other.

Decodr.ai extracts metadata, engagement stats, and transcripts from YouTube and Instagram videos, then lets you have a real conversation with an AI analyst about what's working and what isn't. The chat is backed by actual transcript content — so when it says "Video A has a stronger hook", it can cite the exact moment in the transcript.

Built with FastAPI, Next.js 15, LangGraph, and PostgreSQL + pgvector. Deployed on Railway + Vercel.

---

## What's covered (challenge requirement checklist)

For reviewers going through the spec:

* **Metadata extraction** — views, likes, comments, creator details, follower count. YouTube goes through the Data API v3 with a yt-dlp fallback. Instagram uses instaloader.
* **Engagement rate calculation** — both view-based and follower-based ratios are computed and stored.
* **Transcript extraction** — three-tier fallback: native YouTube captions → AssemblyAI cloud transcription → local faster-whisper. Fully automatic, no manual input.
* **Chunking and embeddings** — transcripts are split into overlapping chunks and embedded locally using `BAAI/bge-small-en-v1.5` via FastEmbed. No API calls, no cost.
* **pgvector retrieval** — similarity search runs directly in PostgreSQL using the `pgvector` extension.
* **RAG chatbot** — LangGraph agent with intent-based routing. Simple stat questions skip retrieval entirely. Complex questions run vector search, hook analysis, and comparison before answering.
* **Source citations** — every AI answer includes timestamped transcript references showing exactly where the answer came from.
* **Conversational memory** — chat history is persisted in the DB. Continuing a conversation picks up where you left off.
* **Streaming (SSE)** — tokens stream to the frontend in real-time via Server-Sent Events.
* **Side-by-side UI** — video cards, metrics, engagement data, and transcript viewer all in one layout.
* **Graceful degradation** — if transcripts can't be retrieved (bot detection, disabled captions, etc.), the session is marked `partial_success` instead of failing. Metadata comparison and chat still work.

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
│  │ │  Insta │  │ │ │AssemblyAI│ │  │  │Retrieve│ │Comparison │  │  │
│  │ │Provider│  │ │ ├──────────┤ │  │  └────┬───┘ └─────┬─────┘  │  │
│  │ └────────┘  │ │ │ Whisper  │ │  │       │           │        │  │
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

## How it's designed

### The three layers

**Frontend** is intentionally dumb. It doesn't touch LangGraph, embeddings, or SQL. It calls the API, renders video cards, and streams SSE tokens to the chat window. That's it.

**Backend** owns all the logic — ingestion, chunking, embedding, agent orchestration. A single FastAPI process handles everything. No microservices, no distributed queues, because the problem doesn't need that complexity yet.

**PostgreSQL** does double duty as both the relational store and the vector store. I didn't want to maintain two separate databases when pgvector handles the vector volume we're dealing with just fine. More on that in the scaling section.

### Provider adapter pattern

Every platform implements the same interface:

```python
class BaseVideoProvider(ABC):
    @classmethod
    def can_handle(cls, url: str) -> bool: ...
    async def extract_metadata(self, url: str) -> VideoMetadata: ...
    async def extract_transcript(self, url: str) -> str | None: ...
    async def download_audio(self, url: str, output_dir: str) -> str: ...
```

`ProviderRegistry.detect(url)` picks the right provider based on the URL. Adding TikTok means creating `tiktok.py` and appending it to the registry — nothing else in the codebase changes.

### LangGraph agent

The agent uses intent classification to decide what work to actually do:

```
START → Intent Detection → Metadata Load → (routing)
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

"How many views does Video A have?" never touches pgvector — it reads from metadata and answers directly. "Compare the storytelling and suggest what Video B should do differently" runs retrieval, comparison, and recommendations in sequence before generating the answer.

---

## Database Schema

```sql
-- Tracks the lifecycle of a two-video analysis
analysis_sessions (
  id          UUID PRIMARY KEY,
  status      VARCHAR(20),    -- pending | processing | completed | partial_success | failed
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
  transcript_status VARCHAR(20), -- pending | completed | failed
  hook_text   TEXT,
  engagement_rate FLOAT,
  comment_rate FLOAT,
  like_rate   FLOAT,
  engagement_per_follower FLOAT
)

-- Chunked transcript with pgvector embeddings and timestamps
transcript_chunks (
  id          UUID PRIMARY KEY,
  analysis_id UUID REFERENCES analysis_sessions(id),
  video_id    UUID REFERENCES videos(id),
  chunk_number INTEGER,
  chunk_text  TEXT,
  embedding   VECTOR(384),    -- BAAI/bge-small-en-v1.5
  start_time  DOUBLE PRECISION,
  end_time    DOUBLE PRECISION
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

## API

### `POST /api/analyze`

Kick off an analysis. Runs async in the background — poll the GET endpoint for status.

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

Check analysis status and get results when done.

`status` will be one of: `pending` | `processing` | `completed` | `partial_success` | `failed`

`partial_success` means metadata was extracted but transcripts couldn't be retrieved — usually due to bot detection on the cloud host.

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

Send a message to the AI analyst. Streams tokens back as Server-Sent Events.

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
| Agent | LangGraph, LangChain | Stateful graph with conditional routing |
| LLM | Gemini 2.5 Flash | Fast, cheap, streams natively |
| Embeddings | BAAI/bge-small-en-v1.5 | Runs locally — no API costs, no rate limits, 384-dim vectors |
| Vector Store | PostgreSQL + pgvector | One database instead of two |
| Transcription | youtube-transcript-api, yt-dlp, AssemblyAI, faster-whisper | Layered fallback — native captions → AssemblyAI → local Whisper tiny |
| ORM | SQLAlchemy 2.0 (async) | Full async support, no blocking |

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql+asyncpg://hookiq:hookiq@localhost:5432/hookiq
GOOGLE_API_KEY=your-gemini-api-key
YOUTUBE_API_KEY=your-youtube-data-api-key
ASSEMBLYAI_API_KEY=your-assemblyai-key
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
WHISPER_MODEL=tiny
CHUNK_SIZE=500
CHUNK_OVERLAP=100
CORS_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8023/api
```

---

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker & Docker Compose
- FFmpeg (`brew install ffmpeg` on macOS)
- A Google AI API key for Gemini

### 1. Clone

```bash
git clone https://github.com/AnubhavScripts/Decodr-AI.git
cd Decodr-AI
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

Starts PostgreSQL 16 with pgvector on port 5435.

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in your API keys

uvicorn app.main:app --reload --host 0.0.0.0 --port 8023
```

On first start it creates the pgvector extension, runs migrations, and starts pre-loading the BGE embedding model in the background.

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local

npm run dev
```

### 5. Go

Open `http://localhost:3000`, paste two video URLs, hit Analyze.

Or use the one-liner from root:

```bash
./start_services.sh
```

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
```

Set `NEXT_PUBLIC_API_URL` to your Railway backend URL.

### Backend → Railway

1. Connect repo to Railway
2. Set root directory: `backend`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example`

### Database → Supabase

1. Create a Supabase project
2. Run in the SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Set the connection string as `DATABASE_URL`

---

## Cost

### Per analysis (two videos)

| Component | Cost |
|-----------|------|
| Gemini 2.5 Flash (intent + analysis) | ~$0.003 |
| BGE embedding (local) | $0.00 |
| Whisper transcription (local fallback) | $0.00 |
| Supabase DB (free tier) | $0.00 |

**~$0.003 per full analysis.** Most of that is the LLM.

### Per chat message

| Component | Cost |
|-----------|------|
| Gemini 2.5 Flash (2-5 agent node calls) | ~$0.001-0.004 |
| BGE embedding (1 query vector) | $0.00 |

### Monthly infra

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | $0 |
| Railway | Starter | ~$5/mo |
| Supabase | Free | $0 |

**~$5/mo fixed** + $3-10/mo in LLM usage at 1000 analyses/month.

---

## Scaling

### Why pgvector instead of a dedicated vector DB

The honest answer is: at this scale, a dedicated vector DB adds complexity without adding much value.

At 1,000 analyses/day × 2 videos × ~15 chunks = ~30,000 new vectors per day. pgvector with HNSW indexing handles that easily into the tens of millions. The bigger win is keeping everything in one transaction — chunks and metadata either both commit or both roll back. With a separate vector store you'd be managing eventual consistency between two systems.

At roughly 1,000 creators/day, pgvector is the right call. If volume grew to tens of millions of chunks and query latency started degrading, then migrating the vector search to Qdrant makes sense. The switch would be isolated to a single method — `EmbeddingService.similarity_search` is the only place that queries vectors.

### Horizontal scaling

- **Backend** is async and stateless, so it scales horizontally fine. The BGE model is ~170MB in RAM per process, so factor that into instance sizing.
- **Database** — read replicas for analytics, PgBouncer for connection pooling if needed.
- **Transcription** — AssemblyAI offloads cloud transcription, but the local Whisper fallback is CPU-heavy. At higher throughput that should move to a background worker queue (Celery + Redis) rather than running inline.

---

## Engineering Tradeoffs

| Decision | What you give up | Why it's worth it |
|----------|----------|-----|
| pgvector over Qdrant | Slightly slower ANN at huge scale | One database, transactional integrity |
| BGE-small over OpenAI embeddings | 384-dim vs 1536-dim vectors | Zero cost, no rate limits, runs locally |
| faster-whisper over OpenAI Whisper API | Needs CPU on the server | No per-minute charges, works offline |
| Background tasks over Celery | No retry queue or dead-letter handling | Much simpler deployment at this scale |
| SSE over WebSockets | One-way only | HTTP-native, no upgrade handshake needed for text streaming |
| LangGraph over plain chains | More setup overhead | Clean conditional routing, persistent state |

---

## What I'd build next

- **TikTok, LinkedIn, X providers** — each is a new adapter file, nothing else changes
- **Batch analysis** — compare 5+ videos in a single session
- **Scheduled monitoring** — weekly snapshots of a creator's performance over time
- **GPU Whisper** — CUDA support would cut local transcription time dramatically
- **Multi-language transcripts** — auto-detect language, translate before embedding
- **A/B hook predictor** — predict which opening will retain more viewers
- **Export** — PDF or Notion export of the full analysis
- **Team workspaces** — shared sessions with roles

---

## Interview Notes

**On system design:**
"It's a RAG system where the retrieval corpus is video transcripts instead of documents. The LangGraph agent uses intent classification so it doesn't burn tokens on vector search for questions that are just about stats — those get answered straight from metadata."

**On the adapter pattern:**
"Adding a new platform is one file. The registry routes URLs to providers, and none of the ingestion pipeline knows or cares which platform it's dealing with. I've worked on systems where adding a data source means touching five different files — I didn't want that here."

**On pgvector:**
"At our vector volume — maybe 30-50K vectors a day — pgvector with HNSW is more than enough. The real reason I picked it is transactional consistency. When chunks and metadata are in the same commit, I never have a state where the vector DB has embeddings for records that got rolled back."

**On streaming:**
"The chat endpoint uses SSE with LangGraph's `astream_events` API. I filter by node name so the frontend only receives tokens from the answer generator — internal routing calls don't leak through. Each node also emits a status event ('Searching transcripts...') so users know what's happening."

**On the transcript pipeline:**
"YouTube has native captions but they're not always available. Instagram has nothing. So I built a layered fallback: first try native captions, then download the audio and send it to AssemblyAI, then fall back to running faster-whisper locally with a timeout guard so it doesn't block the event loop indefinitely. If everything fails we mark the session `partial_success` — the user still gets all the engagement data and can chat about stats, they just don't get transcript-based analysis."

---

## Production Considerations

- **Rate limiting:** FastAPI middleware or Cloudflare in front of the API
- **Input sanitization:** URLs are validated but should also be checked against SSRF patterns
- **Secrets:** Use Railway/Vercel secret management in production, not `.env` files
- **Monitoring:** Structured logging is in place — add Sentry for exception tracking
- **Connection pooling:** PgBouncer in front of Supabase if connection counts get high
- **CDN:** Vercel handles frontend automatically. Completed analysis responses are good candidates for edge caching.
- **Data retention:** Audio files are deleted immediately after transcription. Analysis sessions should have a TTL to manage DB growth.

### YouTube transcript limitations in cloud environments

This is worth flagging explicitly. YouTube's bot detection is aggressive, and most cloud provider IP ranges (Railway, Render, AWS, GCP, Azure) are already flagged. In practice this means:

- `youtube-transcript-api` often returns IP-blocked errors on cloud hosts
- `yt-dlp` may hit "Sign in to confirm you're not a bot" errors even for public videos

The fallback pipeline handles this — if both the native API and audio download fail, the session degrades to `partial_success` and everything that doesn't need transcripts still works. For self-hosted deployments where you control the IP, YouTube cookies can be passed to yt-dlp for authenticated access. Cookies aren't bundled with the app.
