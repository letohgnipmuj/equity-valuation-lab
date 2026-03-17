from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from main import run_valuation_orchestrator_json
import uvicorn

app = FastAPI(title="QuantX Valuation Engine API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/valuation/{ticker}")
async def get_valuation(ticker: str, mode: str = "1"):
    ticker = ticker.upper()
    result = run_valuation_orchestrator_json(ticker, mode=mode)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
