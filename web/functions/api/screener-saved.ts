// Proxy Yahoo Finance predefined screener
// GET /api/screener-saved?scrIds=most_volatile&count=50

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const scrIds = url.searchParams.get('scrIds') || 'most_actives'
    const count = url.searchParams.get('count') || '50'
    const yf = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=${encodeURIComponent(
      count,
    )}&scrIds=${encodeURIComponent(scrIds)}`
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


