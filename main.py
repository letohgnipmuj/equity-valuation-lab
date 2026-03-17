import yfinance as yf
import pandas as pd
import numpy as np
import time
from dcf import run_dcf_for_ticker
from cca import run_cca
from data import load_company_data

def run_valuation_orchestrator(ticker_symbol: str, mode: str = "1"):
    ticker_symbol = ticker_symbol.upper()
    try:
        company = load_company_data(ticker_symbol)
        info = company.get("info", {})
        current_price = info.get("currentPrice")
        short_name = (info.get("shortName") or ticker_symbol).upper()

        if mode == "1":
            print(f"COMBINED VALUATION: {short_name}")
            dcf_price = run_dcf_for_ticker(ticker_symbol, mode="normal", export_excel=True, silent=True)
            cca_med, cca_25, cca_75 = run_cca(ticker_symbol, export_excel=True, silent=True)
            mc_med, mc_25, mc_75 = run_dcf_for_ticker(ticker_symbol, mode="monte_carlo", export_excel=True, silent=True)
            implied_rev_growth = run_dcf_for_ticker(ticker_symbol, mode="reverse_growth", silent=True)
            implied_tgr = run_dcf_for_ticker(ticker_symbol, mode="reverse_tgr", silent=True)

            weighted_price = (dcf_price * 0.55) + (cca_med * 0.45)
            upside = (weighted_price / current_price - 1) * 100 if current_price else 0

            print(f"DCF Implied Value:      ${dcf_price:,.2f}")
            print(f"CCA Implied Value:      ${cca_med:,.2f}")
            print(f"------------------------------------------")
            print(f"EXPECTED VALUE (55/45): ${weighted_price:,.2f}")
            print(f"CURRENT PRICE ${current_price:,.2f}")
            print(f"IMPLIED UPSIDE:         {upside:,.1f}%")
            print(f"------------------------------------------")
            print(f"MONTE CARLO MEDIAN:     ${mc_med:,.2f}")
            print(f"MC 25th-75th RANGE:     ${mc_25:,.2f} - ${mc_75:,.2f}")
            print(f"------------------------------------------")
            
            if isinstance(implied_rev_growth, (float, int)) and not np.isnan(implied_rev_growth) and implied_rev_growth != -999:
                print(f"MARKET IMPLIED REV GROWTH: {implied_rev_growth*100:,.2f}%")
            else:
                print(f"MARKET IMPLIED REV GROWTH: ERR")
                
            if isinstance(implied_tgr, (float, int)) and not np.isnan(implied_tgr):
                print(f"MARKET IMPLIED TGR:        {implied_tgr*100:,.2f}%")
            else:
                print(f"MARKET IMPLIED TGR:        ERR")
            
            print(f"\n" + "-"*40)
            if upside > 15: print("Recommendation: BUY")
            elif upside < -10: print("Recommendation: SELL")
            else: print("Recommendation: HOLD")
            print("="*40 + "\n")
        elif mode == "2": run_dcf_for_ticker(ticker_symbol, mode="normal", silent=False)
        elif mode == "3": run_cca(ticker_symbol, silent=False)
        elif mode == "4":
            print(f"\n>>> Running Reverse DCF Models for {short_name}...")
            run_dcf_for_ticker(ticker_symbol, mode="reverse_growth", silent=False)
            run_dcf_for_ticker(ticker_symbol, mode="reverse_tgr", silent=False)
        elif mode == "5": run_dcf_for_ticker(ticker_symbol, mode="monte_carlo", silent=False)
    except Exception as e:
        print(f"Error: {e}")

def run_valuation_orchestrator_json(ticker_symbol: str, mode: str = "1"):
    ticker_symbol = ticker_symbol.upper()
    try:
        company = load_company_data(ticker_symbol)
        info = company.get("info", {})
        current_price = info.get("currentPrice")
        short_name = (info.get("shortName") or ticker_symbol).upper()

        if mode == "1":
            # 1. Run DCF (API Mode)
            dcf_data = run_dcf_for_ticker(ticker_symbol, mode="normal", export_excel=False, silent=True, return_full_data=True)
            cca_med, cca_25, cca_75 = run_cca(ticker_symbol, export_excel=False, silent=True)
            mc_med, mc_25, mc_75 = run_dcf_for_ticker(ticker_symbol, mode="monte_carlo", export_excel=False, silent=True)
            implied_rev_growth = run_dcf_for_ticker(ticker_symbol, mode="reverse_growth", silent=True)
            implied_tgr = run_dcf_for_ticker(ticker_symbol, mode="reverse_tgr", silent=True)
            weighted_price = (dcf_data["implied_price"] * 0.55) + (cca_med * 0.45)
        elif mode == "2":
            dcf_data = run_dcf_for_ticker(ticker_symbol, mode="normal", export_excel=False, silent=True, return_full_data=True)
            cca_med, cca_25, cca_75 = 0, 0, 0
            mc_med, mc_25, mc_75 = 0, 0, 0
            implied_rev_growth, implied_tgr = 0, 0
            weighted_price = dcf_data["implied_price"]
        elif mode == "3":
            dcf_data = {
                "implied_price": 0, 
                "wacc": 0, "tgr": 0,
                "sensitivity": {"index": [0], "columns": [0], "data": [[0]]},
                "assumptions": {"ebit_margin": [0], "tax_rate": 0, "wacc": 0, "tgr": 0, "revenue_growth": [0]}
            }
            cca_med, cca_25, cca_75 = run_cca(ticker_symbol, export_excel=False, silent=True)
            mc_med, mc_25, mc_75 = 0, 0, 0
            implied_rev_growth, implied_tgr = 0, 0
            weighted_price = cca_med
        elif mode == "4":
            dcf_data = {
                "implied_price": 0, 
                "wacc": 0, "tgr": 0,
                "sensitivity": {"index": [0], "columns": [0], "data": [[0]]},
                "assumptions": {"ebit_margin": [0], "tax_rate": 0, "wacc": 0, "tgr": 0, "revenue_growth": [0]}
            }
            cca_med, cca_25, cca_75 = 0, 0, 0
            mc_med, mc_25, mc_75 = 0, 0, 0
            implied_rev_growth = run_dcf_for_ticker(ticker_symbol, mode="reverse_growth", silent=True)
            implied_tgr = run_dcf_for_ticker(ticker_symbol, mode="reverse_tgr", silent=True)
            weighted_price = current_price
        elif mode == "5":
            dcf_data = {
                "implied_price": 0, 
                "wacc": 0, "tgr": 0,
                "sensitivity": {"index": [0], "columns": [0], "data": [[0]]},
                "assumptions": {"ebit_margin": [0], "tax_rate": 0, "wacc": 0, "tgr": 0, "revenue_growth": [0]}
            }
            cca_med, cca_25, cca_75 = 0, 0, 0
            mc_med, mc_25, mc_75 = run_dcf_for_ticker(ticker_symbol, mode="monte_carlo", export_excel=False, silent=True)
            implied_rev_growth, implied_tgr = 0, 0
            weighted_price = mc_med
        else:
            return {"error": f"Mode {mode} not supported"}

        upside = (weighted_price / current_price - 1) * 100 if current_price else 0
        recommendation = "HOLD"
        if upside > 15: recommendation = "BUY"
        elif upside < -10: recommendation = "SELL"

        return {
            "ticker": ticker_symbol,
            "name": short_name,
            "current_price": current_price,
            "weighted_valuation": weighted_price,
            "upside": upside,
            "recommendation": recommendation,
            "dcf": dcf_data,
            "cca": {
                "median": cca_med,
                "range": [cca_25, cca_75]
            },
            "monte_carlo": {
                "median": mc_med,
                "range": [mc_25, mc_75]
            },
            "market_implied": {
                "revenue_growth": implied_rev_growth if not np.isnan(implied_rev_growth) else None,
                "tgr": implied_tgr if not np.isnan(implied_tgr) else None
            },
            "timestamp": time.time()
        }
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    ticker = input("Enter ticker: ").strip()
    print("\nSelect Valuation Mode:")
    print("1: Aggregated Valuation (DCF + CCA + Monte Carlo)")
    print("2: DCF Valuation (Normal)")
    print("3: CCA Valuation (Comparable Companies)")
    print("4: Reverse DCF (Solving for Market Expectations)")
    print("5: Monte Carlo Simulation")
    
    mode_input = input("Enter choice (1-5) [default: 1]: ").strip()
    if not mode_input: mode_input = "1"
    
    run_valuation_orchestrator(ticker, mode_input)
