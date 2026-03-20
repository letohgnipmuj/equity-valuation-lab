import numpy as np
import pandas as pd
import requests
import yfinance as yf
from openpyxl import load_workbook
import json
import logging
from data import load_company_data
from utils import pull_info, fill_excel_cca, safe_iloc0, get_weights
from data import API_KEY


def find_peers(ticker_symbol, sector, industry, target_ev=None, universe_path="sp500_universe.json", num_peers=15):
    """Filter universe for candidates and rank by size proximity (Enterprise Value) before fetching fresh data."""
    try:
        with open(universe_path, "r") as f:
            universe = json.load(f)
    except FileNotFoundError:
        print(f"Error: {universe_path} not found.")
        return []

    # Exclude self
    peers = [c for c in universe if c.get("ticker") != ticker_symbol]

    # Try Industry Filter
    candidates = [c for c in peers if c.get("industry") == industry]
    
    # Fallback to Sector if industry is too small
    if len(candidates) < 6:
        candidates = [c for c in peers if c.get("sector") == sector]

    if target_ev and candidates:
        # Rank by EV proximity to target
        def size_proximity(c):
            c_ev = c.get("enterprise_value") or c.get("market_cap") or 0
            if c_ev == 0 or target_ev == 0:
                return float('inf')
            return abs(c_ev - target_ev) / target_ev
            
        candidates.sort(key=size_proximity)

    # Return top 'num_peers' candidates (e.g., top 15-20)
    return [c["ticker"] for c in candidates[:num_peers]]


def get_peer_stats(tickers, fast_mode=False):
    from data import API_KEY
    from utils import pull_info

    peer_results = []
    for t in tickers:
        try:
            company_data = load_company_data(t)
            y_info = company_data.get("info", {})
            if not y_info:
                continue

            # Initialize metrics
            revenue = None
            ebitda = None
            net_income = None

            if fast_mode:
                # Screening mode: Use only yf info for speed
                revenue = y_info.get("totalRevenue")
                ebitda = y_info.get("ebitda")
                net_income = y_info.get("netIncome")
            else:
                # Valuation mode: Full fallback chain for accuracy. Favor TTM (info) for multiples consistency.
                revenue = y_info.get("totalRevenue")
                ebitda = y_info.get("ebitda")
                net_income = y_info.get("netIncome")

                income = company_data.get("income")
                if income is not None and not income.empty:
                    if revenue is None:
                        revenue = safe_iloc0(
                            income.loc["Total Revenue"]) if "Total Revenue" in income.index else None
                    if ebitda is None:
                        ebitda = safe_iloc0(
                            income.loc["EBITDA"]) if "EBITDA" in income.index else None
                    if net_income is None:
                        net_income = safe_iloc0(
                            income.loc["Net Income"]) if "Net Income" in income.index else None

                if revenue is None or ebitda is None:
                    fmp_income = pull_info("income-statement", t, API_KEY)
                    if isinstance(fmp_income, list) and len(fmp_income) > 0:
                        if revenue is None:
                            revenue = fmp_income[0].get("revenue")
                        if ebitda is None:
                            ebitda = fmp_income[0].get("ebitda")
                        if net_income is None:
                            net_income = fmp_income[0].get("netIncome")

            # Common metadata/ratios
            pe = y_info.get("trailingPE") or y_info.get("forwardPE")
            peg = y_info.get("pegRatio") or y_info.get("trailingPegRatio")
            roe = y_info.get("returnOnEquity")
            rev_growth = y_info.get("revenueGrowth")
            ev = y_info.get("enterpriseValue") or y_info.get("marketCap")
            margin = (
                ebitda / revenue) if (ebitda and revenue and revenue != 0) else None

            eps_growth = None
            if not fast_mode:
                try:
                    fmp_growth = pull_info("financial-growth", t, API_KEY)
                    if isinstance(fmp_growth, list) and len(fmp_growth) > 0:
                        eps_growth = fmp_growth[0].get("epsgrowth")
                except:
                    pass

            if eps_growth is None:
                eps_growth = y_info.get("earningsGrowth")

            peer_results.append({
                "ticker": t,
                "name": y_info.get("shortName") or t,
                "price": y_info.get("currentPrice") or y_info.get("navPrice"),
                "revenue": revenue,
                "ebitda": ebitda,
                "net_income": net_income,
                "ev": ev,
                "pe": pe,
                "peg": peg,
                "eps_growth": eps_growth,
                "rev_growth": rev_growth,
                "margin": margin,
                "roe": roe
            })
        except Exception as e:
            # Silent during pool fetching
            continue

    return peer_results


def run_cca(stock, export_excel: bool = True, silent: bool = False) -> tuple[float, float, float]:
    stock = stock.upper()

    try:
        company = load_company_data(stock)
    except Exception as e:
        if not silent:
            print(f"Error loading data for {stock}: {e}")
        return 0.0, 0.0, 0.0

    if not company or "info" not in company:
        if not silent:
            print(f"Error: Invalid data structure for {stock}.")
        return 0.0, 0.0, 0.0

    income = company.get("income", pd.DataFrame())
    info = company.get("info", {})

    # Target Metrics for Similarity
    # Target Metrics for Similarity (Prefer TTM from info, fallback to latest annual from statement)
    target_rev = info.get("totalRevenue") or (safe_iloc0(
        income.loc["Total Revenue"]) if "Total Revenue" in income.index else None)
    target_ebitda = info.get("ebitda") or (safe_iloc0(
        income.loc["EBITDA"]) if "EBITDA" in income.index else None)
    target_ni = info.get("netIncome") or (safe_iloc0(
        income.loc["Net Income"]) if "Net Income" in income.index else None)
    target_ev = info.get("enterpriseValue") or info.get("marketCap")
    target_rev_growth = info.get("revenueGrowth")
    target_margin = (target_ebitda / target_rev) if (
        target_ebitda and target_rev and target_rev != 0) else None

    sector = info.get("sector")
    industry = info.get("industry")

    if not sector:
        if not silent:
            print(f"Error: No sector information found for {stock}.")
        return 0.0, 0.0, 0.0

    if not silent:
        print(
            f"Finding peer candidates for {stock} in {industry} (Fallback: {sector})...")
    candidate_tickers = find_peers(stock, sector, industry, target_ev=target_ev)
    if not candidate_tickers:
        print(f"Error: Could not find any candidates for {stock}.")
        return 0.0, 0.0, 0.0

    pool_data = get_peer_stats(candidate_tickers, fast_mode=True)

    # Similarity Scoring logic (3 factors, 1/3 weight each)
    for p in pool_data:
        score_parts = []

        # 1. Revenue similarity (1/3)
        if p.get("revenue") and target_rev and target_rev != 0:
            score_parts.append(
                (1/3) * abs((p["revenue"] - target_rev) / target_rev))
        else:
            score_parts.append(1/3)

        # 2. EBITDA Margin similarity (1/3)
        if p.get("margin") is not None and target_margin is not None:
            score_parts.append((1/3) * abs(p["margin"] - target_margin))
        else:
            score_parts.append(1/3)

        # 3. Enterprise Value similarity (1/3)
        if p.get("ev") and target_ev and target_ev != 0:
            score_parts.append((1/3) * abs((p["ev"] - target_ev) / target_ev))
        else:
            score_parts.append(1/3)

        p["similarity_score"] = sum(score_parts)

    # Sort candidates and pick top 6
    pool_data.sort(key=lambda x: x["similarity_score"])
    top_6_tickers = [p["ticker"] for p in pool_data[:6]]

    peer_data = get_peer_stats(top_6_tickers, fast_mode=False)
    if not silent:
        print(
            f"Peer Group (Ranked): {', '.join([p['ticker'] for p in peer_data])}")

    # Calculate Multiples for chosen Peers
    for p in peer_data:
        # Validate denominators and EV exist and are non-zero
        p["ev_rev"] = p["ev"] / \
            p["revenue"] if (p.get("ev") and p.get("revenue")) else None
        p["ev_ebitda"] = p["ev"] / \
            p["ebitda"] if (p.get("ev") and p.get("ebitda")) else None

        # Adjusted P/E (P/E / (1 + Growth))
        # Ensure eps_growth is a small float (like 0.1 for 10%)
        growth_denominator = (
            1 + p["eps_growth"]) if p.get("eps_growth") is not None else None
        if p.get("pe") and growth_denominator and growth_denominator != 0:
            p["adj_pe"] = p["pe"] / growth_denominator
        else:
            p["adj_pe"] = None

    # Compute Statistics for Valuations (Median)
    valid_ev_rev = [p["ev_rev"] for p in peer_data if p["ev_rev"] is not None]
    valid_ev_ebitda = [p["ev_ebitda"]
                       for p in peer_data if p["ev_ebitda"] is not None]
    valid_pe = [p["pe"] for p in peer_data if p["pe"] is not None]

    # Compute Statistics for Valuations (Median, 25th, 75th)
    def d_stats(data):
        clean = [x for x in data if x is not None and np.isfinite(x)]
        if not clean:
            return None
        return {
            "25th": np.percentile(clean, 25),
            "median": np.median(clean),
            "75th": np.percentile(clean, 75)
        }

    s_rev = d_stats(valid_ev_rev)
    s_ebitda = d_stats(valid_ev_ebitda)
    s_pe = d_stats(valid_pe)

    if not s_rev and not s_ebitda and not s_pe:
        print("Error: Insufficient peer data to compute valuations.")
        return 0.0, 0.0, 0.0

    net_debt = (info.get("totalDebt") or 0) - (info.get("totalCash") or 0)
    shares = info.get("sharesOutstanding")

    if not shares:
        print(f"Error: Missing shares outstanding for {stock}.")
        return 0.0, 0.0, 0.0

    # Scenario containers
    implied_med = []
    implied_25 = []
    implied_75 = []
    results_display = []

    # EV/Revenue Implied
    if target_rev and s_rev:
        p_med = (target_rev * s_rev["median"] - net_debt) / shares
        p_25 = (target_rev * s_rev["25th"] - net_debt) / shares
        p_75 = (target_rev * s_rev["75th"] - net_debt) / shares
        implied_med.append(p_med)
        implied_25.append(p_25)
        implied_75.append(p_75)
        results_display.append(f"Based on EV/Revenue: ${p_med:.2f}")

    # EV/EBITDA Implied
    if target_ebitda and s_ebitda:
        p_med = (target_ebitda * s_ebitda["median"] - net_debt) / shares
        p_25 = (target_ebitda * s_ebitda["25th"] - net_debt) / shares
        p_75 = (target_ebitda * s_ebitda["75th"] - net_debt) / shares
        implied_med.append(p_med)
        implied_25.append(p_25)
        implied_75.append(p_75)
        results_display.append(f"Based on EV/EBITDA: ${p_med:.2f}")

    # P/E Implied
    if target_ni and s_pe:
        p_med = (target_ni * s_pe["median"]) / shares
        p_25 = (target_ni * s_pe["25th"]) / shares
        p_75 = (target_ni * s_pe["75th"]) / shares
        implied_med.append(p_med)
        implied_25.append(p_25)
        implied_75.append(p_75)
        results_display.append(f"Based on P/E:       ${p_med:.2f}")

    if not implied_med:
        print(f"Error: Sufficient financials for {stock} are missing.")
        return 0.0, 0.0, 0.0

    # Weighting based on Median implied prices
    weights = get_weights(implied_med)
    
    final_med = np.dot(implied_med, weights)
    final_25 = np.dot(implied_25, weights)
    final_75 = np.dot(implied_75, weights)

    if not silent:
        print(f"\n--- Valuation Range ({stock}) ---")
        for res in results_display:
            print(res)
        print(f"---------------------------------")
        print(f"Base Case Implied:  ${final_med:.2f}")
        print(f"Range (25th-75th):  ${final_25:.2f} - ${final_75:.2f}")
        print(f"Current Price:      ${info.get('currentPrice', 0):.2f}")
        
        if info.get('currentPrice'):
            upside = ((final_med / info.get('currentPrice')) - 1) * 100
            print(f"Implied Upside:     {upside:.1f}%\n")

    if export_excel:
        fill_excel_cca(stock, info, peer_data, income, API_KEY, weights)
    
    return float(final_med), float(final_25), float(final_75)



if __name__ == "__main__":
    user_stock = input("Enter stock ticker: ").strip()
    run_cca(user_stock)
