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
    fetchValuation: (ticker: string) => Promise<void>;
    loadCachedValuation: (valuation: ValuationData) => void;
}

const ValuationContext = createContext<ValuationContextType | undefined>(undefined);
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 45000);

export function ValuationProvider({ children }: { children: ReactNode }) {
    const [valuationData, setValuationData] = useState<ValuationData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const activeControllerRef = useRef<AbortController | null>(null);
    const activeRequestIdRef = useRef(0);

    useEffect(() => {
        return () => {
            activeControllerRef.current?.abort();
        };
    }, []);

    const fetchValuation = async (ticker: string) => {
        if (!ticker) return;

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
        setError(null);

        try {
            // mode=1 fetches combined data
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
            }
        } catch (err: unknown) {
            if (controller.signal.aborted) {
                if (didTimeout && requestId === activeRequestIdRef.current) {
                    setError(`Request timed out after ${Math.round(API_TIMEOUT_MS / 1000)} seconds. Please try again later or check the history page.`);
                    setValuationData(null);
                }
                return;
            }

            if (requestId === activeRequestIdRef.current) {
                const message = err instanceof Error ? err.message : "An unexpected error occurred.";
                setError(message);
                setValuationData(null);
            }
        } finally {
            window.clearTimeout(timeoutId);
            if (activeControllerRef.current === controller) {
                activeControllerRef.current = null;
            }
            if (requestId === activeRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    };

    const loadCachedValuation = (valuation: ValuationData) => {
        setValuationData(valuation);
        setError(null);
        setIsLoading(false);
    };

    return (
        <ValuationContext.Provider value={{ valuationData, isLoading, error, fetchValuation, loadCachedValuation }}>
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
