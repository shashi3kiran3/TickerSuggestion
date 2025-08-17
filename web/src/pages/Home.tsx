import { useEffect, useState } from 'react'
import { fetchTrending, fetchMarketSentiment } from '../services/mockApi'

export default function Home() {
  const [trending, setTrending] = useState<{ symbol: string; name: string; changePct: number }[]>([])
  const [sectors, setSectors] = useState<{ sector: string; changePct: number }[]>([])
  const [sentiment, setSentiment] = useState<'Bearish' | 'Neutral' | 'Bullish' | null>(null)

  useEffect(() => {
    fetchTrending().then((d) => {
      setTrending(d.stocks)
      setSectors(d.sectors)
    })
    fetchMarketSentiment().then(setSentiment)
  }, [])

  return (
    <div id="home-page" className="space-y-10">
      <div id="home-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Card 1: Market Sentiment */}
        <div id="card-sentiment" className="rounded-xl border border-white/10 bg-white/10 p-6 shadow-md text-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Market Sentiment</h2>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                sentiment === 'Bullish'
                  ? 'bg-green-100 text-green-700'
                  : sentiment === 'Bearish'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {sentiment ?? 'Loading...'}
            </span>
          </div>
          <p className="mt-4 text-sm text-gray-600">Overall market mood based on trending data.</p>
        </div>

        {/* Card 2: Trending Stocks */}
        <div id="card-trending-stocks" className="rounded-xl border border-white/10 bg-white/10 p-6 shadow-md text-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Trending Stocks</h2>
          <ul id="list-trending-stocks" className="mt-4 space-y-3">
            {trending.slice(0, 5).map((s) => (
              <li key={s.symbol} className="flex items-center justify-between text-sm">
                <div className="text-gray-100 font-medium">{s.symbol}</div>
                <div className={s.changePct >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {s.changePct >= 0 ? '+' : ''}
                  {s.changePct.toFixed(2)}%
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 3: Trending Sectors */}
        <div id="card-trending-sectors" className="rounded-xl border border-white/10 bg-white/10 p-6 shadow-md text-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Trending Sectors</h2>
          <ul id="list-trending-sectors" className="mt-4 space-y-3">
            {sectors.slice(0, 5).map((sec) => (
              <li key={sec.sector} className="flex items-center justify-between text-sm">
                <div className="text-gray-100 font-medium">{sec.sector}</div>
                <div className={sec.changePct >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {sec.changePct >= 0 ? '+' : ''}
                  {sec.changePct.toFixed(2)}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}


