# Equity Valuation Lab

An institutional-grade equity valuation engine designed for automated analysis, combining Discounted Cash Flow (DCF), Comparable Company Analysis (CCA), and Monte Carlo simulations. Built with a modern, high-performance tech stack and a premium glassmorphic user interface.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
- **Data Visualization**: Apache ECharts (Heatmaps and Distributions)
- **Backend API**: FastAPI (Python 3.11), Pydantic V2
- **Core Engine**: NumPy, Pandas, yfinance
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
├── data.py                 # Financial data fetching & cleanup
└── cache.py                # Redix/Local caching abstraction
```

## Local Development

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

## Deployment Guide

### Backend (Render)

1. Connect your repository to **Render**.
2. Select **Web Service**.
3. Point to the `backend/Dockerfile`.
4. Add the following environment variables:
   - `PORT`: `10000`
   - `HOST`: `0.0.0.0`
   - `PYTHONUNBUFFERED`: `1`

### Frontend (Vercel)

1. Connect your repository to **Vercel**.
2. Set the **Root Directory** to `frontend`.
3. Configure the **Build Command**: `npm run build`.
4. Set the following environment variable:
   - `NEXT_PUBLIC_API_URL`: *Your Render backend URL (e.g., https://your-backend.onrender.com)*

## License

MIT
