import numpy as np
import matplotlib.pyplot as plt
from utils import dcf_valuation
from info import MIN_WACC_TGR_SPREAD

def run_monte_carlo_sim(
    stock: str,
    revenue,
    ebit_margin,
    tax_rate,
    depreciation,
    growth_rates,
    discount_rate,
    terminal_growth,
    net_debt,
    shares_outstanding,
    cashflow,
    balance, current_price,
    num_runs: int = 5000,
    terminal_roic: float | None = None,
    save_plot: bool = True,
    silent: bool = False
) -> tuple[float, float, float]:
    if not silent:
        print(f"\nRunning Monte Carlo Simulation for {stock} ({num_runs} runs)...")
    
    mean_predicted_growth = np.mean(growth_rates)
    growth_sd = max(0.01, abs(mean_predicted_growth) * 0.35)
    wacc_sd = 0.01
    tgr_sd = 0.0075
    
    results = []
    
    for _ in range(num_runs):
        valid = False
        while not valid:
            # Randomize Growth
            shock = np.random.normal(0, growth_sd)
            sim_growth_rates = np.clip(growth_rates + shock, -0.05, 0.40)
            
            # Randomize WACC
            sim_wacc = np.random.normal(discount_rate, wacc_sd)
            sim_wacc = np.clip(sim_wacc, 0.05, 0.20)
            
            # Randomize TGR
            sim_tgr = np.random.normal(terminal_growth, tgr_sd)
            sim_tgr = np.clip(sim_tgr, -np.inf, 0.05)
            
            # Enforce guardrail WACC > TGR + minimum spread to prevent degenerate valuations
            if sim_wacc > sim_tgr + MIN_WACC_TGR_SPREAD:
                valid = True
                
        # Calculate DCF
        implied_price = dcf_valuation(
            revenue=revenue,
            ebit_margin=ebit_margin,
            tax_rate=tax_rate,
            depreciation=depreciation,
            growth_rates=sim_growth_rates,
            discount_rate=sim_wacc,
            terminal_growth=sim_tgr,
            net_debt=net_debt,
            shares_outstanding=shares_outstanding,
            cashflow=cashflow,
            balance=balance,
            terminal_roic=terminal_roic,
        )
        
        if not np.isnan(implied_price) and implied_price > 0:
            results.append(implied_price)
            
    if not results:
        print("Simulation failed to produce valid valuations.")
        return 0.0, 0.0, 0.0
        
    results_arr = np.array(results)
    
    out_median = np.median(results_arr)
    out_25 = np.percentile(results_arr, 25)
    out_75 = np.percentile(results_arr, 75)
    out_5 = np.percentile(results_arr, 5)
    out_95 = np.percentile(results_arr, 95)
    percentile = (results_arr < current_price).mean() * 100
    
    if not silent:
        print("\n--- Monte Carlo Results ---")
        print(f"Median Implied Price: ${out_median:.2f}")
        print(f"25th - 75th Percentile: ${out_25:.2f} - ${out_75:.2f}")
        print(f"5th - 95th Percentile: ${out_5:.2f} - ${out_95:.2f}")
        print(f"Current Price: ${current_price:.2f}")
        print(f"Market Price Percentile: {percentile:.2f}%")
    
    # Plotting
    if save_plot:
        try:
            plt.figure(figsize=(10, 6))
            # Remove extreme outliers for a cleaner plot (top and bottom 1%)
            p1, p99 = np.percentile(results_arr, 1), np.percentile(results_arr, 99)
            plot_data = results_arr[(results_arr >= p1) & (results_arr <= p99)]
            
            plt.hist(plot_data, bins=50, color='skyblue', edgecolor='black', alpha=0.7)
            plt.axvline(current_price, color='green', linestyle='dashed', linewidth=2, label=f'Current Price: ${current_price:.2f}')
            plt.axvline(out_median, color='red', linestyle='dashed', linewidth=2, label=f'Median: ${out_median:.2f}')
            plt.axvline(out_25, color='orange', linestyle='dotted', linewidth=2, label=f'25th Perc: ${out_25:.2f}')
            plt.axvline(out_75, color='orange', linestyle='dotted', linewidth=2, label=f'75th Perc: ${out_75:.2f}')        
            plt.axvline(out_5, color='purple', linestyle='dotted', linewidth=2, label=f'5th Perc: ${out_5:.2f}')
            plt.axvline(out_95, color='purple', linestyle='dotted', linewidth=2, label=f'95th Perc: ${out_95:.2f}')
            
            plt.title(f'Monte Carlo DCF Valuation Distribution for {stock} ({num_runs} Runs)')
            plt.xlabel('Implied Share Price ($)')
            plt.ylabel('Frequency')
            plt.legend()
            plt.grid(axis='y', alpha=0.75)
            
            plot_filename = f"{stock} Monte Carlo.png"
            plt.savefig(plot_filename)
            plt.close()
            print(f"Histogram saved to {plot_filename}")
        except Exception as e:
            print(f"Failed to generate plot: {e}")

    return float(out_median), float(out_25), float(out_75)

