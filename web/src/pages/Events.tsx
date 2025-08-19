import { useEffect, useMemo, useState } from 'react'
import { fetchEvents } from '../services/mockApi'

type EventItem = {
  id: string
  type: 'Earnings' | 'IPO' | 'Fed'
  title: string
  date: string
}

export default function Events() {
  const [all, setAll] = useState<EventItem[]>([])
  const [type, setType] = useState<'All' | EventItem['type']>('All')

  useEffect(() => {
    fetchEvents().then(setAll)
  }, [])

  const types = useMemo(() => ['All', ...Array.from(new Set(all.map((e) => e.type)))] as const, [all])
  const filtered = useMemo(() => (type === 'All' ? all : all.filter((e) => e.type === type)), [all, type])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setType(t as any)}
            className={`px-3 py-1.5 rounded-full border text-sm ${
              type === t
                ? 'bg-blue-600 text-white border-blue-500 shadow'
                : 'bg-white/5 text-gray-200 border-white/10 hover:border-white/20'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((e) => (
          <div key={e.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-xs text-gray-400">{e.type}</div>
              </div>
              <div className="text-sm text-gray-300">{new Date(e.date).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


