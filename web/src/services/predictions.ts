export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number }

export async function fetchDaily(symbol: string, range: string = '2y'): Promise<Candle[]> {
  const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=1d`)
  if (!res.ok) throw new Error('chart_error')
  const data = await res.json()
  const r = data?.chart?.result?.[0]
  if (!r) return []
  const ts: number[] = r.timestamp || []
  const o = r.indicators?.quote?.[0]?.open || []
  const h = r.indicators?.quote?.[0]?.high || []
  const l = r.indicators?.quote?.[0]?.low || []
  const c = r.indicators?.quote?.[0]?.close || []
  const out: Candle[] = []
  for (let i = 0; i < ts.length; i++) {
    if (typeof c[i] !== 'number') continue
    out.push({ t: ts[i] * 1000, o: o[i], h: h[i], l: l[i], c: c[i] })
  }
  return out
}

export type PatternStats = {
  count: number
  avgPct: number
  medianPct: number
  winRate: number
  minPct: number
  maxPct: number
  observations: {
    date: string
    pct: number
    open: number
    high: number
    low: number
    close: number
    prevClose: number
    high52w: number
    low52w: number
  }[]
}

export function computeWeekdayPattern(daily: Candle[], weekday: number, lookbackDays: number): PatternStats {
  // weekday: 0=Sun ... 6=Sat
  const obs: number[] = []
  const list: {
    date: string
    pct: number
    open: number
    high: number
    low: number
    close: number
    prevClose: number
    high52w: number
    low52w: number
  }[] = []
  for (let i = 1; i < daily.length; i++) {
    const prev = daily[i - 1]
    const cur = daily[i]
    if (!prev?.c || !cur?.c) continue
    const d = new Date(cur.t)
    if (Date.now() - cur.t > lookbackDays * 24 * 3600 * 1000) continue
    if (d.getDay() !== weekday) continue
    const pct = ((cur.c - prev.c) / prev.c) * 100
    obs.push(pct)
    // trailing 52w (approx 252 trading days)
    const start = Math.max(0, i - 252)
    let hi = -Infinity
    let lo = Infinity
    for (let j = start; j <= i; j++) {
      const cc = daily[j]?.c
      if (typeof cc !== 'number') continue
      if (cc > hi) hi = cc
      if (cc < lo) lo = cc
    }
    list.push({
      date: d.toISOString().slice(0, 10),
      pct,
      open: cur.o,
      high: cur.h,
      low: cur.l,
      close: cur.c,
      prevClose: prev.c,
      high52w: Number.isFinite(hi) ? hi : cur.c,
      low52w: Number.isFinite(lo) ? lo : cur.c,
    })
  }
  if (obs.length === 0) {
    return { count: 0, avgPct: 0, medianPct: 0, winRate: 0, minPct: 0, maxPct: 0, observations: [] }
  }
  const sorted = [...obs].sort((a, b) => a - b)
  const avg = obs.reduce((a, b) => a + b, 0) / obs.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const wins = obs.filter((x) => x > 0).length / obs.length
  return {
    count: obs.length,
    avgPct: avg,
    medianPct: median,
    winRate: wins * 100,
    minPct: sorted[0],
    maxPct: sorted[sorted.length - 1],
    observations: list.reverse(),
  }
}


