import { useEffect, useRef, useState } from 'react'
import { sendChat, type ChatMessage } from '../lib/nexora'

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm the Nexora Assistant. Ask me about TMU loans, the documents you need, or where your application stands.",
}

const SUGGESTIONS = ['What documents do I need?', 'What is the status of my application?', 'How much will a loan cost?']

/** Floating help chat. Mount only for signed-in customers (borrowers). */
export default function CustomerChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, open])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    setError('')
    setBusy(true)
    try {
      // The greeting is UI only; the model conversation starts with the customer's first message.
      const reply = await sendChat(next.filter((m) => m !== GREETING))
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label="Customer assistant"
          className="w-[calc(100vw-2rem)] sm:w-[360px] h-[min(32rem,calc(100vh-7rem))] flex flex-col rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-on-primary">
            <div>
              <div className="font-semibold text-[14px]">Nexora Assistant</div>
              <div className="text-[11px] opacity-80">AI help — staff make all loan decisions</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-xl leading-none px-2 hover:opacity-80">
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-[13px]">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                    m.role === 'user' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-[12px] px-3 py-1.5 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {busy && <div className="text-[12px] text-on-surface-variant px-1">Typing…</div>}
            {error && <div className="text-[12px] text-red-600 px-1">{error}</div>}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-outline-variant p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Type your question…"
              aria-label="Message"
              className="flex-1 rounded-full border border-outline-variant bg-surface px-4 py-2 text-[13px] text-on-surface outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full bg-primary text-on-primary px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
            >
              Send
            </button>
          </form>
          <div className="px-3 pb-2 text-[10px] text-on-surface-variant text-center">
            Don't share ID, bank account numbers or passwords here.
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        className="h-14 w-14 rounded-full bg-primary text-on-primary shadow-xl text-2xl flex items-center justify-center hover:opacity-90"
      >
        {open ? '×' : '💬'}
      </button>
    </div>
  )
}
