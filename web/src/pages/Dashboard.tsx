import { useState, useEffect } from 'react'
import Loading from '../components/Loading'

type MarketIndex = {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

type TrendingStock = {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  source: string
}

export default function Dashboard() {
  const [loading, setLoading] = useState(false)
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([])
  const [lastFetch, setLastFetch] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = async (forceRefresh = false) => {
    // Check if we have recent data (less than 2 minutes old for dashboard) unless forcing refresh
    const now = Date.now()
    if (!forceRefresh && indices.length > 0 && now - lastFetch < 2 * 60 * 1000) {
      return // Use cached data
    }

    setLoading(true)
    setError(null)
    
    try {
      console.log('Loading dashboard data...')
      // Fetch real market data with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const marketRes = await fetch('/api/market-data', { signal: controller.signal })
      clearTimeout(timeoutId)
      
      if (marketRes.ok) {
        const marketData = await marketRes.json()
        console.log('Market data received:', marketData)
        
        if (marketData.indices) {
          setIndices(marketData.indices)
        }
        
        if (marketData.trending) {
          setTrendingStocks(marketData.trending)
        }
      } else {
        console.error('Market data API failed, no fallback data available')
        setError('Failed to load real-time market data. Please try again.')
      }

      setLastFetch(now)
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      console.log('Dashboard loading completed')
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, []) // Run only once on mount

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
    return num.toString()
  }

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-400' : 'text-red-400'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Market Dashboard</h1>
          <div className="text-sm text-gray-400">
            Real-time market overview
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastFetch > 0 && (
            <div className="text-xs text-gray-500">
              Last updated: {new Date(lastFetch).toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={() => {
              setLastFetch(0)
              loadDashboard(true) // Force refresh
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loading />
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Market Indices */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-full">
              <h2 className="text-lg font-semibold text-white mb-3">Major Indices</h2>
            </div>
            {indices.map((index) => (
              <div key={index.symbol} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all duration-200 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{index.name}</div>
                    <div className="text-sm text-gray-400">{index.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{index.price.toFixed(2)}</div>
                    <div className={`text-sm ${getChangeColor(index.change)}`}>
                      {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trending Stocks */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Trending Stocks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingStocks.map((stock) => (
                <div key={stock.symbol} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all duration-200 hover:shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-white">{stock.symbol}</div>
                    <div className="text-xs text-gray-400">via {stock.source}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-white">${stock.price.toFixed(2)}</div>
                    <div className={`text-sm ${getChangeColor(stock.change)}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Vol: {formatNumber(stock.volume)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market Summary */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Market Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-md font-medium text-white mb-2">Today's Highlights</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  {indices.length > 0 && (
                    <>
                      <li>• {indices.find(i => i.symbol === '^GSPC')?.name || 'S&P 500'} at {indices.find(i => i.symbol === '^GSPC')?.price.toFixed(2) || 'N/A'}</li>
                      <li>• {indices.find(i => i.symbol === '^VIX')?.name || 'VIX'} at {indices.find(i => i.symbol === '^VIX')?.price.toFixed(2) || 'N/A'} (volatility indicator)</li>
                      <li>• {indices.find(i => i.symbol === '^TNX')?.name || '10Y Treasury'} at {indices.find(i => i.symbol === '^TNX')?.price.toFixed(2) || 'N/A'}%</li>
                    </>
                  )}
                  {trendingStocks.length > 0 && (
                    <li>• Top mover: {trendingStocks[0]?.symbol} {trendingStocks[0]?.changePercent >= 0 ? '+' : ''}{trendingStocks[0]?.changePercent.toFixed(2)}%</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-md font-medium text-white mb-2">Market Status</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Real-time data from Yahoo Finance</li>
                  <li>• Last updated: {new Date(lastFetch).toLocaleTimeString()}</li>
                  <li>• {indices.length} major indices tracked</li>
                  <li>• {trendingStocks.length} trending stocks monitored</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

