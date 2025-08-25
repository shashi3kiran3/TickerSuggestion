import { fetchArticleText, searchFinanceContexts, extractTickersFromQuery, getAnalystData, getHistoricalTrends, getMarketSentiment, getFundamentals, compareFundamentals, getFundamentalPredictions, getMultiSourceRecommendations, type NewsItem } from './financeSearch'

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
          regularMarketPrice: quote.regularMarketPrice,
          regularMarketChange: quote.regularMarketChange,
          regularMarketChangePercent: quote.regularMarketChangePercent,
          regularMarketVolume: quote.regularMarketVolume,
          marketCap: quote.marketCap,
          trailingPE: quote.trailingPE,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
          // Additional fields for enhanced analysis
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          volume: quote.regularMarketVolume,
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

// Helper function to format article dates with relative time
function formatArticleDate(dateString: string | undefined): string {
  if (!dateString) return 'Date unknown'
  
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Date unknown'
  }
}

// Helper function to classify query type
function classifyQuery(query: string): string {
  const q = query.toLowerCase()
  if (q.includes('fundamental') || q.includes('valuation') || q.includes('pe ratio') || q.includes('financial')) return 'fundamental'
  if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('against')) return 'comparison'
  if (q.includes('recommend') || q.includes('should i buy') || q.includes('investment advice')) return 'recommendation'
  if (q.includes('analyst') || q.includes('rating') || q.includes('target') || q.includes('sentiment')) return 'analyst'
  if (q.includes('predict') || q.includes('forecast') || q.includes('trend') || q.includes('movement')) return 'prediction'
  if (q.includes('powell') || q.includes('fed') || q.includes('fomc')) return 'fed'
  if (q.includes('earnings') || q.includes('quarterly') || q.includes('results')) return 'earnings'
  if (q.includes('market') || q.includes('sector')) return 'market'
  if (q.includes('inflation') || q.includes('cpi') || q.includes('jobs')) return 'economic'
  return 'general'
}

// Helper function to get analysis instructions based on query type
function getAnalysisInstructions(queryType: string): string {
  switch (queryType) {
    case 'fundamental':
      return 'Focus on fundamental analysis including valuation metrics (P/E, P/B, P/S ratios), financial health, profitability, growth rates, and balance sheet strength. Provide detailed financial analysis and valuation assessment.'
    case 'comparison':
      return 'Focus on comparing stocks across key metrics including valuation, profitability, growth, financial health, and market performance. Highlight strengths and weaknesses of each stock relative to others.'
    case 'recommendation':
      return 'Focus on providing investment recommendations based on comprehensive analysis including fundamentals, technicals, analyst opinions, and market sentiment. Consider risk factors and provide balanced advice.'
    case 'analyst':
      return 'Focus on analyst ratings, target prices, upgrades/downgrades, and sentiment analysis. Include specific analyst recommendations and price targets.'
    case 'prediction':
      return 'Focus on technical analysis, trend patterns, support/resistance levels, and price movement predictions. Include volatility and volume analysis.'
    case 'fed':
      return 'Focus on Federal Reserve policy, interest rates, economic outlook, and market implications. Include impact on different sectors.'
    case 'earnings':
      return 'Focus on earnings results, revenue growth, profit margins, guidance, and market reaction. Compare with analyst expectations.'
    case 'market':
      return 'Focus on overall market trends, sector performance, key drivers, and market sentiment. Include technical and fundamental analysis.'
    case 'economic':
      return 'Focus on economic data, inflation, employment, GDP, and their impact on markets and specific sectors.'
    default:
      return 'Provide comprehensive analysis with current data, market context, and relevant insights.'
  }
}

export async function askOpenAI(
  prompt: string,
  conversationHistory: ChatMessage[] = [],
  opts?: { signal?: AbortSignal; timeoutMs?: number; enhancedData?: any },
): Promise<string> {
  const startTime = Date.now()
  const now = new Date()
  const currentTime = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Step 1: Smart context gathering with caching
  const contexts = await getOptimizedContexts(prompt)
  const top = contexts.slice(0, 6) // Increased for better coverage

  // Step 1.5: Get real-time stock quotes for ticker queries
  const tickers = extractTickersFromQuery(prompt)
  const stockQuotes = await getStockQuotes(tickers)

  // Step 2: Get analyst data, trends, sentiment, fundamentals, and recommendations for enhanced analysis
  let analystData: any = null
  let trendsData: any = null
  let sentimentData: any = null
  let fundamentalsData: any = null
  let comparisonData: any = null
  let predictionsData: any = null
  let recommendationsData: any = null
  const queryType = classifyQuery(prompt)
  
  // Use enhanced data if provided (for incremental responses)
  if (opts?.enhancedData) {
    analystData = opts.enhancedData.analystData
    trendsData = opts.enhancedData.trendsData
    sentimentData = opts.enhancedData.sentimentData
    fundamentalsData = opts.enhancedData.fundamentalsData
    comparisonData = opts.enhancedData.comparisonData
    predictionsData = opts.enhancedData.predictionsData
    recommendationsData = opts.enhancedData.recommendationsData
  } else if (tickers.length > 0) {
    try {
      // Determine which data to fetch based on query type
      const dataPromises: Promise<any>[] = []
      
      if (queryType === 'analyst' || queryType === 'prediction' || queryType === 'general') {
        dataPromises.push(getAnalystData(tickers[0]))
        dataPromises.push(getHistoricalTrends(tickers[0]))
        dataPromises.push(getMarketSentiment(tickers[0]))
      }
      
      if (queryType === 'fundamental' || queryType === 'general') {
        dataPromises.push(getFundamentals(tickers[0]))
        dataPromises.push(getFundamentalPredictions(tickers[0]))
      }
      
      if (queryType === 'comparison' && tickers.length >= 2) {
        dataPromises.push(compareFundamentals(tickers.slice(0, 3)))
      }
      
      if (queryType === 'recommendation' || queryType === 'general') {
        dataPromises.push(getMultiSourceRecommendations(tickers[0]))
      }
      
      const results = await Promise.allSettled(dataPromises)
      let resultIndex = 0
      
      if (queryType === 'analyst' || queryType === 'prediction' || queryType === 'general') {
        analystData = results[resultIndex]?.status === 'fulfilled' ? (results[resultIndex] as PromiseFulfilledResult<any>).value : null
        resultIndex++
        trendsData = results[resultIndex]?.status === 'fulfilled' ? (results[resultIndex] as PromiseFulfilledResult<any>).value : null
        resultIndex++
        sentimentData = results[resultIndex]?.status === 'fulfilled' ? (results[resultIndex] as PromiseFulfilledResult<any>).value : null
        resultIndex++
      }
      
      if (queryType === 'fundamental' || queryType === 'general') {
        fundamentalsData = results[resultIndex]?.status === 'fulfilled' ? (results[resultIndex] as PromiseFulfilledResult<any>).value : null
        resultIndex++
        predictionsData = results[resultIndex]?.status === 'fulfilled' ? (results[resultIndex] as PromiseFulfilledResult<any>).value : null
        resultIndex++
      }
      
      if (queryType === 'comparison' && tickers.length >= 2) {
        comparisonData = results[resultIndex]?.status === 'fulfilled' ? (results[resultIndex] as PromiseFulfilledResult<any>).value : null
        resultIndex++
      }
      
      if (queryType === 'recommendation' || queryType === 'general') {
        recommendationsData = results[resultIndex]?.status === 'fulfilled' ? (results[resultIndex] as PromiseFulfilledResult<any>).value : null
        resultIndex++
      }
      
    } catch (error) {
      console.log('Error fetching enhanced data:', error)
    }
  }

  // Step 3: Enhanced article extraction with better content analysis
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

  // Step 4: Enhanced system prompt for better stock analysis
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are an expert financial analyst and market advisor. Provide comprehensive, accurate analysis based on current market data and news. Current time: ${currentTime}

Key capabilities:
- Detailed stock analysis with price movements, volume, and technical indicators
- Company fundamentals and earnings analysis
- Market sentiment and trend analysis
- Economic data interpretation (Fed, inflation, jobs, etc.)
- Sector and industry analysis
- Risk assessment and investment insights
- Analyst ratings and target price analysis
- Technical analysis and pattern recognition
- Market sentiment from multiple sources

Response style:
- Be comprehensive but well-structured
- Include specific numbers, percentages, and timeframes
- Provide context and background information
- Distinguish between facts, analysis, and opinions
- Include relevant market context
- For stock queries: mention price, volume, recent news, and key metrics
- For economic queries: explain implications and market impact
- Always mention data timestamps when relevant
- Note if data is older than 24 hours

When analyzing stocks:
- Current price and recent performance
- Volume and trading activity
- Key news and catalysts
- Technical indicators if relevant
- Company fundamentals when available
- Market sentiment and analyst opinions
- Support and resistance levels
- Trend analysis and predictions

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
      content: buildEnhancedPromptWithAnalytics(prompt, top, bodies, conversationHistory, stockQuotes, analystData, trendsData, sentimentData, fundamentalsData, comparisonData, predictionsData, recommendationsData, queryType, currentTime)
    }
  ]

  // Step 5: Enhanced OpenAI call with better parameters
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
    
    if (!response.ok) return buildEnhancedFallbackWithAnalytics(prompt, top, conversationHistory, stockQuotes, analystData, trendsData, sentimentData, fundamentalsData, comparisonData, predictionsData, recommendationsData, queryType, currentTime)
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    
    console.log(`AI Response time: ${Date.now() - startTime}ms`)
    return text || buildEnhancedFallbackWithAnalytics(prompt, top, conversationHistory, stockQuotes, analystData, trendsData, sentimentData, fundamentalsData, comparisonData, predictionsData, recommendationsData, queryType, currentTime)
  } catch (error) {
    console.log(`Error in AI call: ${Date.now() - startTime}ms`)
    return buildEnhancedFallbackWithAnalytics(prompt, top, conversationHistory, stockQuotes, analystData, trendsData, sentimentData, fundamentalsData, comparisonData, predictionsData, recommendationsData, queryType, currentTime)
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

function buildEnhancedPromptWithAnalytics(
  currentQuestion: string, 
  items: NewsItem[], 
  bodies: string[], 
  history: ChatMessage[],
  stockQuotes: Record<string, any>,
  analystData: any,
  trendsData: any,
  sentimentData: any,
  fundamentalsData: any,
  comparisonData: any,
  predictionsData: any,
  recommendationsData: any,
  queryType: string,
  currentTime: string
): string {
  const sourcesList = items
    .map((n, i) => `(${i + 1}) ${n.source}: ${n.title} - ${formatArticleDate(n.publishedAt)}`)
    .join('\n')
  const bodyText = bodies.join('\n---\n')
  
  // Enhanced conversation context
  const conversationContext = history.length > 0 
    ? `\nPrevious conversation context: ${history.slice(-3).map(msg => msg.content ?? '').join(' | ')}\n`
    : ''

  // Add real-time stock data if available
  let stockDataSection = ''
  if (Object.keys(stockQuotes).length > 0) {
    stockDataSection = '\n\nReal-time stock data (as of ' + currentTime + '):\n'
    for (const [symbol, quote] of Object.entries(stockQuotes)) {
      stockDataSection += `${symbol}: $${quote.regularMarketPrice?.toFixed(2) || 'N/A'} (${quote.regularMarketChangePercent >= 0 ? '+' : ''}${quote.regularMarketChangePercent?.toFixed(2) || 'N/A'}%) | Volume: ${quote.regularMarketVolume?.toLocaleString() || 'N/A'} | 52w: $${quote.fiftyTwoWeekHigh?.toFixed(2) || 'N/A'} - $${quote.fiftyTwoWeekLow?.toFixed(2) || 'N/A'}\n`
    }
  }

  // Add analyst data section
  let analystSection = ''
  if (analystData) {
    analystSection = `\n\nAnalyst Ratings & Sentiment (as of ${currentTime}):
- Analyst Rating: ${analystData.analystRating || 'N/A'} (${analystData.analystCount || 0} analysts)
- Target Price: $${analystData.targetPrice?.toFixed(2) || 'N/A'} (${analystData.priceToTarget?.toFixed(1) || 'N/A'}% to target)
- Target Range: $${analystData.targetLow?.toFixed(2) || 'N/A'} - $${analystData.targetHigh?.toFixed(2) || 'N/A'}
- Short Ratio: ${analystData.shortRatio || 'N/A'}
- Institutional Ownership: ${analystData.institutionalOwnership?.toFixed(1) || 'N/A'}%
- Insider Ownership: ${analystData.insiderOwnership?.toFixed(1) || 'N/A'}%`
  }

  // Add trends data section
  let trendsSection = ''
  if (trendsData) {
    trendsSection = `\n\nTechnical Analysis & Trends (${trendsData.daysAnalyzed} days analyzed):
- Current Price: $${trendsData.currentPrice?.toFixed(2) || 'N/A'}
- Price Change: $${trendsData.priceChange?.toFixed(2) || 'N/A'} (${trendsData.priceChangePercent?.toFixed(2) || 'N/A'}%)
- Trend Direction: ${trendsData.trend}
- Volatility: ${trendsData.volatility?.toFixed(2) || 'N/A'}
- Volume Change: ${trendsData.volumeChange?.toFixed(1) || 'N/A'}%
- Support Level: $${trendsData.supportLevel?.toFixed(2) || 'N/A'}
- Resistance Level: $${trendsData.resistanceLevel?.toFixed(2) || 'N/A'}`
  }

  // Add sentiment data section
  let sentimentSection = ''
  if (sentimentData) {
    sentimentSection = `\n\nMarket Sentiment Analysis:
${Object.entries(sentimentData.sources).map(([source, data]: [string, any]) => `
${source.toUpperCase()}:
${Object.entries(data).map(([key, value]) => `- ${key}: ${value}`).join('\n')}`).join('\n')}`
  }

  // Add fundamental data section
  let fundamentalSection = ''
  if (fundamentalsData) {
    fundamentalSection = `\n\nFundamental Analysis (as of ${currentTime}):
- Company: ${fundamentalsData.companyName || 'N/A'}
- Sector: ${fundamentalsData.sector || 'N/A'}
- Market Cap: $${(fundamentalsData.marketCap / 1e9)?.toFixed(2) || 'N/A'}B
- P/E Ratio: ${fundamentalsData.peRatio?.toFixed(2) || 'N/A'}
- Forward P/E: ${fundamentalsData.forwardPE?.toFixed(2) || 'N/A'}
- Price to Book: ${fundamentalsData.priceToBook?.toFixed(2) || 'N/A'}
- Price to Sales: ${fundamentalsData.priceToSales?.toFixed(2) || 'N/A'}
- Profit Margin: ${(fundamentalsData.profitMargin * 100)?.toFixed(2) || 'N/A'}%
- Return on Equity: ${(fundamentalsData.returnOnEquity * 100)?.toFixed(2) || 'N/A'}%
- Debt to Equity: ${fundamentalsData.debtToEquity?.toFixed(2) || 'N/A'}
- Revenue Growth: ${(fundamentalsData.revenueGrowth * 100)?.toFixed(2) || 'N/A'}%
- Dividend Yield: ${(fundamentalsData.dividendYield * 100)?.toFixed(2) || 'N/A'}%`
  }

  // Add comparison data section
  let comparisonSection = ''
  if (comparisonData) {
    comparisonSection = `\n\nStock Comparison Analysis:
${comparisonData.symbols.join(' vs ')} Comparison:

Valuation Metrics:
${comparisonData.analysis.valuation.peRatio.map((item: any) => `- ${item.symbol} P/E: ${item.value?.toFixed(2) || 'N/A'}`).join('\n')}

Profitability Metrics:
${comparisonData.analysis.profitability.profitMargin.map((item: any) => `- ${item.symbol} Profit Margin: ${(item.value * 100)?.toFixed(2) || 'N/A'}%`).join('\n')}

Growth Metrics:
${comparisonData.analysis.growth.revenueGrowth.map((item: any) => `- ${item.symbol} Revenue Growth: ${(item.value * 100)?.toFixed(2) || 'N/A'}%`).join('\n')}`
  }

  // Add predictions data section
  let predictionsSection = ''
  if (predictionsData) {
    predictionsSection = `\n\nFundamental Prediction Scores (0-100):
- Overall Score: ${predictionsData.scores.overallScore}/100
- Valuation Score: ${predictionsData.scores.valuationScore}/100
- Growth Score: ${predictionsData.scores.growthScore}/100
- Profitability Score: ${predictionsData.scores.profitabilityScore}/100
- Financial Health Score: ${predictionsData.scores.financialHealthScore}/100

Strengths: ${predictionsData.analysis.strengths.join(', ') || 'None identified'}
Weaknesses: ${predictionsData.analysis.weaknesses.join(', ') || 'None identified'}
Recommendations: ${predictionsData.analysis.recommendations.join(', ') || 'None provided'}`
  }

  // Add recommendations data section
  let recommendationsSection = ''
  if (recommendationsData) {
    recommendationsSection = `\n\nMulti-Source Recommendations:

${Object.entries(recommendationsData.sources).map(([source, data]: [string, any]) => {
  if (source === 'stocktwits') {
    return `StockTwits Sentiment:
- Bullish Messages: ${(data as any).bullishCount || 0}
- Bearish Messages: ${(data as any).bearishCount || 0}
- Recent Bullish: ${(data as any).bullishMessages?.slice(0, 2).map((m: any) => m.text.substring(0, 100)).join(' | ') || 'None'}`
  } else if (source === 'reddit') {
    return `Reddit Discussions:
${(data as any).posts?.slice(0, 3).map((post: any) => `- ${post.title} (${post.score} points)`).join('\n') || 'None'}`
  } else if (source === 'seekingAlpha') {
    return `Seeking Alpha Articles:
${(data as any).articles?.slice(0, 3).map((article: any) => `- ${article.title}`).join('\n') || 'None'}`
  } else if (source === 'analysts') {
    return `Analyst Consensus:
- Rating: ${(data as any).recommendation || 'N/A'}
- Target Price: $${(data as any).targetPrice?.toFixed(2) || 'N/A'}
- Analyst Count: ${(data as any).analystCount || 'N/A'}`
  }
  return ''
}).join('\n\n')}`
  }

  const analysisInstructions = getAnalysisInstructions(queryType)

  return `Question: ${currentQuestion}${conversationContext}

Current sources (analyzed at ${currentTime}):
${sourcesList}${stockDataSection}${analystSection}${trendsSection}${sentimentSection}${fundamentalSection}${comparisonSection}${predictionsSection}${recommendationsSection}

Article excerpts:
${bodyText}

Instructions:
- Provide comprehensive, accurate analysis
- Include specific numbers, percentages, and timeframes
- Provide context and background information
- Distinguish between facts, analysis, and opinions
- Include relevant market context
- Always mention data timestamps when relevant
- Note if data is older than 24 hours
${analysisInstructions}
- Cite sources for specific claims
- Keep response well-structured and informative`
}

// Legacy function - kept for compatibility but not used
// function buildEnhancedPrompt(
//   currentQuestion: string, 
//   items: NewsItem[], 
//   bodies: string[], 
//   history: ChatMessage[],
//   stockQuotes: Record<string, any>
// ): string {
//   // Implementation removed to avoid unused function warning
//   return ''
// }

function buildEnhancedFallbackWithAnalytics(
  q: string, 
  items: NewsItem[], 
  history: ChatMessage[],
  stockQuotes: Record<string, any>,
  analystData: any,
  trendsData: any,
  sentimentData: any,
  _fundamentalsData: any,
  _comparisonData: any,
  _predictionsData: any,
  _recommendationsData: any,
  _queryType: string,
  currentTime: string
): string {
  const bullets = items.slice(0, 4).map((n) => `- ${n.source}: ${n.title} (${formatArticleDate(n.publishedAt)})`)
  const refs = items.slice(0, 4).map((n, i) => `${i + 1}. ${n.url}`)
  
  // Add stock data to fallback if available
  let stockDataSection = ''
  if (Object.keys(stockQuotes).length > 0) {
    stockDataSection = '\n\nCurrent stock data (as of ' + currentTime + '):\n'
    for (const [symbol, quote] of Object.entries(stockQuotes)) {
      stockDataSection += `${symbol}: $${quote.regularMarketPrice?.toFixed(2) || 'N/A'} (${quote.regularMarketChangePercent >= 0 ? '+' : ''}${quote.regularMarketChangePercent?.toFixed(2) || 'N/A'}%)\n`
    }
  }

  // Add analyst data to fallback
  let analystSection = ''
  if (analystData) {
    analystSection = `\n\nAnalyst Insights:
- Rating: ${analystData.analystRating || 'N/A'} (${analystData.analystCount || 0} analysts)
- Target: $${analystData.targetPrice?.toFixed(2) || 'N/A'} (${analystData.priceToTarget?.toFixed(1) || 'N/A'}% to target)`
  }

  // Add trends data to fallback
  let trendsSection = ''
  if (trendsData) {
    trendsSection = `\n\nTechnical Trends:
- Trend: ${trendsData.trend} (${trendsData.priceChangePercent?.toFixed(2) || 'N/A'}% change)
- Support: $${trendsData.supportLevel?.toFixed(2) || 'N/A'} | Resistance: $${trendsData.resistanceLevel?.toFixed(2) || 'N/A'}`
  }

  // Add sentiment data to fallback
  let sentimentSection = ''
  if (sentimentData) {
    sentimentSection = `\n\nSentiment: ${Object.entries(sentimentData.sources).map(([source, data]: [string, any]) => 
      `${source}: ${(data as any).sentiment || 'N/A'}`
    ).join(' | ')}`
  }
  
  const contextNote = history.length > 0 
    ? `\n\nNote: I'm responding based on current sources. Feel free to ask follow-up questions for more detailed analysis!`
    : ''

  return `I found some current information about "${q}" (analyzed at ${currentTime})${contextNote}${stockDataSection}${analystSection}${trendsSection}${sentimentSection}

${bullets.join('\n')}

Sources:\n${refs.join('\n')}

For more detailed analysis, please ask specific follow-up questions about price movements, volume, news catalysts, analyst ratings, or market sentiment.`
}

// Legacy function - kept for compatibility but not used
// function buildEnhancedFallback(
//   q: string, 
//   items: NewsItem[], 
//   history: ChatMessage[],
//   stockQuotes: Record<string, any>
// ): string {
//   // Implementation removed to avoid unused function warning
//   return ''
// }

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


