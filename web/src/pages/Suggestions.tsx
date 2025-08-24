import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import { screenSymbols, type ScreenResult, fetchCategorySymbols, fetchIPOs, fetchTrendingFromMultipleSources, fetchIndexFallback } from '../services/screener'

type Section = 'Trending' | '52w High' | '52w Low' | 'EMA50' | 'EMA200' | 'Growth' | 'Volatile' | 'AI' | 'IPOs'

export default function Suggestions() {
  const [sections, setSections] = useState<Record<Section, ScreenResult[]>>({
    'Trending': [],
    '52w High': [],
    '52w Low': [],
    'EMA50': [],
    'EMA200': [],
    'Growth': [],
    'Volatile': [],
    'AI': [],
    'IPOs': []
  })
  const [indexStocks, setIndexStocks] = useState<Record<string, ScreenResult[]>>({
    'Dow': [],
    'Nasdaq': [],
    'S&P': []
  })
  const [loading, setLoading] = useState<Record<Section, boolean>>({
    'Trending': false,
    '52w High': false,
    '52w Low': false,
    'EMA50': false,
    'EMA200': false,
    'Growth': false,
    'Volatile': false,
    'AI': false,
    'IPOs': false
  })
  const [selectedSection, setSelectedSection] = useState<Section>('Trending')
  const [lastFetch, setLastFetch] = useState<number>(0)

  const loadSection = async (section: Section, forceRefresh = false) => {
    // Check if we have recent data (less than 5 minutes old) unless forcing refresh
    const now = Date.now()
    if (!forceRefresh && sections[section].length > 0 && now - lastFetch < 5 * 60 * 1000) {
      return // Use cached data
    }

    setLoading(prev => ({ ...prev, [section]: true }))
    
    try {
      console.log(`Loading ${section} section...`)
      
      let symbols: string[] = []
      let results: ScreenResult[] = []
      
             switch (section) {
         case 'Trending':
           // Get trending from multiple sources
           const trendingSources = await fetchTrendingFromMultipleSources(10)
           const allTrendingSymbols = Object.values(trendingSources).flat()
           results = await screenSymbols(allTrendingSymbols)
           setSections(prev => ({ ...prev, [section]: results.slice(0, 15) }))
           break
           
         case '52w High':
           // Get symbols from multiple sources and filter for 52-week highs (within 5% of 52w high)
           const high52wSources = await fetchTrendingFromMultipleSources(13)
           const allHigh52wSymbols = Object.values(high52wSources).flat()
           results = await screenSymbols(allHigh52wSymbols)
           const high52wResults = results.filter(s => s.close >= s.high52w * 0.95).slice(0, 12)
           setSections(prev => ({ ...prev, [section]: high52wResults }))
           
           // Also load index stocks for 52-week high
           const dowSymbols = await fetchIndexFallback('dow', 10)
           const nasdaqSymbols = await fetchIndexFallback('nasdaq', 10)
           const spSymbols = await fetchIndexFallback('sp500', 10)
           const allIndexSymbols = [...dowSymbols, ...nasdaqSymbols, ...spSymbols]
           const indexResults = await screenSymbols(allIndexSymbols)
           const indexHigh52w = indexResults.filter(s => s.close >= s.high52w * 0.95)
           
           setIndexStocks(prev => ({
             ...prev,
             'Dow': indexHigh52w.filter(s => ['AAPL', 'MSFT', 'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'MA', 'DIS'].includes(s.symbol)).slice(0, 5),
             'Nasdaq': indexHigh52w.filter(s => ['NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'AMD', 'NFLX', 'ADBE', 'CRM', 'TTD'].includes(s.symbol)).slice(0, 5),
             'S&P': indexHigh52w.filter(s => ['SPY', 'QQQ', 'IWM', 'VTI', 'VOO'].includes(s.symbol)).slice(0, 5)
           }))
           break
           
         case '52w Low':
           // Get symbols and filter for 52-week lows (within 10% of 52w low)
           const low52wSources = await fetchTrendingFromMultipleSources(13)
           const allLow52wSymbols = Object.values(low52wSources).flat()
           results = await screenSymbols(allLow52wSymbols)
           const low52wResults = results.filter(s => s.close <= s.low52w * 1.10).slice(0, 15)
           setSections(prev => ({ ...prev, [section]: low52wResults }))
           
           // Also load index stocks for 52-week low
           const dowSymbolsLow = await fetchIndexFallback('dow', 10)
           const nasdaqSymbolsLow = await fetchIndexFallback('nasdaq', 10)
           const spSymbolsLow = await fetchIndexFallback('sp500', 10)
           const allIndexSymbolsLow = [...dowSymbolsLow, ...nasdaqSymbolsLow, ...spSymbolsLow]
           const indexResultsLow = await screenSymbols(allIndexSymbolsLow)
           const indexLow52w = indexResultsLow.filter(s => s.close <= s.low52w * 1.10)
           
           setIndexStocks(prev => ({
             ...prev,
             'Dow': indexLow52w.filter(s => ['AAPL', 'MSFT', 'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'MA', 'DIS'].includes(s.symbol)).slice(0, 5),
             'Nasdaq': indexLow52w.filter(s => ['NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'AMD', 'NFLX', 'ADBE', 'CRM', 'TTD'].includes(s.symbol)).slice(0, 5),
             'S&P': indexLow52w.filter(s => ['SPY', 'QQQ', 'IWM', 'VTI', 'VOO'].includes(s.symbol)).slice(0, 5)
           }))
           break
           
         case 'EMA50':
           const ema50Sources = await fetchTrendingFromMultipleSources(10)
           const allEma50Symbols = Object.values(ema50Sources).flat()
           results = await screenSymbols(allEma50Symbols)
           setSections(prev => ({ ...prev, [section]: results.filter(s => s.above50).slice(0, 6) }))
           break
           
         case 'EMA200':
           const ema200Sources = await fetchTrendingFromMultipleSources(10)
           const allEma200Symbols = Object.values(ema200Sources).flat()
           results = await screenSymbols(allEma200Symbols)
           setSections(prev => ({ ...prev, [section]: results.filter(s => s.above200).slice(0, 6) }))
           break
           
         case 'Growth':
           symbols = await fetchCategorySymbols('Growth')
           results = await screenSymbols(symbols.slice(0, 20))
           setSections(prev => ({ ...prev, [section]: results.slice(0, 12) }))
           break
           
         case 'Volatile':
           symbols = await fetchCategorySymbols('Volatile')
           results = await screenSymbols(symbols.slice(0, 20))
           setSections(prev => ({ ...prev, [section]: results.slice(0, 10) }))
           break
           
         case 'AI':
           symbols = await fetchCategorySymbols('AI')
           results = await screenSymbols(symbols.slice(0, 20))
           setSections(prev => ({ ...prev, [section]: results.slice(0, 10) }))
           break
           
                   case 'IPOs':
            const ipoSymbols = await fetchCategorySymbols('RecentIPO')
            const ipoResults = await screenSymbols(ipoSymbols.slice(0, 20))
            await fetchIPOs() // Fetch but don't use for now
            setSections(prev => ({ ...prev, [section]: ipoResults.slice(0, 10) }))
            break
       }
      
      setLastFetch(now)
    } catch (error) {
      console.error(`Error loading ${section}:`, error)
    } finally {
      setLoading(prev => ({ ...prev, [section]: false }))
    }
  }

  useEffect(() => {
    // Load trending section by default
    loadSection('Trending')
  }, []) // Run only once on mount

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-400' : 'text-red-400'
  }

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
    return num.toString()
  }

  const renderStockCard = (stock: ScreenResult) => (
    <div key={stock.symbol} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all duration-200 hover:shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-white">{stock.symbol}</div>
        <div className="text-xs text-gray-400">via {stock.source || 'Unknown'}</div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-white">${stock.close.toFixed(2)}</div>
        <div className={`text-sm ${getChangeColor(stock.changePct || 0)}`}>
          {(stock.changePct || 0) >= 0 ? '+' : ''}{(stock.changePct || 0).toFixed(2)}%
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        Vol: {formatNumber((stock as any).volume || 0)}
      </div>
    </div>
  )

  const renderIndexTable = (indexName: string, stocks: ScreenResult[]) => (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-white mb-3">{indexName} Stocks</h4>
      <div className="space-y-2">
        {stocks.map(stock => (
          <div key={stock.symbol} className="flex items-center justify-between text-sm">
            <span className="text-white">{stock.symbol}</span>
            <span className={`${getChangeColor(stock.changePct || 0)}`}>
              {(stock.changePct || 0) >= 0 ? '+' : ''}{(stock.changePct || 0).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Stock Suggestions</h1>
          <div className="text-sm text-gray-400">
            Curated stock picks from multiple sources
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
              loadSection(selectedSection, true)
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Section Selector */}
      <div className="flex flex-wrap gap-2">
        {(['Trending', '52w High', '52w Low', 'EMA50', 'EMA200', 'Growth', 'Volatile', 'AI', 'IPOs'] as Section[]).map((section) => (
          <button
            key={section}
            onClick={() => {
              setSelectedSection(section)
              if (sections[section].length === 0) {
                loadSection(section)
              }
            }}
            className={`px-3 py-1.5 rounded-full border text-sm ${
              selectedSection === section
                ? 'bg-blue-600 text-white border-blue-500 shadow'
                : 'bg-white/5 text-gray-200 border-white/10 hover:border-white/20'
            }`}
          >
            {section}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading[selectedSection] && (
        <div className="flex items-center justify-center h-32">
          <Loading />
        </div>
      )}

      {/* Content */}
      {!loading[selectedSection] && (
        <div className="space-y-6">
          {/* Main Section */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">
              {selectedSection === 'Trending' && 'Trending (Top 15)'}
              {selectedSection === '52w High' && 'Near 52-Week High (Top 12)'}
              {selectedSection === '52w Low' && 'Near 52-Week Low (Top 15)'}
              {selectedSection === 'EMA50' && '> 50 EMA (Top 6)'}
              {selectedSection === 'EMA200' && '> 200 EMA (Top 6)'}
              {selectedSection === 'Growth' && 'Growth (Top 12)'}
              {selectedSection === 'Volatile' && 'Most Volatile (Top 10)'}
              {selectedSection === 'AI' && 'AI (Top 10)'}
              {selectedSection === 'IPOs' && 'Latest IPO (Top 10)'}
            </h2>
            
            {sections[selectedSection].length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No {selectedSection.toLowerCase()} stocks found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections[selectedSection].map(renderStockCard)}
              </div>
            )}
          </div>

          {/* Index Tables for 52-week sections */}
          {(selectedSection === '52w High' || selectedSection === '52w Low') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderIndexTable('Dow 30', indexStocks.Dow)}
              {renderIndexTable('Nasdaq 100', indexStocks.Nasdaq)}
              {renderIndexTable('S&P 500', indexStocks['S&P'])}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


