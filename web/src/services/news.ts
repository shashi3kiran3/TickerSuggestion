export type NewsCard = {
  id: string
  title: string
  url: string
  source: string
  publishedAt?: string
  description?: string
}

const allOrigins = (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch {
    const res = await fetch(allOrigins(url))
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
    return await res.text()
  }
}

function parseRss(xml: string, fallbackSource: string): NewsCard[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  if (items.length === 0) return []
  return items.map((it, idx) => ({
    id: `${fallbackSource}-${idx}-${it.querySelector('guid')?.textContent || it.querySelector('link')?.textContent || idx}`,
    title: it.querySelector('title')?.textContent?.trim() || 'Untitled',
    url: it.querySelector('link')?.textContent?.trim() || '#',
    source: it.querySelector('source')?.textContent?.trim() || fallbackSource,
    publishedAt: it.querySelector('pubDate')?.textContent?.trim() || undefined,
  }))
}

// Feeds
const feeds: { name: string; url: string }[] = [
  { name: 'CNBC', url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html' }, // Markets
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'Yahoo Finance', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US' },
  { name: 'MarketWatch', url: 'https://www.marketwatch.com/feeds/topstories' },
]

export async function fetchLiveNews(): Promise<NewsCard[]> {
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const xml = await fetchText(f.url)
      return parseRss(xml, f.name)
    }),
  )
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  return rankAndDedupe(items)
}

function rankAndDedupe(items: NewsCard[]): NewsCard[] {
  const seen = new Set<string>()
  const unique: NewsCard[] = []
  for (const n of items) {
    if (!n.url || seen.has(n.url)) continue
    seen.add(n.url)
    unique.push(n)
  }
  // Sort by recency where available
  return unique.sort((a, b) => (dateMs(b.publishedAt) - dateMs(a.publishedAt)))
}

function dateMs(s?: string) {
  if (!s) return 0
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

export function timeAgo(iso?: string): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// Heuristic filter: keep stock-market-focused headlines only
export function filterStockMarket(items: NewsCard[]): NewsCard[] {
  const re = /(stock|stocks|share|shares|earnings|guidance|upgrade|downgrade|price target|pre[- ]?market|after[- ]?hours|Nasdaq|S&P|Dow|IPO|dividend|buyback)/i
  return items.filter((n) => re.test(n.title || ''))
}


