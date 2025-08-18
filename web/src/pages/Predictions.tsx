import { useMemo, useState } from 'react'
import { computeWeekdayPattern, fetchDaily, type PatternStats } from '../services/predictions'

const WEEKDAYS = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
]

export default function Predictions() {
  const [symbol, setSymbol] = useState('SPY')
  const [weekday, setWeekday] = useState(1)
  const [unit, setUnit] = useState<'weeks' | 'months' | 'years'>('weeks')
  const [count, setCount] = useState(4)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<PatternStats | null>(null)
  const lookbackDays = useMemo(() => toDays(unit, count), [unit, count])

  async function analyze() {
    setLoading(true)
    try {
      const candles = await fetchDaily(symbol, rangeForDays(lookbackDays))
      const s = computeWeekdayPattern(candles, weekday, lookbackDays)
      setStats(s)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-gray-300">Ticker</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
            placeholder="SPY"
          />
        </div>
        <div>
          <label className="text-xs text-gray-300">Weekday</label>
          <select
            value={weekday}
            onChange={(e) => setWeekday(parseInt(e.target.value))}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-300">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as any)}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-300">Count</label>
          <input
            type="number"
            min={1}
            max={260}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={analyze}
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-200">
            <span>
              Observations: <b>{stats.count}</b>
            </span>
            <span>
              Avg: <b className={stats.avgPct >= 0 ? 'text-green-400' : 'text-red-400'}>{stats.avgPct.toFixed(2)}%</b>
            </span>
            <span>
              Median: <b className={stats.medianPct >= 0 ? 'text-green-400' : 'text-red-400'}>{stats.medianPct.toFixed(2)}%</b>
            </span>
            <span>
              Win rate: <b>{stats.winRate.toFixed(0)}%</b>
            </span>
            <span>
              Min/Max: <b>{stats.minPct.toFixed(2)}% / {stats.maxPct.toFixed(2)}%</b>
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-300">
            {stats.observations.map((o) => (
              <div key={o.date} className="rounded-md border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{o.date}</span>
                  <span className={o.pct >= 0 ? 'text-green-400' : 'text-red-400'}>{o.pct.toFixed(2)}%</span>
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  <Stat label="Open" value={o.open} />
                  <Stat label="High" value={o.high} />
                  <Stat label="Low" value={o.low} />
                  <Stat label="Close" value={o.close} />
                  <Stat label="Prev Close" value={o.prevClose} />
                  <Stat label="52w L/H" value={`${o.low52w.toFixed(2)} / ${o.high52w.toFixed(2)}`} raw />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function toDays(unit: 'weeks' | 'months' | 'years', count: number) {
  if (unit === 'weeks') return count * 7
  if (unit === 'months') return count * 30
  return count * 365
}

function rangeForDays(days: number) {
  if (days <= 30) return '1mo'
  if (days <= 90) return '3mo'
  if (days <= 180) return '6mo'
  if (days <= 365) return '1y'
  if (days <= 365 * 2) return '2y'
  if (days <= 365 * 5) return '5y'
  return '10y'
}

function Stat({ label, value, raw }: { label: string; value: number | string; raw?: boolean }) {
  const display = typeof value === 'number' && !raw ? value.toFixed(2) : String(value)
  return (
    <div className="rounded bg-white/5 px-2 py-1 text-[11px]">
      <div className="text-gray-400">{label}</div>
      <div className="text-gray-100">{display}</div>
    </div>
  )
}


