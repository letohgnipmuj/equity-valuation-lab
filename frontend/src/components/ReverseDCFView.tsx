"use client";

import React from "react";
import { MarketImpliedModel } from "@/contexts/ValuationContext";

interface ReverseDCFViewProps {
  marketImplied: MarketImpliedModel;
}

export function ReverseDCFView({ marketImplied }: ReverseDCFViewProps) {
  const revenueGrowth = marketImplied?.revenue_growth;
  const tgr = marketImplied?.tgr;

  const formatPercent = (value?: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "—";
    return `${(value * 100).toFixed(2)}%`;
  };

  if (revenueGrowth == null && tgr == null) {
    return (
      <div className="glass p-5 sm:p-6 md:p-8 rounded-2xl border-white/5 w-full flex items-center justify-center text-white/50 min-h-[220px]">
        <p>Reverse DCF data unavailable.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5 sm:p-6 md:p-8 rounded-2xl border-white/5 w-full">
      <div className="mb-6">
        <h3 className="text-xl tracking-tight font-medium text-white/90">Reverse DCF (Market-Implied)</h3>
        <p className="text-sm text-white/50 mt-1">
          Growth rates required to justify the current share price under the DCF model. Results are individual, ie the revenue growth assumes base case terminal growth, and the TGR assumes base case revenue growth. Use as a sanity check to see if market expectations seem reasonable or extreme.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-5 rounded-xl border-white/5">
          <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2 block">Required Revenue Growth</span>
          <span className="text-3xl font-mono text-white">{formatPercent(revenueGrowth)}</span>
          <p className="text-xs text-white/40 mt-2">Implied multi-year revenue CAGR.</p>
        </div>

        <div className="glass p-5 rounded-xl border-white/5">
          <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-2 block">Implied Terminal Growth (TGR)</span>
          <span className="text-3xl font-mono text-white">{formatPercent(tgr)}</span>
          <p className="text-xs text-white/40 mt-2">Steady-state growth needed at maturity.</p>
        </div>
      </div>
    </div>
  );
}
