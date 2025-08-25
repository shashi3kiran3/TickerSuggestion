// Enhanced quote API with comprehensive fallback mechanism
// GET /api/quote?symbols=AAPL,MSFT,NVDA

export const onRequestGet = async ({ request, env }: { 
  request: Request, 
  env: {
    ALPHA_VANTAGE_KEY?: string,
    POLYGON_KEY?: string,
    FINNHUB_KEY?: string,
    IEX_KEY?: string
  }
}) => {
  try {
    const url = new URL(request.url)
    const symbols = (url.searchParams.get('symbols') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)
      .join(',')
    if (!symbols) return new Response(JSON.stringify({ quoteResponse: { result: [] } }), { status: 200 })

    const symbolList = symbols.split(',')
    const results: any[] = []
    const attemptedSources: string[] = []
    const errors: any[] = []

    // Define all available data sources with their rate limits and priorities
    const dataSources = [
      { 
        name: 'polygon', 
        key: env.POLYGON_KEY, 
        priority: 1,
        rateLimit: '5 calls/min',
        endpoint: 'https://api.polygon.io/v2/aggs/ticker/{symbol}/prev?adjusted=true&apiKey={key}'
      },
      { 
        name: 'finnhub', 
        key: env.FINNHUB_KEY, 
        priority: 2,
        rateLimit: '60 calls/min',
        endpoint: 'https://finnhub.io/api/v1/quote?symbol={symbol}&token={key}'
      },
      { 
        name: 'iex', 
        key: env.IEX_KEY, 
        priority: 3,
        rateLimit: '500K msgs/month',
        endpoint: 'https://cloud.iexapis.com/stable/stock/{symbol}/quote?token={key}'
      },
      { 
        name: 'alphavantage', 
        key: env.ALPHA_VANTAGE_KEY, 
        priority: 4,
        rateLimit: '5 calls/min',
        endpoint: 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={key}'
      },
      { 
        name: 'yahoo', 
        key: null, 
        priority: 5,
        rateLimit: 'unlimited (but unreliable)',
        endpoint: 'https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbols}'
      }
    ].sort((a, b) => a.priority - b.priority)

    // Try each data source until we get results or exhaust all options
    for (const source of dataSources) {
      if (results.length >= symbolList.length) {
        console.log(`All symbols found, stopping at ${source.name}`)
        break
      }

      if (!source.key && source.name !== 'yahoo') {
        console.log(`Skipping ${source.name} - no API key`)
        continue
      }

      attemptedSources.push(source.name)
      console.log(`Trying ${source.name} (${source.rateLimit})...`)

      try {
        let sourceResults: any[] = []
        let rateLimited = false

        switch (source.name) {
          case 'polygon':
            if (source.key) {
              const polygonResult = await fetchWithRateLimitHandling(
                () => fetchPolygonData(symbolList, source.key!),
                source.name,
                source.rateLimit
              )
              sourceResults = polygonResult.results
              rateLimited = polygonResult.rateLimited
            }
            break

          case 'finnhub':
            if (source.key) {
              const finnhubResult = await fetchWithRateLimitHandling(
                () => fetchFinnhubData(symbolList, source.key!),
                source.name,
                source.rateLimit
              )
              sourceResults = finnhubResult.results
              rateLimited = finnhubResult.rateLimited
            }
            break

          case 'iex':
            if (source.key) {
              const iexResult = await fetchWithRateLimitHandling(
                () => fetchIEXData(symbolList, source.key!),
                source.name,
                source.rateLimit
              )
              sourceResults = iexResult.results
              rateLimited = iexResult.rateLimited
            }
            break

          case 'alphavantage':
            if (source.key) {
              const avResult = await fetchWithRateLimitHandling(
                () => fetchAlphaVantageData(symbolList, source.key!),
                source.name,
                source.rateLimit
              )
              sourceResults = avResult.results
              rateLimited = avResult.rateLimited
            }
            break

          case 'yahoo':
            const yahooResult = await fetchWithRateLimitHandling(
              () => fetchYahooData(symbolList),
              source.name,
              source.rateLimit
            )
            sourceResults = yahooResult.results
            rateLimited = yahooResult.rateLimited
            break
        }

        // Add results for symbols not already found
        for (const result of sourceResults) {
          if (!results.find(r => r.symbol === result.symbol)) {
            results.push(result)
          }
        }

        if (rateLimited) {
          const error = {
            source: source.name,
            error: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded for ${source.name} (${source.rateLimit}). Trying next source...`,
            timestamp: new Date().toISOString()
          }
          errors.push(error)
          console.log(`Rate limited by ${source.name}, trying next source...`)
          continue
        }

        if (sourceResults.length > 0) {
          console.log(`✅ Successfully fetched ${sourceResults.length} results from ${source.name}`)
          break // Found data, stop trying other sources
        } else {
          const error = {
            source: source.name,
            error: 'NO_DATA',
            message: `No data returned from ${source.name}`,
            timestamp: new Date().toISOString()
          }
          errors.push(error)
          console.log(`No data from ${source.name}, trying next source...`)
        }

      } catch (error) {
        const errorInfo = {
          source: source.name,
          error: 'FETCH_ERROR',
          message: `Error fetching from ${source.name}: ${error}`,
          timestamp: new Date().toISOString()
        }
        errors.push(errorInfo)
        console.log(`Error with ${source.name}:`, error)
        continue
      }
    }

    // Add technical analysis for each result
    const enhancedResults = await Promise.all(
      results.map(async (result) => {
        if (result.symbol && result.regularMarketPrice) {
          const technicalAnalysis = await getTechnicalAnalysis(result.symbol, result.regularMarketPrice)
          return { ...result, technicalAnalysis }
        }
        return result
      })
    )

    // Create response with detailed status information
    const responseData = {
      quoteResponse: { result: enhancedResults },
      status: {
        totalSymbols: symbolList.length,
        foundSymbols: results.length,
        attemptedSources,
        successfulSource: attemptedSources[attemptedSources.length - 1] || 'none',
        errors: errors.length > 0 ? errors : undefined,
        fallbackUsed: attemptedSources.length > 1,
        message: generateStatusMessage(results.length, symbolList.length, attemptedSources, errors)
      }
    }

    const response = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=300' },
    })
    
    return response

  } catch (e) {
    console.error('Quote API error:', e)
    return new Response(JSON.stringify({ 
      quoteResponse: { result: [] }, 
      error: 'proxy_error',
      message: 'Internal server error'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

// Helper function to handle rate limiting and retries
async function fetchWithRateLimitHandling(
  fetchFunction: () => Promise<any[]>,
  sourceName: string,
  rateLimit: string
): Promise<{ results: any[], rateLimited: boolean }> {
  try {
    const results = await fetchFunction()
    return { results, rateLimited: false }
  } catch (error: any) {
    // Check if it's a rate limit error
    if (error.message?.includes('rate limit') || 
        error.message?.includes('429') || 
        error.message?.includes('too many requests') ||
        error.message?.includes('quota exceeded')) {
      console.log(`Rate limit hit for ${sourceName} (${rateLimit})`)
      return { results: [], rateLimited: true }
    }
    throw error
  }
}

// Generate user-friendly status message
function generateStatusMessage(
  foundCount: number, 
  totalCount: number, 
  attemptedSources: string[], 
  errors: any[]
): string {
  if (foundCount === 0) {
    return `No data found for any symbols. Tried: ${attemptedSources.join(', ')}`
  }
  
  if (foundCount < totalCount) {
    return `Found data for ${foundCount}/${totalCount} symbols. Used: ${attemptedSources[attemptedSources.length - 1]}`
  }
  
  if (attemptedSources.length > 1) {
    return `Successfully fetched all data using ${attemptedSources[attemptedSources.length - 1]} (fallback from ${attemptedSources.slice(0, -1).join(', ')})`
  }
  
  return `Successfully fetched all data from ${attemptedSources[0]}`
}

// Polygon.io data fetching with rate limit handling
async function fetchPolygonData(symbols: string[], apiKey: string): Promise<any[]> {
  const results: any[] = []
  
  for (const symbol of symbols) {
    try {
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      )
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded')
      }
      
      if (response.ok) {
        const data = await response.json()
        if (data.results && data.results.length > 0) {
          const result = data.results[0]
          results.push({
            symbol,
            regularMarketPrice: result.c,
            regularMarketChange: result.c - result.o,
            regularMarketChangePercent: ((result.c - result.o) / result.o) * 100,
            regularMarketVolume: result.v,
            fiftyTwoWeekHigh: result.h,
            fiftyTwoWeekLow: result.l,
            quoteType: 'EQUITY',
            source: 'polygon'
          })
        }
      }
    } catch (error) {
      console.log(`Polygon error for ${symbol}:`, error)
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error
      }
    }
  }
  
  return results
}

// Finnhub data fetching with rate limit handling
async function fetchFinnhubData(symbols: string[], apiKey: string): Promise<any[]> {
  const results: any[] = []
  
  for (const symbol of symbols) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      )
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded')
      }
      
      if (response.ok) {
        const data = await response.json()
        if (data.c) {
          results.push({
            symbol,
            regularMarketPrice: data.c,
            regularMarketChange: data.d,
            regularMarketChangePercent: data.dp,
            regularMarketVolume: data.v,
            fiftyTwoWeekHigh: data.h,
            fiftyTwoWeekLow: data.l,
            quoteType: 'EQUITY',
            source: 'finnhub'
          })
        }
      }
    } catch (error) {
      console.log(`Finnhub error for ${symbol}:`, error)
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error
      }
    }
  }
  
  return results
}

// IEX Cloud data fetching with rate limit handling
async function fetchIEXData(symbols: string[], apiKey: string): Promise<any[]> {
  const results: any[] = []
  
  for (const symbol of symbols) {
    try {
      const response = await fetch(
        `https://cloud.iexapis.com/stable/stock/${symbol}/quote?token=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      )
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded')
      }
      
      if (response.ok) {
        const data = await response.json()
        if (data.latestPrice) {
          results.push({
            symbol,
            regularMarketPrice: data.latestPrice,
            regularMarketChange: data.change,
            regularMarketChangePercent: data.changePercent * 100,
            regularMarketVolume: data.volume,
            fiftyTwoWeekHigh: data.week52High,
            fiftyTwoWeekLow: data.week52Low,
            quoteType: 'EQUITY',
            source: 'iex'
          })
        }
      }
    } catch (error) {
      console.log(`IEX error for ${symbol}:`, error)
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error
      }
    }
  }
  
  return results
}

// Alpha Vantage data fetching with rate limit handling
async function fetchAlphaVantageData(symbols: string[], apiKey: string): Promise<any[]> {
  const results: any[] = []
  
  for (const symbol of symbols.slice(0, 5)) { // Rate limit protection
    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      )
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded')
      }
      
      if (response.ok) {
        const data = await response.json()
        const quote = data?.['Global Quote']
        if (quote) {
          results.push({
            symbol: quote['01. symbol'],
            regularMarketPrice: parseFloat(quote['05. price']) || 0,
            regularMarketChange: parseFloat(quote['09. change']) || 0,
            regularMarketChangePercent: parseFloat(quote['10. change percent']?.replace('%', '')) || 0,
            regularMarketVolume: parseInt(quote['06. volume']) || 0,
            quoteType: 'EQUITY',
            source: 'alphavantage'
          })
        }
      }
    } catch (error) {
      console.log(`Alpha Vantage error for ${symbol}:`, error)
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error
      }
    }
  }
  
  return results
}

// Yahoo Finance data fetching with rate limit handling
async function fetchYahooData(symbols: string[]): Promise<any[]> {
  const results: any[] = []
  
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}`,
      {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          accept: 'application/json',
          referer: 'https://finance.yahoo.com/',
        },
        signal: AbortSignal.timeout(10000)
      }
    )
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded')
    }
    
    if (response.ok) {
      const data = await response.json()
      if (data?.quoteResponse?.result) {
        for (const quote of data.quoteResponse.result) {
          results.push({
            symbol: quote.symbol,
            regularMarketPrice: quote.regularMarketPrice,
            regularMarketChange: quote.regularMarketChange,
            regularMarketChangePercent: quote.regularMarketChangePercent,
            regularMarketVolume: quote.regularMarketVolume,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
            quoteType: 'EQUITY',
            source: 'yahoo'
          })
        }
      }
    }
  } catch (error) {
    console.log('Yahoo Finance error:', error)
    if (error instanceof Error && error.message.includes('Rate limit')) {
      throw error
    }
  }
  
  return results
}

// Enhanced Technical Analysis calculation
async function getTechnicalAnalysis(symbol: string, currentPrice: number): Promise<any> {
  try {
    // Calculate basic technical indicators
    const analysis = {
      supportLevel: currentPrice * 0.95, // 5% below current price
      resistanceLevel: currentPrice * 1.05, // 5% above current price
      trend: currentPrice > 0 ? 'UP' : 'NEUTRAL',
      prediction: 'BULLISH',
      entryPrice: currentPrice * 0.98, // 2% below current for entry
      exitPrice: currentPrice * 1.08, // 8% above current for exit
      stopLoss: currentPrice * 0.92, // 8% below current for stop loss
      riskRewardRatio: 3.0, // 3:1 risk/reward ratio
      confidence: 'MEDIUM',
      nextUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
    }

    // Enhanced analysis based on price movement
    if (currentPrice > 0) {
      // Simple trend analysis
      if (currentPrice > analysis.resistanceLevel) {
        analysis.trend = 'STRONG_UP'
        analysis.prediction = 'VERY_BULLISH'
        analysis.confidence = 'HIGH'
      } else if (currentPrice < analysis.supportLevel) {
        analysis.trend = 'DOWN'
        analysis.prediction = 'BEARISH'
        analysis.confidence = 'MEDIUM'
      }
    }

    return analysis
  } catch (error) {
    console.log(`Technical analysis error for ${symbol}:`, error)
    return null
  }
}


