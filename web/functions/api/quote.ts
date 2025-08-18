// Proxy Yahoo Finance quote endpoint for multiple symbols
// GET /api/quote?symbols=AAPL,MSFT,NVDA

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const symbols = url.searchParams.get('symbols') || ''
    if (!symbols) return new Response(JSON.stringify({ quotes: [] }), { status: 200 })
    const yf = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`
    const resp = await fetch(yf, { headers: { 'user-agent': 'Mozilla/5.0' } })
    const text = await resp.text()
    return new Response(text, { status: resp.status, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ quotes: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}


