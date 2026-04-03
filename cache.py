import redis
import json
import logging
from typing import Any, Optional
import os
from constants import REDIS_DEFAULT_CACHE_TTL_SECONDS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", None)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS = float(
    os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS", "2")
)
REDIS_SOCKET_TIMEOUT_SECONDS = float(
    os.getenv("REDIS_SOCKET_TIMEOUT_SECONDS", "2")
)
REDIS_HEALTH_CHECK_INTERVAL_SECONDS = int(
    os.getenv("REDIS_HEALTH_CHECK_INTERVAL_SECONDS", "30")
)

REDIS_CLIENT_KWARGS = {
    "decode_responses": True,
    "socket_connect_timeout": REDIS_SOCKET_CONNECT_TIMEOUT_SECONDS,
    "socket_timeout": REDIS_SOCKET_TIMEOUT_SECONDS,
    "health_check_interval": REDIS_HEALTH_CHECK_INTERVAL_SECONDS,
}

try:
    if REDIS_URL:
        redis_client = redis.Redis.from_url(REDIS_URL, **REDIS_CLIENT_KWARGS)
        # Test connection
        redis_client.ping()
        logger.info(f"Connected to Redis via URL")
    else:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            **REDIS_CLIENT_KWARGS,
        )
        # Test connection
        redis_client.ping()
        logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
except Exception as e:
    logger.warning(
        f"Could not connect to Redis: {e}. Caching will be disabled.")
    redis_client = None


def get_cache(key: str) -> Optional[Any]:
    if not redis_client:
        return None
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.error(f"Error reading from cache: {e}")
    return None


def set_cache(key: str, value: Any, ttl: int = REDIS_DEFAULT_CACHE_TTL_SECONDS) -> bool:
    if not redis_client:
        return False
    try:
        redis_client.set(key, json.dumps(value), ex=ttl)
        return True
    except Exception as e:
        logger.error(f"Error writing to cache: {e}")
        return False


def acquire_lock(lock_name: str, acquire_timeout: int = 10, lock_timeout: int = 60) -> Optional[str]:
    """
    Simple Redis lock for request deduplication.
    """
    if not redis_client:
        return "mock_lock_id"

    import uuid
    identifier = str(uuid.uuid4())
    if redis_client.set(lock_name, identifier, nx=True, ex=lock_timeout):
        return identifier
    return None


def release_lock(lock_name: str, identifier: str):
    if not redis_client:
        return
    # Only release if we own it
    if redis_client.get(lock_name) == identifier:
        redis_client.delete(lock_name)
