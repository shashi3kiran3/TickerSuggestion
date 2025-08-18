// Fetch daily candles from Yahoo Finance chart API (server-side to avoid CORS)
// GET /api/chart?symbol=SPY&range=2y&interval=1d

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const symbol = url.searchParams.get('symbol') || 'SPY'
    const range = url.searchParams.get('range') || '2y'
    const interval = url.searchParams.get('interval') || '1d'

    const yf = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=div%2Csplit`

    const resp = await fetch(yf, { headers: { 'user-agent': 'Mozilla/5.0' } })
    const text = await resp.text()
    return new Response(text, { status: resp.status, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'chart_fetch_error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}


