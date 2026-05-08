"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";

// Matches ValuationResponseModel from backend
export interface DCFAssumptions {
    growth_rates?: number[];
    wacc?: number;
    tgr?: number;
    ebit_margin?: number[];
    tax_rate?: number;
}

export interface SensitivityData {
    index: number[];
    columns: number[];
    data: (number | null)[][];
}

export interface Peer {
    ticker?: string;
    name?: string;
    [key: string]: unknown;
}

export interface DCFModel {
    implied_price: number;
    current_price?: number;
    upside?: number;
    wacc?: number;
    tgr?: number;
    sensitivity?: SensitivityData;
    assumptions?: DCFAssumptions;
}

export interface CCAModel {
    median: number;
    range: number[];
    peers?: Peer[];
}

export interface MonteCarloModel {
    median: number;
    range: number[];
    distribution?: number[];
}

export interface MarketImpliedModel {
    revenue_growth?: number;
    tgr?: number;
}

export interface ValuationData {
    ticker: string;
    name: string;
    current_price?: number;
    weighted_valuation?: number;
    upside?: number;
    recommendation?: string;
    dcf?: DCFModel;
    cca?: CCAModel;
    monte_carlo?: MonteCarloModel;
    market_implied?: MarketImpliedModel;
    timestamp: number;
}

interface ValuationContextType {
    valuationData: ValuationData | null;
    isLoading: boolean;
    error: string | null;
    isPolling: boolean;
    pollProgress: number;
    fetchValuation: (ticker: string) => Promise<void>;
    loadCachedValuation: (valuation: ValuationData) => void;
}

const ValuationContext = createContext<ValuationContextType | undefined>(undefined);
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 45000);  // 45s timeout
const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || 3000);  // Poll every 3s
const MAX_POLL_ATTEMPTS = Number(process.env.NEXT_PUBLIC_MAX_POLL_ATTEMPTS || 300);  // Max 15 minutes

export function ValuationProvider({ children }: { children: ReactNode }) {
    const [valuationData, setValuationData] = useState<ValuationData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [pollProgress, setPollProgress] = useState(0);  // Track attempt count for UI
    const activeControllerRef = useRef<AbortController | null>(null);
    const activeRequestIdRef = useRef(0);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            activeControllerRef.current?.abort();
            if (pollingIntervalRef.current) {
                clearTimeout(pollingIntervalRef.current);
            }
        };
    }, []);

    /**
     * Poll job status until completion or failure
     */
    const pollJobStatus = async (jobId: string, attempt: number = 1) => {
        if (attempt > MAX_POLL_ATTEMPTS) {
            setError(`Valuation computation exceeded maximum wait time (${Math.round(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000 / 60)} minutes).`);
            setIsPolling(false);
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);

            if (!res.ok) {
                throw new Error("Failed to check job status");
            }

            const jobStatus = await res.json();
            setPollProgress(attempt);

            if (jobStatus.status === "completed" && jobStatus.result) {
                setValuationData(jobStatus.result);
                setError(null);
                setIsPolling(false);
                setIsLoading(false);
            } else if (jobStatus.status === "failed") {
                setError(`Valuation computation failed: ${jobStatus.error || "Unknown error"}`);
                setIsPolling(false);
                setIsLoading(false);
            } else {
                // Still processing, poll again
                pollingIntervalRef.current = setTimeout(() => {
                    pollJobStatus(jobId, attempt + 1);
                }, POLL_INTERVAL_MS);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Polling error";
            console.error("Polling error:", message);
            // Retry polling on error
            pollingIntervalRef.current = setTimeout(() => {
                pollJobStatus(jobId, attempt + 1);
            }, POLL_INTERVAL_MS);
        }
    };

    const fetchValuation = async (ticker: string) => {
        if (!ticker) return;

        // Clean up any previous polling
        if (pollingIntervalRef.current) {
            clearTimeout(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        // Deduplicate rapid submits by aborting any active request first.
        activeControllerRef.current?.abort();

        const controller = new AbortController();
        activeControllerRef.current = controller;
        const requestId = ++activeRequestIdRef.current;
        let didTimeout = false;
        const timeoutId = window.setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, API_TIMEOUT_MS);

        setIsLoading(true);
        setIsPolling(false);
        setPollProgress(0);
        setError(null);

        try {
            // Try synchronous fetch first (mode=1 = combined valuation)
            const res = await fetch(`${API_BASE_URL}/api/valuation/${ticker}?mode=1`, {
                signal: controller.signal,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to fetch valuation");
            }

            const data: ValuationData = await res.json();
            if (requestId === activeRequestIdRef.current) {
                setValuationData(data);
                setIsLoading(false);
            }
        } catch (err: unknown) {
            if (controller.signal.aborted) {
                if (didTimeout && requestId === activeRequestIdRef.current) {
                    // Timeout: try polling approach
                    console.log("Sync timeout, attempting async job submission...");
                    try {
                        const submitRes = await fetch(`${API_BASE_URL}/api/valuation/submit?ticker=${ticker}&mode=1`, {
                            method: "POST",
                        });

                        if (submitRes.ok) {
                            const jobResponse = await submitRes.json();
                            const jobId = jobResponse.job_id;

                            setError(`Calculation taking longer than expected (>${Math.round(API_TIMEOUT_MS / 1000)}s). Checking status...`);
                            setIsPolling(true);
                            setValuationData(null);

                            // Start polling
                            pollJobStatus(jobId, 1);
                        } else {
                            setError(`Request timed out after ${Math.round(API_TIMEOUT_MS / 1000)} seconds. Please try again later or check the history page.`);
                            setValuationData(null);
                            setIsLoading(false);
                        }
                    } catch (submitErr) {
                        console.error("Job submission failed:", submitErr);
                        setError(`Request timed out after ${Math.round(API_TIMEOUT_MS / 1000)} seconds. Please try again later or check the history page.`);
                        setValuationData(null);
                        setIsLoading(false);
                    }
                }
                return;
            }

            if (requestId === activeRequestIdRef.current) {
                const message = err instanceof Error ? err.message : "An unexpected error occurred.";
                setError(message);
                setValuationData(null);
                setIsLoading(false);
            }
        } finally {
            window.clearTimeout(timeoutId);
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;
            }
        }
    };

    const loadCachedValuation = (valuation: ValuationData) => {
        setValuationData(valuation);
        setError(null);
        setIsLoading(false);
    };

    return (
        <ValuationContext.Provider value={{ valuationData, isLoading, error, isPolling, pollProgress, fetchValuation, loadCachedValuation }}>
            {children}
        </ValuationContext.Provider>
    );
}

export function useValuation() {
    const context = useContext(ValuationContext);
    if (!context) {
        throw new Error("useValuation must be used within a ValuationProvider");
    }
    return context;
}
