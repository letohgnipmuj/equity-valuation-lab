import os

SECONDS_PER_HOUR = 3600
SECONDS_PER_DAY = 86400
SECONDS_PER_WEEK = 604800

# Redis cache TTLs
REDIS_DEFAULT_CACHE_TTL_SECONDS = int(
    os.getenv("REDIS_DEFAULT_CACHE_TTL_SECONDS", str(SECONDS_PER_DAY))
)
API_VALUATION_CACHE_TTL_SECONDS = int(
    os.getenv("API_VALUATION_CACHE_TTL_SECONDS", str(4 * SECONDS_PER_HOUR))
)
RAW_DATA_CACHE_TTL_SECONDS = int(
    os.getenv("RAW_DATA_CACHE_TTL_SECONDS", str(SECONDS_PER_WEEK))
)
FMP_CACHE_TTL_SECONDS = int(
    os.getenv("FMP_CACHE_TTL_SECONDS", str(SECONDS_PER_DAY))
)

# In-process company cache tuning
LOCAL_COMPANY_CACHE_TTL_SECONDS = int(
    os.getenv("LOCAL_COMPANY_CACHE_TTL_SECONDS", "60")
)
LOCAL_COMPANY_CACHE_MAX_ENTRIES = int(
    os.getenv("LOCAL_COMPANY_CACHE_MAX_ENTRIES", "256")
)

# API timeout configuration (seconds)
# Backend synchronous execution timeout before switching to async job processing
API_SYNC_TIMEOUT_SECONDS = int(
    os.getenv("API_SYNC_TIMEOUT_SECONDS", "20")
)
