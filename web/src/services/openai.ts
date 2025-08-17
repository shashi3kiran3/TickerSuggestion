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

export async function summarizeNewsArticle(title: string, url: string): Promise<NewsSummary> {
  let body = ''
  try {
    body = await fetchArticleText(url)
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
              'You are a finance news summarizer. Produce a very short, plain headline and 3-5 simple bullets an everyday investor can grasp. Avoid hype. Return JSON with keys: headline, bullets.',
          },
          {
            role: 'user',
            content: `Title: ${title}\nURL: ${url}\n\nContent:\n${body.slice(0, 6000)}`,
          },
        ],
        temperature: 0.2,
      }),
    })
    if (!response.ok) throw new Error('bad response')
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || '{}'
    const parsed = JSON.parse(text)
    const headline = typeof parsed.headline === 'string' ? parsed.headline : simpleHeadline(title)
    const bullets: string[] = Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 5) : []
    return { headline, bullets }
  } catch {
    return { headline: simpleHeadline(title), bullets: ['Open the source to read details.'] }
  }
}

function simpleHeadline(title: string) {
  // Trim long titles, remove source suffix after ' - '
  const t = title.split(' - ')[0]
  return t.length > 100 ? t.slice(0, 97) + '…' : t
}


