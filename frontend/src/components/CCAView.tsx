"use client";

import React, { useState } from "react";
import { CCAModel } from "@/contexts/ValuationContext";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { downloadFile } from "@/lib/download";

interface CCAViewProps {
  cca: CCAModel;
  currentPrice?: number;
  ticker: string;
  scenarioLabel?: string;
  scenarioValue?: number;
  scenarioPercentileLabel?: string;
}

export function CCAView({
  cca,
  currentPrice,
  ticker,
  scenarioLabel,
  scenarioValue,
  scenarioPercentileLabel,
}: CCAViewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!ticker) return;
    setDownloadError(null);
    try {
      setIsDownloading(true);
      await downloadFile(
        `${API_BASE_URL}/api/exports/cca/${ticker}`,
        `${ticker} CCA.xlsx`
      );
    } catch {
      setDownloadError("Export failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Safe fallbacks
  const median = cca.median || 0;
  const p25 = cca.range?.[0] || 0;
  const p75 = cca.range?.[1] || 0;

  // Calculate relative ranges for a nice visual bar
  const minBound = Math.min(p25 * 0.8, currentPrice ? currentPrice * 0.8 : p25 * 0.8) || 0;
  const maxBound = Math.max(p75 * 1.2, currentPrice ? currentPrice * 1.2 : p75 * 1.2) || 100;
  const totalRange = maxBound - minBound;

  const medianPercent = totalRange > 0 ? ((median - minBound) / totalRange) * 100 : 50;
  const p25Percent = totalRange > 0 ? ((p25 - minBound) / totalRange) * 100 : 25;
  const p75Percent = totalRange > 0 ? ((p75 - minBound) / totalRange) * 100 : 75;
  const cpPercent = currentPrice && totalRange > 0 ? ((currentPrice - minBound) / totalRange) * 100 : null;

  return (
    <div className="glass p-5 sm:p-6 md:p-8 rounded-2xl border-white/5 w-full flex flex-col justify-between">
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h3 className="text-xl tracking-tight font-medium text-white/90">Comparable Company Analysis</h3>
          <p className="text-sm text-white/50 mt-1">Valuation implied by industry peer multiples.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Exporting..." : "Export CCA"}
          </Button>
          {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-12">
        <div className="flex flex-col">
          <span className="text-3xl sm:text-4xl md:text-5xl font-mono text-white">
            ${((scenarioValue !== undefined ? scenarioValue : median) || 0).toFixed(2)}
          </span>
          {scenarioValue !== undefined && (
            <span className="mt-3 text-xs text-white/50 uppercase tracking-widest font-semibold">
              {scenarioLabel || "Scenario"}: {scenarioPercentileLabel || "Selected"}
            </span>
          )}
        </div>

        {currentPrice && (
          <div className="flex flex-col sm:items-end">
            <span className="text-sm text-white/50 uppercase tracking-widest font-semibold mb-1">Upside</span>
            <span className={`text-2xl font-mono ${(((scenarioValue !== undefined ? scenarioValue : median) - currentPrice) / currentPrice) * 100 > 0 ? "text-green-400" : "text-red-400"}`}>
              {((((scenarioValue !== undefined ? scenarioValue : median) - currentPrice) / currentPrice) * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-between text-xs text-white/40 uppercase tracking-wider mb-3">
          <span>25th Percentile (${p25.toFixed(2)})</span>
          <span>75th Percentile (${p75.toFixed(2)})</span>
        </div>

        <div className="relative h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/10">
          {/* 25th to 75th range bar */}
          <div
            className="absolute top-0 bottom-0 bg-white/20 border-x border-white/40"
            style={{
              left: `${Math.max(0, p25Percent)}%`,
              width: `${Math.max(0, p75Percent - p25Percent)}%`
            }}
          />

          {/* Median marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white z-10 -ml-0.5 shadow-[0_0_10px_rgba(255,255,255,0.8)]"
            style={{ left: `${Math.max(0, Math.min(100, medianPercent))}%` }}
          />

          {/* Current Price marker */}
          {cpPercent !== null && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-blue-500 z-20 -ml-0.5 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
              style={{ left: `${Math.max(0, Math.min(100, cpPercent))}%` }}
              title={`Current Price: $${currentPrice?.toFixed(2)}`}
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-start sm:justify-end gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center"><span className="w-3 h-3 bg-white rounded-full inline-block mr-2" /> Median Implied</div>
          <div className="flex items-center"><span className="w-3 h-3 bg-white/20 border border-white/40 rounded-sm inline-block mr-2" /> Peer Range</div>
          {currentPrice && <div className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full inline-block mr-2 shadow-[0_0_5px_rgba(59,130,246,1)]" /> Current Price</div>}
        </div>
      </div>
    </div>
  );
}
