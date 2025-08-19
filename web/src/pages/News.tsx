import { useEffect, useMemo, useState } from 'react'
import { type NewsCard, timeAgo } from '../services/news'
import { summarizeNewsArticle, type NewsSummary } from '../services/openai'

export default function News() {
  const [all, setAll] = useState<NewsCard[]>([])
  const [q, setQ] = useState('')
  const [source, setSource] = useState('All')
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<Record<string, NewsSummary | 'loading'>>({})
  const [visible, setVisible] = useState(5)
  const [auto, setAuto] = useState(true)

  function loadNews() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', '50')
    if (source && source !== 'All') params.set('source', source)
    if (q.trim()) params.set('q', q.trim())
    fetch(`/api/news?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => (Array.isArray(d.items) ? d.items : []))
      .then(setAll)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadNews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sources = useMemo(() => ['All', ...Array.from(new Set(all.map((a) => a.source)))], [all])
  const filtered = useMemo(() => {
    const bySource = source === 'All' ? all : all.filter((a) => a.source === source)
    const query = q.trim().toLowerCase()
    const filtered = query ? bySource.filter((a) => a.title.toLowerCase().includes(query)) : bySource
    return filtered
  }, [all, q, source])

  // Auto-incrementally reveal 5 at a time while loading or until all visible
  useEffect(() => {
    if (!auto) return
    if (visible >= filtered.length) return
    const id = setInterval(() => {
      setVisible((v) => {
        const next = Math.min(v + 5, filtered.length)
        if (next >= filtered.length) setAuto(false)
        return next
      })
    }, 800)
    return () => clearInterval(id)
  }, [auto, filtered.length, visible])

  return (
    <div className="space-y-5">
      <div className="text-2xl font-bold text-red-400">In Progress</div>
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setVisible(5)
          setAuto(true)
          loadNews()
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search news..."
          className="w-full sm:w-72 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm"
        >
          {sources.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/20"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="text-sm text-gray-300">Loading latest finance headlines…</div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, visible).map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/7.5 transition"
            >
              <button
                className="w-full text-left"
                onClick={async () => {
                  setOpenId((id) => (id === a.id ? null : a.id))
                  if (!summaries[a.id]) {
                    setSummaries((s) => ({ ...s, [a.id]: 'loading' }))
                    const sum = await summarizeNewsArticle(a.title, a.url, (a as any).description)
                    setSummaries((s) => ({ ...s, [a.id]: sum }))
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium text-gray-100 tracking-tight">
                    {(summaries[a.id] && summaries[a.id] !== 'loading' && (summaries[a.id] as NewsSummary).headline) ||
                      a.title}
                  </h3>
                  <span className="text-xs text-gray-400">{a.source}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">{timeAgo(a.publishedAt)}</div>
              </button>
              {openId === a.id && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  {summaries[a.id] === 'loading' ? (
                    <div className="text-xs text-gray-300">Summarizing…</div>
                  ) : summaries[a.id] ? (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-200">
                      {(summaries[a.id] as NewsSummary).bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-gray-300">No summary available.</div>
                  )}
                  <div className="mt-3 text-xs">
                    <a href={a.url} target="_blank" rel="noreferrer" className="underline text-blue-300">
                      Read full article
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
          {visible < filtered.length && (
            <div className="pt-2">
              <button
                onClick={() => setVisible((v) => v + 5)}
                className="w-full rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/20"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


