import { fetchArticleText, searchFinanceContexts, extractTickersFromQuery, type NewsItem } from './financeSearch'

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Simple in-memory cache for recent queries
const queryCache = new Map<string, { data: NewsItem[], timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Add stock quote fetching capability
async function getStockQuotes(tickers: string[]): Promise<Record<string, any>> {
  if (tickers.length === 0) return {}
  
  try {
    const response = await fetch(`/api/quote?symbols=${tickers.join(',')}`)
    if (!response.ok) return {}
    
    const data = await response.json()
    const quotes: Record<string, any> = {}
    
    if (data?.quoteResponse?.result) {
      for (const quote of data.quoteResponse.result) {
        quotes[quote.symbol] = {
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          volume: quote.regularMarketVolume,
          marketCap: quote.marketCap,
          pe: quote.trailingPE,
          high52w: quote.fiftyTwoWeekHigh,
          low52w: quote.fiftyTwoWeekLow
        }
      }
    }
    
    return quotes
  } catch (error) {
    console.log('Error fetching stock quotes:', error)
    return {}
  }
}

export async function askOpenAI(
  prompt: string,
  conversationHistory: ChatMessage[] = [],
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<string> {
  const startTime = Date.now()
  
  // Step 1: Smart context gathering with caching
  const contexts = await getOptimizedContexts(prompt)
  const top = contexts.slice(0, 6) // Increased for better coverage

  // Step 1.5: Get real-time stock quotes for ticker queries
  const tickers = extractTickersFromQuery(prompt)
  const stockQuotes = await getStockQuotes(tickers)

  // Step 2: Enhanced article extraction with better content analysis
  const bodies: string[] = []
  const articlePromises = top.slice(0, 3).map(async (item) => { // Increased to 3 articles
    try {
      const text = await fetchArticleText(item.url)
      return { url: item.url, text: text.slice(0, 5000), source: item.source } // Increased content size
    } catch {
      return null
    }
  })
  
  const articleResults = await Promise.allSettled(articlePromises)
  for (const result of articleResults) {
    if (result.status === 'fulfilled' && result.value) {
      bodies.push(result.value.text)
    }
  }

  // Step 3: Enhanced system prompt for better stock analysis
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are an expert financial analyst and market advisor. Provide comprehensive, accurate analysis based on current market data and news.

Key capabilities:
- Detailed stock analysis with price movements, volume, and technical indicators
- Company fundamentals and earnings analysis
- Market sentiment and trend analysis
- Economic data interpretation (Fed, inflation, jobs, etc.)
- Sector and industry analysis
- Risk assessment and investment insights

Response style:
- Be comprehensive but well-structured
- Include specific numbers, percentages, and timeframes
- Provide context and background information
- Distinguish between facts, analysis, and opinions
- Include relevant market context
- For stock queries: mention price, volume, recent news, and key metrics
- For economic queries: explain implications and market impact

When analyzing stocks:
- Current price and recent performance
- Volume and trading activity
- Key news and catalysts
- Technical indicators if relevant
- Company fundamentals when available
- Market sentiment and analyst opinions

When discussing economic events:
- Key points and implications
- Market reaction and impact
- Historical context if relevant
- Forward-looking implications

Always cite sources and provide balanced perspectives.`
  }

  // Build enhanced conversation
  const messages: ChatMessage[] = [
    systemMessage,
    ...conversationHistory.slice(-8), // Increased context window
    {
      role: 'user',
      content: buildEnhancedPrompt(prompt, top, bodies, conversationHistory, stockQuotes)
    }
  ]

  // Step 4: Enhanced OpenAI call with better parameters
  try {
    const response = await fetchWithTimeout('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.2, // Lower for more consistent, factual responses
        max_tokens: 1000, // Increased for more comprehensive responses
      }),
      signal: opts?.signal,
    }, opts?.timeoutMs ?? 15000) // Increased timeout for comprehensive analysis
    
    if (!response.ok) return buildEnhancedFallback(prompt, top, conversationHistory, stockQuotes)
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    
    console.log(`AI Response time: ${Date.now() - startTime}ms`)
    return text || buildEnhancedFallback(prompt, top, conversationHistory, stockQuotes)
  } catch (error) {
    console.log(`Error in AI call: ${Date.now() - startTime}ms`)
    return buildEnhancedFallback(prompt, top, conversationHistory, stockQuotes)
  }
}

async function getOptimizedContexts(prompt: string): Promise<NewsItem[]> {
  // Check cache first
  const cacheKey = prompt.toLowerCase().trim()
  const cached = queryCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Using cached context')
    return cached.data
  }

  // Get fresh contexts
  const contexts = await searchFinanceContexts(prompt)
  
  // Cache the result
  queryCache.set(cacheKey, { data: contexts, timestamp: Date.now() })
  
  // Limit cache size
  if (queryCache.size > 50) {
    const oldestKey = queryCache.keys().next().value
    if (oldestKey) {
      queryCache.delete(oldestKey)
    }
  }
  
  return contexts
}

function buildEnhancedPrompt(
  currentQuestion: string, 
  items: NewsItem[], 
  bodies: string[], 
  history: ChatMessage[],
  stockQuotes: Record<string, any>
): string {
  const sourcesList = items
    .map((n, i) => `(${i + 1}) ${n.source}: ${n.title} - ${n.url}`)
    .join('\n')
  const bodyText = bodies.join('\n---\n')
  
  // Enhanced conversation context
  const conversationContext = history.length > 0 
    ? `\nPrevious conversation context: ${history.slice(-3).map(msg => msg.content ?? '').join(' | ')}\n`
    : ''

  // Add real-time stock data if available
  let stockDataSection = ''
  if (Object.keys(stockQuotes).length > 0) {
    stockDataSection = '\n\nReal-time stock data:\n'
    for (const [symbol, quote] of Object.entries(stockQuotes)) {
      stockDataSection += `${symbol}: $${quote.price} (${quote.change >= 0 ? '+' : ''}${quote.change} ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent}%) | Volume: ${quote.volume?.toLocaleString() || 'N/A'} | 52w: $${quote.high52w} - $${quote.low52w}\n`
    }
  }

  // Detect query type for better analysis
  const query = currentQuestion.toLowerCase()
  const isStockQuery = query.includes('stock') || query.includes('price') || query.includes('trading')
  const isFedQuery = query.includes('powell') || query.includes('fed') || query.includes('fomc')
  const isEarningsQuery = query.includes('earnings') || query.includes('quarterly') || query.includes('results')
  const isMarketQuery = query.includes('market') || query.includes('sector') || query.includes('trend')

  let analysisInstructions = ''
  if (isStockQuery) {
    analysisInstructions = `
Focus on:
- Current stock price and recent performance (use real-time data if available)
- Volume and trading activity
- Key news and catalysts
- Technical indicators if relevant
- Company fundamentals when available
- Market sentiment and analyst opinions`
  } else if (isFedQuery) {
    analysisInstructions = `
Focus on:
- Key points from the speech/meeting
- Market reaction and implications
- Interest rate policy outlook
- Economic data interpretation
- Impact on different sectors`
  } else if (isEarningsQuery) {
    analysisInstructions = `
Focus on:
- Earnings results and key metrics
- Revenue and profit performance
- Guidance and outlook
- Market reaction
- Analyst expectations vs actual results`
  } else if (isMarketQuery) {
    analysisInstructions = `
Focus on:
- Overall market performance
- Sector trends and rotations
- Key drivers and catalysts
- Market sentiment
- Technical analysis if relevant`
  }

  return `Question: ${currentQuestion}${conversationContext}

Current sources:
${sourcesList}${stockDataSection}

Article excerpts:
${bodyText}

Instructions:
- Provide comprehensive, accurate analysis
- Include specific numbers, percentages, and timeframes
- Provide context and background information
- Distinguish between facts, analysis, and opinions
- Include relevant market context${analysisInstructions}
- Cite sources for specific claims
- Keep response well-structured and informative`
}

function buildEnhancedFallback(
  q: string, 
  items: NewsItem[], 
  history: ChatMessage[],
  stockQuotes: Record<string, any>
): string {
  const bullets = items.slice(0, 4).map((n) => `- ${n.source}: ${n.title}`)
  const refs = items.slice(0, 4).map((n, i) => `${i + 1}. ${n.url}`)
  
  // Add stock data to fallback if available
  let stockDataSection = ''
  if (Object.keys(stockQuotes).length > 0) {
    stockDataSection = '\n\nCurrent stock data:\n'
    for (const [symbol, quote] of Object.entries(stockQuotes)) {
      stockDataSection += `${symbol}: $${quote.price} (${quote.change >= 0 ? '+' : ''}${quote.change} ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent}%)\n`
    }
  }
  
  const contextNote = history.length > 0 
    ? `\n\nNote: I'm responding based on current sources. Feel free to ask follow-up questions for more detailed analysis!`
    : ''

  return `I found some current information about "${q}"${contextNote}${stockDataSection}

${bullets.join('\n')}

Sources:\n${refs.join('\n')}

For more detailed analysis, please ask specific follow-up questions about price movements, volume, news catalysts, or market sentiment.`
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
              'You are a finance news summarizer. Output JSON {"headline": string, "bullets": string[]}.\nHeadline: concise and neutral.\nBullets: 5–10 bullets, each ~12–25 words. Cover: (1) what happened, (2) key numbers (%, $, guidance), (3) companies/tickers, (4) timeframe, (5) immediate reaction/risks, (6) market impact, (7) analyst opinions, (8) future outlook.\nPlain language. No hype, no emojis, no CDATA. No boilerplate.',
          },
          {
            role: 'user',
            content: `Title: ${title}\nURL: ${url}\n\nContent (may be partial, use what is available):\n${body.slice(0, 12000)}`,
          },
        ],
        temperature: 0.15,
        max_tokens: 1000,
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
    let bullets = limitBullets(aiBullets)
    if (bullets.length < 5) bullets = limitBullets([...bullets, ...naiveBullets(body)])
    if (bullets.length < 5) bullets = limitBullets(naiveBullets(body))
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
  // Pick top 10 by score, then restore original order for readability
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)

  return top.length > 0 ? top : sentences.slice(0, 8)
}

function limitBullets(arr: string[]): string[] {
  // Ensure 5–10 bullets; trim very long lines to encourage brevity without cutting words awkwardly
  const cleaned = arr
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)
  let out = cleaned.slice(0, 10)
  if (out.length > 10) out = out.slice(0, 10)
  return out
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, ms: number) {
  if (init.signal) {
    // If caller provided its own signal, just run fetch; outer caller manages abort
    return fetch(input, init)
  }
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}


