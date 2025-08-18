// Returns list of trending tickers from Yahoo Finance
// GET /api/trending?region=US&count=25

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const region = url.searchParams.get('region') || 'US'
    const count = url.searchParams.get('count') || '25'
    const yf = `https://query1.finance.yahoo.com/v1/finance/trending/${encodeURIComponent(region)}?count=${encodeURIComponent(
      count,
    )}`
    const resp = await fetch(yf, { headers: { 'user-agent': 'Mozilla/5.0' } })
    if (!resp.ok) return new Response(JSON.stringify({ symbols: [] }), { status: 200 })
    const data = await resp.json<any>()
    const lists = data?.finance?.result || []
    const symbols: string[] = []
    for (const l of lists) {
      for (const q of l?.quotes || []) {
        if (q?.symbol) symbols.push(q.symbol)
      }
    }
    const uniq = Array.from(new Set(symbols))
    return new Response(JSON.stringify({ symbols: uniq }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ symbols: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}


