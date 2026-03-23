import yfinance as yf
import pandas as pd
from typing import Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

"""
Central place for configuration and raw data loading.

This module is intentionally side‑effect free: no user input or network
calls are executed at import time. Callers should explicitly request data
via the helper functions below.
"""

# Configuration / constants
API_KEY = os.getenv("FMP_API_KEY")
PROJECTION_YEARS: int = 10
EQUITY_RISK_PREMIUM: float = 0.05
RISK_FREE_RATE: float = 0.04  # Risk-free rate
# Nominal GDP growth rate (approximate upper bound for terminal growth)
MAX_TERMINAL_GROWTH: float = 0.045


from cache import get_cache, set_cache
from io import StringIO

def load_company_data(stock: str, use_cache: bool = True) -> Dict[str, Any]:
    """
    Load core financial statements and metadata for a given ticker with Redis caching.
    """
    cache_key = f"raw_data:{stock.upper()}"
    
    if use_cache:
        cached = get_cache(cache_key)
        if cached:
            try:
                income = pd.read_json(StringIO(cached["income"]), orient="split")
                cashflow = pd.read_json(StringIO(cached["cashflow"]), orient="split")
                balance = pd.read_json(StringIO(cached["balance"]), orient="split")
                print(f"Using cached raw financial data for {stock}")
                return {
                    "stock": stock,
                    "ticker": yf.Ticker(stock),
                    "income": income,
                    "cashflow": cashflow,
                    "balance": balance,
                    "info": cached["info"],
                    "cached": True
                }
            except Exception as e:
                print(f"Error restoring cache for {stock}: {e}")

    # Not in cache or cache error
    print(f"Fetching fresh raw financial data for {stock} from yfinance...")
    ticker = yf.Ticker(stock)
    income = ticker.financials
    cashflow = ticker.cashflow
    balance = ticker.balance_sheet
    info = ticker.info

    # Save to cache if data was actually found
    if use_cache and not income.empty:
        cache_data = {
            "income": income.to_json(orient="split"),
            "cashflow": cashflow.to_json(orient="split"),
            "balance": balance.to_json(orient="split"),
            "info": info
        }
        set_cache(cache_key, cache_data, ttl=86400) # Cache for 24 hours
    elif income.empty:
        print(f"Warning: No financial data found for {stock}. Will not cache empty results.")

    return {
        "stock": stock,
        "ticker": ticker,
        "income": income,
        "cashflow": cashflow,
        "balance": balance,
        "info": info,
        "cached": False
    }


def is_dcf_safe(stock: str, income: pd.DataFrame = None) -> bool:
    """
    Basic sanity checks to decide whether a DCF is appropriate for a company.
    """
    try:
        ticker = yf.Ticker(stock)
        info = ticker.info

        country = info.get("country")
        exchange = info.get("exchange")
        market_cap = info.get("marketCap")
        sector = info.get("sector")

        if country != "United States":
            return False

        # NASDAQ, NYSE
        if exchange not in ["NMS", "NYQ"]:
            return False

        if market_cap is None or market_cap < 10_000_000_000:
            return False

        if sector in ["Financial Services", "Utilities", "Real Estate", "Airlines", "Auto Manufacturers"] and stock not in ["V", "MA"]:
            return False

        # Try to detect financials based on income statement composition when available
        if income is not None and not income.empty and "Interest Income" in income.index:
            interest_series = income.loc["Interest Income"].dropna()
            revenue_series = income.loc["Total Revenue"].dropna(
            ) if "Total Revenue" in income.index else None

            if not interest_series.empty and revenue_series is not None and not revenue_series.empty:
                interest_income = float(interest_series.iloc[0])
                total_revenue = float(revenue_series.iloc[0])
                if total_revenue > 0 and interest_income / total_revenue > 0.3:
                    return False

        return True

    except Exception as exc:
        print(f"Error while checking DCF suitability: {exc}")
        return False
