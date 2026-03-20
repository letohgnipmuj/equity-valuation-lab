"use client";

import { useValuation } from "@/contexts/ValuationContext";
import { TickerSearch } from "@/components/TickerSearch";
import { AlertCircle, TrendingUp, TrendingDown, Target } from "lucide-react";
import { DCFView } from "@/components/DCFView";
import { CCAView } from "@/components/CCAView";
import { MonteCarloView } from "@/components/MonteCarloView";
import { ReverseDCFView } from "@/components/ReverseDCFView";

export default function Home() {
  const { valuationData, isLoading, error } = useValuation();

  return (
    <main className="min-h-screen relative flex flex-col items-center p-8 transition-all duration-700">
      {/* Dynamic Background Noise & Blur */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-gradient-to-br from-black via-zinc-950 to-[#0A0A0A]"></div>
      
      {/* Floating Header */}
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center py-6 mb-12">
        <h1 className="text-2xl font-semibold tracking-tighter text-white/90">
          Equity Valuation <span className="text-white/40">Lab</span>
        </h1>
      </header>

      {/* Main Content Area */}
      <div className={`w-full max-w-7xl mx-auto flex flex-col transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${valuationData ? 'pt-0' : 'pt-[20vh] items-center'}`}>
        
        {/* Search Bar - Center aligned initially, moves to top contextually when data loads? We can just keep it elegantly centered/topped */}
        <div className={`w-full transition-all duration-700 ${valuationData ? 'max-w-xl mx-0 mb-12' : 'max-w-2xl text-center'}`}>
          {!valuationData && (
            <div className="mb-12 space-y-4">
              <h2 className="text-5xl lg:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 leading-[1.05] pb-1">
                Institutional-Grade<br />Valuation Engine
              </h2>
              <p className="text-lg text-white/40 max-w-lg mx-auto">
                Automated DCF, Comparable Company Analysis, and Monte Carlo simulations synthesized in seconds.
              </p>
            </div>
          )}
          
          <TickerSearch />
          
          {error && (
            <div className="mt-6 flex items-center justify-center space-x-2 text-red-400 glass px-4 py-3 rounded-xl mx-auto max-w-md w-full border-red-500/20">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Valuation Results Dashboard Scaffold */}
        {valuationData && !isLoading && (
          <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header / Summary Card */}
            <div className="glass-card p-8 flex flex-col md:flex-row justify-between items-center gap-8">
               <div className="flex-1">
                 <h2 className="text-5xl font-bold text-white tracking-tight">{valuationData.ticker}</h2>
                 <p className="text-xl text-white/50 mt-1">{valuationData.name}</p>
               </div>
               
               <div className="flex items-center gap-12">
                   <div className="text-right">
                     <p className="text-xs text-white/40 uppercase tracking-widest mb-2 font-bold">Current Price</p>
                     <div className="text-4xl font-mono text-white tracking-tight">
                       ${valuationData.current_price?.toFixed(2) || "N/A"}
                     </div>
                   </div>
                   
                   <div className="h-16 w-px bg-white/10" />

                   <div className="text-right">
                     <p className="text-xs text-white/40 uppercase tracking-widest mb-2 font-bold">Weighted Fair Value</p>
                     <div className="flex items-center gap-4">
                         <div className="text-4xl font-mono text-white tracking-tight">
                           ${valuationData.weighted_valuation?.toFixed(2) || "N/A"}
                         </div>
                     </div>
                   </div>

                   <div className="h-16 w-px bg-white/10" />
                   
                   <div className="text-right">
                     <p className="text-xs text-white/40 uppercase tracking-widest mb-2 font-bold">Action</p>
                     <div className="flex items-center justify-end gap-2">
                         {valuationData.recommendation === "BUY" && <TrendingUp className="w-8 h-8 text-green-400" />}
                         {valuationData.recommendation === "SELL" && <TrendingDown className="w-8 h-8 text-red-400" />}
                         {valuationData.recommendation === "HOLD" && <Target className="w-8 h-8 text-yellow-500" />}
                         <div className={`text-4xl font-bold tracking-tight uppercase ${
                             valuationData.recommendation === "BUY" ? "text-green-400" :
                             valuationData.recommendation === "SELL" ? "text-red-400" : "text-yellow-500"
                         }`}>
                           {valuationData.recommendation || "N/A"}
                         </div>
                     </div>
                   </div>
               </div>
            </div>

            {/* DCF Block */}
            {valuationData.dcf && <DCFView dcf={valuationData.dcf} currentPrice={valuationData.current_price} />}

            {/* Bottom Row - CCA & Monte Carlo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {valuationData.cca && <CCAView cca={valuationData.cca} currentPrice={valuationData.current_price} />}
               {valuationData.monte_carlo && <MonteCarloView monteCarlo={valuationData.monte_carlo} currentPrice={valuationData.current_price} />}
            </div>

            {valuationData.market_implied && (
              <ReverseDCFView marketImplied={valuationData.market_implied} />
            )}
            
          </div>
        )}
      </div>
    </main>
  );
}
