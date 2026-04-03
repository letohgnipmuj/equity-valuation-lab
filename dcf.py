import numpy as np
import pandas as pd

from data import (
    API_KEY,
    PROJECTION_YEARS,
    EQUITY_RISK_PREMIUM,
    RISK_FREE_RATE,
    MAX_TERMINAL_GROWTH,
    load_company_data,
    is_dcf_safe,
)
from info import build_dcf_assumptions, MIN_WACC_TGR_SPREAD
from utils import dcf_valuation, get_yf_item, fill_excel, solve_for_revenue_growth, solve_for_tgr
from monte_carlo import run_monte_carlo_sim


from typing import Union

def run_dcf_for_ticker(stock: str, mode: str = "normal", export_excel: bool = True, silent: bool = False, return_full_data: bool = False) -> Union[float, tuple, dict]:
    stock = stock.upper()

    company = load_company_data(stock)
    ticker = company["ticker"]
    income = company["income"]
    cashflow = company["cashflow"]
    balance = company["balance"]
    info = company["info"]

    if not is_dcf_safe(stock, income):
        raise ValueError(
            f"Invalid ticker {stock}. Must be US company, NYSE or NASDAQ, >10b market cap, and not financials, utilities, or real estate sector."
        )

    assumptions = build_dcf_assumptions(
        stock=stock,
        api_key=API_KEY,
        projection_years=PROJECTION_YEARS,
        equity_risk_premium=EQUITY_RISK_PREMIUM,
        r_f=RISK_FREE_RATE,
        maxtgr=MAX_TERMINAL_GROWTH,
        income=income,
        cashflow=cashflow,
        balance=balance,
    )

    tax_rate = assumptions["tax_rate"]
    discount_rate = assumptions["discount_rate"]
    terminal_growth = min(assumptions["terminal_growth"], MAX_TERMINAL_GROWTH)
    
    # Enforce a minimum spread between WACC and TGR to prevent degenerate valuations
    if terminal_growth >= (discount_rate - MIN_WACC_TGR_SPREAD):
        if not silent:
            print(f"WARNING: Spread violation detected. TGR ({terminal_growth:.2%}) is too close to or exceeds WACC ({discount_rate:.2%}).")
            print(f"Clamping TGR to {(discount_rate - MIN_WACC_TGR_SPREAD):.2%} to enforce a minimum {MIN_WACC_TGR_SPREAD:.0%} spread.")
        terminal_growth = discount_rate - MIN_WACC_TGR_SPREAD

    growth_rates = assumptions["growth_rates"]
    ebit_margin = assumptions["ebit_margin"]
    terminal_roic = assumptions.get("terminal_roic")

    revenue = income.loc["Total Revenue"].dropna()

    depreciation = get_yf_item(cashflow, "depreciation")
    if depreciation is None:
        raise ValueError(
            "Could not locate depreciation in cash flow statement.")

    total_debt_series = get_yf_item(balance, "total debt")
    cash_series = get_yf_item(balance, "cash")
    if total_debt_series is None or cash_series is None:
        raise ValueError(
            "Could not locate total debt or cash for net debt calculation.")

    net_debt = float(total_debt_series.iloc[0]) - float(cash_series.iloc[0])

    shares_outstanding = float(ticker.info.get("sharesOutstanding") or 0)
    if shares_outstanding <= 0:
        raise ValueError(
            "Ticker is missing sharesOutstanding; cannot compute per-share value.")

    current_price = float(ticker.info.get("currentPrice") or 0)

    if mode == "reverse_growth":
        if current_price <= 0:
            if not silent:
                print("Cannot perform reverse DCF without a valid current price.")
            return 0.0
            
        implied_growth = solve_for_revenue_growth(
            current_price=current_price,
            revenue=revenue,
            ebit_margin=ebit_margin,
            tax_rate=tax_rate,
            depreciation=depreciation,
            discount_rate=discount_rate,
            terminal_growth=terminal_growth,
            net_debt=net_debt,
            shares_outstanding=shares_outstanding,
            cashflow=cashflow,
            balance=balance,
            terminal_roic=terminal_roic,
        )
        
        if not silent:
            short_name = (info.get("shortName") or stock).upper()
            print(f"\n{short_name} Reverse DCF (Solve for Revenue Growth)")
            print(f"Current Price: ${current_price:.2f}")
            print(
                f"Constant Assumptions: WACC={round(discount_rate * 100, 2):.2f}%, "
                f"TGR={terminal_growth * 100:.2f}%, "
                f"Projection Years={PROJECTION_YEARS}"
            )
            if np.isnan(implied_growth):
                print("Could not find a valid revenue growth rate to justify the current price.")
            elif implied_growth == -999.0:
                print("VALUE DESTRUCTION ERROR: Under current assumptions (Net PPE scaling 1:1 with Revenue), increasing growth actually DECREASES company value.")
                print("No positive growth rate can justify the current price in this model.")
            else:
                print(f"Implied ANNUAL revenue growth needed to justify price (constant over {PROJECTION_YEARS}y): {implied_growth * 100:.2f}%")
        
        return implied_growth

    elif mode == "reverse_tgr":
        if current_price <= 0:
            if not silent:
                print("Cannot perform reverse DCF without a valid current price.")
            return 0.0
            
        implied_tgr = solve_for_tgr(
            current_price=current_price,
            revenue=revenue,
            ebit_margin=ebit_margin,
            tax_rate=tax_rate,
            depreciation=depreciation,
            growth_rates=growth_rates,
            discount_rate=discount_rate,
            net_debt=net_debt,
            shares_outstanding=shares_outstanding,
            cashflow=cashflow,
            balance=balance,
            terminal_roic=terminal_roic,
        )
        
        if not silent:
            short_name = (info.get("shortName") or stock).upper()
            print(f"\n{short_name} Reverse DCF (Solve for Terminal Growth Rate)")
            print(f"Current Price: ${current_price:.2f}")
            print(
                f"Constant Assumptions: Growth Rates={np.round(growth_rates, 2)}, "
                f"WACC={round(discount_rate * 100, 2):.2f}%, "
                f"Projection Years={PROJECTION_YEARS}"
            )
            if np.isnan(implied_tgr):
                print("Could not find a valid terminal growth rate to justify the current price.")
            else:
                print(f"Implied TERMINAL growth rate needed to justify price: {implied_tgr * 100:.2f}%")
        
        return implied_tgr

    elif mode == "monte_carlo":
        return run_monte_carlo_sim(
            stock=stock,
            revenue=revenue,
            ebit_margin=ebit_margin,
            tax_rate=tax_rate,
            depreciation=depreciation,
            growth_rates=growth_rates,
            discount_rate=discount_rate,
            terminal_growth=terminal_growth,
            net_debt=net_debt,
            shares_outstanding=shares_outstanding,
            cashflow=cashflow,
            balance=balance, current_price=current_price,
            terminal_roic=terminal_roic,
            silent=silent
        )

    # Normal DCF Mode
    implied_share_price = dcf_valuation(
        revenue=revenue,
        ebit_margin=ebit_margin,
        tax_rate=tax_rate,
        depreciation=depreciation,
        growth_rates=growth_rates,
        discount_rate=discount_rate,
        terminal_growth=terminal_growth,
        net_debt=net_debt,
        shares_outstanding=shares_outstanding,
        cashflow=cashflow,
        balance=balance,
        terminal_roic=terminal_roic,
    )

    upside_downside = (implied_share_price - current_price) / \
        current_price * 100 if current_price > 0 else np.nan

    wacc_deltas = np.array([-0.006, -0.003, 0, 0.003, 0.006])
    wacc_range = [discount_rate + d for d in wacc_deltas]

    tgr_deltas = np.array([-0.005, 0, 0.005])
    # Sensitivity scenarios can exceed base cap IF WACC allows, but base case is clamped
    tgr_range = [terminal_growth + d for d in tgr_deltas]

    sensitivity = pd.DataFrame(index=tgr_range, columns=wacc_range)
    for wacc in wacc_range:
        for tgr in tgr_range:
            impl_price = dcf_valuation(
                revenue=revenue,
                ebit_margin=ebit_margin,
                tax_rate=tax_rate,
                depreciation=depreciation,
                growth_rates=growth_rates,
                discount_rate=wacc,
                terminal_growth=tgr,
                net_debt=net_debt,
                shares_outstanding=shares_outstanding,
                cashflow=cashflow,
                balance=balance,
                terminal_roic=terminal_roic,
            )
            # Use "--" for cases where WACC <= TGR (mathematically invalid)
            sensitivity.loc[tgr, wacc] = float(impl_price) if not np.isnan(impl_price) else None
    
    # Ensure all data is numeric before rounding (skipping "--" strings)
    sensitivity_display = sensitivity.copy()

    if not silent:
        short_name = (info.get("shortName") or stock).upper()
        print(f"{short_name} DCF")
        print(
            f"Assumptions: Growth Rates={np.round(growth_rates, 2)}, "
            f"WACC={round(discount_rate * 100, 2):.2f}%, "
            f"TGR={terminal_growth * 100:.2f}%, "
            f"Projection Years={PROJECTION_YEARS}"
        )
        print(f"Implied Share Price: ${implied_share_price:.2f}")
        print(f"Current Price: ${current_price:.2f}")
        print(f"Upside/Downside: {upside_downside:.2f}%")
        print("\nSensitivity Analysis (Base Case TGR capped at 5%):")
        # For display, try to round the numeric values and handle the non-numeric strings
        print(sensitivity_display.map(lambda x: f"${x:.2f}" if isinstance(x, (float, int)) and not np.isnan(x) else x))

    if export_excel:
        fill_excel(
            stock=stock,
            ticker=ticker,
            info=info,
            income=income,
            cashflow=cashflow,
            balance=balance,
            discount_rate=discount_rate,
            terminal_growth=terminal_growth,
            growth_rates=growth_rates,
            ebit_margin=ebit_margin,
            tax_rate=tax_rate,
        )
    
    if return_full_data:
        return {
            "implied_price": float(implied_share_price),
            "current_price": float(current_price),
            "upside": float(upside_downside),
            "wacc": float(discount_rate),
            "tgr": float(terminal_growth),
            "sensitivity": sensitivity.to_dict(orient="split"),
            "assumptions": {
                "growth_rates": growth_rates.tolist() if hasattr(growth_rates, "tolist") else list(growth_rates),
                "ebit_margin": ebit_margin.tolist() if hasattr(ebit_margin, "tolist") else list(ebit_margin),
                "tax_rate": float(tax_rate)
            }
        }

    return float(implied_share_price)

    


if __name__ == "__main__":
    user_stock = input("Enter stock ticker: ").strip()
    print("\nSelect DCF Mode:")
    print("1: Normal DCF")
    print("2: Reverse DCF (Solve for Revenue Growth)")
    print("3: Reverse DCF (Solve for Terminal Growth Rate)")
    print("4: Monte Carlo Simulation")
    mode_input = input("Enter choice (1-4) [default: 1]: ").strip()
    
    if mode_input == "2":
        mode = "reverse_growth"
    elif mode_input == "3":
        mode = "reverse_tgr"
    elif mode_input == "4":
        mode = "monte_carlo"
    else:
        mode = "normal"
        
    run_dcf_for_ticker(user_stock, mode)
