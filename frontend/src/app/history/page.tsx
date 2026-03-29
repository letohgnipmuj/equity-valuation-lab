"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useValuation, ValuationData } from "@/contexts/ValuationContext";

interface ValuationHistoryResponse {
  entries: ValuationData[];
  limit: number;
}

function formatCurrency(value?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return `$${value.toFixed(2)}`;
}

function formatTimestamp(epochSeconds?: number) {
  if (!epochSeconds || Number.isNaN(epochSeconds)) return "Unknown";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function recommendationStyles(recommendation?: string) {
  if (recommendation === "BUY") {
    return {
      text: "text-green-400",
      badge: "bg-green-500/10 border-green-400/40 text-green-300",
      icon: <TrendingUp className="w-5 h-5 text-green-400" />
    };
  }

  if (recommendation === "SELL") {
    return {
      text: "text-red-400",
      badge: "bg-red-500/10 border-red-400/40 text-red-300",
      icon: <TrendingDown className="w-5 h-5 text-red-400" />
    };
  }

  return {
    text: "text-yellow-400",
    badge: "bg-yellow-500/10 border-yellow-300/40 text-yellow-300",
    icon: <Target className="w-5 h-5 text-yellow-400" />
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const { loadCachedValuation } = useValuation();
  const [entries, setEntries] = useState<ValuationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/valuations/history?limit=20`, {
          signal: controller.signal
        });

        if (!res.ok) {
          throw new Error("Failed to load valuation history.");
        }

        const data: ValuationHistoryResponse = await res.json();
        setEntries(data.entries || []);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error) {
          setError(err.message || "Failed to load valuation history.");
        } else {
          setError("Failed to load valuation history.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();

    return () => {
      controller.abort();
    };
  }, []);

  const titleText = useMemo(() => {
    if (isLoading) return "Loading history...";
    if (entries.length === 0) return "No saved valuations yet";
    return `${entries.length} recent valuations`;
  }, [entries.length, isLoading]);

  const handleCardClick = (entry: ValuationData) => {
    loadCachedValuation(entry);
    router.push("/");
  };

  return (
    <main className="w-full max-w-6xl mx-auto px-8 pb-16 pt-6">
      <section className="glass-card p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-0">History</p>
        <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-white mt-3">
          Past Valuation Results
        </h2>
        <p className="text-lg text-white/50 max-w-3xl leading-relaxed mt-4">
          Browse analyses of recent ticker valuations. Select a card to load that stored
          result into the main dashboard.
        </p>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/70 text-sm uppercase tracking-[0.18em]">{titleText}</p>
        </div>

        {error && (
          <div className="glass-card p-5 border border-red-500/30 text-red-300">
            {error}
          </div>
        )}

        {!error && isLoading && (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="glass-card p-6 animate-pulse">
                <div className="h-6 w-20 bg-white/10 rounded" />
                <div className="h-4 w-40 bg-white/10 rounded mt-4" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {Array.from({ length: 4 }).map((__, metricIdx) => (
                    <div key={metricIdx} className="h-10 bg-white/10 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!error && !isLoading && entries.length === 0 && (
          <div className="glass-card p-8 text-white/60">
            Run a ticker valuation from Home and successful results will show up here.
          </div>
        )}

        {!error && !isLoading && entries.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {entries.map((entry, idx) => {
              const recommendation = entry.recommendation || "HOLD";
              const recStyles = recommendationStyles(recommendation);
              return (
                <button
                  key={`${entry.ticker}-${entry.timestamp}-${idx}`}
                  type="button"
                  onClick={() => handleCardClick(entry)}
                  className="glass-card p-6 text-left border border-white/10 hover:border-white/25 transition-all duration-300 hover:-translate-y-[2px]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-3xl font-bold text-white tracking-tight">{entry.ticker}</h3>
                      <p className="text-sm text-white/50 mt-1">{formatTimestamp(entry.timestamp)}</p>
                    </div>
                    <div className={`inline-flex items-center gap-2 border rounded-full px-3 py-1 ${recStyles.badge}`}>
                      {recStyles.icon}
                      <span className="text-xs font-semibold tracking-wider uppercase">
                        {recommendation}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                        Weighted Value
                      </p>
                      <p className="text-xl font-mono text-white">
                        {formatCurrency(entry.weighted_valuation)}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                        Current Price
                      </p>
                      <p className="text-xl font-mono text-white">
                        {formatCurrency(entry.current_price)}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                        Recommendation
                      </p>
                      <p className={`text-xl font-semibold uppercase ${recStyles.text}`}>
                        {recommendation}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                        Company
                      </p>
                      <p className="text-base font-medium text-white/80 truncate">
                        {entry.name || "N/A"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
