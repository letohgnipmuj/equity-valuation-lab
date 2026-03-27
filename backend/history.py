import json
import logging
import os
import time
from typing import Any, Dict, List

from cache import redis_client

logger = logging.getLogger(__name__)

VALUATION_HISTORY_KEY = "valuation_history"
DEFAULT_HISTORY_LIMIT = int(os.getenv("VALUATION_HISTORY_LIMIT", "20"))


def save_valuation_to_history(
    valuation_payload: Dict[str, Any], max_entries: int = DEFAULT_HISTORY_LIMIT
) -> bool:
    if not redis_client:
        return False

    try:
        timestamp = valuation_payload.get("timestamp")
        if not isinstance(timestamp, (int, float)):
            timestamp = time.time()

        serialized = json.dumps(valuation_payload)
        pipe = redis_client.pipeline()
        pipe.zadd(VALUATION_HISTORY_KEY, {serialized: timestamp})
        pipe.zcard(VALUATION_HISTORY_KEY)
        _, entry_count = pipe.execute()

        if entry_count > max_entries:
            redis_client.zremrangebyrank(
                VALUATION_HISTORY_KEY, 0, entry_count - max_entries - 1
            )
        return True
    except Exception as exc:
        logger.error("Failed to save valuation history: %s", exc)
        return False


def get_recent_valuation_history(limit: int = DEFAULT_HISTORY_LIMIT) -> List[Dict[str, Any]]:
    if not redis_client:
        return []

    try:
        raw_entries = redis_client.zrevrange(VALUATION_HISTORY_KEY, 0, max(limit - 1, 0))
        parsed_entries: List[Dict[str, Any]] = []
        for entry in raw_entries:
            try:
                parsed_entries.append(json.loads(entry))
            except json.JSONDecodeError:
                continue
        return parsed_entries
    except Exception as exc:
        logger.error("Failed to fetch valuation history: %s", exc)
        return []
