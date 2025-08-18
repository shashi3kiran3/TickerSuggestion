import { useEffect, useMemo, useState } from 'react'
import { fetchSuggestions } from '../services/mockApi'
import { fetchTrendingSymbols, screenSymbols, type ScreenResult, fetchCategorySymbols, fetchIPOs, type IPOItem } from '../services/screener'

type Suggestion = {
  symbol: string
  name: string
  tags: string[]
  thesis: string
}

export default function Suggestions() {
  const [all, setAll] = useState<Suggestion[]>([])
  const [trend, setTrend] = useState<ScreenResult[]>([])
  const [hi52, setHi52] = useState<ScreenResult[]>([])
  const [lo52, setLo52] = useState<ScreenResult[]>([])
  const [ema50, setEma50] = useState<ScreenResult[]>([])
  const [ema200, setEma200] = useState<ScreenResult[]>([])
  const [ai, setAi] = useState<ScreenResult[]>([])
  const [growth, setGrowth] = useState<ScreenResult[]>([])
  const [volatile, setVolatile] = useState<ScreenResult[]>([])
  const [ipos, setIPOs] = useState<IPOItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>('All')

  useEffect(() => {
    fetchSuggestions().then(setAll)
    ;(async () => {
      setLoading(true)
      try {
        const symbols = await fetchTrendingSymbols(30)
        const screened = await screenSymbols(symbols)
        setTrend(screened.slice(0, 10))
        setHi52(screened.filter((s) => s.close >= s.high52w * 0.995).slice(0, 10))
        setLo52(screened.filter((s) => s.close <= s.low52w * 1.005).slice(0, 10))
        setEma50(screened.filter((s) => s.above50).slice(0, 10))
        setEma200(screened.filter((s) => s.above200).slice(0, 10))
        // Category lists
        const [aiSyms, grSyms, voSyms, _divSyms, ipoSyms] = await Promise.all([
          fetchCategorySymbols('AI'),
          fetchCategorySymbols('Growth'),
          fetchCategorySymbols('Volatile'),
          fetchCategorySymbols('Dividend'),
          fetchCategorySymbols('RecentIPO'),
        ])
        const [aiR, grR, voR] = await Promise.all([
          screenSymbols(aiSyms.slice(0, 20)),
          screenSymbols(grSyms.slice(0, 20)),
          screenSymbols(voSyms.slice(0, 20)),
        ])
        setAi(aiR.slice(0, 10))
        setGrowth(grR.slice(0, 10))
        setVolatile(voR.slice(0, 10))
        // Recent IPOs list from screener + Nasdaq
        const ipoQuotes = await screenSymbols(ipoSyms.slice(0, 20))
        const ipoCal = await fetchIPOs()
        setIPOs(mergeIPOLists(ipoQuotes.map((q) => q.symbol), ipoCal))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const tags = useMemo(() => ['All', ...Array.from(new Set(all.flatMap((s) => s.tags)))], [all])
  const filtered = useMemo(
    () => (selectedTag === 'All' ? all : all.filter((s) => s.tags.includes(selectedTag))),
    [all, selectedTag],
  )

  return (
    <div className="space-y-5">
      {loading && <div className="text-sm text-gray-300">Screening live symbols…</div>}
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTag(t)}
            className={`px-3 py-1.5 rounded-full border text-sm ${
              selectedTag === t
                ? 'bg-blue-600 text-white border-blue-500 shadow'
                : 'bg-white/5 text-gray-200 border-white/10 hover:border-white/20'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((s) => (
          <div key={s.symbol} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/7.5 transition">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold tracking-wide">{s.symbol}</div>
                <div className="text-sm text-gray-400">{s.name}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {s.tags.map((tag) => (
                  <span key={tag} className="text-xs rounded-full bg-white/10 px-2.5 py-0.5 text-gray-200 border border-white/10">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-200 leading-relaxed">
              {s.thesis}
            </p>
          </div>
        ))}
      </div>

      <Section title="Trending (Top 10)">
        <SymbolGrid items={trend} />
      </Section>
      <Section title="Near 52-Week High (Top 10)">
        <SymbolGrid items={hi52} />
      </Section>
      <Section title="Near 52-Week Low (Top 10)">
        <SymbolGrid items={lo52} />
      </Section>
      <Section title="> 50 EMA (Top 10)">
        <SymbolGrid items={ema50} />
      </Section>
      <Section title="> 200 EMA (Top 10)">
        <SymbolGrid items={ema200} />
      </Section>
      <Section title="AI (Top 10)">
        <SymbolGrid items={ai} />
      </Section>
      <Section title="Growth (Top 10)">
        <SymbolGrid items={growth} />
      </Section>
      <Section title="Most Volatile (Top 10)">
        <SymbolGrid items={volatile} />
      </Section>
      <Section title="High Dividend Yield (Top 10)">
        <SymbolGrid items={[] /* placeholder to keep layout; can compute from category later */} />
      </Section>
      <Section title="Upcoming IPOs">
        <IPOGrid items={ipos} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-gray-200">{title}</div>
      {children}
    </div>
  )
}

function SymbolGrid({ items }: { items: ScreenResult[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((s) => (
        <a
          key={s.symbol}
          href={`https://finance.yahoo.com/quote/${s.symbol}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
        >
          <div className="flex items-center justify-between">
            <div className="font-semibold">{s.symbol}</div>
            <div className="text-xs text-gray-400">{s.close.toFixed(2)}</div>
          </div>
          <div className="mt-1 text-[11px] text-gray-400">52w L/H: {s.low52w.toFixed(2)} / {s.high52w.toFixed(2)}</div>
          <div className="mt-1 text-[11px] text-gray-400">EMA: {s.above50 ? '≥50' : '<50'} • {s.above200 ? '≥200' : '<200'}</div>
        </a>
      ))}
    </div>
  )
}

function IPOGrid({ items }: { items: IPOItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.slice(0, 10).map((it, idx) => (
        <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{it.symbol || 'TBA'}</div>
            <div className="text-xs text-gray-400">{it.date || ''}</div>
          </div>
          <div className="mt-1 text-sm text-gray-200">{it.company || 'Upcoming IPO'}</div>
          {it.priceRange && <div className="mt-1 text-[11px] text-gray-400">Price: {it.priceRange}</div>}
        </div>
      ))}
    </div>
  )
}

function mergeIPOLists(symbols: string[], cal: IPOItem[]): IPOItem[] {
  const map = new Map<string, IPOItem>()
  for (const s of symbols) map.set(s, { symbol: s })
  for (const c of cal) {
    const key = (c.symbol || '').toUpperCase()
    if (!key) continue
    map.set(key, { ...map.get(key), ...c, symbol: key })
  }
  return Array.from(map.values())
}


