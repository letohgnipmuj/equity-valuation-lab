"use client";

import React, { useState } from "react";
import { Search, Loader2, Info } from "lucide-react";
import { useValuation } from "@/contexts/ValuationContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TickerSearchProps {
  align?: "left" | "center";
}

export function TickerSearch({ align = "center" }: TickerSearchProps) {
  const [ticker, setTicker] = useState("");
  const { fetchValuation, isLoading } = useValuation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      fetchValuation(ticker.trim());
    }
  };

  const alignmentClass = align === "left" ? "max-w-xl mx-0" : "max-w-md mx-auto";

  return (
    <form
      onSubmit={handleSearch}
      className={`relative flex items-center w-full ${alignmentClass}`}
    >
      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
        <Input
          type="text"
          placeholder="Enter a ticker (e.g. AAPL)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          disabled={isLoading}
          className="pl-12 pr-24 py-6 w-full text-lg uppercase bg-white/5 border border-white/20 rounded-full focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:border-white/50 backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.05)] text-foreground placeholder:text-gray-500 transition-all"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <div className="relative group">
            <Info className="w-4 h-4 text-gray-400 hover:text-white" />
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 absolute -top-2 -right-52 w-64 bg-slate-900 text-xs text-white p-2 rounded-lg shadow-lg z-20">
              Must be US company (NYSE/NASDAQ), `{'>'}`10B market cap, not financials, utilities, or real estate.
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !ticker}
            className="rounded-full px-6 py-4 bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:bg-white/20 disabled:text-gray-400 font-medium"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Analyze"}
          </Button>
        </div>
      </div>
    </form>
  );
}
