// Fetch upcoming IPOs from Nasdaq (public calendar CSV) via server-side proxy
// GET /api/ipos

export const onRequestGet: PagesFunction = async () => {
  try {
    // Nasdaq provides a downloadable IPO calendar CSV; paths occasionally change. Use a stable finance site as fallback.
    const urls = [
      'https://api.nasdaq.com/api/ipo/calendar',
      'https://www.nasdaq.com/api/v3/calendar/ipos',
    ]
    for (const u of urls) {
      const resp = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json,text/csv,*/*' } })
      if (!resp.ok) continue
      const text = await resp.text()
      if (text.length < 10) continue
      return new Response(text, { status: 200, headers: { 'content-type': resp.headers.get('content-type') || 'text/plain' } })
    }
  } catch {}
  return new Response(JSON.stringify({ error: 'unavailable' }), { status: 200, headers: { 'content-type': 'application/json' } })
}


