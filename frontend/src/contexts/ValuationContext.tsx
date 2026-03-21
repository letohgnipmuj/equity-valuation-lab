"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { API_BASE_URL } from "@/lib/api";

// Matches ValuationResponseModel from backend
export interface DCFAssumptions {
    growth_rates?: number[];
    wacc?: number;
    tgr?: number;
    ebit_margin?: number[];
    tax_rate?: number;
}

export interface DCFModel {
    implied_price: number;
    current_price?: number;
    upside?: number;
    wacc?: number;
    tgr?: number;
    sensitivity?: any;
    assumptions?: DCFAssumptions;
}

export interface CCAModel {
    median: number;
    range: number[];
    peers?: any[];
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
}

const ValuationContext = createContext<ValuationContextType | undefined>(undefined);

export function ValuationProvider({ children }: { children: ReactNode }) {
    const [valuationData, setValuationData] = useState<ValuationData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchValuation = async (ticker: string) => {
        if (!ticker) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            // mode=1 fetches combined data
            const res = await fetch(`${API_BASE_URL}/api/valuation/${ticker}?mode=1`);
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to fetch valuation");
            }
            
            const data: ValuationData = await res.json();
            setValuationData(data);
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
            setValuationData(null);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ValuationContext.Provider value={{ valuationData, isLoading, error, fetchValuation }}>
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
