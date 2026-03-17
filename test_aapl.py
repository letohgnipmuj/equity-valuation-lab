import traceback
from main import run_valuation_orchestrator_json
import sys

try:
    print("Running valuation for AAPL...")
    result = run_valuation_orchestrator_json('AAPL', mode='1')
    if "error" in result:
        print(f"ERROR RETURNED: {result['error']}")
    else:
        print("SUCCESS")
        print(result)
except Exception:
    traceback.print_exc()
