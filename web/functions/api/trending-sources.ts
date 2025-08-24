// Aggregate trending symbols from multiple public sources
// GET /api/trending-sources?region=US&per=3

type SourcesResponse = {
  yahoo: string[]
  cnbc: string[]
  google: string[]
  stocktwits: string[]
  reuters?: string[]
  marketwatch?: string[]
  dow?: string[]
  nasdaq?: string[]
  sp500?: string[]
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<string> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...init, signal: ctrl.signal })
    const text = await resp.text()
    return text
  } finally {
    clearTimeout(id)
  }
}

function extractSymbolsFromText(text: string): string[] {
  // Basic extraction: uppercase 1-5 letters; drop obvious non-tickers
  const candidates = text.match(/\b[A-Z]{1,5}\b/g) || []
  const blacklist = new Set([
    'CNBC', 'USD', 'DJIA', 'NYSE', 'NASDAQ', 'AMEX', 'ETF', 'TECH', 'NEWS', 'CEO', 'EPS', 'FOMC', 'AI', 'IPO', 'USA',
  ])
  const out: string[] = []
  for (const c of candidates) {
    if (blacklist.has(c)) continue
    out.push(c)
  }
  return Array.from(new Set(out))
}

function parseRssTitles(xml: string): { title: string; description?: string }[] {
  // Very light RSS parse for titles/desc
  const items: { title: string; description?: string }[] = []
  const itemBlocks = xml.split(/<item[\s\S]*?>/i).slice(1)
  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i)
    if (!titleMatch) continue
    const title = titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i)
    const desc = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : undefined
    items.push({ title, description: desc })
  }
  return items
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const region = url.searchParams.get('region') || 'US'
    const per = Math.max(1, Math.min(10, Number(url.searchParams.get('per') || '3')))
    const name = (url.searchParams.get('name') || '').toLowerCase()

    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://finance.yahoo.com/',
    }

    if (name === 'yahoo') {
      const yahooText = await fetchWithTimeout(
        `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}?count=50`,
        { headers },
        6000,
      ).catch(() => '')
      let yahoo: string[] = []
      try {
        const data = JSON.parse(yahooText || '{}')
        const lists = data?.finance?.result || []
        for (const l of lists) {
          for (const q of l?.quotes || []) if (q?.symbol) yahoo.push(q.symbol)
        }
      } catch {}
      yahoo = Array.from(new Set(yahoo))
      return new Response(JSON.stringify({ yahoo: yahoo.slice(0, per) }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (name === 'stocktwits') {
      const stJson = await fetchWithTimeout('https://api.stocktwits.com/api/2/trending/symbols.json', { headers }, 6000).catch(
        () => '',
      )
      let stocktwits: string[] = []
      try {
        const data = JSON.parse(stJson || '{}')
        const syms = (data?.symbols || []).map((x: any) => x?.symbol).filter(Boolean)
        stocktwits = Array.from(new Set(syms))
      } catch {}
      return new Response(JSON.stringify({ stocktwits: stocktwits.slice(0, per) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (name === 'cnbc') {
      const cnbcXml = await fetchWithTimeout('https://www.cnbc.com/id/10001147/device/rss/rss.html', { headers }, 6000).catch(
        () => '',
      )
      const cnbcItems = parseRssTitles(cnbcXml || '')
      const cnbc = Array.from(
        new Set(cnbcItems.flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`)).filter((s) => s.length <= 5)),
      )
      return new Response(JSON.stringify({ cnbc: cnbc.slice(0, per) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (name === 'google') {
      const googleXml = await fetchWithTimeout(
        'https://news.google.com/rss/search?q=stock%20market&hl=en-US&gl=US&ceid=US:en',
        { headers },
        6000,
      ).catch(() => '')
      const googleItems = parseRssTitles(googleXml || '')
      const google = Array.from(
        new Set(googleItems.flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`)).filter((s) => s.length <= 5)),
      )
      return new Response(JSON.stringify({ google: google.slice(0, per) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (name === 'reuters') {
      const reutersXml = await fetchWithTimeout('https://feeds.reuters.com/reuters/businessNews', { headers }, 6000).catch(
        () => '',
      )
      const reutersItems = parseRssTitles(reutersXml || '')
      const reuters = Array.from(
        new Set(
          reutersItems.flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`)).filter((s) => s.length <= 5),
        ),
      )
      return new Response(JSON.stringify({ reuters: reuters.slice(0, per) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (name === 'marketwatch') {
      const marketwatchXml = await fetchWithTimeout('https://www.marketwatch.com/feeds/topstories', { headers }, 6000).catch(
        () => '',
      )
      const marketwatchItems = parseRssTitles(marketwatchXml || '')
      const marketwatch = Array.from(
        new Set(
          marketwatchItems.flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`)).filter((s) => s.length <= 5),
        ),
      )
      return new Response(JSON.stringify({ marketwatch: marketwatch.slice(0, per) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (name === 'dow') {
      // Static Dow 30 snapshot (best-effort, may change over time)
      const dow = [
        'AAPL','AMGN','AXP','BA','CAT','CRM','CSCO','CVX','DIS','DOW','GS','HD','HON','IBM','JNJ','JPM','KO','MCD','MRK','MSFT','NKE','PG','TRV','UNH','V','VZ','WBA','WMT','INTC','MMM'
      ]
      return new Response(JSON.stringify({ dow: dow.slice(0, per) }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (name === 'nasdaq' || name === 'nasdaq100') {
      // Static NASDAQ-100-ish core list (subset sufficient for fallback)
      const ndx = [
        'AAPL','MSFT','NVDA','AMZN','META','GOOGL','GOOG','TSLA','AVGO','COST','NFLX','ADBE','PEP','AMD','INTC','CSCO','QCOM','TXN','AMAT','SBUX','BKNG','PYPL','PDD','MRVL','LIN','ADI','INTU','VRTX','REGN','MU','PANW','CRWD','ABNB','SNPS','CDNS','MAR','KDP','GILD','LRCX','KHC','ADP','CSX','MDLZ','AMGN','HON','CHTR','MRNA','IDXX','ORLY','TTD','ZM','TEAM','OKTA','DOCU','ROKU','SQ','SPOT','SNAP','UBER','LYFT'
      ]
      return new Response(JSON.stringify({ nasdaq: ndx.slice(0, per) }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (name === 'sp500') {
      // Small representative subset for S&P 500 fallback
      const sp = [
        'AAPL','MSFT','NVDA','AMZN','META','GOOGL','BRK.B','LLY','AVGO','JPM','TSLA','XOM','V','UNH','WMT','MA','JNJ','PG','ORCL','HD','COST','ABBV','BAC','MRK','CVX','PEP','KO','ADBE','CRM','PFE'
      ]
      return new Response(JSON.stringify({ sp500: sp.slice(0, per) }), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    const [yahooText, cnbcXml, googleXml, stJson, reutersXml, marketwatchXml] = await Promise.all([
      // Yahoo trending
      fetchWithTimeout(
        `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}?count=50`,
        { headers },
        6000,
      ).catch(() => ''),
      // CNBC Markets RSS
      fetchWithTimeout('https://www.cnbc.com/id/10001147/device/rss/rss.html', { headers }, 6000).catch(() => ''),
      // Google News RSS (stock market)
      fetchWithTimeout(
        'https://news.google.com/rss/search?q=stock%20market&hl=en-US&gl=US&ceid=US:en',
        { headers },
        6000,
      ).catch(() => ''),
      // StockTwits trending symbols
      fetchWithTimeout('https://api.stocktwits.com/api/2/trending/symbols.json', { headers }, 6000).catch(() => ''),
      // Reuters Business RSS
      fetchWithTimeout('https://feeds.reuters.com/reuters/businessNews', { headers }, 6000).catch(() => ''),
      // MarketWatch Top Stories
      fetchWithTimeout('https://www.marketwatch.com/feeds/topstories', { headers }, 6000).catch(() => ''),
    ])

    // Yahoo parse
    let yahoo: string[] = []
    try {
      const data = JSON.parse(yahooText || '{}')
      const lists = data?.finance?.result || []
      for (const l of lists) {
        for (const q of l?.quotes || []) {
          if (q?.symbol) yahoo.push(q.symbol)
        }
      }
    } catch {}
    yahoo = Array.from(new Set(yahoo))

    // CNBC parse
    const cnbcItems = parseRssTitles(cnbcXml || '')
    const cnbc = Array.from(
      new Set(
        cnbcItems
          .flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`))
          .filter((s) => s.length <= 5),
      ),
    )

    // Google parse
    const googleItems = parseRssTitles(googleXml || '')
    const google = Array.from(
      new Set(
        googleItems
          .flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`))
          .filter((s) => s.length <= 5),
      ),
    )

    // StockTwits parse
    let stocktwits: string[] = []
    try {
      const data = JSON.parse(stJson || '{}')
      const syms = (data?.symbols || []).map((x: any) => x?.symbol).filter(Boolean)
      stocktwits = Array.from(new Set(syms))
    } catch {}

    // Reuters parse
    const reutersItems = parseRssTitles(reutersXml || '')
    const reuters = Array.from(
      new Set(
        reutersItems
          .flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`))
          .filter((s) => s.length <= 5),
      ),
    )

    // MarketWatch parse
    const marketwatchItems = parseRssTitles(marketwatchXml || '')
    const marketwatch = Array.from(
      new Set(
        marketwatchItems
          .flatMap((it) => extractSymbolsFromText(`${it.title} ${it.description || ''}`))
          .filter((s) => s.length <= 5),
      ),
    )

    // Limit to per from each
    const out: SourcesResponse = {
      yahoo: yahoo.slice(0, per),
      cnbc: cnbc.slice(0, per),
      google: google.slice(0, per),
      stocktwits: stocktwits.slice(0, per),
      reuters: reuters.slice(0, per),
      marketwatch: marketwatch.slice(0, per),
    }

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=120' },
    })
  } catch (e) {
    const empty: SourcesResponse = { yahoo: [], cnbc: [], google: [], stocktwits: [] }
    return new Response(JSON.stringify(empty), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}


