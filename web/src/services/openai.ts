import { fetchArticleText, searchFinanceContexts, type NewsItem } from './financeSearch'

export async function askOpenAI(prompt: string): Promise<string> {
  // Step 1: fetch live finance contexts from open sources
  const contexts = await searchFinanceContexts(prompt)
  const top = contexts.slice(0, 6)

  // Pull first-article bodies to ground the answer
  const bodies: string[] = []
  for (const it of top.slice(0, 3)) {
    try {
      bodies.push(await fetchArticleText(it.url))
    } catch {
      // ignore
    }
  }

  // Step 2: call OpenAI (or fallback)
  // Prefer Cloudflare function proxy to keep key server-side
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a finance assistant. Only answer stock/news/event questions. Use sources given. Provide concise, timely bullets and include 3-5 cited links at the end. If query is out of scope, ask to refine.',
          },
          { role: 'user', content: buildPrompt(prompt, top, bodies) },
        ],
        temperature: 0.3,
      }),
    })
    if (!response.ok) return localAnswer(prompt, top, bodies)
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    return text || localAnswer(prompt, top, bodies)
  } catch {
    return localAnswer(prompt, top, bodies)
  }
}

function buildPrompt(q: string, items: NewsItem[], bodies: string[]) {
  const sourcesList = items
    .map((n, i) => `(${i + 1}) ${n.source}: ${n.title} - ${n.url}`)
    .join('\n')
  const bodyText = bodies.join('\n---\n')
  return `Question: ${q}

Recent finance sources:
${sourcesList}

Relevant article excerpts:
${bodyText}

Instructions:
- Answer based strictly on the sources above.
- Prefer the latest timestamps.
- Provide 3-6 short bullets.
- End with a "Sources" list referencing the numbered links.
`
}

function localAnswer(q: string, items: NewsItem[], _bodies: string[]) {
  const bullets = items.slice(0, 4).map((n) => `- ${n.source}: ${n.title}`)
  const refs = items.slice(0, 5).map((n, i) => `${i + 1}. ${n.url}`)
  return `Live sources fetched for: "${q}"

${bullets.join('\n')}

Sources:\n${refs.join('\n')}`
}

export type NewsSummary = { headline: string; bullets: string[] }

export async function summarizeNewsArticle(title: string, url: string, hint?: string): Promise<NewsSummary> {
  let body = hint ? (hint + '\n\n') : ''
  try {
    if (!body) {
      const resp = await fetch(`/api/read?url=${encodeURIComponent(url)}`)
      if (resp.ok) body = await resp.text()
    }
  } catch {
    // ignore; proceed with title-only
  }

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a finance news summarizer. Output JSON {"headline": string, "bullets": string[]}.\nHeadline: concise and neutral.\nBullets: 3–10 bullets, each ~20–40 words. Cover: (1) what happened, (2) drivers/why, (3) key numbers (%, $, guidance), (4) companies/tickers, (5) timeframes (today/this week/next quarter), (6) immediate market reaction, (7) risks/uncertainties.\nPlain language. No hype, no emojis, no CDATA. Do not include boilerplate or disclaimers.',
          },
          {
            role: 'user',
            content: `Title: ${title}\nURL: ${url}\n\nContent (may be partial, use what is available):\n${body.slice(0, 12000)}`,
          },
        ],
        temperature: 0.15,
        max_tokens: 700,
      }),
    })
    if (!response.ok) {
      // Try to detect quota/auth errors and fallback gracefully
      try {
        const err = await response.json()
        const code = err?.error?.code || err?.code
        if (code === 'insufficient_quota' || response.status === 401 || response.status === 429) {
          const bullets = naiveBullets(body)
          return { headline: simpleHeadline(title), bullets }
        }
      } catch {}
      throw new Error('bad response')
    }
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(text)
    const headline = typeof parsed.headline === 'string' ? parsed.headline : simpleHeadline(title)
    const aiBullets: string[] = Array.isArray(parsed.bullets) ? parsed.bullets : []
    let bullets = aiBullets.slice(0, 10)
    if (bullets.length < 3) {
      bullets = [...bullets, ...naiveBullets(body)].slice(0, 10)
    }
    if (bullets.length < 3) bullets = naiveBullets(body)
    return { headline, bullets }
  } catch {
    const bullets = naiveBullets(body)
    return { headline: simpleHeadline(title), bullets }
  }
}

function simpleHeadline(title: string) {
  // Trim long titles, remove source suffix after ' - '
  const t = title.split(' - ')[0]
  return t.length > 100 ? t.slice(0, 97) + '…' : t
}

function naiveBullets(text: string): string[] {
  const clean = (text || '')
    .replace(/\s+/g, ' ')
    .replace(/^\W+/, '')
    .trim()
  if (!clean) return ['Open the source to read the full article.']
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 20 && /[a-zA-Z]/.test(s))

  // Score sentences: prefer ones with numbers, %, $, dates, tickers, verbs like rise/fall/beat/miss
  const scoreSentence = (s: string) => {
    let score = 0
    if (/[\$€£]\s?\d/.test(s)) score += 2
    if (/\d+\s?%/.test(s)) score += 2
    if (/\b\d{4}\b|\bQ[1-4]\b|\bH[12]\b|\bFY\d{2}\b/i.test(s)) score += 1
    if (/\b[A-Z]{1,5}\b/.test(s)) score += 1
    if (/(rise|gain|surge|fall|slump|drop|beat|miss|guidance|forecast|downgrade|upgrade)/i.test(s)) score += 1
    if (s.length > 160) score += 1
    return score
  }

  const scored = sentences.map((s, i) => ({ s, i, score: scoreSentence(s) }))
  // Pick top 8 by score, then restore original order for readability
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)

  return top.length > 0 ? top : sentences.slice(0, 6)
}


