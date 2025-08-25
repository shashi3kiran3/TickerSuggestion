// Lightweight client-side finance news/social search using open sources
// No extra deps; uses RSS endpoints and public APIs with CORS-friendly fallbacks.

export type NewsItem = {
  title: string
  url: string
  source: string
  publishedAt?: string
}

// AllOrigins proxy for CORS fallbacks
const allOrigins = (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

// Helpers
async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch {
    // Try via AllOrigins proxy
    const res = await fetch(allOrigins(url))
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`)
    return await res.text()
  }
}

function parseRssItems(xml: string, fallbackSource: string): NewsItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const items = Array.from(doc.querySelectorAll('item'))
  if (items.length === 0) return []
  return items.slice(0, 10).map((it) => ({
    title: it.querySelector('title')?.textContent?.trim() || 'Untitled',
    url: it.querySelector('link')?.textContent?.trim() || '#',
    source: it.querySelector('source')?.textContent?.trim() || fallbackSource,
    publishedAt: it.querySelector('pubDate')?.textContent?.trim() || undefined,
  }))
}

// Source adapters (RSS-based where possible)
async function googleNewsSearch(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const xml = await fetchText(url)
  return parseRssItems(xml, 'Google News')
}

async function yahooFinanceNews(tickerOrQuery: string): Promise<NewsItem[]> {
  // Yahoo Finance RSS for symbol; fallback to general query via Google News if needed
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    tickerOrQuery,
  )}&region=US&lang=en-US`
  try {
    const xml = await fetchText(url)
    const items = parseRssItems(xml, 'Yahoo Finance')
    if (items.length > 0) return items
  } catch {
    // ignore
  }
  return []
}

async function cnbcTop(): Promise<NewsItem[]> {
  const url = 'https://www.cnbc.com/id/100003114/device/rss/rss.html'
  const xml = await fetchText(url)
  return parseRssItems(xml, 'CNBC')
}

async function stocktwitsSymbol(symbol: string): Promise<NewsItem[]> {
  // Public API; may have CORS; use proxy if needed
  const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('sw cors')
    const data = await res.json()
    const items: NewsItem[] = (data?.messages || []).slice(0, 10).map((m: any) => ({
      title: m?.body?.slice(0, 140) || 'Post',
      url: m?.entities?.links?.[0]?.url || `https://stocktwits.com/${m?.user?.username || ''}`,
      source: 'StockTwits',
      publishedAt: m?.created_at,
    }))
    return items
  } catch {
    try {
      const res = await fetch(allOrigins(url))
      if (!res.ok) return []
      const data = await res.json()
      const items: NewsItem[] = (data?.messages || []).slice(0, 10).map((m: any) => ({
        title: m?.body?.slice(0, 140) || 'Post',
        url: m?.entities?.links?.[0]?.url || `https://stocktwits.com/${m?.user?.username || ''}`,
        source: 'StockTwits',
        publishedAt: m?.created_at,
      }))
      return items
    } catch {
      return []
    }
  }
}

// Enhanced ticker and company name detection
const COMPANY_TO_TICKER: Record<string, string> = {
  'apple': 'AAPL',
  'microsoft': 'MSFT',
  'google': 'GOOGL',
  'alphabet': 'GOOGL',
  'amazon': 'AMZN',
  'tesla': 'TSLA',
  'nvidia': 'NVDA',
  'meta': 'META',
  'facebook': 'META',
  'netflix': 'NFLX',
  'amd': 'AMD',
  'intel': 'INTC',
  'coca cola': 'KO',
  'coca-cola': 'KO',
  'coke': 'KO',
  'mcdonalds': 'MCD',
  'disney': 'DIS',
  'walt disney': 'DIS',
  'jpmorgan': 'JPM',
  'jp morgan': 'JPM',
  'bank of america': 'BAC',
  'wells fargo': 'WFC',
  'goldman sachs': 'GS',
  'morgan stanley': 'MS',
  'berkshire hathaway': 'BRK.A',
  'berkshire': 'BRK.A',
  'johnson & johnson': 'JNJ',
  'jnj': 'JNJ',
  'procter & gamble': 'PG',
  'p&g': 'PG',
  'unitedhealth': 'UNH',
  'united health': 'UNH',
  'home depot': 'HD',
  'mastercard': 'MA',
  'visa': 'V',
  'paypal': 'PYPL',
  'salesforce': 'CRM',
  'oracle': 'ORCL',
  'cisco': 'CSCO',
  'adobe': 'ADBE',
  'nike': 'NKE',
  'starbucks': 'SBUX',
  'costco': 'COST',
  'walmart': 'WMT',
  'target': 'TGT',
  'chevron': 'CVX',
  'exxon': 'XOM',
  'exxon mobil': 'XOM',
  'pfizer': 'PFE',
  'moderna': 'MRNA',
  'biontech': 'BNTX',
  'zoom': 'ZM',
  'palantir': 'PLTR',
  'snowflake': 'SNOW',
  'datadog': 'DDOG',
  'crowdstrike': 'CRWD',
  'okta': 'OKTA',
  'shopify': 'SHOP',
  'square': 'SQ',
  'block': 'SQ',
  'robinhood': 'HOOD',
  'coinbase': 'COIN',
  'spotify': 'SPOT',
  'uber': 'UBER',
  'lyft': 'LYFT',
  'airbnb': 'ABNB',
  'doordash': 'DASH',
  'snap': 'SNAP',
  'snapchat': 'SNAP',
  'pinterest': 'PINS',
  'twitter': 'TWTR',
  'x': 'TWTR',
  'linkedin': 'MSFT', // Microsoft owns LinkedIn
  'github': 'MSFT', // Microsoft owns GitHub
  'activision': 'ATVI',
  'blizzard': 'ATVI',
  'ea': 'EA',
  'electronic arts': 'EA',
  'take two': 'TTWO',
  'take-two': 'TTWO',
  'rockstar': 'TTWO',
  'gta': 'TTWO',
  'federal reserve': 'FED',
  'fed': 'FED',
  'powell': 'FED',
  'jerome powell': 'FED',
  'fomc': 'FED',
  'sec': 'SEC',
  'securities and exchange commission': 'SEC',
  'treasury': 'TREASURY',
  'us treasury': 'TREASURY',
  'yellen': 'TREASURY',
  'janet yellen': 'TREASURY',
  'congress': 'CONGRESS',
  'senate': 'CONGRESS',
  'house': 'CONGRESS',
  'white house': 'WHITE_HOUSE',
  'biden': 'WHITE_HOUSE',
  'president biden': 'WHITE_HOUSE',
  'trump': 'TRUMP',
  'donald trump': 'TRUMP',
  'president trump': 'TRUMP'
}

// Enhanced ticker extraction with company name support
export function extractTickersFromQuery(q: string): string[] {
  const query = q.toLowerCase()
  const tickers = new Set<string>()
  
  // Check for company names first
  for (const [company, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (query.includes(company)) {
      tickers.add(ticker)
    }
  }
  
  // Extract traditional ticker symbols (1-5 letter uppercase)
  const candidates = q
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  
  for (const w of candidates) {
    if (/^[A-Za-z]{1,5}$/.test(w)) {
      tickers.add(w.toUpperCase())
    }
  }
  
  return Array.from(tickers).slice(0, 5) // Increased limit for better coverage
}

// New function to fetch analyst ratings and sentiment
export async function getAnalystData(symbol: string): Promise<any> {
  try {
    // Try to get analyst data from Yahoo Finance
    const response = await fetch(`/api/quote?symbols=${symbol}`)
    if (!response.ok) return null
    
    const data = await response.json()
    const quote = data?.quoteResponse?.result?.[0]
    
    if (!quote) return null
    
    return {
      symbol: quote.symbol,
      analystRating: quote.recommendationMean || null,
      analystCount: quote.numberOfAnalystOpinions || null,
      targetPrice: quote.targetMeanPrice || null,
      targetHigh: quote.targetHighPrice || null,
      targetLow: quote.targetLowPrice || null,
      priceToTarget: quote.targetMeanPrice ? ((quote.targetMeanPrice - quote.regularMarketPrice) / quote.regularMarketPrice * 100) : null,
      // Sentiment indicators
      shortRatio: quote.shortRatio || null,
      shortPercent: quote.sharesShort || null,
      institutionalOwnership: quote.heldPercentInstitutions || null,
      insiderOwnership: quote.heldPercentInsiders || null
    }
  } catch (error) {
    console.log('Error fetching analyst data:', error)
    return null
  }
}

// New function to get historical trends and patterns
export async function getHistoricalTrends(symbol: string, days: number = 30): Promise<any> {
  try {
    const response = await fetch(`/api/chart?symbol=${symbol}&range=${days}d&interval=1d`)
    if (!response.ok) return null
    
    const data = await response.json()
    // const timestamps = data?.chart?.result?.[0]?.timestamp || []
    const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0] || {}
    const closes = quotes.close || []
    const volumes = quotes.volume || []
    
    if (closes.length < 2) return null
    
    // Calculate trends
    const recentPrices = closes.slice(-10) // Last 10 days
    const avgPrice = recentPrices.reduce((a: number, b: number) => a + b, 0) / recentPrices.length
    const currentPrice = closes[closes.length - 1]
    const priceChange = currentPrice - closes[closes.length - 2]
    const priceChangePercent = (priceChange / closes[closes.length - 2]) * 100
    
    // Volume analysis
    const recentVolumes = volumes.slice(-10)
    const avgVolume = recentVolumes.reduce((a: number, b: number) => a + b, 0) / recentVolumes.length
    const currentVolume = volumes[volumes.length - 1]
    const volumeChange = ((currentVolume - avgVolume) / avgVolume) * 100
    
    // Trend analysis
    const trend = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'UP' : 'DOWN'
    const volatility = Math.sqrt(recentPrices.reduce((sum: number, price: number) => sum + Math.pow(price - avgPrice, 2), 0) / recentPrices.length)
    
    // Support and resistance levels
    const highs = closes.slice(-20).map((price: number, index: number) => ({ price, index })).sort((a: any, b: any) => b.price - a.price)
    const lows = closes.slice(-20).map((price: number, index: number) => ({ price, index })).sort((a: any, b: any) => a.price - b.price)
    
    return {
      symbol,
      currentPrice,
      priceChange,
      priceChangePercent,
      avgPrice,
      trend,
      volatility,
      currentVolume,
      avgVolume,
      volumeChange,
      supportLevel: lows[0]?.price || null,
      resistanceLevel: highs[0]?.price || null,
      daysAnalyzed: days,
      priceHistory: closes.slice(-20) // Last 20 days for pattern analysis
    }
  } catch (error) {
    console.log('Error fetching historical trends:', error)
    return null
  }
}

// New function to get market sentiment from multiple sources
export async function getMarketSentiment(symbol: string): Promise<any> {
  try {
    const sentimentData = {
      symbol,
      sources: {} as Record<string, any>
    }
    
    // Get StockTwits sentiment
    try {
      const stResponse = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`)
      if (stResponse.ok) {
        const stData = await stResponse.json()
        const messages = stData?.messages || []
        const bullishCount = messages.filter((m: any) => m.entities?.sentiment?.basic === 'Bullish').length
        const bearishCount = messages.filter((m: any) => m.entities?.sentiment?.basic === 'Bearish').length
        const total = bullishCount + bearishCount
        
        sentimentData.sources.stocktwits = {
          bullish: bullishCount,
          bearish: bearishCount,
          total,
          sentiment: total > 0 ? (bullishCount / total * 100).toFixed(1) + '% Bullish' : 'No data'
        }
      }
    } catch (error) {
      console.log('StockTwits sentiment error:', error)
    }
    
    // Get news sentiment (basic keyword analysis)
    try {
      const newsResponse = await fetch(`/api/news`)
      if (newsResponse.ok) {
        const newsData = await newsResponse.json()
        const relevantNews = newsData.filter((item: any) => 
          item.title.toLowerCase().includes(symbol.toLowerCase())
        )
        
        const bullishKeywords = ['surge', 'rally', 'gain', 'up', 'positive', 'beat', 'exceed', 'growth', 'strong']
        const bearishKeywords = ['fall', 'drop', 'decline', 'down', 'negative', 'miss', 'weak', 'loss', 'concern']
        
        let bullishScore = 0
        let bearishScore = 0
        
        relevantNews.forEach((item: any) => {
          const title = item.title.toLowerCase()
          bullishKeywords.forEach(keyword => {
            if (title.includes(keyword)) bullishScore++
          })
          bearishKeywords.forEach(keyword => {
            if (title.includes(keyword)) bearishScore++
          })
        })
        
        sentimentData.sources.news = {
          bullishScore,
          bearishScore,
          totalNews: relevantNews.length,
          sentiment: bullishScore > bearishScore ? 'Bullish' : bearishScore > bullishScore ? 'Bearish' : 'Neutral'
        }
      }
    } catch (error) {
      console.log('News sentiment error:', error)
    }
    
    return sentimentData
  } catch (error) {
    console.log('Error fetching market sentiment:', error)
    return null
  }
}

// New function to fetch comprehensive fundamental data
export async function getFundamentals(symbol: string): Promise<any> {
  try {
    const response = await fetch(`/api/quote?symbols=${symbol}`)
    if (!response.ok) return null
    
    const data = await response.json()
    const quote = data?.quoteResponse?.result?.[0]
    
    if (!quote) return null
    
    return {
      symbol: quote.symbol,
      // Basic Info
      companyName: quote.longName || quote.shortName,
      sector: quote.sector,
      industry: quote.industry,
      marketCap: quote.marketCap,
      enterpriseValue: quote.enterpriseValue,
      
      // Valuation Metrics
      peRatio: quote.trailingPE,
      forwardPE: quote.forwardPE,
      pegRatio: quote.pegRatio,
      priceToBook: quote.priceToBook,
      priceToSales: quote.priceToSalesTrailing12Months,
      enterpriseToRevenue: quote.enterpriseToRevenue,
      enterpriseToEbitda: quote.enterpriseToEbitda,
      
      // Financial Metrics
      revenue: quote.totalRevenue,
      revenueGrowth: quote.revenueGrowth,
      grossProfit: quote.grossProfits,
      operatingIncome: quote.operatingIncome,
      netIncome: quote.netIncomeToCommon,
      ebitda: quote.ebitda,
      
      // Profitability
      grossMargin: quote.grossMargins,
      operatingMargin: quote.operatingMargins,
      profitMargin: quote.profitMargins,
      returnOnEquity: quote.returnOnEquity,
      returnOnAssets: quote.returnOnAssets,
      
      // Balance Sheet
      totalCash: quote.totalCash,
      totalDebt: quote.totalDebt,
      debtToEquity: quote.debtToEquity,
      currentRatio: quote.currentRatio,
      quickRatio: quote.quickRatio,
      
             // Growth Metrics
       earningsGrowth: quote.earningsGrowth,
      
      // Dividends
      dividendRate: quote.dividendRate,
      dividendYield: quote.dividendYield,
      payoutRatio: quote.payoutRatio,
      
      // Technical
      beta: quote.beta,
      fiftyDayAverage: quote.fiftyDayAverage,
      twoHundredDayAverage: quote.twoHundredDayAverage,
      
      // Additional
      sharesOutstanding: quote.sharesOutstanding,
      floatShares: quote.floatShares,
      sharesShort: quote.sharesShort,
      shortRatio: quote.shortRatio
    }
  } catch (error) {
    console.log('Error fetching fundamentals:', error)
    return null
  }
}

// New function to compare fundamentals between stocks
export async function compareFundamentals(symbols: string[]): Promise<any> {
  if (symbols.length < 2) return null
  
  try {
    const fundamentals = await Promise.all(
      symbols.map(symbol => getFundamentals(symbol))
    )
    
    const validFundamentals = fundamentals.filter(f => f !== null)
    if (validFundamentals.length < 2) return null
    
    // Calculate comparison metrics
    const comparison = {
      symbols: validFundamentals.map(f => f.symbol),
      data: validFundamentals,
      analysis: {
        // Valuation comparison
        valuation: {
          peRatio: validFundamentals.map(f => ({ symbol: f.symbol, value: f.peRatio })),
          priceToBook: validFundamentals.map(f => ({ symbol: f.symbol, value: f.priceToBook })),
          priceToSales: validFundamentals.map(f => ({ symbol: f.symbol, value: f.priceToSales }))
        },
        // Profitability comparison
        profitability: {
          profitMargin: validFundamentals.map(f => ({ symbol: f.symbol, value: f.profitMargin })),
          returnOnEquity: validFundamentals.map(f => ({ symbol: f.symbol, value: f.returnOnEquity })),
          grossMargin: validFundamentals.map(f => ({ symbol: f.symbol, value: f.grossMargin }))
        },
        // Growth comparison
        growth: {
          revenueGrowth: validFundamentals.map(f => ({ symbol: f.symbol, value: f.revenueGrowth })),
          earningsGrowth: validFundamentals.map(f => ({ symbol: f.symbol, value: f.earningsGrowth }))
        },
        // Financial health
        financialHealth: {
          debtToEquity: validFundamentals.map(f => ({ symbol: f.symbol, value: f.debtToEquity })),
          currentRatio: validFundamentals.map(f => ({ symbol: f.symbol, value: f.currentRatio }))
        }
      }
    }
    
    return comparison
  } catch (error) {
    console.log('Error comparing fundamentals:', error)
    return null
  }
}

// New function to get predictions based on fundamentals
export async function getFundamentalPredictions(symbol: string): Promise<any> {
  try {
    const fundamentals = await getFundamentals(symbol)
    if (!fundamentals) return null
    
    // Calculate prediction scores based on fundamental analysis
    const predictions = {
      symbol,
      timestamp: new Date().toISOString(),
      scores: {
        // Valuation Score (0-100, lower is better for value)
        valuationScore: calculateValuationScore(fundamentals),
        
        // Growth Score (0-100, higher is better)
        growthScore: calculateGrowthScore(fundamentals),
        
        // Profitability Score (0-100, higher is better)
        profitabilityScore: calculateProfitabilityScore(fundamentals),
        
        // Financial Health Score (0-100, higher is better)
        financialHealthScore: calculateFinancialHealthScore(fundamentals),
        
        // Overall Score (0-100, higher is better)
        overallScore: 0
      },
      analysis: {
        strengths: [] as string[],
        weaknesses: [] as string[],
        recommendations: [] as string[]
      }
    }
    
    // Calculate overall score
    predictions.scores.overallScore = Math.round(
      (predictions.scores.valuationScore + 
       predictions.scores.growthScore + 
       predictions.scores.profitabilityScore + 
       predictions.scores.financialHealthScore) / 4
    )
    
    // Generate analysis
    generateFundamentalAnalysis(predictions, fundamentals)
    
    return predictions
  } catch (error) {
    console.log('Error generating fundamental predictions:', error)
    return null
  }
}

// Helper function to calculate valuation score
function calculateValuationScore(fundamentals: any): number {
  let score = 50 // Base score
  
  // PE Ratio analysis
  if (fundamentals.peRatio) {
    if (fundamentals.peRatio < 15) score += 20
    else if (fundamentals.peRatio < 25) score += 10
    else if (fundamentals.peRatio > 50) score -= 20
    else if (fundamentals.peRatio > 30) score -= 10
  }
  
  // Price to Book analysis
  if (fundamentals.priceToBook) {
    if (fundamentals.priceToBook < 1) score += 15
    else if (fundamentals.priceToBook < 2) score += 5
    else if (fundamentals.priceToBook > 5) score -= 15
  }
  
  // Price to Sales analysis
  if (fundamentals.priceToSales) {
    if (fundamentals.priceToSales < 1) score += 15
    else if (fundamentals.priceToSales < 3) score += 5
    else if (fundamentals.priceToSales > 10) score -= 15
  }
  
  return Math.max(0, Math.min(100, score))
}

// Helper function to calculate growth score
function calculateGrowthScore(fundamentals: any): number {
  let score = 50
  
  // Revenue growth
  if (fundamentals.revenueGrowth) {
    if (fundamentals.revenueGrowth > 0.2) score += 25
    else if (fundamentals.revenueGrowth > 0.1) score += 15
    else if (fundamentals.revenueGrowth > 0.05) score += 5
    else if (fundamentals.revenueGrowth < 0) score -= 20
  }
  
  // Earnings growth
  if (fundamentals.earningsGrowth) {
    if (fundamentals.earningsGrowth > 0.15) score += 25
    else if (fundamentals.earningsGrowth > 0.1) score += 15
    else if (fundamentals.earningsGrowth > 0.05) score += 5
    else if (fundamentals.earningsGrowth < 0) score -= 20
  }
  
  return Math.max(0, Math.min(100, score))
}

// Helper function to calculate profitability score
function calculateProfitabilityScore(fundamentals: any): number {
  let score = 50
  
  // Profit margin
  if (fundamentals.profitMargin) {
    if (fundamentals.profitMargin > 0.2) score += 25
    else if (fundamentals.profitMargin > 0.1) score += 15
    else if (fundamentals.profitMargin > 0.05) score += 5
    else if (fundamentals.profitMargin < 0) score -= 25
  }
  
  // Return on equity
  if (fundamentals.returnOnEquity) {
    if (fundamentals.returnOnEquity > 0.15) score += 25
    else if (fundamentals.returnOnEquity > 0.1) score += 15
    else if (fundamentals.returnOnEquity > 0.05) score += 5
    else if (fundamentals.returnOnEquity < 0) score -= 25
  }
  
  return Math.max(0, Math.min(100, score))
}

// Helper function to calculate financial health score
function calculateFinancialHealthScore(fundamentals: any): number {
  let score = 50
  
  // Debt to equity
  if (fundamentals.debtToEquity) {
    if (fundamentals.debtToEquity < 0.3) score += 25
    else if (fundamentals.debtToEquity < 0.5) score += 15
    else if (fundamentals.debtToEquity < 1) score += 5
    else if (fundamentals.debtToEquity > 2) score -= 25
  }
  
  // Current ratio
  if (fundamentals.currentRatio) {
    if (fundamentals.currentRatio > 2) score += 25
    else if (fundamentals.currentRatio > 1.5) score += 15
    else if (fundamentals.currentRatio > 1) score += 5
    else if (fundamentals.currentRatio < 0.5) score -= 25
  }
  
  return Math.max(0, Math.min(100, score))
}

// Helper function to generate fundamental analysis
function generateFundamentalAnalysis(predictions: any, fundamentals: any) {
  // Strengths
  if (fundamentals.profitMargin > 0.15) {
    predictions.analysis.strengths.push('Strong profit margins')
  }
  if (fundamentals.revenueGrowth > 0.1) {
    predictions.analysis.strengths.push('High revenue growth')
  }
  if (fundamentals.debtToEquity < 0.5) {
    predictions.analysis.strengths.push('Low debt levels')
  }
  if (fundamentals.returnOnEquity > 0.15) {
    predictions.analysis.strengths.push('Strong return on equity')
  }
  
  // Weaknesses
  if (fundamentals.peRatio > 30) {
    predictions.analysis.weaknesses.push('High valuation multiples')
  }
  if (fundamentals.debtToEquity > 1) {
    predictions.analysis.weaknesses.push('High debt levels')
  }
  if (fundamentals.profitMargin < 0.05) {
    predictions.analysis.weaknesses.push('Low profitability')
  }
  
  // Recommendations
  if (predictions.scores.overallScore > 75) {
    predictions.analysis.recommendations.push('Strong fundamental profile - consider for long-term investment')
  } else if (predictions.scores.overallScore > 60) {
    predictions.analysis.recommendations.push('Good fundamentals - monitor for entry opportunities')
  } else if (predictions.scores.overallScore < 40) {
    predictions.analysis.recommendations.push('Weak fundamentals - exercise caution')
  }
}

// New function to get multi-source recommendations
export async function getMultiSourceRecommendations(symbol: string): Promise<any> {
  try {
    const recommendations = {
      symbol,
      timestamp: new Date().toISOString(),
      sources: {} as Record<string, any>
    }
    
    // StockTwits recommendations
    try {
      const stResponse = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`)
      if (stResponse.ok) {
        const stData = await stResponse.json()
        const messages = stData?.messages || []
        
        // Analyze recent messages for sentiment and recommendations
        const bullishMessages = messages.filter((m: any) => 
          m.entities?.sentiment?.basic === 'Bullish' && 
          m.body.toLowerCase().includes('buy') || 
          m.body.toLowerCase().includes('long') ||
          m.body.toLowerCase().includes('bullish')
        ).slice(0, 5)
        
        const bearishMessages = messages.filter((m: any) => 
          m.entities?.sentiment?.basic === 'Bearish' && 
          m.body.toLowerCase().includes('sell') || 
          m.body.toLowerCase().includes('short') ||
          m.body.toLowerCase().includes('bearish')
        ).slice(0, 5)
        
        recommendations.sources.stocktwits = {
          bullishCount: bullishMessages.length,
          bearishCount: bearishMessages.length,
          bullishMessages: bullishMessages.map((m: any) => ({
            text: m.body,
            author: m.user?.username,
            timestamp: m.created_at
          })),
          bearishMessages: bearishMessages.map((m: any) => ({
            text: m.body,
            author: m.user?.username,
            timestamp: m.created_at
          }))
        }
      }
    } catch (error) {
      console.log('StockTwits recommendations error:', error)
    }
    
    // Reddit recommendations (r/stocks, r/investing)
    try {
      const redditResponse = await fetch(`https://www.reddit.com/search.json?q=${symbol}&restrict_sr=on&sr=stocks+investing&t=week&limit=10`)
      if (redditResponse.ok) {
        const redditData = await redditResponse.json()
        const posts = redditData?.data?.children || []
        
        recommendations.sources.reddit = {
          posts: posts.map((post: any) => ({
            title: post.data.title,
            text: post.data.selftext,
            score: post.data.score,
            comments: post.data.num_comments,
            subreddit: post.data.subreddit,
            url: `https://reddit.com${post.data.permalink}`
          }))
        }
      }
    } catch (error) {
      console.log('Reddit recommendations error:', error)
    }
    
    // Seeking Alpha recommendations
    try {
      const saResponse = await fetch(`/api/news?q=${symbol}+seeking+alpha`)
      if (saResponse.ok) {
        const saData = await saResponse.json()
        const saArticles = saData.filter((item: any) => 
          item.url.includes('seekingalpha.com') && 
          item.title.toLowerCase().includes(symbol.toLowerCase())
        ).slice(0, 5)
        
        recommendations.sources.seekingAlpha = {
          articles: saArticles.map((item: any) => ({
            title: item.title,
            url: item.url,
            publishedAt: item.publishedAt
          }))
        }
      }
    } catch (error) {
      console.log('Seeking Alpha recommendations error:', error)
    }
    
    // Analyst recommendations from Yahoo Finance
    try {
      const analystResponse = await fetch(`/api/quote?symbols=${symbol}`)
      if (analystResponse.ok) {
        const analystData = await analystResponse.json()
        const quote = analystData?.quoteResponse?.result?.[0]
        
        if (quote) {
          recommendations.sources.analysts = {
            recommendation: quote.recommendationMean,
            targetPrice: quote.targetMeanPrice,
            targetHigh: quote.targetHighPrice,
            targetLow: quote.targetLowPrice,
            analystCount: quote.numberOfAnalystOpinions,
            upgrades: quote.numberOfAnalystOpinions, // Simplified for now
            downgrades: 0 // Would need additional API calls for detailed breakdown
          }
        }
      }
    } catch (error) {
      console.log('Analyst recommendations error:', error)
    }
    
    return recommendations
  } catch (error) {
    console.log('Error fetching multi-source recommendations:', error)
    return null
  }
}

// Enhanced search with time-based filtering and user-controlled timeframe
export async function searchFinanceContexts(userQuery: string, timeFrame: string = '24h'): Promise<NewsItem[]> {
  const tickers = extractTickersFromQuery(userQuery)
  const query = userQuery.toLowerCase()
  
  // Parse time frame
  const timeConfig = parseTimeFrame(timeFrame)
  
  // Detect query type for better source selection
  const isTickerQuery = tickers.length > 0
  const isFedQuery = query.includes('powell') || query.includes('fed') || query.includes('fomc') || query.includes('federal reserve')
  const isEarningsQuery = query.includes('earnings') || query.includes('quarterly') || query.includes('results')
  const isMarketQuery = query.includes('market') || query.includes('sector') || query.includes('trend')
  const isEconomicQuery = query.includes('inflation') || query.includes('cpi') || query.includes('jobs') || query.includes('employment')
  const isAnalystQuery = query.includes('analyst') || query.includes('rating') || query.includes('target') || query.includes('sentiment')
  const isPredictionQuery = query.includes('predict') || query.includes('forecast') || query.includes('trend') || query.includes('movement')
  const isFundamentalQuery = query.includes('fundamental') || query.includes('valuation') || query.includes('pe ratio') || query.includes('financial')
  const isComparisonQuery = query.includes('compare') || query.includes('vs') || query.includes('versus') || query.includes('against')
  const isRecommendationQuery = query.includes('recommend') || query.includes('should i buy') || query.includes('investment advice')
  
  const searches: Promise<NewsItem[]>[] = []
  
  if (isTickerQuery) {
    // For specific tickers, get comprehensive data
    for (const ticker of tickers.slice(0, 3)) {
      searches.push(yahooFinanceNews(ticker))
      searches.push(stocktwitsSymbol(ticker))
      searches.push(googleNewsSearch(`${ticker} stock news ${timeConfig.googleTimeFilter}`))
      
      // Add fundamental-specific searches
      if (isFundamentalQuery) {
        searches.push(googleNewsSearch(`${ticker} fundamental analysis valuation ${timeConfig.googleTimeFilter}`))
        searches.push(googleNewsSearch(`${ticker} financial ratios pe ratio ${timeConfig.googleTimeFilter}`))
      }
      
      // Add comparison-specific searches
      if (isComparisonQuery) {
        searches.push(googleNewsSearch(`${ticker} vs comparison analysis ${timeConfig.googleTimeFilter}`))
        searches.push(googleNewsSearch(`${ticker} competitor analysis ${timeConfig.googleTimeFilter}`))
      }
      
      // Add recommendation-specific searches
      if (isRecommendationQuery) {
        searches.push(googleNewsSearch(`${ticker} buy sell recommendation ${timeConfig.googleTimeFilter}`))
        searches.push(googleNewsSearch(`${ticker} investment advice ${timeConfig.googleTimeFilter}`))
      }
      
      // Add analyst and prediction specific searches
      if (isAnalystQuery || isPredictionQuery) {
        searches.push(googleNewsSearch(`${ticker} analyst rating target price ${timeConfig.googleTimeFilter}`))
        searches.push(googleNewsSearch(`${ticker} stock prediction forecast ${timeConfig.googleTimeFilter}`))
      }
    }
  } else if (isFedQuery) {
    // For Fed-related queries, focus on financial news
    searches.push(googleNewsSearch(`Federal Reserve Powell speech ${timeConfig.googleTimeFilter}`))
    searches.push(googleNewsSearch(`FOMC meeting ${timeConfig.googleTimeFilter}`))
    searches.push(cnbcTop())
  } else if (isEarningsQuery) {
    // For earnings queries
    searches.push(googleNewsSearch(`earnings results ${timeConfig.googleTimeFilter}`))
    searches.push(yahooFinanceNews('^GSPC')) // S&P 500 for market context
  } else if (isMarketQuery) {
    // For market queries
    searches.push(googleNewsSearch(`stock market today ${timeConfig.googleTimeFilter}`))
    searches.push(cnbcTop())
    searches.push(yahooFinanceNews('^GSPC'))
  } else if (isEconomicQuery) {
    // For economic data
    searches.push(googleNewsSearch(`inflation CPI jobs economic data ${timeConfig.googleTimeFilter}`))
    searches.push(googleNewsSearch(`Federal Reserve economic ${timeConfig.googleTimeFilter}`))
  } else if (isAnalystQuery) {
    // For analyst queries
    searches.push(googleNewsSearch(`analyst ratings stock recommendations ${timeConfig.googleTimeFilter}`))
    searches.push(googleNewsSearch(`target price upgrades downgrades ${timeConfig.googleTimeFilter}`))
  } else if (isPredictionQuery) {
    // For prediction queries
    searches.push(googleNewsSearch(`stock market prediction forecast ${timeConfig.googleTimeFilter}`))
    searches.push(googleNewsSearch(`technical analysis trends ${timeConfig.googleTimeFilter}`))
  } else if (isFundamentalQuery) {
    // For fundamental queries
    searches.push(googleNewsSearch(`fundamental analysis stock valuation ${timeConfig.googleTimeFilter}`))
    searches.push(googleNewsSearch(`financial ratios pe ratio analysis ${timeConfig.googleTimeFilter}`))
  } else if (isComparisonQuery) {
    // For comparison queries
    searches.push(googleNewsSearch(`stock comparison analysis ${timeConfig.googleTimeFilter}`))
    searches.push(googleNewsSearch(`investment comparison ${timeConfig.googleTimeFilter}`))
  } else if (isRecommendationQuery) {
    // For recommendation queries
    searches.push(googleNewsSearch(`stock recommendations buy sell ${timeConfig.googleTimeFilter}`))
    searches.push(googleNewsSearch(`investment advice ${timeConfig.googleTimeFilter}`))
  } else {
    // General finance query
    const preferredSites = ['reuters.com', 'cnbc.com', 'finance.yahoo.com', 'bloomberg.com']
    const siteFilter = preferredSites.map((s) => `site:${s}`).join(' OR ')
    const gQuery = `${userQuery} finance ${timeConfig.googleTimeFilter} (${siteFilter})`
    searches.push(googleNewsSearch(gQuery))
    searches.push(cnbcTop())
  }

  // Execute searches with timeout
  const results = await Promise.allSettled(searches)
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter(Boolean)

  // Filter items by time frame
  const filteredItems = filterItemsByTimeFrame(items, timeConfig)
  
  const unique = dedupeByUrl(filteredItems)
  const ranked = unique
    .map((n) => ({ news: n, score: enhancedScoreNews(n, userQuery, tickers, isTickerQuery, isFedQuery, isAnalystQuery, isPredictionQuery, isFundamentalQuery, isComparisonQuery, isRecommendationQuery, timeConfig) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.news)

  return ranked.slice(0, 12) // Increased for better coverage
}

function dedupeByUrl(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    if (!it?.url) continue
    if (seen.has(it.url)) continue
    seen.add(it.url)
    out.push(it)
  }
  return out
}

// Enhanced scoring with time-based relevance
function enhancedScoreNews(
  item: NewsItem, 
  userQuery: string, 
  tickers: string[], 
  isTickerQuery: boolean,
  isFedQuery: boolean,
  isAnalystQuery: boolean,
  isPredictionQuery: boolean,
  isFundamentalQuery: boolean,
  isComparisonQuery: boolean,
  isRecommendationQuery: boolean,
  timeConfig: any
): number {
  let score = 0
  const title = (item.title || '').toUpperCase()
  const query = userQuery.toUpperCase()
  
  // Ticker-specific scoring
  for (const t of tickers) {
    if (title.includes(t)) score += 5
  }
  
  // Query-specific scoring
  if (isTickerQuery && /STOCK|SHARE|PRICE|TRADING|VOLUME/i.test(title)) score += 3
  if (isFedQuery && /FED|FEDERAL|POWELL|FOMC|RATE|INTEREST/i.test(title)) score += 4
  if (query.includes('EARNINGS') && /EARNINGS|QUARTERLY|RESULTS|REVENUE|PROFIT/i.test(title)) score += 3
  if (query.includes('MARKET') && /MARKET|SECTOR|INDEX|TREND/i.test(title)) score += 2
  if (query.includes('INFLATION') && /INFLATION|CPI|PRICE|ECONOMIC/i.test(title)) score += 3
  
  // Analyst and prediction specific scoring
  if (isAnalystQuery && /ANALYST|RATING|TARGET|UPGRADE|DOWNGRADE|RECOMMENDATION/i.test(title)) score += 4
  if (isPredictionQuery && /PREDICT|FORECAST|TREND|MOVEMENT|TECHNICAL|PATTERN/i.test(title)) score += 4
  if (isAnalystQuery && /SENTIMENT|BULLISH|BEARISH|OUTLOOK/i.test(title)) score += 3
  
  // Fundamental analysis scoring
  if (isFundamentalQuery && /FUNDAMENTAL|VALUATION|RATIO|PE|PB|PS|FINANCIAL/i.test(title)) score += 4
  if (isFundamentalQuery && /BALANCE|INCOME|CASH|DEBT|EQUITY|MARGIN/i.test(title)) score += 3
  
  // Comparison scoring
  if (isComparisonQuery && /COMPARE|VS|VERSUS|AGAINST|COMPETITOR/i.test(title)) score += 4
  if (isComparisonQuery && /BETTER|WORSE|STRONGER|WEAKER/i.test(title)) score += 3
  
  // Recommendation scoring
  if (isRecommendationQuery && /RECOMMEND|BUY|SELL|HOLD|ADVICE/i.test(title)) score += 4
  if (isRecommendationQuery && /SHOULD|OPINION|VIEW|OUTLOOK/i.test(title)) score += 3
  
  // Enhanced time-based scoring
  const ts = item.publishedAt ? Date.parse(item.publishedAt) : NaN
  if (!Number.isNaN(ts)) {
    const now = Date.now()
    const ageMs = now - ts
    const ageHours = ageMs / (1000 * 60 * 60)
    
    // Higher score for more recent items within the time frame
    if (ageHours <= 1) score += 8 // Very recent (last hour)
    else if (ageHours <= 6) score += 6 // Recent (last 6 hours)
    else if (ageHours <= 12) score += 4 // Recent (last 12 hours)
    else if (ageHours <= 24) score += 2 // Within 24 hours
    else if (ageHours <= timeConfig.maxAgeHours) score += 1 // Within time frame
    else score -= 5 // Outside time frame - penalize
  }
  
  // Source preference
  const preferredSources = ['reuters.com', 'cnbc.com', 'finance.yahoo.com', 'bloomberg.com', 'marketwatch.com']
  if (preferredSources.some((s) => item.url.includes(s))) score += 2
  
  return score
}

// Helper function to parse time frame
function parseTimeFrame(timeFrame: string): { 
  googleTimeFilter: string, 
  maxAgeHours: number, 
  description: string,
  allowExtension: boolean 
} {
  switch (timeFrame.toLowerCase()) {
    case '1h':
    case '1 hour':
      return { googleTimeFilter: 'when:1h', maxAgeHours: 1, description: 'last hour', allowExtension: true }
    case '6h':
    case '6 hours':
      return { googleTimeFilter: 'when:6h', maxAgeHours: 6, description: 'last 6 hours', allowExtension: true }
    case '12h':
    case '12 hours':
      return { googleTimeFilter: 'when:12h', maxAgeHours: 12, description: 'last 12 hours', allowExtension: true }
    case '24h':
    case '24 hours':
    case '1d':
    case '1 day':
    default:
      return { googleTimeFilter: 'when:1d', maxAgeHours: 24, description: 'last 24 hours', allowExtension: true }
    case '3d':
    case '3 days':
      return { googleTimeFilter: 'when:3d', maxAgeHours: 72, description: 'last 3 days', allowExtension: true }
    case '1w':
    case '1 week':
      return { googleTimeFilter: 'when:1w', maxAgeHours: 168, description: 'last week', allowExtension: true }
    case '1m':
    case '1 month':
      return { googleTimeFilter: 'when:1m', maxAgeHours: 720, description: 'last month', allowExtension: false }
  }
}

// Helper function to filter items by time frame
function filterItemsByTimeFrame(items: NewsItem[], timeConfig: any): NewsItem[] {
  const now = Date.now()
  const maxAgeMs = timeConfig.maxAgeHours * 60 * 60 * 1000
  
  return items.filter(item => {
    if (!item.publishedAt) return true // Keep items without dates for now
    
    try {
      const itemDate = new Date(item.publishedAt).getTime()
      const ageMs = now - itemDate
      return ageMs <= maxAgeMs
    } catch {
      return true // Keep items with invalid dates
    }
  })
}

// New function to check if we have recent data and suggest time extension
export function checkDataRecency(items: NewsItem[], timeConfig: any): { 
  hasRecentData: boolean, 
  suggestion: string, 
  availableTimeFrames: string[] 
} {
  const now = Date.now()
  const maxAgeMs = timeConfig.maxAgeHours * 60 * 60 * 1000
  
  const recentItems = items.filter(item => {
    if (!item.publishedAt) return false
    try {
      const itemDate = new Date(item.publishedAt).getTime()
      const ageMs = now - itemDate
      return ageMs <= maxAgeMs
    } catch {
      return false
    }
  })
  
  const hasRecentData = recentItems.length > 0
  
  let suggestion = ''
  if (!hasRecentData) {
    suggestion = `No recent information found in the ${timeConfig.description}. `
    if (timeConfig.allowExtension) {
      suggestion += `Would you like me to search for older information? Available time frames: 1 hour, 6 hours, 12 hours, 24 hours, 3 days, 1 week, 1 month.`
    } else {
      suggestion += `This is the maximum search timeframe available.`
    }
  }
  
  const availableTimeFrames = timeConfig.allowExtension ? 
    ['1h', '6h', '12h', '24h', '3d', '1w', '1m'] : 
    [timeConfig.description]
  
  return { hasRecentData, suggestion, availableTimeFrames }
}

export async function fetchArticleText(url: string): Promise<string> {
  // Use Jina reader for robust readability with CORS bypass
  const reader = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
  const txt = await fetchText(reader)
  return txt.slice(0, 4000) // Reduced context size for faster processing
}


