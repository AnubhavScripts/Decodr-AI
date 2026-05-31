"""Full ingestion pipeline — orchestrates metadata, transcript, chunking, and embedding."""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis import AnalysisSession
from app.models.video import Video
from app.providers.registry import ProviderRegistry
from app.services.transcript import TranscriptService
from app.services.embedding import EmbeddingService
from app.services.analytics import AnalyticsService

logger = logging.getLogger(__name__)


class IngestionService:
    """Orchestrates the full video analysis pipeline."""

    @staticmethod
    async def run(
        analysis_id: str,
        url_a: str,
        url_b: str,
        db: AsyncSession,
    ):
        """
        Run the complete ingestion pipeline for two video URLs.

        Steps:
        1. Detect platforms
        2. Extract metadata (concurrent)
        3. Compute engagement metrics
        4. Extract transcripts (concurrent)
        5. Chunk transcripts
        6. Generate embeddings
        7. Store everything
        8. Mark session as completed
        """
        session = await db.get(AnalysisSession, analysis_id)
        if not session:
            logger.error(f"Analysis session {analysis_id} not found")
            return

        try:
            # Update status
            session.status = "processing"
            session.updated_at = datetime.now(timezone.utc)
            await db.commit()

            # 1. Detect platforms
            logger.info(f"[{analysis_id}] Detecting platforms...")
            provider_a = ProviderRegistry.detect(url_a)
            provider_b = ProviderRegistry.detect(url_b)

            # 2. Extract metadata concurrently
            logger.info(f"[{analysis_id}] Extracting metadata...")
            meta_a, meta_b = await asyncio.gather(
                provider_a.extract_metadata(url_a),
                provider_b.extract_metadata(url_b),
            )

            # 3. Compute engagement metrics
            metrics_a = AnalyticsService.compute(
                views=meta_a.views,
                likes=meta_a.likes,
                comments=meta_a.comments_count,
                follower_count=meta_a.follower_count,
            )
            metrics_b = AnalyticsService.compute(
                views=meta_b.views,
                likes=meta_b.likes,
                comments=meta_b.comments_count,
                follower_count=meta_b.follower_count,
            )

            # 4. Create video records
            video_a = Video(
                analysis_id=analysis_id,
                video_label="A",
                platform=meta_a.platform,
                original_url=url_a,
                title=meta_a.title,
                creator=meta_a.creator,
                follower_count=meta_a.follower_count,
                views=meta_a.views,
                likes=meta_a.likes,
                comments_count=meta_a.comments_count,
                hashtags=meta_a.hashtags,
                upload_date=meta_a.upload_date,
                duration=meta_a.duration,
                thumbnail_url=meta_a.thumbnail_url,
                video_url=meta_a.video_url,
                engagement_rate=metrics_a.engagement_rate,
                comment_rate=metrics_a.comment_rate,
                like_rate=metrics_a.like_rate,
                engagement_per_follower=metrics_a.engagement_per_follower,
            )
            video_b = Video(
                analysis_id=analysis_id,
                video_label="B",
                platform=meta_b.platform,
                original_url=url_b,
                title=meta_b.title,
                creator=meta_b.creator,
                follower_count=meta_b.follower_count,
                views=meta_b.views,
                likes=meta_b.likes,
                comments_count=meta_b.comments_count,
                hashtags=meta_b.hashtags,
                upload_date=meta_b.upload_date,
                duration=meta_b.duration,
                thumbnail_url=meta_b.thumbnail_url,
                video_url=meta_b.video_url,
                engagement_rate=metrics_b.engagement_rate,
                comment_rate=metrics_b.comment_rate,
                like_rate=metrics_b.like_rate,
                engagement_per_follower=metrics_b.engagement_per_follower,
            )
            db.add(video_a)
            db.add(video_b)
            await db.flush()

            # 5. Extract transcripts concurrently
            logger.info(f"[{analysis_id}] Extracting transcripts...")
            transcript_a, transcript_b = await asyncio.gather(
                TranscriptService.extract(provider_a, url_a),
                TranscriptService.extract(provider_b, url_b),
            )

            video_a.transcript_text = transcript_a
            video_b.transcript_text = transcript_b

            # 6. Chunk transcripts
            logger.info(f"[{analysis_id}] Chunking transcripts...")
            chunks_a = TranscriptService.chunk(transcript_a)
            chunks_b = TranscriptService.chunk(transcript_b)

            # 7. Generate embeddings and store
            all_chunks = chunks_a + chunks_b
            if all_chunks:
                logger.info(
                    f"[{analysis_id}] Generating embeddings for "
                    f"{len(all_chunks)} chunks..."
                )
                all_embeddings = await EmbeddingService.generate(all_chunks)

                # Split embeddings back to per-video
                embeddings_a = all_embeddings[: len(chunks_a)]
                embeddings_b = all_embeddings[len(chunks_a) :]

                # Store chunks with embeddings
                if chunks_a:
                    await EmbeddingService.store_chunks(
                        analysis_id, video_a.id, chunks_a, embeddings_a, db
                    )
                if chunks_b:
                    await EmbeddingService.store_chunks(
                        analysis_id, video_b.id, chunks_b, embeddings_b, db
                    )
            else:
                logger.warning(f"[{analysis_id}] No transcript chunks to embed")

            # 8. Mark completed
            session.status = "completed"
            session.updated_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info(f"[{analysis_id}] Analysis completed successfully!")

        except Exception as e:
            logger.error(f"[{analysis_id}] Ingestion failed: {e}", exc_info=True)
            session.status = "failed"
            session.error_message = str(e)[:2000]
            session.updated_at = datetime.now(timezone.utc)
            await db.commit()
            raise
