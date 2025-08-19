export const onRequestGet: PagesFunction<{ ALPHA_VANTAGE_KEY?: string }> = async ({ request, env }) => {
  try {
    const url = new URL(request.url)
    const symbol = url.searchParams.get('symbol') || 'SPY'
    const range = url.searchParams.get('range') || '2y'
    const interval = url.searchParams.get('interval') || '1d'

    // Cache first
    const cache = caches.default
    const cacheKey = new Request(request.url, { method: 'GET' })
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      accept: 'application/json, text/plain, */*',
      referer: 'https://finance.yahoo.com/',
      'accept-language': 'en-US,en;q=0.9',
    }

    // Try Yahoo chart first
    const ep = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=div%2Csplit`
    const resp = await fetch(ep, { headers })
    if (resp.ok) {
      const text = await resp.text()
      const response = new Response(text, {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=600' },
      })
      await cache.put(cacheKey, response.clone())
      return response
    }

    // Fallback: Alpha Vantage TIME_SERIES_DAILY_ADJUSTED (compact)
    const key = env.ALPHA_VANTAGE_KEY
    if (key) {
      const av = await fetch(
        `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(
          symbol,
        )}&outputsize=${range === '10y' || range === '5y' ? 'full' : 'compact'}&apikey=${encodeURIComponent(key)}`,
      )
      const data = await av.json()
      const series = data?.['Time Series (Daily)'] || {}
      const entries = Object.entries(series) as [string, any][]
      entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      const timestamp: number[] = []
      const open: number[] = []
      const high: number[] = []
      const low: number[] = []
      const close: number[] = []
      for (const [date, ohlc] of entries) {
        timestamp.push(new Date(date).getTime() / 1000)
        open.push(parseFloat(ohlc['1. open']))
        high.push(parseFloat(ohlc['2. high']))
        low.push(parseFloat(ohlc['3. low']))
        close.push(parseFloat(ohlc['4. close']))
      }
      const payload = {
        chart: {
          result: [
            {
              timestamp,
              indicators: { quote: [{ open, high, low, close }] },
            },
          ],
        },
      }
      const response = new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=600' },
      })
      await cache.put(cacheKey, response.clone())
      return response
    }

    return new Response(JSON.stringify({ chart: { result: [] }, error: 'upstream_unavailable' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ chart: { result: [] }, error: 'proxy_error' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}


