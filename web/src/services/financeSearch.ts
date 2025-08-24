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

// Enhanced ticker and company name detection
const COMPANY_TO_TICKER: Record<string, string> = {
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'amazon': 'AMZN',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  'meta': 'META',
  'facebook': 'META',
  'netflix': 'NFLX',
  'amd': 'AMD',
  'intel': 'INTC',
  'coca cola': 'KO',
  'coca-cola': 'KO',
  'coke': 'KO',
  'mcdonalds': 'MCD',
  'disney': 'DIS',
  'walt disney': 'DIS',
  'jpmorgan': 'JPM',
  'jp morgan': 'JPM',
  'bank of america': 'BAC',
  'wells fargo': 'WFC',
  'goldman sachs': 'GS',
  'morgan stanley': 'MS',
  'berkshire hathaway': 'BRK.A',
  'berkshire': 'BRK.A',
  'johnson & johnson': 'JNJ',
  'jnj': 'JNJ',
  'procter & gamble': 'PG',
  'p&g': 'PG',
  'unitedhealth': 'UNH',
  'united health': 'UNH',
  'home depot': 'HD',
  'mastercard': 'MA',
  'visa': 'V',
  'paypal': 'PYPL',
  'salesforce': 'CRM',
  'oracle': 'ORCL',
  'cisco': 'CSCO',
  'adobe': 'ADBE',
  'nike': 'NKE',
  'starbucks': 'SBUX',
  'costco': 'COST',
  'walmart': 'WMT',
  'target': 'TGT',
  'chevron': 'CVX',
  'exxon': 'XOM',
  'exxon mobil': 'XOM',
  'pfizer': 'PFE',
  'moderna': 'MRNA',
  'biontech': 'BNTX',
  'zoom': 'ZM',
  'palantir': 'PLTR',
  'snowflake': 'SNOW',
  'datadog': 'DDOG',
  'crowdstrike': 'CRWD',
  'okta': 'OKTA',
  'shopify': 'SHOP',
  'square': 'SQ',
  'block': 'SQ',
  'robinhood': 'HOOD',
  'coinbase': 'COIN',
  'spotify': 'SPOT',
  'uber': 'UBER',
  'lyft': 'LYFT',
  'airbnb': 'ABNB',
  'doordash': 'DASH',
  'snap': 'SNAP',
  'snapchat': 'SNAP',
  'pinterest': 'PINS',
  'twitter': 'TWTR',
  'x': 'TWTR',
  'linkedin': 'MSFT', // Microsoft owns LinkedIn
  'github': 'MSFT', // Microsoft owns GitHub
  'activision': 'ATVI',
  'blizzard': 'ATVI',
  'ea': 'EA',
  'electronic arts': 'EA',
  'take two': 'TTWO',
  'take-two': 'TTWO',
  'rockstar': 'TTWO',
  'gta': 'TTWO',
  'federal reserve': 'FED',
  'fed': 'FED',
  'powell': 'FED',
  'jerome powell': 'FED',
  'fomc': 'FED',
  'sec': 'SEC',
  'securities and exchange commission': 'SEC',
  'treasury': 'TREASURY',
  'us treasury': 'TREASURY',
  'yellen': 'TREASURY',
  'janet yellen': 'TREASURY',
  'congress': 'CONGRESS',
  'senate': 'CONGRESS',
  'house': 'CONGRESS',
  'white house': 'WHITE_HOUSE',
  'biden': 'WHITE_HOUSE',
  'president biden': 'WHITE_HOUSE',
  'trump': 'TRUMP',
  'donald trump': 'TRUMP',
  'president trump': 'TRUMP'
}

// Enhanced ticker extraction with company name support
export function extractTickersFromQuery(q: string): string[] {
  const query = q.toLowerCase()
  const tickers = new Set<string>()
  
  // Check for company names first
  for (const [company, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (query.includes(company)) {
      tickers.add(ticker)
    }
  }
  
  // Extract traditional ticker symbols (1-5 letter uppercase)
  const candidates = q
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  
  for (const w of candidates) {
    if (/^[A-Za-z]{1,5}$/.test(w)) {
      tickers.add(w.toUpperCase())
    }
  }
  
  return Array.from(tickers).slice(0, 5) // Increased limit for better coverage
}

// Enhanced search with better context detection
export async function searchFinanceContexts(userQuery: string): Promise<NewsItem[]> {
  const tickers = extractTickersFromQuery(userQuery)
  const query = userQuery.toLowerCase()
  
  // Detect query type for better source selection
  const isTickerQuery = tickers.length > 0
  const isFedQuery = query.includes('powell') || query.includes('fed') || query.includes('fomc') || query.includes('federal reserve')
  const isEarningsQuery = query.includes('earnings') || query.includes('quarterly') || query.includes('results')
  const isMarketQuery = query.includes('market') || query.includes('sector') || query.includes('trend')
  const isEconomicQuery = query.includes('inflation') || query.includes('cpi') || query.includes('jobs') || query.includes('employment')
  
  const searches: Promise<NewsItem[]>[] = []
  
  if (isTickerQuery) {
    // For specific tickers, get comprehensive data
    for (const ticker of tickers.slice(0, 3)) {
      searches.push(yahooFinanceNews(ticker))
      searches.push(stocktwitsSymbol(ticker))
      // Add more ticker-specific sources
      searches.push(googleNewsSearch(`${ticker} stock news when:1d`))
    }
  } else if (isFedQuery) {
    // For Fed-related queries, focus on financial news
    searches.push(googleNewsSearch('Federal Reserve Powell speech when:1d'))
    searches.push(googleNewsSearch('FOMC meeting when:1d'))
    searches.push(cnbcTop())
  } else if (isEarningsQuery) {
    // For earnings queries
    searches.push(googleNewsSearch('earnings results when:1d'))
    searches.push(yahooFinanceNews('^GSPC')) // S&P 500 for market context
  } else if (isMarketQuery) {
    // For market queries
    searches.push(googleNewsSearch('stock market today when:1d'))
    searches.push(cnbcTop())
    searches.push(yahooFinanceNews('^GSPC'))
  } else if (isEconomicQuery) {
    // For economic data
    searches.push(googleNewsSearch('inflation CPI jobs economic data when:1d'))
    searches.push(googleNewsSearch('Federal Reserve economic when:1d'))
  } else {
    // General finance query
    const preferredSites = ['reuters.com', 'cnbc.com', 'finance.yahoo.com', 'bloomberg.com']
    const siteFilter = preferredSites.map((s) => `site:${s}`).join(' OR ')
    const gQuery = `${userQuery} finance when:1d (${siteFilter})`
    searches.push(googleNewsSearch(gQuery))
    searches.push(cnbcTop())
  }

  // Execute searches with timeout
  const results = await Promise.allSettled(searches)
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter(Boolean)

  const unique = dedupeByUrl(items)
  const ranked = unique
    .map((n) => ({ news: n, score: enhancedScoreNews(n, userQuery, tickers, isTickerQuery, isFedQuery) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.news)

  return ranked.slice(0, 12) // Increased for better coverage
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

// Enhanced scoring for better relevance
function enhancedScoreNews(
  item: NewsItem, 
  userQuery: string, 
  tickers: string[], 
  isTickerQuery: boolean,
  isFedQuery: boolean
): number {
  let score = 0
  const title = (item.title || '').toUpperCase()
  const query = userQuery.toUpperCase()
  
  // Ticker-specific scoring
  for (const t of tickers) {
    if (title.includes(t)) score += 5
  }
  
  // Query-specific scoring
  if (isTickerQuery && /STOCK|SHARE|PRICE|TRADING|VOLUME/i.test(title)) score += 3
  if (isFedQuery && /FED|FEDERAL|POWELL|FOMC|RATE|INTEREST/i.test(title)) score += 4
  if (query.includes('EARNINGS') && /EARNINGS|QUARTERLY|RESULTS|REVENUE|PROFIT/i.test(title)) score += 3
  if (query.includes('MARKET') && /MARKET|SECTOR|INDEX|TREND/i.test(title)) score += 2
  if (query.includes('INFLATION') && /INFLATION|CPI|PRICE|ECONOMIC/i.test(title)) score += 3
  
  // Source preference
  const preferredSources = ['reuters.com', 'cnbc.com', 'finance.yahoo.com', 'bloomberg.com', 'marketwatch.com']
  if (preferredSources.some((s) => item.url.includes(s))) score += 2
  
  // Recency scoring
  const ts = item.publishedAt ? Date.parse(item.publishedAt) : NaN
  if (!Number.isNaN(ts)) {
    const hrs = (Date.now() - ts) / 36e5
    if (hrs <= 6) score += 4
    else if (hrs <= 24) score += 3
    else if (hrs <= 72) score += 2
  }
  
  return score
}

export async function fetchArticleText(url: string): Promise<string> {
  // Use Jina reader for robust readability with CORS bypass
  const reader = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
  const txt = await fetchText(reader)
  return txt.slice(0, 4000) // Reduced context size for faster processing
}


