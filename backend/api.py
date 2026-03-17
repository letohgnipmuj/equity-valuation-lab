from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging
import time

from main import run_valuation_orchestrator
from cache import get_cache, set_cache, acquire_lock, release_lock
from data import load_company_data

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Equity Valuation Lab API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ValuationRequest(BaseModel):
    ticker: str
    mode: str = "1"

@app.get("/")
async def root():
    return {"message": "Equity Valuation Lab API is running"}

@app.get("/ticker/{symbol}")
async def get_ticker_info(symbol: str):
    """
    Check cache and return basic ticker info.
    """
    symbol = symbol.upper()
    cache_key = f"ticker_info:{symbol}"
    
    cached = get_cache(cache_key)
    if cached:
        return cached

    try:
        data = load_company_data(symbol)
        info = data.get("info", {})
        
        result = {
            "symbol": symbol,
            "name": info.get("shortName"),
            "price": info.get("currentPrice"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "currency": info.get("currency"),
            "marketCap": info.get("marketCap")
        }
        
        set_cache(cache_key, result, ttl=3600) # 1 hour for basic info
        return result
    except Exception as e:
        logger.error(f"Error fetching ticker {symbol}: {e}")
        raise HTTPException(status_code=404, detail=f"Ticker {symbol} not found or error fetching data.")

@app.post("/evaluate")
async def evaluate_ticker(request: ValuationRequest):
    """
    Run full valuation with Level 2 caching and deduplication.
    """
    ticker = request.ticker.upper()
    mode = request.mode
    cache_key = f"valuation:{ticker}:{mode}"
    lock_key = f"lock:valuation:{ticker}:{mode}"
    
    # Check Level 2 Cache
    cached_result = get_cache(cache_key)
    if cached_result:
        logger.info(f"Level 2 Cache Hit for {ticker} (Mode {mode})")
        return cached_result

    # Request Deduplication / Locking
    lock_id = acquire_lock(lock_key, lock_timeout=120)
    if not lock_id:
        # If locked, wait a bit and check cache again or return "Processing"
        # For simplicity, we'll wait 2 seconds and retry once
        time.sleep(2)
        cached_result = get_cache(cache_key)
        if cached_result:
            return cached_result
        raise HTTPException(status_code=429, detail="Calculation already in progress. Please try again in 30 seconds.")

    try:
        logger.info(f"Running valuation for {ticker} (Mode {mode})")
        # Note: We need to refactor run_valuation_orchestrator to return the dict instead of printing
        # For now, I'll use a placeholder that calls the orchestrator
        # In the next step, I will refactor main.py to support this
        
        # result = run_valuation_orchestrator(ticker, mode)
        # Placeholder for refactored main.py
        from main import run_valuation_orchestrator_json
        result = run_valuation_orchestrator_json(ticker, mode)
        
        # Save to Level 2 Cache
        set_cache(cache_key, result, ttl=3600) # 1 hour
        return result
        
    except Exception as e:
        logger.error(f"Valuation error for {ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        release_lock(lock_key, lock_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
