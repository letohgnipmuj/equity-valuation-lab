import logging
from io import StringIO
from cache import get_cache, set_cache
import yfinance as yf
import pandas as pd
from typing import Dict, Any
import os
from dotenv import load_dotenv
import yfinance.exceptions
import time

logger = logging.getLogger(__name__)

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
LOCAL_CACHE_TTL_SECONDS: int = 60
LOCAL_COMPANY_CACHE: Dict[str, tuple[Dict[str, Any], float]] = {}


def load_company_data(stock: str, use_cache: bool = True) -> Dict[str, Any]:
    """
    Load core financial statements and metadata for a given ticker with Redis caching.
    """
    stock = stock.upper()
    now = time.time()
    cache_key = f"raw_data:{stock}"

    if use_cache:
        local_entry = LOCAL_COMPANY_CACHE.get(stock)
        if local_entry:
            cached_data, cached_at = local_entry
            if now - cached_at < LOCAL_CACHE_TTL_SECONDS:
                logger.debug("Using in-memory cached raw data for %s", stock)
                return cached_data

    if use_cache:
        cached = get_cache(cache_key)
        if cached:
            try:
                income = pd.read_json(
                    StringIO(cached["income"]), orient="split")
                cashflow = pd.read_json(
                    StringIO(cached["cashflow"]), orient="split")
                balance = pd.read_json(
                    StringIO(cached["balance"]), orient="split")
                logger.debug("Using cached raw financial data for %s", stock)
                company_data = {
                    "stock": stock,
                    "ticker": yf.Ticker(stock),
                    "income": income,
                    "cashflow": cashflow,
                    "balance": balance,
                    "info": cached["info"],
                    "cached": True
                }
                LOCAL_COMPANY_CACHE[stock] = (company_data, now)
                return company_data
            except Exception as e:
                logger.warning("Error restoring cache for %s: %s", stock, e)

    # Not in cache or cache error
    logger.info("Fetching fresh raw financial data for %s from yfinance", stock)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(stock)
            income = ticker.financials
            cashflow = ticker.cashflow
            balance = ticker.balance_sheet
            info = ticker.info
            break  # Success
        except yfinance.exceptions.YFRateLimitError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff: 1, 2, 4 seconds
                logger.warning("Rate limited, retrying in %s seconds... (%s/%s)", wait_time, attempt + 1, max_retries)
                time.sleep(wait_time)
            else:
                logger.error("Rate limit error after %s attempts: %s", max_retries, e)
                raise e

    # Save to cache if data was actually found
    if use_cache and not income.empty:
        cache_data = {
            "income": income.to_json(orient="split"),
            "cashflow": cashflow.to_json(orient="split"),
            "balance": balance.to_json(orient="split"),
            "info": info
        }
        set_cache(cache_key, cache_data, ttl=604800)  # Cache for 7 days
    elif income.empty:
        logger.warning("No financial data found for %s. Will not cache empty results.", stock)

    company_data = {
        "stock": stock,
        "ticker": ticker,
        "income": income,
        "cashflow": cashflow,
        "balance": balance,
        "info": info,
        "cached": False
    }

    LOCAL_COMPANY_CACHE[stock] = (company_data, now)
    return company_data


def is_dcf_safe(stock: str, income: pd.DataFrame = None) -> bool:
    """
    Basic sanity checks to decide whether a DCF is appropriate for a company.
    """
    try:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                ticker = yf.Ticker(stock)
                info = ticker.info
                break
            except yfinance.exceptions.YFRateLimitError as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning("Rate limited in is_dcf_safe, retrying in %s seconds... (%s/%s)", wait_time, attempt + 1, max_retries)
                    time.sleep(wait_time)
                else:
                    logger.error("Rate limit error in is_dcf_safe after %s attempts: %s", max_retries, e)
                    raise e

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
        logger.warning("Error while checking DCF suitability: %s", exc)
        return False
