"use client";

import React from "react";
import { MonteCarloModel } from "@/contexts/ValuationContext";
import { Activity } from "lucide-react";

interface MonteCarloViewProps {
  monteCarlo: MonteCarloModel;
  currentPrice?: number;
}

export function MonteCarloView({ monteCarlo, currentPrice }: MonteCarloViewProps) {
  // Safe fallbacks
  const median = monteCarlo.median || 0;
  const p25 = monteCarlo.range?.[0] || 0;
  const p75 = monteCarlo.range?.[1] || 0;
  
  if (median === 0 || isNaN(median)) {
      return (
          <div className="glass p-8 rounded-2xl border-white/5 w-full flex items-center justify-center min-h-[300px] text-white/50">
              <p>Monte Carlo simulation data unavailable.</p>
          </div>
      );
  }

  // Calculate relative ranges for a nice visual bar
  const minBound = Math.min(p25 * 0.7, currentPrice ? currentPrice * 0.7 : p25 * 0.7);
  const maxBound = Math.max(p75 * 1.3, currentPrice ? currentPrice * 1.3 : p75 * 1.3);
  const totalRange = maxBound - minBound;

  const medianPercent = ((median - minBound) / totalRange) * 100;
  const p25Percent = ((p25 - minBound) / totalRange) * 100;
  const p75Percent = ((p75 - minBound) / totalRange) * 100;
  const cpPercent = currentPrice ? ((currentPrice - minBound) / totalRange) * 100 : null;

  return (
    <div className="glass p-8 rounded-2xl border-white/5 w-full flex flex-col justify-between">
      <div className="mb-4">
        <div className="flex items-center space-x-3 mb-1">
          <Activity className="w-5 h-5 text-purple-400" />
          <h3 className="text-xl tracking-tight font-medium text-white/90">Monte Carlo Simulation</h3>
        </div>
        <p className="text-sm text-white/50">10,000 randomized iterations of DCF assumptions.</p>
      </div>

      <div className="flex items-center justify-between my-8">
        <div className="flex flex-col border-l-2 border-purple-500/50 pl-4">
          <span className="text-sm text-white/50 uppercase tracking-widest font-semibold mb-1">Simulated Median</span>
          <span className="text-3xl lg:text-4xl font-mono text-white">${median.toFixed(2)}</span>
        </div>
        
        {currentPrice && (
          <div className="flex flex-col items-end">
            <span className="text-sm text-white/50 uppercase tracking-widest font-semibold mb-1">Conviction</span>
            <span className={`text-2xl font-mono ${((median - currentPrice) / currentPrice) * 100 > 0 ? "text-green-400" : "text-red-400"}`}>
              {(((median - currentPrice) / currentPrice) * 100 > 0) ? "Bullish" : "Bearish"}
            </span>
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-between text-xs text-white/40 uppercase tracking-wider mb-2">
          <span className="text-left w-1/3">Bear Case<br/>(${p25.toFixed(2)})</span>
          <span className="text-center w-1/3">Base Case<br/>(${median.toFixed(2)})</span>
          <span className="text-right w-1/3">Bull Case<br/>(${p75.toFixed(2)})</span>
        </div>
        
        <div className="relative h-6 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 mt-2">
            {/* The "Probability mass" visual */}
          <div 
            className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"
            style={{ 
              left: `${p25Percent}%`, 
              width: `${p75Percent - p25Percent}%` 
            }}
          />
          
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-purple-400 z-10 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
            style={{ left: `${medianPercent}%` }}
          />

          {cpPercent !== null && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
              style={{ left: `${cpPercent}%` }}
              title={`Current Price: $${currentPrice?.toFixed(2)}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
