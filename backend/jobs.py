"""
Background job management for async valuation calculations.
Handles job creation, status tracking, and result retrieval.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum
import redis
import os

logger = logging.getLogger(__name__)

# Redis configuration (reuse same settings as cache.py)
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
        redis_client.ping()
        logger.info("Jobs: Connected to Redis via URL")
    else:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            **REDIS_CLIENT_KWARGS,
        )
        redis_client.ping()
        logger.info(f"Jobs: Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
except Exception as e:
    logger.warning(
        f"Jobs: Could not connect to Redis: {e}. Job tracking disabled.")
    redis_client = None


class JobStatus(str, Enum):
    """Enum for job status values"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Job:
    """Represents a background valuation job"""

    def __init__(self, job_id: str, ticker: str, mode: str):
        self.job_id = job_id
        self.ticker = ticker
        self.mode = mode
        self.status = JobStatus.QUEUED
        self.progress = 0  # 0-100
        self.result = None
        self.error = None
        self.eta_seconds = 0
        self.created_at = datetime.utcnow().isoformat()
        self.started_at = None
        self.completed_at = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert job to dictionary for storage"""
        return {
            "job_id": self.job_id,
            "ticker": self.ticker,
            "mode": self.mode,
            "status": self.status.value,
            "progress": self.progress,
            "result": self.result,
            "error": self.error,
            "eta_seconds": self.eta_seconds,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "Job":
        """Create Job from dictionary"""
        job = Job(data["job_id"], data["ticker"], data["mode"])
        job.status = JobStatus(data["status"])
        job.progress = data.get("progress", 0)
        job.result = data.get("result")
        job.error = data.get("error")
        job.eta_seconds = data.get("eta_seconds", 0)
        job.created_at = data.get("created_at")
        job.started_at = data.get("started_at")
        job.completed_at = data.get("completed_at")
        return job


def create_job(ticker: str, mode: str) -> str:
    """
    Create a new background valuation job.

    Args:
        ticker: Stock ticker symbol
        mode: Valuation mode (1-5)

    Returns:
        Job ID string
    """
    if not redis_client:
        logger.warning("Redis unavailable; job creation disabled")
        return None

    job_id = str(uuid.uuid4())
    job = Job(job_id, ticker, mode)

    try:
        key = f"job:{job_id}"
        redis_client.set(key, json.dumps(job.to_dict()), ex=3600)  # 1 hour TTL
        logger.info(f"Created job {job_id} for {ticker} mode={mode}")
        return job_id
    except Exception as e:
        logger.error(f"Error creating job: {e}")
        return None


def get_job(job_id: str) -> Optional[Job]:
    """
    Retrieve job by ID.

    Args:
        job_id: The job ID to retrieve

    Returns:
        Job object or None if not found
    """
    if not redis_client:
        return None

    try:
        key = f"job:{job_id}"
        data = redis_client.get(key)
        if data:
            return Job.from_dict(json.loads(data))
    except Exception as e:
        logger.error(f"Error retrieving job {job_id}: {e}")

    return None


def update_job_status(job_id: str, status: JobStatus, progress: int = None,
                      eta_seconds: int = None, error: str = None) -> bool:
    """
    Update job status and optional fields.

    Args:
        job_id: The job ID to update
        status: New status (queued, processing, completed, failed)
        progress: Progress percentage (0-100)
        eta_seconds: Estimated seconds remaining
        error: Error message if status is failed

    Returns:
        True if successful, False otherwise
    """
    if not redis_client:
        return False

    try:
        job = get_job(job_id)
        if not job:
            return False

        job.status = status
        if progress is not None:
            job.progress = progress
        if eta_seconds is not None:
            job.eta_seconds = eta_seconds
        if error is not None:
            job.error = error

        if status == JobStatus.PROCESSING and job.started_at is None:
            job.started_at = datetime.utcnow().isoformat()
        elif status in [JobStatus.COMPLETED, JobStatus.FAILED]:
            job.completed_at = datetime.utcnow().isoformat()

        key = f"job:{job_id}"
        redis_client.set(key, json.dumps(job.to_dict()), ex=3600)
        logger.info(f"Updated job {job_id} status to {status.value}")
        return True
    except Exception as e:
        logger.error(f"Error updating job {job_id}: {e}")
        return False


def complete_job(job_id: str, result: Dict[str, Any]) -> bool:
    """
    Mark job as completed with result.

    Args:
        job_id: The job ID to complete
        result: The valuation result dictionary

    Returns:
        True if successful, False otherwise
    """
    if not redis_client:
        return False

    try:
        job = get_job(job_id)
        if not job:
            return False

        job.status = JobStatus.COMPLETED
        job.result = result
        job.progress = 100
        job.error = None
        job.completed_at = datetime.utcnow().isoformat()

        key = f"job:{job_id}"
        redis_client.set(key, json.dumps(job.to_dict()), ex=3600)
        logger.info(f"Completed job {job_id}")
        return True
    except Exception as e:
        logger.error(f"Error completing job {job_id}: {e}")
        return False


def fail_job(job_id: str, error_message: str) -> bool:
    """
    Mark job as failed with error message.

    Args:
        job_id: The job ID to fail
        error_message: The error message

    Returns:
        True if successful, False otherwise
    """
    if not redis_client:
        return False

    try:
        job = get_job(job_id)
        if not job:
            return False

        job.status = JobStatus.FAILED
        job.error = error_message
        job.completed_at = datetime.utcnow().isoformat()

        key = f"job:{job_id}"
        redis_client.set(key, json.dumps(job.to_dict()), ex=3600)
        logger.error(f"Failed job {job_id}: {error_message}")
        return True
    except Exception as e:
        logger.error(f"Error failing job {job_id}: {e}")
        return False


def delete_job(job_id: str) -> bool:
    """
    Delete job from storage.

    Args:
        job_id: The job ID to delete

    Returns:
        True if successful, False otherwise
    """
    if not redis_client:
        return False

    try:
        key = f"job:{job_id}"
        redis_client.delete(key)
        logger.info(f"Deleted job {job_id}")
        return True
    except Exception as e:
        logger.error(f"Error deleting job {job_id}: {e}")
        return False
