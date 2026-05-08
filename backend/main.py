from constants import API_VALUATION_CACHE_TTL_SECONDS
import importlib.util
import sys
import os
import time
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Add parent directory to path to import existing valuation modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now import from parent directory

try:
    from backend.history import get_recent_valuation_history, save_valuation_to_history
except ModuleNotFoundError:
    from history import get_recent_valuation_history, save_valuation_to_history

try:
    from backend.jobs import create_job, get_job, update_job_status, complete_job, fail_job, JobStatus
except ModuleNotFoundError:
    from jobs import create_job, get_job, update_job_status, complete_job, fail_job, JobStatus


def load_cache():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cache_path = os.path.join(root_dir, "cache.py")
    spec = importlib.util.spec_from_file_location("cache_module", cache_path)
    cache_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cache_module)
    return cache_module


cache_module = load_cache()
get_cache = cache_module.get_cache
set_cache = cache_module.set_cache

# Import existing core functions and cache logic from the root main.py


def load_core_main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main_path = os.path.join(root_dir, "main.py")
    spec = importlib.util.spec_from_file_location("valuation_core", main_path)
    core = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(core)
    return core


valuation_core = load_core_main()

EXPORT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(
    title="Equity Valuation Lab API",
    description="API for fetching automated equity valuations (DCF, CCA, Monte Carlo).",
    version="1.0.0"
)


def get_allowed_origins() -> List[str]:
    configured_origins = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if configured_origins:
        if configured_origins == "*":
            return ["*"]
        return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]

    # Local development defaults
    return ["http://localhost:3000", "http://127.0.0.1:3000"]


allowed_origins = get_allowed_origins()
allow_credentials = allowed_origins != ["*"]

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DCFAssumptionsModel(BaseModel):
    growth_rates: Optional[List[float]] = None
    wacc: Optional[float] = None
    tgr: Optional[float] = None
    ebit_margin: Optional[List[float]] = None
    tax_rate: Optional[float] = None


class DCFModel(BaseModel):
    implied_price: float
    current_price: Optional[float] = None
    upside: Optional[float] = None
    wacc: Optional[float] = None
    tgr: Optional[float] = None
    sensitivity: Optional[Dict[str, Any]] = None
    assumptions: Optional[DCFAssumptionsModel] = None


class CCAModel(BaseModel):
    median: float
    range: List[float]
    peers: Optional[List[Dict[str, Any]]] = None


class MonteCarloModel(BaseModel):
    median: float
    range: List[float]
    distribution: Optional[List[float]] = None


class MarketImpliedModel(BaseModel):
    revenue_growth: Optional[float] = None
    tgr: Optional[float] = None


class ValuationResponseModel(BaseModel):
    ticker: str
    name: str
    current_price: Optional[float]
    weighted_valuation: Optional[float]
    upside: Optional[float]
    recommendation: Optional[str]
    dcf: Optional[DCFModel] = None
    cca: Optional[CCAModel] = None
    monte_carlo: Optional[MonteCarloModel] = None
    market_implied: Optional[MarketImpliedModel] = None
    timestamp: float


class ValuationHistoryResponseModel(BaseModel):
    entries: List[ValuationResponseModel]
    limit: int


class JobSubmitResponseModel(BaseModel):
    job_id: str
    status: str
    ticker: str
    mode: str


class JobStatusResponseModel(BaseModel):
    job_id: str
    status: str
    progress: int
    eta_seconds: int
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": time.time()}


@app.post("/api/valuation/submit", response_model=JobSubmitResponseModel)
def submit_valuation_job(ticker: str, mode: str = Query("1", description="Valuation mode (1=Combined, 2=DCF, 3=CCA, 4=Reverse, 5=Monte Carlo)")):
    """
    Submit a valuation job to run asynchronously.
    Returns job ID for polling status.
    """
    ticker = ticker.upper()
    job_id = create_job(ticker, mode)

    if not job_id:
        raise HTTPException(
            status_code=500, detail="Failed to create job. Job tracking may be unavailable.")

    return {"job_id": job_id, "status": "queued", "ticker": ticker, "mode": mode}


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponseModel)
def get_job_status(job_id: str):
    """
    Poll job status and retrieve result when ready.
    """
    job = get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    response = {
        "job_id": job_id,
        "status": job.status.value,
        "progress": job.progress,
        "eta_seconds": job.eta_seconds,
        "error": job.error
    }

    # Only include result if completed
    if job.status.value == "completed":
        response["result"] = job.result

    return response


@app.get("/api/valuation/{ticker}", response_model=ValuationResponseModel)
def get_valuation(ticker: str, mode: str = Query("1", description="Valuation mode (1=Combined, 2=DCF, 3=CCA, 4=Reverse, 5=Monte Carlo)")):
    """
    Fetch valuation metrics for a given ticker.
    Uses the existing orchestration logic to compute and return models.
    """
    ticker = ticker.upper()
    cache_key = f"api_valuation:{ticker}:{mode}"

    # Try to fetch from cache first (1 hour cache for full API response)
    cached_result = get_cache(cache_key)
    if cached_result:
        save_valuation_to_history(cached_result)
        return cached_result

    # Using the existing JSON orchestrator function
    result = valuation_core.run_valuation_orchestrator_json(ticker, mode=mode)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Save successful response to Redis cache
    set_cache(cache_key, result, ttl=API_VALUATION_CACHE_TTL_SECONDS)
    save_valuation_to_history(result)

    return result


@app.get("/api/valuations/history", response_model=ValuationHistoryResponseModel)
def get_valuation_history(limit: int = Query(20, ge=1, le=20)):
    entries = get_recent_valuation_history(limit=limit)
    return {"entries": entries, "limit": limit}


@app.get("/api/exports/dcf/{ticker}")
def export_dcf_excel(ticker: str):
    ticker = ticker.upper()
    try:
        valuation_core.run_dcf_for_ticker(
            ticker, mode="normal", export_excel=True, silent=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    filename = f"{ticker} DCF.xlsx"
    file_path = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="DCF export not found.")

    return FileResponse(
        file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/api/exports/cca/{ticker}")
def export_cca_excel(ticker: str):
    ticker = ticker.upper()
    try:
        valuation_core.run_cca(ticker, export_excel=True, silent=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    filename = f"{ticker} CCA.xlsx"
    file_path = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="CCA export not found.")

    return FileResponse(
        file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/api/exports/monte-carlo/{ticker}")
def export_monte_carlo_png(ticker: str):
    ticker = ticker.upper()
    try:
        valuation_core.run_dcf_for_ticker(
            ticker, mode="monte_carlo", export_excel=False, silent=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    filename = f"{ticker} Monte Carlo.png"
    file_path = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404, detail="Monte Carlo export not found.")

    return FileResponse(
        file_path,
        filename=filename,
        media_type="image/png"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
