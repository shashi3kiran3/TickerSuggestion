import { useEffect, useMemo, useState } from 'react'
import { fetchLiveNews, type NewsCard, timeAgo } from '../services/news'
import { summarizeNewsArticle, type NewsSummary } from '../services/openai'

export default function News() {
  const [all, setAll] = useState<NewsCard[]>([])
  const [q, setQ] = useState('')
  const [source, setSource] = useState('All')
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<Record<string, NewsSummary | 'loading'>>({})

  useEffect(() => {
    setLoading(true)
    fetchLiveNews()
      .then(setAll)
      .finally(() => setLoading(false))
  }, [])

  const sources = useMemo(() => ['All', ...Array.from(new Set(all.map((a) => a.source)))], [all])
  const filtered = useMemo(() => {
    const bySource = source === 'All' ? all : all.filter((a) => a.source === source)
    const query = q.trim().toLowerCase()
    return query ? bySource.filter((a) => a.title.toLowerCase().includes(query)) : bySource
  }, [all, q, source])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      {loading ? (
        <div className="text-sm text-gray-300">Loading latest finance headlines…</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
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
                    const sum = await summarizeNewsArticle(a.title, a.url)
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
        </div>
      )}
    </div>
  )
}


