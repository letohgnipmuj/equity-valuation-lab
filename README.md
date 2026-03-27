# Equity Valuation Lab

An equity valuation engine designed for automated analysis of US public equities (S&P 500), combining Discounted Cash Flow (DCF), Comparable Company Analysis (CCA), and Monte Carlo simulations. <br>
Not financial advice, just a tool to make common modeling techniques easier.

## How it works

**DCF**: Finds the **intrinsic value** of a company by projecting future cash flows and discounting them to the present day. <br>
**CCA**: Finds the implied **fair market value** of a company by comparing its valuation ratios (EV/EBITDA, EV/REVENUE, and P/E) to similar peers. <br>
**Monte Carlo**: Randomizes key DCF inputs (revenue growth, WACC, and TGR) centering around base case assumptions to generate probability-weighted valuation range rather than a single estimate. <br>
**Reverse DCF**: Starts with the current stock price and solves for the revenue growth and terminal growth rate needed to justify it, showing the market's implied expectations. <br>

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
- **Data Visualization**: Apache ECharts (Heatmaps and Distributions)
- **Backend API**: FastAPI (Python 3.11)
- **Core Engine**: NumPy, Pandas, yfinance, Financial Modeling Prep
- **State & Caching**: Custom Valuation Context & Redis (Deployment ready)

## Project Structure

```text
├── backend/                # FastAPI application
│   ├── main.py             # API endpoints and logic orchestration
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Container configuration for Render
├── frontend/               # Next.js 15 application
│   ├── src/                # Frontend source code
│   │   ├── app/            # Next.js App Router (Layouts & Pages)
│   │   ├── components/     # Reusable UI components (DCF, CCA, Monte Carlo)
│   │   ├── contexts/       # Global State Management
│   │   └── lib/            # Utility functions
│   └── package.json        # Frontend dependencies
├── main.py                 # Original valuation core orchestration
├── dcf.py                  # DCF calculation engine
├── cca.py                  # Comparable Company Analysis engine
├── monte_carlo.py          # Monte Carlo simulation
├── utils.py                # DCF and exporting helper functions
├── data.py and info.py     # Financial data and inputs fetching & cleanup
└── cache.py                # Redix/Local caching abstraction
```

## Local Deployment

### 1. Prerequisites

- Python 3.11+
- Node.js 20+
- npm or pnpm

### 2. Run Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The API will be available at `http://localhost:8000`.

### 3. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.