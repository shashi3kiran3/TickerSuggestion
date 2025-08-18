import { fetchDaily } from './predictions'

export async function fetchTrendingSymbols(count = 25): Promise<string[]> {
  const res = await fetch(`/api/trending?region=US&count=${count}`)
  if (!res.ok) return []
  const data = await res.json()
  const syms: string[] = (data?.symbols as string[]) || []
  // Filter out common index/ETF symbols to prefer single stocks
  const blacklist = new Set([
    'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'IVV', 'XLK', 'XLF', 'XLV', 'XLE', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB',
    'ARKK', 'SQQQ', 'TQQQ', 'UVXY', 'VXX', 'SPX', '^GSPC', '^IXIC', '^DJI', 'BTC-USD', 'ETH-USD',
  ])
  return syms.filter((s) => !blacklist.has(s.toUpperCase()))
}

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (period + 1)
  const out: number[] = []
  let emaPrev = values[0]
  out.push(emaPrev)
  for (let i = 1; i < values.length; i++) {
    emaPrev = values[i] * k + emaPrev * (1 - k)
    out.push(emaPrev)
  }
  return out
}

export type ScreenResult = {
  symbol: string
  close: number
  high52w: number
  low52w: number
  above50: boolean
  above200: boolean
}

export async function screenSymbols(symbols: string[]): Promise<ScreenResult[]> {
  const results: ScreenResult[] = []
  const equities = await filterEquities(symbols)
  const top = equities.slice(0, 40) // cap to 40 for speed
  for (const sym of top) {
    try {
      const candles = await fetchDaily(sym, '1y')
      if (candles.length < 60) continue
      const closes = candles.map((c) => c.c)
      const e50 = ema(closes, 50)
      const e200 = ema(closes, 200)
      const last = candles[candles.length - 1]
      let hi = -Infinity
      let lo = Infinity
      for (const c of candles) {
        if (c.c > hi) hi = c.c
        if (c.c < lo) lo = c.c
      }
      results.push({
        symbol: sym,
        close: last.c,
        high52w: Number.isFinite(hi) ? hi : last.c,
        low52w: Number.isFinite(lo) ? lo : last.c,
        above50: last.c >= e50[e50.length - 1],
        above200: last.c >= (e200[e200.length - 1] || e50[e50.length - 1]),
      })
    } catch {
      // ignore symbol on error
    }
  }
  return results
}

export async function fetchCategorySymbols(kind: 'AI' | 'Growth' | 'Volatile' | 'Dividend' | 'RecentIPO'): Promise<string[]> {
  // Map to Yahoo predefined screeners where possible
  const map: Record<string, string> = {
    Volatile: 'most_volatile',
    Growth: 'day_gainers',
    Dividend: 'high_dividend_yield',
    AI: 'technology',
    RecentIPO: 'recent_ipo',
  }
  const scr = map[kind] || 'most_actives'
  const res = await fetch(`/api/screener-saved?scrIds=${encodeURIComponent(scr)}&count=50`)
  if (!res.ok) return []
  const data = await res.json()
  const quotes: any[] = data?.finance?.result?.[0]?.quotes || []
  const syms = quotes.map((q) => q?.symbol).filter(Boolean)
  let out = (syms as string[])
  // Optional: tighten AI by keyword in name/symbol
  if (kind === 'AI') {
    const q = await getQuotes(out.slice(0, 50))
    out = q
      .filter((x) => /\bAI\b|Artificial|Machine Learning|NVIDIA|Palantir|Super Micro/i.test(x.longName || x.shortName || ''))
      .map((x) => x.symbol)
  }
  if (kind === 'RecentIPO') {
    const q = await getQuotes(out.slice(0, 50))
    // Yahoo provides firstTradeDateMilliseconds for IPO; sort descending
    out = q
      .filter((x) => typeof x.firstTradeDateMilliseconds === 'number')
      .sort((a, b) => (b.firstTradeDateMilliseconds || 0) - (a.firstTradeDateMilliseconds || 0))
      .map((x) => x.symbol)
  }
  return out
}

export type IPOItem = { symbol?: string; company?: string; date?: string; priceRange?: string }
export async function fetchIPOs(): Promise<IPOItem[]> {
  try {
    const res = await fetch('/api/ipos')
    const text = await res.text()
    // Try JSON first
    try {
      const data = JSON.parse(text)
      const rows = data?.data?.calendar?.upcoming || []
      return rows.map((r: any) => ({ symbol: r?.symbol, company: r?.company, date: r?.date, priceRange: r?.price }))
    } catch {}
    // Fallback: parse CSV-ish plain text best-effort
    const lines = text.split(/\r?\n/).filter((l) => l.includes(','))
    const items: IPOItem[] = []
    for (const l of lines.slice(1, 50)) {
      const parts = l.split(',')
      if (parts.length < 2) continue
      items.push({ company: parts[0], symbol: parts[1], date: parts[2], priceRange: parts[3] })
    }
    return items
  } catch {
    return []
  }
}

// Helpers to filter non-equities (ETFs, futures, crypto, indices)
type Quote = { symbol: string; quoteType?: string; longName?: string; shortName?: string; firstTradeDateMilliseconds?: number }

async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const batched: Quote[] = []
  const chunk = 20
  for (let i = 0; i < symbols.length; i += chunk) {
    const slice = symbols.slice(i, i + chunk)
    const res = await fetch(`/api/quote?symbols=${encodeURIComponent(slice.join(','))}`)
    if (!res.ok) continue
    const data = await res.json()
    const quotes: Quote[] = data?.quoteResponse?.result || []
    batched.push(...quotes)
  }
  return batched
}

async function filterEquities(symbols: string[]): Promise<string[]> {
  const cleaned = symbols.filter((s) => !/=F$/.test(s) && !/=X$/.test(s) && !/-USD$/.test(s))
  const quotes = await getQuotes(cleaned)
  return quotes
    .filter((q) => (q.quoteType || '').toUpperCase() === 'EQUITY')
    .map((q) => q.symbol)
}

export async function fetchEnergyPowerSymbols(): Promise<string[]> {
  // Build a candidate pool: trending + day_gainers
  const [trend, gainers] = await Promise.all([
    fetchTrendingSymbols(50),
    fetchCategorySymbols('Growth'),
  ])
  const pool = Array.from(new Set([...trend, ...gainers]))
  const quotes = await getQuotes(pool)
  const reIndustry = /(Energy|Oil|Gas|Uranium|Nuclear|Power|Utility|Electric|Renewable|Solar|Wind|Hydrogen)/i
  const filtered = quotes
    .filter((q) => (q.quoteType || '').toUpperCase() === 'EQUITY')
    .filter((q) => reIndustry.test((q as any).sector || '') || reIndustry.test((q as any).industry || '') || reIndustry.test(q.longName || q.shortName || ''))
    .map((q) => q.symbol)
  return Array.from(new Set(filtered))
}


