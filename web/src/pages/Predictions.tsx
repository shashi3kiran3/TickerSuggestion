import { useEffect, useState } from 'react'
import { fetchPredictions } from '../services/mockApi'

type Prediction = {
  symbol: string
  forecastPct: number
  trend: 'Up' | 'Down' | 'Sideways'
  points: { t: number; v: number }[]
}

export default function Predictions() {
  const [items, setItems] = useState<Prediction[]>([])

  useEffect(() => {
    fetchPredictions().then(setItems)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {items.map((p) => (
        <div key={p.symbol} className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold tracking-wide">{p.symbol}</div>
            <div
              className={
                p.trend === 'Up' ? 'text-green-400' : p.trend === 'Down' ? 'text-red-400' : 'text-yellow-300'
              }
            >
              {p.trend}
            </div>
          </div>
          <div className="mt-1 text-sm text-gray-300">Forecast: {p.forecastPct.toFixed(1)}%</div>
          <div className="mt-4 h-32 w-full rounded bg-gray-800/60">
            {/* Placeholder mini-chart using SVG */}
            <svg viewBox="0 0 100 40" className="h-full w-full">
              <polyline
                fill="none"
                stroke="currentColor"
                className="text-blue-400"
                strokeWidth="2"
                points={p.points.map((pt, i) => `${(i / (p.points.length - 1)) * 100},${40 - pt.v}`).join(' ')}
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  )
}


