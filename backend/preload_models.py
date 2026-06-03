"""Pre-download ML models during the build phase to eliminate runtime download latency."""

import logging
from fastembed import TextEmbedding
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

def main():
    logger.info("🚀 Starting preflight download of ML models...")
    
    # 1. Preload FastEmbed BGE embedding model
    try:
        logger.info("Downloading BAAI/bge-small-en-v1.5 embedding model...")
        TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        logger.info("✅ Embedding model cached successfully.")
    except Exception as e:
        logger.error(f"❌ Failed to download embedding model: {e}")

    # 2. Preload Whisper tiny model
    try:
        logger.info("Downloading faster-whisper 'tiny' model...")
        WhisperModel("tiny", device="cpu", compute_type="int8")
        logger.info("✅ Whisper model cached successfully.")
    except Exception as e:
        logger.error(f"❌ Failed to download Whisper model: {e}")

    logger.info("🎉 All models pre-cached successfully!")

if __name__ == "__main__":
    main()
