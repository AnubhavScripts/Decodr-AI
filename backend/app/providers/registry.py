"""Provider registry — auto-detects platform from URL and returns the right adapter.

To register a new provider, just append it to _PROVIDERS.
"""

import logging
from app.providers.base import BaseVideoProvider
from app.providers.youtube import YouTubeProvider
from app.providers.instagram import InstagramProvider

logger = logging.getLogger(__name__)


class UnsupportedPlatformError(Exception):
    """Raised when no provider can handle the given URL."""

    def __init__(self, url: str):
        self.url = url
        super().__init__(
            f"No provider found for URL: {url}. "
            f"Supported platforms: YouTube, Instagram"
        )


# ----- Registry -----
# Add new providers here. The order determines priority when multiple
# providers could theoretically handle the same URL.
_PROVIDERS: list[type[BaseVideoProvider]] = [
    YouTubeProvider,
    InstagramProvider,
    # Future: TikTokProvider, LinkedInProvider, XProvider, FacebookProvider
]


class ProviderRegistry:
    """Detects which platform a URL belongs to and returns the right provider."""

    @classmethod
    def detect(cls, url: str) -> BaseVideoProvider:
        """Return an instantiated provider for the given URL."""
        for provider_cls in _PROVIDERS:
            if provider_cls.can_handle(url):
                logger.info(f"Detected {provider_cls.__name__} for {url}")
                return provider_cls()
        raise UnsupportedPlatformError(url)

    @classmethod
    def detect_platform(cls, url: str) -> str:
        """Return just the platform name string (youtube | instagram)."""
        provider = cls.detect(url)
        return provider.__class__.__name__.replace("Provider", "").lower()

    @classmethod
    def supported_platforms(cls) -> list[str]:
        """List all registered platform names."""
        return [
            p.__name__.replace("Provider", "").lower() for p in _PROVIDERS
        ]
