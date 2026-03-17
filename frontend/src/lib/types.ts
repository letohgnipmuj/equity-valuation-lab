export interface ValuationResult {
  ticker: string;
  name: string;
  current_price: number;
  weighted_valuation: number;
  upside: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  dcf: {
    implied_price: number;
    current_price: number;
    upside: number;
    wacc: number;
    tgr: number;
    sensitivity: {
      index: number[]; // TGRs
      columns: number[]; // WACCs
      data: (number | null)[][];
    };
    assumptions: {
      growth_rates: number[];
      ebit_margin: number[];
      tax_rate: number;
    };
  };
  cca: {
    median: number;
    range: [number, number];
  };
  monte_carlo: {
    median: number;
    range: [number, number];
  };
  market_implied: {
    revenue_growth: number | null;
    tgr: number | null;
  };
  timestamp: number;
}
