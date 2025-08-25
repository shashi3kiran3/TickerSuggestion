import React, { useState, useRef, useEffect } from 'react'
import { askOpenAI } from '../services/openai'

type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
  incrementalData?: {
    stockData?: any
    analystData?: any
    trendsData?: any
    sentimentData?: any
    newsContext?: any[] | null
  }
}

export default function AskAI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your financial advisor and market analyst. I can help you understand stocks, markets, and financial news. What would you like to know about today?',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [_isEnhancing, setIsEnhancing] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // Create initial loading message
    const loadingMessage: Message = {
      role: 'assistant',
      content: 'Analyzing your request...',
      timestamp: new Date(),
      isLoading: true,
      incrementalData: {}
    }

    setMessages(prev => [...prev, loadingMessage])

    // Create abort controller for this request
    const controller = new AbortController()
    setAbortController(controller)

    try {
      // Start progressive data loading
      await loadDataProgressively(inputValue, controller)
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        console.log('Request was aborted')
      } else {
        console.error('Error:', error)
        setMessages(prev => prev.map(msg => 
          msg.isLoading ? {
            ...msg,
            content: 'Sorry, I encountered an error while processing your request. Please try again.',
            isLoading: false
          } : msg
        ))
      }
    } finally {
      setIsLoading(false)
      setAbortController(null)
    }
  }

  const loadDataProgressively = async (query: string, controller: AbortController, timeFrame: string = '24h') => {
    const { extractTickersFromQuery, getAnalystData, getHistoricalTrends, getMarketSentiment } = await import('../services/financeSearch')
    const tickers = extractTickersFromQuery(query)
    
    // Step 1: Show that we're gathering data
    updateLoadingMessage(`Gathering market data and news from the last ${timeFrame === '24h' ? '24 hours' : timeFrame}...`, {})
    
    // Step 2: Load stock quotes first (fastest)
    let stockData = null
    if (tickers.length > 0) {
      try {
        updateLoadingMessage(`Fetching real-time data for ${tickers.join(', ')}...`, {})
        const response = await fetch(`/api/quote?symbols=${tickers.join(',')}`)
        if (response.ok && !controller.signal.aborted) {
          const data = await response.json()
          if (data?.quoteResponse?.result) {
            stockData = {} as Record<string, any>
            const validSymbols = []
            const invalidSymbols = []
            
            for (const quote of data.quoteResponse.result) {
              if (quote.error) {
                // Handle invalid/delisted symbols
                invalidSymbols.push(quote.symbol)
                stockData[quote.symbol] = {
                  price: 0,
                  change: 0,
                  changePercent: 0,
                  volume: 0,
                  high52w: 0,
                  low52w: 0,
                  error: quote.error
                }
              } else {
                // Handle valid symbols
                validSymbols.push(quote.symbol)
                stockData[quote.symbol] = {
                  price: quote.regularMarketPrice,
                  change: quote.regularMarketChange,
                  changePercent: quote.regularMarketChangePercent,
                  volume: quote.regularMarketVolume,
                  high52w: quote.fiftyTwoWeekHigh,
                  low52w: quote.fiftyTwoWeekLow
                }
              }
            }
            
            // Show appropriate message based on data source and validity
            let message = 'Real-time data loaded. Analyzing trends...'
            if (data.status?.fallbackUsed) {
              message = `Data loaded via fallback (${data.status.attemptedSources.join(' → ')}). Analyzing trends...`
            } else if (data.status?.successfulSource) {
              message = `Data loaded from ${data.status.successfulSource}. Analyzing trends...`
            }
            if (invalidSymbols.length > 0) {
              message += ` Note: ${invalidSymbols.join(', ')} may be invalid or delisted.`
            }
            
            updateLoadingMessage(message, { stockData, status: data.status })
          }
        }
      } catch (error) {
        console.log('Error fetching stock data:', error)
      }
    }

    // Step 3: Start AI response generation immediately with available data
    if (!controller.signal.aborted) {
      try {
        updateLoadingMessage('Generating initial analysis...', { stockData })
        
        const conversationHistory = messages
          .filter(msg => !msg.isLoading)
          .slice(-10)
          .map(msg => ({ role: msg.role, content: msg.content }))

        // Start AI response with just stock data
        const initialResponse = await askOpenAI(query, conversationHistory, { 
          signal: controller.signal,
          timeoutMs: 8000 // Shorter timeout for initial response
        })

        if (!controller.signal.aborted && initialResponse) {
          // Replace loading message with initial AI response
          setMessages(prev => prev.map(msg => 
            msg.isLoading ? {
              ...msg,
              isLoading: false,
              content: initialResponse,
              incrementalData: { stockData }
            } : msg
          ))
        }
      } catch (error) {
        console.log('Error generating initial response:', error)
      }
    }

    // Step 4: Load additional data in parallel and update response incrementally
    let analystData: any = null
    let trendsData: any = null
    let sentimentData: any = null
    let newsContext: any = null

    if (tickers.length > 0 && !controller.signal.aborted) {
      try {
        // Load all additional data in parallel
        const [analyst, trends, sentiment, news] = await Promise.allSettled([
          getAnalystData(tickers[0]),
          getHistoricalTrends(tickers[0]),
          getMarketSentiment(tickers[0]),
          (async () => {
            const { searchFinanceContexts } = await import('../services/financeSearch')
            return searchFinanceContexts(query, timeFrame)
          })()
        ])

        if (!controller.signal.aborted) {
          analystData = analyst.status === 'fulfilled' ? analyst.value : null
          trendsData = trends.status === 'fulfilled' ? trends.value : null
          sentimentData = sentiment.status === 'fulfilled' ? sentiment.value : null
          newsContext = news.status === 'fulfilled' ? news.value : null

          // Update the message with enhanced data
          setMessages(prev => prev.map(msg => 
            !msg.isLoading && msg.role === 'assistant' ? {
              ...msg,
              incrementalData: { 
                stockData, 
                analystData, 
                trendsData, 
                sentimentData, 
                newsContext 
              }
            } : msg
          ))

          // Show enhancing indicator
          setIsEnhancing(true)

          // Generate enhanced response with all data
          if (!controller.signal.aborted) {
            try {
              const conversationHistory = messages
                .filter(msg => !msg.isLoading)
                .slice(-10)
                .map(msg => ({ role: msg.role, content: msg.content }))

              const enhancedResponse = await askOpenAI(query, conversationHistory, { 
                signal: controller.signal,
                timeoutMs: 12000,
                enhancedData: { analystData, trendsData, sentimentData, newsContext }
              })

              if (!controller.signal.aborted && enhancedResponse) {
                setMessages(prev => prev.map(msg => 
                  !msg.isLoading && msg.role === 'assistant' ? {
                    ...msg,
                    content: enhancedResponse
                  } : msg
                ))
              }
            } catch (error) {
              console.log('Error generating enhanced response:', error)
            } finally {
              setIsEnhancing(false)
            }
          }
        }
      } catch (error) {
        console.log('Error fetching enhanced data:', error)
      }
    }
  }

  const updateLoadingMessage = (content: string, incrementalData: any) => {
    setMessages(prev => prev.map(msg => 
      msg.isLoading ? {
        ...msg,
        content,
        incrementalData
      } : msg
    ))
  }

  const handleStop = () => {
    if (abortController) {
      abortController.abort()
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? {
          ...msg,
          content: 'Analysis stopped. Here\'s what I found so far:',
          isLoading: false
        } : msg
      ))
    }
    setIsLoading(false)
    setAbortController(null)
  }

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation cleared. How can I help you with your financial questions today?',
        timestamp: new Date()
      }
    ])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderIncrementalData = (data: any) => {
    if (!data) return null

    return (
      <div className="mt-3 p-3 bg-gray-800/60 rounded-lg border-l-4 border-blue-500">
        {data.stockData && Object.keys(data.stockData).length > 0 && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-gray-200 mb-2">📊 Real-time Data</h4>
            {Object.entries(data.stockData).map(([symbol, quote]: [string, any]) => (
              <div key={symbol} className="text-sm text-gray-300">
                <span className="font-medium">{symbol}:</span>
                {quote.error ? (
                  <span className="text-red-400 ml-1">❌ {quote.error}</span>
                ) : (
                  <>
                    ${quote.price?.toFixed(2) || 'N/A'} 
                    <span className={quote.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent?.toFixed(2) || 'N/A'}%)
                    </span>
                    {quote.source && (
                      <span className="text-xs text-gray-500 ml-1">({quote.source})</span>
                    )}
                  </>
                )}
              </div>
            ))}
            
            {/* Show data source status */}
            {data.status && (
              <div className="mt-2 p-2 bg-gray-800/40 rounded text-xs">
                <div className="text-gray-400 mb-1">
                  <span className="font-medium">Data Source:</span> {data.status.successfulSource}
                  {data.status.fallbackUsed && (
                    <span className="text-yellow-400 ml-1">(fallback used)</span>
                  )}
                </div>
                <div className="text-gray-500">
                  {data.status.foundSymbols}/{data.status.totalSymbols} symbols found
                  {data.status.attemptedSources.length > 1 && (
                    <span className="ml-1">• Tried: {data.status.attemptedSources.join(' → ')}</span>
                  )}
                </div>
                {data.status.errors && data.status.errors.length > 0 && (
                  <div className="text-red-400 mt-1">
                    ⚠️ {data.status.errors.length} source(s) had issues
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {data.stockData && Object.keys(data.stockData).length > 0 && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-gray-200 mb-2">📈 Technical Analysis</h4>
            {Object.entries(data.stockData).map(([symbol, quote]: [string, any]) => {
              if (quote.error || !quote.technicalAnalysis) return null
              
              const ta = quote.technicalAnalysis
              return (
                <div key={symbol} className="text-sm text-gray-300 mb-2">
                  <div className="font-medium">{symbol} Analysis:</div>
                  <div className="ml-2 space-y-1">
                    <div>Trend: <span className={ta.trend === 'UP' || ta.trend === 'STRONG_UP' ? 'text-green-400' : 'text-red-400'}>{ta.trend}</span></div>
                    <div>Prediction: <span className={ta.prediction === 'BULLISH' || ta.prediction === 'VERY_BULLISH' ? 'text-green-400' : 'text-red-400'}>{ta.prediction}</span></div>
                    <div>Support: ${ta.supportLevel?.toFixed(2)} | Resistance: ${ta.resistanceLevel?.toFixed(2)}</div>
                    <div>Entry: ${ta.entryPrice?.toFixed(2)} | Exit: ${ta.exitPrice?.toFixed(2)}</div>
                    <div>Stop Loss: ${ta.stopLoss?.toFixed(2)} | Risk/Reward: {ta.riskRewardRatio}:1</div>
                    <div>Confidence: <span className={ta.confidence === 'HIGH' ? 'text-green-400' : ta.confidence === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'}>{ta.confidence}</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {data.analystData && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-gray-200 mb-2">📈 Analyst Ratings</h4>
            <div className="text-sm text-gray-300">
              <div>Rating: {data.analystData.analystRating || 'N/A'} ({data.analystData.analystCount || 0} analysts)</div>
              <div>Target: ${data.analystData.targetPrice?.toFixed(2) || 'N/A'} ({data.analystData.priceToTarget?.toFixed(1) || 'N/A'}% to target)</div>
            </div>
          </div>
        )}

        {data.trendsData && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-gray-200 mb-2">📉 Technical Analysis</h4>
            <div className="text-sm text-gray-300">
              <div>Trend: <span className={data.trendsData.trend === 'UP' ? 'text-green-400' : 'text-red-400'}>{data.trendsData.trend}</span></div>
              <div>Support: ${data.trendsData.supportLevel?.toFixed(2) || 'N/A'} | Resistance: ${data.trendsData.resistanceLevel?.toFixed(2) || 'N/A'}</div>
            </div>
          </div>
        )}

        {data.sentimentData && (
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-gray-200 mb-2">😊 Market Sentiment</h4>
            <div className="text-sm text-gray-300">
              {Object.entries(data.sentimentData.sources || {}).map(([source, data]: [string, any]) => (
                <div key={source}>{source}: {(data as any).sentiment || 'N/A'}</div>
              ))}
            </div>
          </div>
        )}

        {data.newsContext && data.newsContext.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm text-gray-200 mb-2">📰 Recent News</h4>
            <div className="text-sm space-y-1 text-gray-300">
              {data.newsContext.slice(0, 3).map((item: any, index: number) => (
                <div key={index}>
                  • {item.title} ({item.source})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-white/10 bg-white/5">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-lg font-semibold text-white">Financial Advisor Chat</h2>
        <p className="text-sm text-gray-400">Ask me about stocks, markets, news, or investment strategies</p>
      </div>
      
      <div ref={messagesEndRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${
              message.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-gray-800/80 text-gray-100'
            } max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-4 py-3 text-sm shadow-lg`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs opacity-70">
                {message.role === 'user' ? 'You' : 'Financial Advisor'}
              </span>
              <span className="text-xs opacity-50">{formatTime(message.timestamp)}</span>
            </div>
            
            <div className="whitespace-pre-wrap">{message.content}</div>
            
            {message.isLoading && (
              <div className="mt-2 flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            )}

            {!message.isLoading && message.incrementalData && renderIncrementalData(message.incrementalData)}
            
            {/* Show enhancement indicator */}
            {!message.isLoading && message.role === 'assistant' && (
              <div className="mt-2 text-xs text-gray-400 italic">
                💡 Response enhanced with real-time data
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="border-t border-white/10 p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about stocks, markets, or investment strategies... (Shift+Enter for newline)"
              rows={2}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none text-white placeholder-gray-400"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/20 transition-colors"
              >
                Clear Chat
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed shadow transition-colors"
            >
              {isLoading ? 'Thinking...' : 'Send'}
            </button>
            {abortController && (
              <button
                type="button"
                onClick={handleStop}
                className="rounded-xl border border-red-300 bg-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/30 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </form>
        
        <div className="mt-3 text-xs text-gray-400">
          💡 <strong>Pro tip:</strong> Ask follow-up questions to dive deeper into topics, or try questions like "What's your analysis of TSLA?" or "How might the Fed's decision affect tech stocks?"
        </div>
      </div>
    </div>
  )
}


