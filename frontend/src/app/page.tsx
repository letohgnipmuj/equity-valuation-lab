"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useValuation } from "@/contexts/ValuationContext";
import { TickerSearch } from "@/components/TickerSearch";
import { AlertCircle, TrendingUp, TrendingDown, Target } from "lucide-react";
import { DCFView } from "@/components/DCFView";
import { CCAView } from "@/components/CCAView";
import { MonteCarloView } from "@/components/MonteCarloView";
import { ReverseDCFView } from "@/components/ReverseDCFView";
import { LoadingDashboard } from "@/components/LoadingDashboard";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { valuationData, isLoading, error } = useValuation();
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  type ScenarioKey = "conservative" | "base" | "optimistic";
  type ScenarioConfig = {
    label: string;
    dcfWaccDelta: number;
    dcfTgrDelta: number;
    ccaLabel: "25th percentile" | "Median" | "75th percentile";
  };
  type ScenarioOutput = {
    label: string;
    dcfValue?: number;
    ccaValue?: number;
    weightedValue?: number;
    upside?: number;
    waccTarget?: number;
    tgrTarget?: number;
    dcfWaccDelta: number;
    dcfTgrDelta: number;
    ccaLabel: "25th percentile" | "Median" | "75th percentile";
  };

  const [scenario, setScenario] = useState<ScenarioKey>("base");

  const loadingSteps = useMemo(
    () => [
      "Collecting market data...",
      "Normalizing financial statements...",
      "Running DCF projections...",
      "Calibrating WACC and terminal growth...",
      "Calculating peer comps...",
      "Simulating Monte Carlo outcomes..."
    ],
    []
  );

  useEffect(() => {
    if (isLoading && !error) {
      setLoadingActive(true);
      setLoadingComplete(false);
      setShowSkeleton(false);
      setProgress(0);
      setStepIndex(0);
    }
  }, [isLoading, error]);

  useEffect(() => {
    if (!loadingActive) return;

    const skeletonTimer = setTimeout(() => setShowSkeleton(true), 3000);
    const start = Date.now();

    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(95, (elapsed / 120000) * 100);
      setProgress(next);
    }, 400);

    const stepTimer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % loadingSteps.length);
    }, 5000);

    return () => {
      clearTimeout(skeletonTimer);
      clearInterval(progressTimer);
      clearInterval(stepTimer);
    };
  }, [loadingActive, loadingSteps.length]);

  useEffect(() => {
    if (loadingActive && loadingComplete && !isLoading) {
      setLoadingActive(false);
      setShowSkeleton(false);
    }
  }, [loadingActive, loadingComplete, isLoading]);

  useEffect(() => {
    if (loadingActive && !isLoading && valuationData) {
      setProgress(100);
      setLoadingComplete(true);
    }
  }, [loadingActive, isLoading, valuationData]);

  useEffect(() => {
    if (error) {
      setLoadingActive(false);
      setShowSkeleton(false);
    }
  }, [error]);

  const showResults = Boolean(valuationData && !isLoading && !loadingActive);

  const scenarioConfig = useMemo<Record<ScenarioKey, ScenarioConfig>>(() => {
    return {
      conservative: {
        label: "Conservative",
        dcfWaccDelta: 0.003,
        dcfTgrDelta: -0.005,
        ccaLabel: "25th percentile",
      },
      base: {
        label: "Base",
        dcfWaccDelta: 0,
        dcfTgrDelta: 0,
        ccaLabel: "Median",
      },
      optimistic: {
        label: "Optimistic",
        dcfWaccDelta: -0.003,
        dcfTgrDelta: 0.005,
        ccaLabel: "75th percentile",
      },
    };
  }, []);

  const scenarioOutputs = useMemo(() => {
    if (!valuationData) return null;

    const dcf = valuationData.dcf;
    const cca = valuationData.cca;
    const currentPrice = valuationData.current_price;

    const baseWacc = dcf?.wacc;
    const baseTgr = dcf?.tgr;

    const getNearestIndex = (values: number[], target: number) => {
      let bestIdx = 0;
      let bestDiff = Infinity;
      values.forEach((val, idx) => {
        const diff = Math.abs(val - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = idx;
        }
      });
      return bestIdx;
    };

    const getScenarioDCF = (waccTarget?: number, tgrTarget?: number) => {
      if (!dcf || waccTarget === undefined || tgrTarget === undefined) {
        return dcf?.implied_price;
      }
      const sensitivity = dcf.sensitivity;
      if (!sensitivity || !sensitivity.index || !sensitivity.columns || !sensitivity.data) {
        return dcf.implied_price;
      }

      const tgrIndex = getNearestIndex(sensitivity.index, tgrTarget);
      const waccIndex = getNearestIndex(sensitivity.columns, waccTarget);
      const row = sensitivity.data?.[tgrIndex];
      const value = row?.[waccIndex];
      return typeof value === "number" ? value : dcf.implied_price;
    };

    const getScenarioCCA = (label: "25th percentile" | "Median" | "75th percentile") => {
      if (!cca) return undefined;
      if (label === "25th percentile") return cca.range?.[0];
      if (label === "75th percentile") return cca.range?.[1];
      return cca.median;
    };

    const outputs = (Object.keys(scenarioConfig) as ScenarioKey[]).reduce((acc, key) => {
      const cfg = scenarioConfig[key];
      const waccTarget = baseWacc !== undefined ? baseWacc + cfg.dcfWaccDelta : undefined;
      const tgrTarget = baseTgr !== undefined ? baseTgr + cfg.dcfTgrDelta : undefined;
      const dcfValue = getScenarioDCF(waccTarget, tgrTarget);
      const ccaValue = getScenarioCCA(cfg.ccaLabel);
      const weightedValue =
        typeof dcfValue === "number" && typeof ccaValue === "number"
          ? dcfValue * 0.55 + ccaValue * 0.45
          : undefined;
      const upside =
        currentPrice && weightedValue ? ((weightedValue - currentPrice) / currentPrice) * 100 : undefined;

      acc[key] = {
        label: cfg.label,
        dcfValue,
        ccaValue,
        weightedValue,
        upside,
        waccTarget,
        tgrTarget,
        dcfWaccDelta: cfg.dcfWaccDelta,
        dcfTgrDelta: cfg.dcfTgrDelta,
        ccaLabel: cfg.ccaLabel,
      };
      return acc;
    }, {} as Record<ScenarioKey, ScenarioOutput>);

    return outputs;
  }, [scenarioConfig, valuationData]);

  return (
    <main className="min-h-screen relative flex flex-col items-center p-8 transition-all duration-700">
      {/* Main Content Area */}
      <div className={`w-full max-w-7xl mx-auto flex flex-col gap-16 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${valuationData ? 'pt-0' : 'pt-[20vh] items-center'}`}>

        {/* Search Bar - Center aligned initially, moves to top contextually when data loads? We can just keep it elegantly centered/topped */}
        <div className={`w-full transition-all duration-700 ${showResults ? 'max-w-xl mx-0 mb-12' : 'max-w-2xl text-center'}`}>
          {!valuationData && (
            <div className="mb-12 space-y-4">
              <h2 className="text-5xl lg:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 leading-[1.1] pb-3">
                Probabalistic Equity<br />Valuation Engine
              </h2>
              <p className="text-lg text-white/40 max-w-lg mx-auto leading-[1.25] pb10">
                Automated DCF, Comparable Company Analysis, and Monte Carlo simulations synthesized in seconds.
              </p>
            </div>
          )}

          <TickerSearch align={showResults ? "left" : "center"} />

          {error && (
            <div className="mt-6 flex items-center justify-center space-x-2 text-red-400 glass px-4 py-3 rounded-xl mx-auto max-w-md w-full border-red-500/20">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Valuation Results Dashboard Scaffold */}
        {loadingActive && showSkeleton && (
          <LoadingDashboard progress={progress} stepText={loadingSteps[stepIndex]} />
        )}

        {showResults && valuationData && (
          <div className="w-full flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header / Summary Card */}
            <div className="glass-card p-8 flex flex-col gap-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8">
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
                        {scenarioOutputs?.[scenario]?.weightedValue !== undefined
                          ? `$${scenarioOutputs[scenario].weightedValue.toFixed(2)}`
                          : `$${valuationData.weighted_valuation?.toFixed(2) || "N/A"}`}
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
                      <div className={`text-4xl font-bold tracking-tight uppercase ${valuationData.recommendation === "BUY" ? "text-green-400" :
                        valuationData.recommendation === "SELL" ? "text-red-400" : "text-yellow-500"
                        }`}>
                        {valuationData.recommendation || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {scenarioOutputs && (
                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs text-white/40 uppercase tracking-widest font-semibold">
                    Select scenario
                  </span>
                  {(["conservative", "base", "optimistic"] as const).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant={scenario === key ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setScenario(key)}
                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                    >
                      {scenarioOutputs[key].label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* DCF Block */}
            {valuationData.dcf && (
              <DCFView
                dcf={valuationData.dcf}
                currentPrice={valuationData.current_price}
                ticker={valuationData.ticker}
                scenarioLabel={scenarioOutputs?.[scenario]?.label}
                scenarioWacc={scenarioOutputs?.[scenario]?.waccTarget}
                scenarioTgr={scenarioOutputs?.[scenario]?.tgrTarget}
                scenarioWaccDelta={scenarioOutputs?.[scenario]?.dcfWaccDelta}
                scenarioTgrDelta={scenarioOutputs?.[scenario]?.dcfTgrDelta}
                scenarioImpliedPrice={scenarioOutputs?.[scenario]?.dcfValue}
              />
            )}

            {/* Bottom Row - CCA & Monte Carlo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {valuationData.cca && (
                <CCAView
                  cca={valuationData.cca}
                  currentPrice={valuationData.current_price}
                  ticker={valuationData.ticker}
                  scenarioLabel={scenarioOutputs?.[scenario]?.label}
                  scenarioValue={scenarioOutputs?.[scenario]?.ccaValue}
                  scenarioPercentileLabel={scenarioOutputs?.[scenario]?.ccaLabel}
                />
              )}
              {valuationData.monte_carlo && (
                <MonteCarloView
                  monteCarlo={valuationData.monte_carlo}
                  currentPrice={valuationData.current_price}
                  ticker={valuationData.ticker}
                />
              )}
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
