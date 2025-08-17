# MarketPulse – Web App

React + Vite + Tailwind scaffold for MarketPulse.

## Getting started

```bash
npm install
npm run dev
```

## Env vars

Create `.env` with:

```
VITE_OPENAI_API_KEY=sk-...
```

If not provided, Ask AI returns a safe dummy response.

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
