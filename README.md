# מורה שוק ההון

An interactive Hebrew learning app for the course "קורס שוק ההון ב-35 שיעורים" (35 lessons, 7 phases), with labs that run on real market data and a paper-trading simulator.

## Run it

Plain static files, no build step. Serve the folder over HTTP (the app loads `data/*.json` with `fetch`, which browsers block from `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

It also works as-is on GitHub Pages.

## What's inside

- **Course** (`js/course1-3.js`): all 35 lessons from the document. Each lesson runs the course's flow: review → guess first → short explanation chunks → worked example + interactive lab → guided practice with gradual hints (auto-checked) → Python exercise with starter code → final quiz (80% unlocks the next lesson) → "explain it back" (graded) → summary saved to your notebook. Includes a 68-term glossary; underlined terms open a definition.
- **Labs** (`js/labs1.js`, `js/labs2.js`): 33 interactive tools such as real S&P 500 drawdowns, volatility in USD vs ILS, random traders vs buy-and-hold, panic-seller backtest, rebalancing on SPY/TLT, moving-average backtest, look-ahead bug hunt, walk-forward, 200 random strategies, and in-browser logistic regression with leakage demos.
- **Simulator** (`js/sim.js`):
  - *Real history*: real daily OHLC (Yahoo Finance, 2000 to 2026-10-05) replayed tick by tick inside each day. Scenarios include 2008, COVID 2020, 2022, dot-com, the 2025 tariff drop, and a **blind mode** that hides the asset and dates to remove hindsight.
  - *Real time*: live Coinbase prices with the real bid/ask, plus US stocks if you add a free Finnhub key in Settings.
  - Market, limit and stop orders, commissions (IBKR / One Zero / bank tariff), spread and slippage. Long-only, no leverage. A coach flags panic selling, FOMO, overtrading and costs, links each flag to its lesson, and enforces your stop rules from lesson 34. You get a process grade against buy-and-hold at the end.
- **Tutor**: when opened as a claude.ai artifact, "שאל את המורה" (ask the teacher), explain-back grading and the capstone's skeptical reviewer use Claude. Elsewhere they fall back to offline answers from the glossary and lessons.

Progress is saved in the browser (localStorage). Use Progress → Backup to move it between devices.

## Data

`data/` holds daily history for SPY, QQQ, AAPL, MSFT, NVDA, AMZN, TSLA, GLD, TLT, TA35.TA, ^TA125.TA, ^GSPC, BTC-USD, ETH-USD and USD/ILS, downloaded from Yahoo Finance. Rows are `[date, open, high, low, close, adjFactor]`; adjusted close = close × adjFactor.

Not investment advice. Fees, tax rules and platform terms change; check them before depositing money.
