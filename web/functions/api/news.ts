// Cloudflare Pages Function: Aggregate stock-market news from multiple RSS sources
// GET /api/news?page=1&pageSize=10&q=tesla&source=CNBC

type NewsItem = {
  id: string
  title: string
  url: string
  source: string
  publishedAt?: string
  description?: string
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(25, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10')))
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const sourceFilter = (url.searchParams.get('source') || '').trim()
    const perSource = Math.min(20, Math.max(3, parseInt(url.searchParams.get('perSource') || '12')))

    const headers = {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      accept: 'application/rss+xml, application/xml, text/xml, */*',
    }

    // Edge cache
    const cache = caches.default
    const cacheKey = new Request(`https://news-cache.invalid${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      method: 'GET',
    })
    // Cache whole aggregate for 60s; paging is derived from cached set
    const cached = await cache.match(cacheKey)
    let items: NewsItem[]
    if (cached) {
      items = (await cached.json()) as NewsItem[]
    } else {
      const feeds = [
        { name: 'CNBC', url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html' }, // Markets
        { name: 'Yahoo Finance', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US' },
        { name: 'MarketWatch', url: 'https://www.marketwatch.com/feeds/topstories' },
        { name: 'Nasdaq', url: 'https://www.nasdaq.com/feed/rssoutbound?category=Stock-Market-News' },
        { name: 'Seeking Alpha', url: 'https://seekingalpha.com/market_currents.xml' },
        { name: 'TheStreet', url: 'https://www.thestreet.com/.rss/full/' },
        { name: 'PR Newswire', url: 'https://www.prnewswire.com/rss/all-news.rss' },
        { name: 'Business Wire', url: 'https://www.businesswire.com/portal/site/home/rss/' },
        { name: 'SEC', url: 'https://www.sec.gov/news/pressreleases.rss' },
        { name: 'Bloomberg US', url: 'https://feeds.bloomberg.com/markets/news.rss' },
        { name: 'Barron\'s', url: 'https://www.barrons.com/feed' },
      ]
      // Add a Google News RSS feed: query-specific if q provided; otherwise general US stock market
      const gq = q ? `${q} US market` : 'US stock market Wall Street'
      feeds.push({
        name: 'Google News',
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(gq)}&hl=en-US&gl=US&ceid=US:en`,
      })
      const results = await Promise.allSettled(
        feeds.map(async (f) => {
          const text = await fetchWithTimeout(f.url, { headers }, 7000)
          const parsed = parseRss(text, f.name)
          return parsed.slice(0, perSource)
        }),
      )
      let all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

      // If query contains a ticker-like symbol, enrich with StockTwits posts
      const mTicker = /\b[A-Z]{1,5}\b/.exec(q || '')
      if (mTicker) {
        const sym = mTicker[0]
        try {
          const st = await fetchWithTimeout(
            `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(sym)}.json`,
            { headers: { 'user-agent': headers['user-agent'] } },
            4000,
          )
          const data = JSON.parse(st)
          const msgs = (data?.messages || []).slice(0, perSource)
          const mapped: NewsItem[] = msgs.map((m: any) => ({
            id: hash(`st_${m.id}`),
            title: (m?.body || '').slice(0, 140),
            url: m?.entities?.links?.[0]?.url || `https://stocktwits.com/${m?.user?.username || ''}/message/${m?.id}`,
            source: 'StockTwits',
            publishedAt: m?.created_at,
            description: m?.body || undefined,
          }))
          all = all.concat(mapped)
        } catch {}
      }
      items = rankAndDedupe(filterStockMarket(all))
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(items), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=60' },
        }),
      )
    }

    let filtered = items
    if (sourceFilter && sourceFilter !== 'All') filtered = filtered.filter((i) => i.source === sourceFilter)
    if (q) filtered = filtered.filter((i) => i.title.toLowerCase().includes(q))

    const total = filtered.length
    const start = (page - 1) * pageSize
    const end = Math.min(start + pageSize, total)
    const pageItems = filtered.slice(start, end)

    return new Response(JSON.stringify({ items: pageItems, total }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ items: [], total: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const regex = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(xml))) {
    const block = m[1]
    const rawTitle = extract(block, 'title')
    const title = sanitizeRss(rawTitle || '', false)
    const link = extract(block, 'link')
    const pubDate = extract(block, 'pubDate')
    const rawDesc = extract(block, 'description') || extract(block, 'content:encoded')
    const desc = rawDesc ? sanitizeRss(rawDesc, true) : null
    if (!title || !link) continue
    items.push({ id: hash(link), title, url: link, source, publishedAt: pubDate || undefined, description: desc || undefined })
  }
  return items
}

function extract(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block)
  if (!m) return null
  return decodeHtml(m[1].trim())
}

function decodeHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, '')
    .replace(/]]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function sanitizeRss(s: string, stripTags: boolean): string {
  let out = decodeHtml(s || '')
  if (stripTags) {
    out = out
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

function rankAndDedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    if (!it.url || seen.has(it.url)) continue
    seen.add(it.url)
    out.push(it)
  }
  return out.sort((a, b) => (dateMs(b.publishedAt) - dateMs(a.publishedAt)))
}

function dateMs(s?: string) {
  if (!s) return 0
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

function filterStockMarket(items: NewsItem[]): NewsItem[] {
  // US-focused filter: general market and ticker-like words (caps 1–5 letters)
  const usMarketTerms = /(stock|stocks|share|shares|market|wall street|fed|rates|yields|earnings|guidance|upgrade|downgrade|price target|pre[- ]?market|after[- ]?hours|nasdaq|s&p|dow|ipo|dividend|buyback|sec|fed|treasury|bond|nyse|amex|otc|us market|american|united states)/i
  const tickerLike = /\b[A-Z]{1,5}\b/
  
  // Keywords that indicate non-US news (to filter out)
  const internationalTerms = /(europe|european|asia|asian|china|chinese|japan|japanese|uk|britain|british|london|frankfurt|tokyo|hong kong|singapore|canada|canadian|australia|australian|india|indian|brazil|brazilian|russia|russian|emerging markets|foreign|overseas|international)/i
  
  return items.filter((n) => {
    const t = n.title || ''
    const desc = n.description || ''
    const fullText = `${t} ${desc}`.toLowerCase()
    
    // Skip if it's clearly international news
    if (internationalTerms.test(fullText)) {
      return false
    }
    
    // Include if it has US market terms or ticker symbols
    return usMarketTerms.test(t) || tickerLike.test(t)
  })
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return `id_${h}`
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<string> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal })
    return await resp.text()
  } finally {
    clearTimeout(id)
  }
}


