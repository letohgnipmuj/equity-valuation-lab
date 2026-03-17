"use client";

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, TrendingDown, Search, BarChart3, Activity, 
  Target, Percent, Scale, ShieldAlert, CheckCircle2, 
  ArrowRight, RefreshCcw, Info
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, ReferenceLine, ScatterChart, 
  Scatter, LabelList, LineChart, Line, AreaChart, Area
} from "recharts";
import { SensitivityTable } from "@/components/SensitivityTable";
import { ValuationResult } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [ticker, setTicker] = useState("AAPL");
  const [mode, setMode] = useState("1");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchValuation = async (t: string, m: string = mode) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/valuation/${t}?mode=${m}`);
      const result = await response.json();
      
      if (!response.ok) {
        setError(result.detail || result.error || "An error occurred fetching valuation data.");
        setData(null);
        return;
      }

      setData(result);
    } catch (err) {
      setError("Failed to connect to the valuation engine backend.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Automatic fetch on load removed per user request
  // useEffect(() => {
  //   fetchValuation("AAPL");
  // }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker) fetchValuation(ticker, mode);
  };

  const chartData = data?.dcf ? [
    { name: "DCF", value: data.dcf.implied_price, type: 'Implied' },
    { name: "CCA", value: data.cca.median, type: 'Implied' },
    { name: "MC", value: data.monte_carlo.median, type: 'Simulated' },
    { name: "Current", value: data.current_price, type: 'Market' },
  ] : [];

  const upsideColor = (val: number) => val > 0 ? "text-emerald-400" : "text-rose-400";
  const recommendationColor = (rec: string) => {
    switch(rec) {
      case 'BUY': return 'text-emerald-400 border-emerald-400/30 bg-emerald-500/10';
      case 'SELL': return 'text-rose-400 border-rose-400/30 bg-rose-500/10';
      default: return 'text-zinc-400 border-zinc-400/30 bg-zinc-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Top Navbar */}
      <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <Scale className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-lg tracking-tight uppercase italic">Antigravity Valuation</span>
          </div>
          
          <form onSubmit={handleSearch} className="flex items-center gap-2 relative w-full max-w-xl ml-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="SEARCH TICKER (e.g. NVDA, MSFT...)" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
              />
              {loading && (
                <RefreshCcw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin" />
              )}
            </div>
            
            <select 
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-xs font-mono text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer hover:bg-zinc-800 transition-colors"
            >
              <option value="1">1: AGGREGATED (DCF+CCA+MC)</option>
              <option value="2">2: DCF VALUATION</option>
              <option value="3">3: CCA VALUATION</option>
              <option value="4">4: REVERSE DCF (IMPLIED GROWTH)</option>
              <option value="5">5: MONTE CARLO SIMULATION</option>
            </select>
          </form>

          <div className="flex items-center gap-6 text-xs font-mono text-zinc-500 uppercase tracking-widest hidden md:flex">
             <div className="flex items-center gap-2">
               <Activity className="w-4 h-4" />
               Engine: ONLINE
             </div>
             <div className="flex items-center gap-2">
               <Info className="w-4 h-4" />
               ALPHA PRO
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-4 text-rose-400"
          >
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold uppercase tracking-tight">Valuation Engine Error</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!data && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
               <Scale className="w-16 h-16 text-zinc-800 mb-6" />
               <h2 className="text-2xl font-bold text-zinc-400">Ready to Analyze</h2>
               <p className="text-zinc-600 max-w-md mt-2">Enter a ticker symbol above to trigger the multi-modal valuation sequence.</p>
            </div>
          )}

          {data && (
            <motion.div 
              key={data.ticker}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Profile Header */}
              <div className="lg:col-span-12 bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
                
                <div className="flex flex-col items-center md:items-start gap-1">
                  <h2 className="text-xs font-mono text-zinc-500 tracking-[0.3em] uppercase mb-1">Stock Profile</h2>
                  <div className="flex items-center gap-4">
                    <h1 className="text-5xl font-black italic tracking-tighter">{data.ticker}</h1>
                    <div className="h-10 w-[2px] bg-zinc-800" />
                    <div className="flex flex-col">
                      <span className="text-xl font-bold text-zinc-100 leading-tight uppercase tracking-tight">{data.name}</span>
                      <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Equities Market Data</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 w-full md:w-auto">
                    <div className="flex flex-col items-center md:items-end">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Market Price</span>
                      <span className="text-3xl font-mono text-zinc-100 tracking-tighter">${data.current_price.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-center md:items-end">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Fair Value</span>
                      <span className="text-3xl font-mono text-emerald-400 tracking-tighter">${data.weighted_valuation.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col items-center md:items-end">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Implied Upside</span>
                      <span className={`text-3xl font-mono tracking-tighter ${upsideColor(data.upside)}`}>
                        {data.upside > 0 ? '+' : ''}{data.upside.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center md:items-end justify-center">
                        <div className={`px-6 py-2 rounded-full border text-sm font-black tracking-[0.2em] ${recommendationColor(data.recommendation)}`}>
                          {data.recommendation}
                        </div>
                    </div>
                </div>
              </div>

              {/* Main Column */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* Chart Section */}
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6 h-[450px]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-bold text-sm uppercase tracking-widest">Aggregated Valuation Spectrum</h3>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-900 px-3 py-1 rounded-full">
                       Confidence Threshold: 85%
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#18181b" />
                      <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.15]} />
                      <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} width={60} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                        itemStyle={{ color: '#ecfdf5', fontFamily: 'monospace' }}
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      />
                      <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24} animationDuration={1500}>
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.name === 'Current' ? '#3f3f46' : entry.name === 'Weighted' ? '#10b981' : '#18181b'} 
                            stroke={entry.name === 'Current' ? '#71717a' : entry.name === 'Weighted' ? '#34d399' : '#3f3f46'}
                          />
                        ))}
                      </Bar>
                      <ReferenceLine x={data.weighted_valuation} stroke="#10b981" strokeDasharray="5 5" label={{ position: 'top', value: 'FAIR VALUE', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                      {chartData.map((entry, index) => (
                        <Bar key={`value-${index}`} dataKey="value" data={[entry]} hide>
                           <LabelList dataKey="value" position="right" formatter={(v: number) => `$${v.toFixed(2)}`} fill="#a1a1aa" fontSize={12} offset={10} fontFamily="monospace" />
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                  
                </div>

                {/* Sensitivity Table */}
                <SensitivityTable 
                  index={data.dcf.sensitivity.index}
                  columns={data.dcf.sensitivity.columns}
                  data={data.dcf.sensitivity.data}
                  currentPrice={data.current_price}
                />
              </div>

              {/* Sidebar Column */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                 {/* Methodology Breakdown */}
                 <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6">
                    <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       Methodology Check
                    </h3>
                    
                    <div className="space-y-6">
                       <div className="flex items-center justify-between group">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-zinc-100">DCF Analysis</span>
                             <span className="text-[10px] text-zinc-500 font-mono italic">Unlevered Free Cash Flow</span>
                          </div>
                          <div className="text-right">
                             <div className="text-sm font-mono text-zinc-100">${data.dcf.implied_price.toFixed(2)}</div>
                             <div className="text-[10px] text-emerald-400/80 font-mono">Weight: 55%</div>
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-zinc-100">Relative Val (CCA)</span>
                             <span className="text-[10px] text-zinc-500 font-mono italic">Industry Comparable Pool</span>
                          </div>
                          <div className="text-right">
                             <div className="text-sm font-mono text-zinc-100">${data.cca.median.toFixed(2)}</div>
                             <div className="text-[10px] text-emerald-400/80 font-mono">Weight: 45%</div>
                          </div>
                       </div>
                       
                       <div className="h-[1px] bg-zinc-800" />
                       
                       <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-zinc-100">Monte Carlo Simulation</span>
                             <span className="text-[10px] text-zinc-500 font-mono italic">5,000 Iteration Probabilistic</span>
                          </div>
                          <div className="text-right">
                             <div className="text-sm font-mono text-zinc-100">${data.monte_carlo.median.toFixed(2)}</div>
                             <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter">P50 Confidence</div>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Assumptions Card */}
                 <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6">
                    <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                       <Target className="w-4 h-4 text-emerald-500" />
                       Model Assumptions
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Cost of Cap</span>
                          <span className="text-xl font-mono text-emerald-400">{(data.dcf.wacc * 100).toFixed(1)}%</span>
                       </div>
                       <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Long Term Grow</span>
                          <span className="text-xl font-mono text-emerald-400">{(data.dcf.tgr * 100).toFixed(1)}%</span>
                       </div>
                        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
                           <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Proj. Margins</span>
                           <span className="text-xl font-mono text-emerald-400">
                             {(data.dcf.assumptions.ebit_margin[0] * 100).toFixed(0)}%
                           </span>
                        </div>
                       <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">Effective Tax</span>
                          <span className="text-xl font-mono text-emerald-400">{(data.dcf.assumptions.tax_rate * 100).toFixed(0)}%</span>
                       </div>
                    </div>
                 </div>

                 {/* Market Logic */}
                 <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6">
                    <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                       <RefreshCcw className="w-4 h-4 text-emerald-500" />
                       Reverse DCF Logic
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                       What the market is currently pricing in for {data.ticker} to justify ${data.current_price.toFixed(2)}.
                    </p>
                    
                    <div className="space-y-4">
                       <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl">
                          <span className="text-xs font-bold uppercase tracking-tight">Implied Growth</span>
                          <span className="font-mono text-zinc-100">
                             {data.market_implied.revenue_growth ? (data.market_implied.revenue_growth * 100).toFixed(1) + '%' : 'ERR'}
                          </span>
                       </div>
                       <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl">
                          <span className="text-xs font-bold uppercase tracking-tight">Implied TGR</span>
                          <span className="font-mono text-zinc-100">
                             {data.market_implied.tgr ? (data.market_implied.tgr * 100).toFixed(1) + '%' : 'ERR'}
                          </span>
                       </div>
                    </div>
                 </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-md h-10 flex items-center px-6">
        <div className="flex items-center gap-6 text-[10px] font-mono text-zinc-500 uppercase">
           <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Valuation Core: Ready
           </div>
           <div>Mode: Aggregated (V.9.4.2)</div>
           <div className="text-zinc-700">|</div>
           <div>Last Scan: {data ? new Date(data.timestamp * 1000).toLocaleTimeString() : 'N/A'}</div>
           <div className="flex-1" />
           <div className="text-zinc-400">© 2026 Antigravity Systems Inc.</div>
        </div>
      </footer>
    </div>
  );
}
