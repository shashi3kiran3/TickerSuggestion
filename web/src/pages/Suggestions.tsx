import { useEffect, useMemo, useState } from 'react'
import { fetchSuggestions } from '../services/mockApi'

type Suggestion = {
  symbol: string
  name: string
  tags: string[]
  thesis: string
}

export default function Suggestions() {
  const [all, setAll] = useState<Suggestion[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('All')

  useEffect(() => {
    fetchSuggestions().then(setAll)
  }, [])

  const tags = useMemo(() => ['All', ...Array.from(new Set(all.flatMap((s) => s.tags)))], [all])
  const filtered = useMemo(
    () => (selectedTag === 'All' ? all : all.filter((s) => s.tags.includes(selectedTag))),
    [all, selectedTag],
  )

  return (
    <div className="space-y-5">
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
    </div>
  )
}


