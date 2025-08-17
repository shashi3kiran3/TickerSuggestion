// Lightweight client-side finance news/social search using open sources
// No extra deps; uses RSS endpoints and public APIs with CORS-friendly fallbacks.

export type NewsItem = {
  title: string
  url: string
  source: string
  publishedAt?: string
}

// AllOrigins proxy for CORS fallbacks
const allOrigins = (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

// Helpers
async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch {
    // Try via AllOrigins proxy
    const res = await fetch(allOrigins(url))
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
    return await res.text()
  }
}

function parseRssItems(xml: string, fallbackSource: string): NewsItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  if (items.length === 0) return []
  return items.slice(0, 10).map((it) => ({
    title: it.querySelector('title')?.textContent?.trim() || 'Untitled',
    url: it.querySelector('link')?.textContent?.trim() || '#',
    source: it.querySelector('source')?.textContent?.trim() || fallbackSource,
    publishedAt: it.querySelector('pubDate')?.textContent?.trim() || undefined,
  }))
}

// Source adapters (RSS-based where possible)
async function googleNewsSearch(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const xml = await fetchText(url)
  return parseRssItems(xml, 'Google News')
}

async function yahooFinanceNews(tickerOrQuery: string): Promise<NewsItem[]> {
  // Yahoo Finance RSS for symbol; fallback to general query via Google News if needed
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    tickerOrQuery,
  )}&region=US&lang=en-US`
  try {
    const xml = await fetchText(url)
    const items = parseRssItems(xml, 'Yahoo Finance')
    if (items.length > 0) return items
  } catch {
    // ignore
  }
  return []
}

async function cnbcTop(): Promise<NewsItem[]> {
  const url = 'https://www.cnbc.com/id/100003114/device/rss/rss.html'
  const xml = await fetchText(url)
  return parseRssItems(xml, 'CNBC')
}

async function stocktwitsSymbol(symbol: string): Promise<NewsItem[]> {
  // Public API; may have CORS; use proxy if needed
  const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('sw cors')
    const data = await res.json()
    const items: NewsItem[] = (data?.messages || []).slice(0, 10).map((m: any) => ({
      title: m?.body?.slice(0, 140) || 'Post',
      url: m?.entities?.links?.[0]?.url || `https://stocktwits.com/${m?.user?.username || ''}`,
      source: 'StockTwits',
      publishedAt: m?.created_at,
    }))
    return items
  } catch {
    try {
      const res = await fetch(allOrigins(url))
      if (!res.ok) return []
      const data = await res.json()
      const items: NewsItem[] = (data?.messages || []).slice(0, 10).map((m: any) => ({
        title: m?.body?.slice(0, 140) || 'Post',
        url: m?.entities?.links?.[0]?.url || `https://stocktwits.com/${m?.user?.username || ''}`,
        source: 'StockTwits',
        publishedAt: m?.created_at,
      }))
      return items
    } catch {
      return []
    }
  }
}

export function extractTickersFromQuery(q: string): string[] {
  // Heuristic: capture 1–5 letter uppercase tokens and common casings like Tsla → TSLA
  const candidates = q
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const tickers = new Set<string>()
  for (const w of candidates) {
    if (/^[A-Za-z]{1,5}$/.test(w)) tickers.add(w.toUpperCase())
  }
  return Array.from(tickers).slice(0, 3)
}

export async function searchFinanceContexts(userQuery: string): Promise<NewsItem[]> {
  const tickers = extractTickersFromQuery(userQuery)
  const prefersTicker = tickers.length > 0
  const preferredSites = [
    'reuters.com',
    'cnbc.com',
    'finance.yahoo.com',
    'marketwatch.com',
    'bloomberg.com',
  ]
  const siteFilter = preferredSites.map((s) => `site:${s}`).join(' OR ')
  const gQuery = prefersTicker
    ? `${tickers.join(' OR ')} stock when:1d (${siteFilter})`
    : `${userQuery} stock when:1d (${siteFilter})`

  const searches: Promise<NewsItem[]>[] = [googleNewsSearch(gQuery)]
  for (const t of tickers) searches.push(yahooFinanceNews(t), stocktwitsSymbol(t))
  if (!prefersTicker) searches.push(cnbcTop())

  const results = await Promise.allSettled(searches)
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter(Boolean)

  const unique = dedupeByUrl(items)
  const ranked = unique
    .map((n) => ({ news: n, score: scoreNews(n, userQuery, tickers, preferredSites) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.news)

  // If ticker present, keep only items above a relevance threshold
  const filtered = prefersTicker ? ranked.filter((n) => scoreNews(n, userQuery, tickers, preferredSites) >= 2) : ranked
  return filtered.slice(0, 20)
}

function dedupeByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    if (!it?.url) continue
    if (seen.has(it.url)) continue
    seen.add(it.url)
    out.push(it)
  }
  return out
}

function scoreNews(item: NewsItem, userQuery: string, tickers: string[], preferredSites: string[]): number {
  let score = 0
  const title = (item.title || '').toUpperCase()
  for (const t of tickers) if (title.includes(t)) score += 3
  const uq = userQuery.toUpperCase()
  if (uq.includes('TREND') && /TREND|RALLY|GAIN|SURGE|MOMENTUM/i.test(title)) score += 1
  if (/STOCK|SHARE|EARNINGS|GUIDANCE|OUTLOOK|PRICE|UPGRADE|DOWNGRADE/i.test(title)) score += 1
  if (preferredSites.some((s) => item.url.includes(s))) score += 1
  // recency heuristic
  const ts = item.publishedAt ? Date.parse(item.publishedAt) : NaN
  if (!Number.isNaN(ts)) {
    const hrs = (Date.now() - ts) / 36e5
    if (hrs <= 24) score += 2
    else if (hrs <= 72) score += 1
  }
  return score
}

export async function fetchArticleText(url: string): Promise<string> {
  // Use Jina reader for robust readability with CORS bypass
  const reader = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
  const txt = await fetchText(reader)
  return txt.slice(0, 8000) // bound context size
}


