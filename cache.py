import redis
import json
import logging
from typing import Any, Optional
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", None)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

try:
    if REDIS_URL:
        redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        # Test connection
        redis_client.ping()
        logger.info(f"Connected to Redis via URL")
    else:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=2
        )
        # Test connection
        redis_client.ping()
        logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
except Exception as e:
    logger.warning(f"Could not connect to Redis: {e}. Caching will be disabled.")
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

def set_cache(key: str, value: Any, ttl: int = 86400) -> bool:
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
