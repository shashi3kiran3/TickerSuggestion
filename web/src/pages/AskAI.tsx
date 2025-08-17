import { useEffect, useRef, useState } from 'react'
import { askOpenAI } from '../services/openai'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function AskAI() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'm1', role: 'assistant', content: 'Hi! Ask me about stocks, sectors, news, or events.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')

    setLoading(true)
    try {
      const replyText = await askOpenAI(text)
      const aiMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: replyText }
      setMessages((m) => [...m, aiMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setMessages([{ id: 'm1', role: 'assistant', content: 'Cleared. Ask me about stocks, sectors, news, or events.' }])
    setInput('')
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-white/10 bg-white/5">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${
              m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-gray-800/80 text-gray-100'
            } max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-sm shadow`}
          >
            <MessageContent text={m.content} />
          </div>
        ))}
        {loading && (
          <div className="mr-auto max-w-[80%] rounded-xl bg-gray-800/60 px-3.5 py-2.5 text-xs text-gray-200">
            Looking for the latest finance sources… this can take a few seconds on free/open endpoints.
          </div>
        )}
      </div>
      <div className="border-t border-white/10 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about stocks, news, or events…"
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {input && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/20"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed shadow"
          >
            {loading ? 'Searching…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}

function MessageContent({ text }: { text: string }) {
  // Convert plain URLs into clickable links; preserve line breaks
  const parts = text.split(/(https?:\/\/[^\s)]+[\w/#?&=%-])/g)
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, idx) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={idx}
              href={part}
              target="_blank"
              rel="noreferrer"
              className="underline text-blue-300 hover:text-blue-200 break-words"
            >
              {part}
            </a>
          )
        }
        return <span key={idx}>{part}</span>
      })}
    </p>
  )
}


