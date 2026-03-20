import numpy as np
import pandas as pd
from typing import Dict, Any

from utils import (
    dynamic_terminal_growth,
    get_wacc,
    get_yf_item,
    pull_info,
    revenue_growth_schedule,
    get_ebit_margin,
)

"""
High‑level construction of DCF inputs/assumptions.

This module exposes a single function that, given raw financial statements
and configuration, derives:
    - tax_rate
    - discount_rate (WACC)
    - terminal_growth
    - growth_rates
    - ebit_margin
"""


def build_dcf_assumptions(
    stock: str,
    api_key: str,
    projection_years: int,
    equity_risk_premium: float,
    r_f: float,
    maxtgr: float,
    income: pd.DataFrame,
    cashflow: pd.DataFrame,
    balance: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Compute all derived inputs needed for the DCF based on current financials.
    """
    if income is None or income.empty:
        raise ValueError(
            "Income statement is empty; cannot build DCF assumptions.")

    if cashflow is None or cashflow.empty:
        raise ValueError(
            "Cash flow statement is empty; cannot build DCF assumptions.")

    if balance is None or balance.empty:
        raise ValueError(
            "Balance sheet is empty; cannot build DCF assumptions.")

    # Tax rate
    if "Tax Provision" not in income.index or "Pretax Income" not in income.index:
        raise ValueError("Required tax items missing from income statement.")

    pretax = income.loc["Pretax Income"].dropna()
    tax_provision = income.loc["Tax Provision"].dropna()
    if pretax.empty or tax_provision.empty or pretax.iloc[0] == 0:
        raise ValueError(
            "Cannot compute tax rate from provided income statement.")

    tax_rate = float(tax_provision.iloc[0]) / float(pretax.iloc[0])
    # Clip to realistic corporate ranges to prevent one-off anomalies from dominating DCF
    tax_rate = float(np.clip(tax_rate, 0.10, 0.35))

    # Data for dynamic terminal growth calculation
    if "Operating Income" not in income.index:
        raise ValueError("Missing 'Operating Income' in income statement.")
    if "Total Assets" not in balance.index:
        raise ValueError("Missing 'Total Assets' in balance sheet.")
    if "Cash And Cash Equivalents" not in balance.index:
        raise ValueError(
            "Missing 'Cash And Cash Equivalents' in balance sheet.")
    if "Current Liabilities" not in balance.index:
        raise ValueError("Missing 'Current Liabilities' in balance sheet.")

    ebit = float(income.loc["Operating Income"].iloc[0])
    total_assets = float(balance.loc["Total Assets"].iloc[0])
    cash = float(balance.loc["Cash And Cash Equivalents"].iloc[0])
    current_liabilities = float(balance.loc["Current Liabilities"].iloc[0])
    short_term_debt = float(
        balance.loc["Current Debt"].iloc[0]) if "Current Debt" in balance.index else 0.0
    long_term_debt = float(
        balance.loc["Long Term Debt"].iloc[0]) if "Long Term Debt" in balance.index else 0.0

    capex = abs(float(cashflow.loc["Capital Expenditure"].iloc[0]))

    depreciation_series = get_yf_item(cashflow, "depreciation")
    if depreciation_series is None:
        raise ValueError(
            "Could not locate depreciation in cash flow statement.")
    depreciation_series = depreciation_series.dropna()
    if depreciation_series.empty:
        raise ValueError("Depreciation series is empty after dropping NaNs.")
    depreciation = float(depreciation_series.iloc[0])

    changenwc = 0.0

    # WACC based on CAPM
    discount_rate = get_wacc(
        ticker_symbol=stock,
        r_f=r_f,
        equity_risk_premium=equity_risk_premium,
        tax_rate=tax_rate,
        income=income,
    )

    # Terminal Growth Rate (TGR) based on ROIC * Reinvestment Rate
    terminal_growth = dynamic_terminal_growth(
        ebit=ebit,
        tax_rate=tax_rate,
        total_assets=total_assets,
        cash=cash,
        current_liabilities=current_liabilities,
        short_term_debt=short_term_debt,
        long_term_debt=long_term_debt,
        capex=capex,
        depreciation=depreciation,
        change_nwc=changenwc,
        cap=maxtgr,
        discount_rate=discount_rate,
    )

    # Calculate ROIC for terminal value calculation
    # We use the same calculate_roic logic as in dynamic_terminal_growth
    from utils import calculate_roic
    terminal_roic = calculate_roic(
        ebit=ebit,
        tax_rate=tax_rate,
        total_assets=total_assets,
        cash=cash,
        current_liabilities=current_liabilities,
        short_term_debt=short_term_debt
    )

    # Sanity check: terminal ROIC should at least be WACC for these companies,
    # but we'll allow it to be higher as requested.
    # If ROIC is very low/negative, default to WACC for a "mature" state.
    if terminal_roic < discount_rate:
        terminal_roic = discount_rate

    # Analyst estimates for revenue growth and margins
    estimates_raw = pull_info("analyst-estimates", stock, api_key)

    if estimates_raw is None:
        print("No analyst estimates available.")
        estimates = pd.DataFrame()
    else:
        estimates = pd.DataFrame(estimates_raw)

    growth_rates = revenue_growth_schedule(
        estimates=estimates,
        terminal_growth=terminal_growth,
        projection_years=projection_years,
        income=income,
    )

    ebit_margin = get_ebit_margin(
        income=income,
        estimates=estimates,
        projection_years=projection_years,
    )

    # Basic economic sanity check: Ensure positive denominator for Gordon Growth
    # Also enforce a minimum spread of 2% to prevent degenerate/explosive valuations
    discount_rate = max(discount_rate, terminal_growth + 0.02)

    # Return as dict for easy access

    return {
        "tax_rate": tax_rate,
        "discount_rate": discount_rate,
        "terminal_growth": terminal_growth,
        "growth_rates": growth_rates,
        "ebit_margin": ebit_margin,
        "terminal_roic": terminal_roic,
    }
