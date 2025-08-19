// Proxy Yahoo Finance quote endpoint for multiple symbols
// GET /api/quote?symbols=AAPL,MSFT,NVDA

export const onRequestGet: PagesFunction<{ ALPHA_VANTAGE_KEY?: string }> = async ({ request, env }) => {
  try {
    const url = new URL(request.url)
    const symbols = (url.searchParams.get('symbols') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50)
      .join(',')
    if (!symbols) return new Response(JSON.stringify({ quoteResponse: { result: [] } }), { status: 200 })

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

    const endpoints = [
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`,
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`,
    ]

    for (const ep of endpoints) {
      const resp = await fetch(ep, { headers })
      if (resp.ok) {
        const text = await resp.text()
        const response = new Response(text, {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=300' },
        })
        await cache.put(cacheKey, response.clone())
        return response
      }
      // Retry next endpoint on 401/403/5xx
      if (![401, 403, 429, 500, 502, 503].includes(resp.status)) {
        const text = await resp.text()
        return new Response(text, { status: resp.status, headers: { 'content-type': 'application/json' } })
      }
    }

    // Fallback: Alpha Vantage GLOBAL_QUOTE (limited; avoid rate limit by capping to 5 symbols)
    const key = env.ALPHA_VANTAGE_KEY
    if (key) {
      const syms = symbols.split(',').slice(0, 5)
      const results: any[] = []
      for (const s of syms) {
        try {
          const av = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(s)}&apikey=${encodeURIComponent(
              key,
            )}`,
          )
          const data = await av.json()
          const q = data?.['Global Quote']
          if (q) {
            results.push({ symbol: q['01. symbol'] || s, quoteType: 'EQUITY' })
          }
        } catch {}
      }
      const response = new Response(JSON.stringify({ quoteResponse: { result: results }, source: 'alphavantage' }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=300' },
      })
      await cache.put(cacheKey, response.clone())
      return response
    }

    return new Response(JSON.stringify({ quoteResponse: { result: [] }, error: 'upstream_unavailable' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ quoteResponse: { result: [] }, error: 'proxy_error' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}


