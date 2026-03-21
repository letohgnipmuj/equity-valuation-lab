import sys
import os
import time
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Add parent directory to path to import existing valuation modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import existing core functions and cache logic from the root main.py
import importlib.util

def load_core_main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main_path = os.path.join(root_dir, "main.py")
    spec = importlib.util.spec_from_file_location("valuation_core", main_path)
    core = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(core)
    return core

valuation_core = load_core_main()
from cache import get_cache, set_cache

EXPORT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(
    title="Equity Valuation Lab API",
    description="API for fetching automated equity valuations (DCF, CCA, Monte Carlo).",
    version="1.0.0"
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, set this to the Vercel URL
    allow_credentials=True,
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

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": time.time()}

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
        return cached_result

    # Using the existing JSON orchestrator function
    result = valuation_core.run_valuation_orchestrator_json(ticker, mode=mode)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    # Save successful response to Redis cache
    set_cache(cache_key, result, ttl=3600)
    
    return result


@app.get("/api/exports/dcf/{ticker}")
def export_dcf_excel(ticker: str):
    ticker = ticker.upper()
    try:
        valuation_core.run_dcf_for_ticker(ticker, mode="normal", export_excel=True, silent=True)
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
        valuation_core.run_dcf_for_ticker(ticker, mode="monte_carlo", export_excel=False, silent=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    filename = f"{ticker} Monte Carlo.png"
    file_path = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Monte Carlo export not found.")

    return FileResponse(
        file_path,
        filename=filename,
        media_type="image/png"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
