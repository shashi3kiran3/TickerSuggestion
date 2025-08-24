import { useEffect, useRef, useState } from 'react'
import { askOpenAI, type ChatMessage } from '../services/openai'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AskAI() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'm1', 
      role: 'assistant', 
      content: 'Hi! I\'m your financial advisor and market analyst. I can help you understand stocks, markets, and financial news. What would you like to know about today?',
      timestamp: new Date()
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [controller, setController] = useState<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    
    const userMsg: Message = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      content: text,
      timestamp: new Date()
    }
    setMessages((m) => [...m, userMsg])
    setInput('')

    setLoading(true)
    const c = new AbortController()
    setController(c)
    
    try {
      // Convert messages to ChatMessage format for conversation history
      const conversationHistory: ChatMessage[] = messages
        .filter(msg => msg.role !== 'assistant' || !msg.content.includes('Hi! I\'m your financial advisor')) // Exclude initial greeting
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))
        .slice(-10) // Keep last 10 messages for context

      const replyText = await askOpenAI(text, conversationHistory, { 
        signal: c.signal, 
        timeoutMs: 20000 
      })
      
      const aiMsg: Message = { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        content: replyText,
        timestamp: new Date()
      }
      setMessages((m) => [...m, aiMsg])
    } catch (error) {
      // Handle errors gracefully
      const errorMsg: Message = { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        content: 'I apologize, but I encountered an issue while processing your request. Could you please try again or rephrase your question?',
        timestamp: new Date()
      }
      setMessages((m) => [...m, errorMsg])
    } finally {
      setLoading(false)
      setController(null)
    }
  }

  function handleClear() {
    setMessages([{ 
      id: 'm1', 
      role: 'assistant', 
      content: 'Conversation cleared. How can I help you with your financial questions today?',
      timestamp: new Date()
    }])
    setInput('')
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-white/10 bg-white/5">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-lg font-semibold text-white">Financial Advisor Chat</h2>
        <p className="text-sm text-gray-400">Ask me about stocks, markets, news, or investment strategies</p>
      </div>
      
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${
              m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-gray-800/80 text-gray-100'
            } max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-4 py-3 text-sm shadow-lg`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs opacity-70">
                {m.role === 'user' ? 'You' : 'Financial Advisor'}
              </span>
              <span className="text-xs opacity-50">{formatTime(m.timestamp)}</span>
            </div>
            <MessageContent text={m.content} />
          </div>
        ))}
        {loading && (
          <div className="mr-auto max-w-[85%] rounded-xl bg-gray-800/60 px-4 py-3 text-sm text-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-xs opacity-70">Financial Advisor</span>
              <span className="text-xs opacity-50">{formatTime(new Date())}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs">Analyzing market data and gathering insights...</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="border-t border-white/10 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stocks, markets, or investment strategies... (Shift+Enter for newline)"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            {input && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/20 transition-colors"
              >
                Clear Chat
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed shadow transition-colors"
            >
              {loading ? 'Thinking...' : 'Send'}
            </button>
            {controller && (
              <button
                type="button"
                onClick={() => controller.abort()}
                className="rounded-xl border border-red-300 bg-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/30 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </form>
        
        <div className="mt-3 text-xs text-gray-400">
          💡 <strong>Pro tip:</strong> Ask follow-up questions to dive deeper into topics, or try questions like "What's your analysis of TSLA?" or "How might the Fed's decision affect tech stocks?"
        </div>
      </div>
    </div>
  )
}

function MessageContent({ text }: { text: string }) {
  // Convert plain URLs into clickable links; preserve line breaks
  const parts = text.split(/(https?:\/\/[^\s)]+[\w/#?&=%-])/g)
  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed">
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
    </div>
  )
}


