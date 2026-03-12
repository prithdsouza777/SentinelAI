"""Redis cache with graceful fallback to in-memory storage.

Used for persisting decisions, alerts, and metrics across restarts.
When Redis is unavailable, the app works identically using in-memory lists.
"""

import json
from datetime import datetime, timezone

import redis.asyncio as aioredis

from app.config import settings


class RedisClient:
    """Async Redis client with automatic fallback when Redis is unavailable."""

    def __init__(self):
        self._client: aioredis.Redis | None = None
        self._available = False

    @property
    def available(self) -> bool:
        return self._available

    async def connect(self):
        """Try to connect to Redis. Non-blocking — handles failure gracefully."""
        try:
            self._client = aioredis.from_url(
                settings.redis_url, decode_responses=True
            )
            await self._client.ping()
            self._available = True
            print(f"[redis] Connected to {settings.redis_url}")
        except Exception as e:
            print(f"[redis] Not available: {e}. Using in-memory fallback.")
            self._available = False

    async def close(self):
        """Close the Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None
            self._available = False

    async def push_json(self, key: str, value: dict, maxlen: int = 200):
        """Push a JSON object to the front of a Redis list, trimming to maxlen."""
        if not self._available:
            return
        try:
            await self._client.lpush(key, json.dumps(value, default=str))
            await self._client.ltrim(key, 0, maxlen - 1)
        except Exception as e:
            print(f"[redis] push_json error: {e}")

    async def get_list(self, key: str, limit: int = 100) -> list[dict]:
        """Get a list of JSON objects from Redis."""
        if not self._available:
            return []
        try:
            items = await self._client.lrange(key, 0, limit - 1)
            return [json.loads(i) for i in items]
        except Exception as e:
            print(f"[redis] get_list error: {e}")
            return []

    async def set_json(self, key: str, value: dict, ttl: int | None = None):
        """Set a JSON value with optional TTL in seconds."""
        if not self._available:
            return
        try:
            data = json.dumps(value, default=str)
            if ttl:
                await self._client.setex(key, ttl, data)
            else:
                await self._client.set(key, data)
        except Exception as e:
            print(f"[redis] set_json error: {e}")

    async def get_json(self, key: str) -> dict | None:
        """Get a JSON value by key."""
        if not self._available:
            return None
        try:
            data = await self._client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"[redis] get_json error: {e}")
            return None

    async def incr(self, key: str, amount: float = 1.0) -> float:
        """Increment a numeric value."""
        if not self._available:
            return 0.0
        try:
            return float(await self._client.incrbyfloat(key, amount))
        except Exception as e:
            print(f"[redis] incr error: {e}")
            return 0.0

    async def health_check(self) -> dict:
        """Return health status for the settings page."""
        if not self._available:
            return {"status": "unavailable", "detail": "Not connected"}
        try:
            await self._client.ping()
            info = await self._client.info("memory")
            return {
                "status": "connected",
                "detail": f"Memory: {info.get('used_memory_human', 'N/A')}",
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)}


redis_client = RedisClient()
