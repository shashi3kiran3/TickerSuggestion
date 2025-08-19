// Reader proxy with timeout + edge cache
// GET /api/read?url=ENCODED_URL

export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const target = url.searchParams.get('url') || ''
    if (!target) return new Response('', { status: 200 })

    const cache = caches.default
    const cacheKey = new Request(request.url, { method: 'GET' })
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 5000)
    try {
      // Try Jina reader first
      const readerUrl = `https://r.jina.ai/http://${target.replace(/^https?:\/\//, '')}`
      const resp = await fetch(readerUrl, {
        signal: controller.signal,
        headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/plain,*/*' },
      })
      if (resp.ok) {
        const text = await resp.text()
        const response = new Response(text || '', {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 's-maxage=600' },
        })
        await cache.put(cacheKey, response.clone())
        return response
      }
    } catch {}
    clearTimeout(id)

    // Fallback: direct fetch and naive HTML strip
    try {
      const resp = await fetch(target, { headers: { 'user-agent': 'Mozilla/5.0' } })
      const html = await resp.text()
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const response = new Response(text, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 's-maxage=600' },
      })
      await cache.put(cacheKey, response.clone())
      return response
    } catch {}

    return new Response('', { status: 200 })
  } catch {
    return new Response('', { status: 200 })
  }
}


