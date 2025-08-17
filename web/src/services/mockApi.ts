export async function fetchTrending(): Promise<{
  stocks: { symbol: string; name: string; changePct: number }[]
  sectors: { sector: string; changePct: number }[]
}> {
  await delay(200)
  return {
    stocks: [
      { symbol: 'AAPL', name: 'Apple Inc.', changePct: 1.23 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', changePct: -0.42 },
      { symbol: 'NVDA', name: 'NVIDIA Corp.', changePct: 2.5 },
    ],
    sectors: [
      { sector: 'Technology', changePct: 1.1 },
      { sector: 'Energy', changePct: -0.9 },
      { sector: 'Healthcare', changePct: 0.2 },
      { sector: 'Financials', changePct: -0.3 },
    ],
  }
}

export async function fetchMarketSentiment(): Promise<'Bearish' | 'Neutral' | 'Bullish'> {
  await delay(120)
  return 'Neutral'
}

export async function fetchSuggestions(): Promise<{
  symbol: string
  name: string
  tags: string[]
  thesis: string
}[]> {
  await delay(220)
  return [
    {
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      tags: ['EV', 'Growth', 'Volatile'],
      thesis: 'Momentum building after delivery beat; watch margin commentary next quarter.',
    },
    {
      symbol: 'AMD',
      name: 'Advanced Micro Devices',
      tags: ['AI', 'Semis'],
      thesis: 'AI server CPU ramp and GPU share gains provide medium-term upside.',
    },
    {
      symbol: 'XOM',
      name: 'Exxon Mobil',
      tags: ['Energy', 'Dividend'],
      thesis: 'Attractive yield with upside to refining margins; commodity risks apply.',
    },
  ]
}

export async function fetchNews(): Promise<{
  id: string
  title: string
  source: string
  url: string
  category: string
}[]> {
  await delay(180)
  return [
    {
      id: 'n1',
      title: 'Tech leads market higher as AI stocks rally',
      source: 'MarketWatch',
      url: 'https://example.com/news1',
      category: 'Markets',
    },
    {
      id: 'n2',
      title: 'Energy stocks slip on oil price decline',
      source: 'Reuters',
      url: 'https://example.com/news2',
      category: 'Energy',
    },
    {
      id: 'n3',
      title: 'Healthcare names steady amid policy uncertainty',
      source: 'Bloomberg',
      url: 'https://example.com/news3',
      category: 'Healthcare',
    },
  ]
}

export async function fetchEvents(): Promise<{
  id: string
  type: 'Earnings' | 'IPO' | 'Fed'
  title: string
  date: string
}[]> {
  await delay(160)
  return [
    { id: 'e1', type: 'Earnings', title: 'AAPL Q3 Earnings', date: new Date(Date.now() + 86400000).toISOString() },
    { id: 'e2', type: 'IPO', title: 'FinTechCo IPO', date: new Date(Date.now() + 3 * 86400000).toISOString() },
    { id: 'e3', type: 'Fed', title: 'FOMC Rate Decision', date: new Date(Date.now() + 5 * 86400000).toISOString() },
  ]
}

export async function fetchPredictions(): Promise<{
  symbol: string
  forecastPct: number
  trend: 'Up' | 'Down' | 'Sideways'
  points: { t: number; v: number }[]
}[]> {
  await delay(200)
  return [
    { symbol: 'AAPL', forecastPct: 5.2, trend: 'Up', points: genSeries(20, 10, 30) },
    { symbol: 'MSFT', forecastPct: -2.1, trend: 'Down', points: genSeries(20, 14, 28) },
    { symbol: 'NVDA', forecastPct: 8.4, trend: 'Up', points: genSeries(20, 5, 35) },
  ]
}

function genSeries(n: number, min: number, max: number) {
  const arr = [] as { t: number; v: number }[]
  for (let i = 0; i < n; i++) {
    arr.push({ t: i, v: Math.max(min, Math.min(max, Math.round(Math.random() * (max - min) + min))) })
  }
  return arr
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}


