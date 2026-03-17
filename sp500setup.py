import pandas as pd
import yfinance as yf
import requests
import json
import concurrent.futures
from io import StringIO

# one time setup for universe

OUTPUT_FILE = "sp500_universe.json"

def get_sp500_tickers():
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"

    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(url, headers=headers)

    table = pd.read_html(StringIO(response.text))[0]

    tickers = table["Symbol"].tolist()

    # Yahoo ticker formatting
    tickers = [t.replace(".", "-") for t in tickers]

    return tickers


def fetch_company_data(ticker):

    try:
        stock = yf.Ticker(ticker)
        info = stock.info

        return {
            "ticker": ticker,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": info.get("marketCap"),
            "enterprise_value": info.get("enterpriseValue")
        }

    except Exception:
        return None


def build_universe():

    tickers = get_sp500_tickers()

    universe = []

    # Run 10 requests at the same time
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:

        results = executor.map(fetch_company_data, tickers)

        for r in results:
            if r is None:
                continue

            if r["enterprise_value"] is None or r["market_cap"] is None:
                continue

            universe.append(r)

    return universe


def save_universe(universe):

    with open(OUTPUT_FILE, "w") as f:
        json.dump(universe, f, indent=2)


def main():

    universe = build_universe()

    save_universe(universe)

    print(f"Saved {len(universe)} companies")


if __name__ == "__main__":
    main()