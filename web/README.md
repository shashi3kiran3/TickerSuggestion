# MarketPulse – Web App

React + Vite + Tailwind scaffold for MarketPulse.

## Getting started

```bash
npm install
npm run dev
```

## Env vars

For local OpenAI access (optional), create `.env` with:

```
VITE_OPENAI_API_KEY=sk-...
```

If not provided, Ask AI returns a safe dummy response.

Cloudflare Pages deployment
- Project settings → Functions → Environment variables:
  - `OPENAI_API_KEY` = your key (server-side)
- Build command: `npm ci && npm run build`
- Build directory: `web/dist`
- Functions directory: `web/functions`

## Scripts

- dev: start the dev server
- build: typecheck and build for production
- preview: preview the production build

## Structure

- `src/layouts/RootLayout.tsx` – App shell and navigation
- `src/pages/*` – Pages for Home, Suggestions, News, Events, Ask AI, Predictions, Admin
- `src/services/mockApi.ts` – Mock API fetchers
- `src/services/openai.ts` – OpenAI chat with graceful fallback
- `src/components/ErrorBoundary.tsx` – Global error boundary
- `src/components/Loading.tsx` – Loading skeleton helper

## Product requirements (current MVP)

- Home
  - Trending stocks/sectors, market sentiment (mock for now)
- Suggestions
  - Curated ideas with tags and filters (mock data)
- News
  - Live headlines from top finance sources (CNBC, Reuters, Yahoo Finance, MarketWatch)
  - Search by text, filter by source, de-dup + recency sort
  - Click to expand for AI-powered short highlights; "Read full article" link
- Events
  - Basic list with filters (mock)
- Ask AI
  - Answers only for stocks/sectors/news/events questions
  - Uses live sources (Google News RSS, Yahoo Finance RSS, CNBC RSS, StockTwits) to ground answers
  - Links included; client never sees the OpenAI key (proxied)
- Predictions (pattern trading – initial)
  - Inputs: Ticker, Weekday, Unit (Weeks/Months/Years), Count
  - Computes weekday performance over lookback window: avg/median % change, win rate, min/max, and per-occurrence list
  - Defaults to index ETFs (SPY, QQQ, DIA, IWM)

## Endpoints (Cloudflare Pages Functions)

- `POST /api/ai`
  - Proxy to OpenAI Chat Completions
  - Request body (subset): `{ model, messages, temperature, response_format? }`
  - Env: `OPENAI_API_KEY` (required in production)
  - Used by: Ask AI answers, News article summarization

- `GET /api/chart?symbol=SPY&range=2y&interval=1d`
  - Server-side fetch to Yahoo Finance chart API
  - Returns JSON from Yahoo (timestamps + OHLC)
  - Used by: Predictions weekday pattern analysis

## Frontend services and tools

- `src/services/news.ts`
  - Fetches multiple RSS feeds (CNBC, Reuters, Yahoo Finance, MarketWatch)
  - De-duplicates, sorts by recency, formats time-ago
- `src/services/financeSearch.ts`
  - Live source search for Ask AI (Google News RSS, Yahoo RSS per ticker, CNBC RSS, StockTwits)
  - Basic ticker extraction, de-dup, ranking, and article-text fetch via Jina reader
- `src/services/openai.ts`
  - askOpenAI(prompt): builds grounded prompt from live sources, calls `/api/ai`
  - summarizeNewsArticle(title, url): fetches article text and produces short headline + bullets via `/api/ai`
- `src/services/predictions.ts`
  - fetchDaily(symbol, range): pulls daily OHLC via `/api/chart`
  - computeWeekdayPattern: returns stats for a chosen weekday over a lookback window

## Local development

- Pure frontend: `npm run dev`
- With Functions locally:
  - `npm run build`
  - `npx wrangler pages dev dist`
  - Wrangler auto-detects `web/functions/*` and serves `/api/*`

### Live mode (auto-rebuild + functions)

One-off commands (no scripts required):

```bash
cd web
npm i -D wrangler concurrently
npx concurrently -k "npm run build -- --watch" "npx wrangler pages dev dist"
```

Optional npm scripts (add to `web/package.json`):

```json
{
  "scripts": {
    "build:watch": "vite build --watch",
    "dev:cf": "concurrently -k \"npm:build:watch\" \"wrangler pages dev dist\""
  }
}
```

Then run:

```bash
cd web
npm run dev:cf
```

## Deployment (Cloudflare Pages)

- Framework preset: Vite
- Root directory: `web`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Functions directory: `functions`
- Env → Functions: `OPENAI_API_KEY`

## Data sources by section (APIs and filtering)

- Ask AI and News summaries
  - Sources: Google News RSS, Yahoo Finance RSS (per ticker), CNBC RSS, StockTwits symbol stream
  - Article text: Jina Reader (`https://r.jina.ai/http://...`) to extract readable text
  - Endpoint path(s):
    - Frontend builds a prompt from live sources (`src/services/financeSearch.ts`)
    - Serverless: `POST /api/ai` → OpenAI Chat Completions
  - Notes: client never sees the OpenAI key; all AI calls go through `/api/ai`

- News page (live headlines)
  - Feeds (RSS):
    - CNBC Markets (`https://www.cnbc.com/id/10001147/device/rss/rss.html`)
    - Reuters Business (`https://feeds.reuters.com/reuters/businessNews`)
    - Yahoo Finance headlines (S&P) (`https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US`)
    - MarketWatch Top Stories (`https://www.marketwatch.com/feeds/topstories`)
  - Endpoint path(s): fetched directly from the client with CORS fallback (AllOrigins) in `src/services/news.ts`
  - Filtering: de-duplicate by URL, sort by recency, "time-ago" display; search and source filter in UI
  - Expand a card → `POST /api/ai` to summarize the article

- Predictions (weekday pattern)
  - Price data: Yahoo Finance Chart API proxied by: `GET /api/chart?symbol=SPY&range=2y&interval=1d`
  - Logic: close-to-previous-close % change on a chosen weekday across a lookback window (weeks/months/years)
  - Stats: count, average/median %, win rate, min/max %, and per-occurrence OHLC + 52w L/H

- Suggestions (screeners)
  - Trending universe: Yahoo Trending API via `GET /api/trending?region=US&count=25`
  - Category universes (Yahoo predefined screeners → proxied):
    - `GET /api/screener-saved?scrIds=most_volatile|day_gainers|high_dividend_yield|technology|recent_ipo&count=50`
  - Quote details for filtering: `GET /api/quote?symbols=AAPL,MSFT,...` (used to drop non-equities and detect IPO dates)
  - OHLC for EMAs / 52w calculations: `GET /api/chart?symbol=...&range=1y&interval=1d`
  - Filtering rules:
    - Equities only: drop futures/indices/crypto (symbols ending with `=F`, `=X`, `-USD`, or non-`EQUITY` `quoteType`)
    - Exclude broad ETFs/indices (e.g., SPY, QQQ, sector ETFs) via a small blacklist
    - 52w proximity: Near High if `close >= 0.995 * 52wHigh`; Near Low if `close <= 1.005 * 52wLow`
    - EMA bands: `close >= EMA50` and `close >= EMA200`
    - AI section: start from "technology" screener, then keyword filter in company name (AI/Artificial/Machine Learning)
    - Each section shows top 10 after screening/sorting
  - Recent IPOs: merge Yahoo `recent_ipo` screener with Nasdaq IPO calendar (`GET /api/ipos`) and list latest 10

### Serverless endpoints in this repo

- `POST /api/ai` → proxies OpenAI Chat Completions (Functions: `web/functions/api/ai.ts`)
- `GET /api/chart` → proxies Yahoo Chart API (Functions: `web/functions/api/chart.ts`)
- `GET /api/trending` → proxies Yahoo Trending (Functions: `web/functions/api/trending.ts`)
- `GET /api/screener-saved` → proxies Yahoo predefined screeners (Functions: `web/functions/api/screener-saved.ts`)
- `GET /api/quote` → proxies Yahoo quote endpoint (Functions: `web/functions/api/quote.ts`)
- `GET /api/ipos` → queries Nasdaq IPO calendar (Functions: `web/functions/api/ipos.ts`)

All external calls include a generic `user-agent` header and, where needed on the client, a CORS fallback via AllOrigins.
