import { useState } from 'react'
import { Send } from 'lucide-react'

type Message = {
    id: number
    from: string
    subject: string
    preview: string
    time: string
    read: boolean
    body: string
}

type Reply = {
    messageId: number
    text: string
}

const DEMO_MESSAGES: Message[] = [
    {
        id: 1,
        from: 'Norvy Brandin',
        subject: 'Re: Partnership opportunity',
        preview: "Thanks for reaching out! I'd love to learn more about what you have in mind...",
        time: '10:24 AM',
        read: false,
        body: "Hi,\n\nThanks for reaching out! I'd love to learn more about what you have in mind. Could we schedule a quick call sometime this week?\n\nBest,\nNorvy",
    },
    {
        id: 2,
        from: 'Anna Lindqvist',
        subject: 'Question about your services',
        preview: "We've been looking for a solution like this for a while. Can you send over a proposal?",
        time: 'Yesterday',
        read: false,
        body: "Hello,\n\nWe've been looking for a solution like this for a while. Can you send over a proposal with pricing details?\n\nRegards,\nAnna",
    },
    {
        id: 3,
        from: 'Erik Svensson',
        subject: 'Intro call follow-up',
        preview: "Great speaking with you earlier! As discussed, I'm attaching our current tech stack...",
        time: 'Mon',
        read: true,
        body: "Hi,\n\nGreat speaking with you earlier! As discussed, I'm attaching our current tech stack overview. Let me know if you need anything else.\n\nCheers,\nErik",
    },
    {
        id: 4,
        from: 'Sofia Karlsson',
        subject: 'Budget approval — next steps',
        preview: 'Our finance team has approved the budget. When can we get started?',
        time: 'Sun',
        read: true,
        body: "Hello,\n\nOur finance team has approved the budget. When can we get started? We're eager to move forward as soon as possible.\n\nBest regards,\nSofia",
    },
    {
        id: 5,
        from: 'Marcus Holm',
        subject: 'Not interested at this time',
        preview: "Appreciate the outreach, but we're not looking to change providers right now...",
        time: 'Oct 25',
        read: true,
        body: "Hi,\n\nAppreciate the outreach, but we're not looking to change providers right now. Feel free to follow up in Q1 next year.\n\nThanks,\nMarcus",
    },
]

export default function Inbox() {
    const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES)
    const [selected, setSelected] = useState<Message | null>(DEMO_MESSAGES[0])
    const [replies, setReplies] = useState<Reply[]>([])
    const [draft, setDraft] = useState('')

    const selectMessage = (msg: Message) => {
        setSelected(msg)
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m)))
    }

    const sendReply = () => {
        if (!draft.trim() || !selected) return
        setReplies((prev) => [...prev, { messageId: selected.id, text: draft.trim() }])
        setDraft('')
    }

    const threadReplies = replies.filter((r) => r.messageId === selected?.id)
    const unreadCount = messages.filter((m) => !m.read).length

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white">

            {/* Message list */}
            <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h1 className="font-semibold text-slate-900">Inbox</h1>
                    {unreadCount > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {messages.map((msg) => (
                        <li key={msg.id}>
                            <button
                                type="button"
                                onClick={() => selectMessage(msg)}
                                className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${selected?.id === msg.id ? 'bg-primary/5' : ''}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className={`truncate text-sm ${msg.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                                        {msg.from}
                                    </span>
                                    <span className="shrink-0 text-xs text-slate-400">{msg.time}</span>
                                </div>
                                <p className={`mt-0.5 truncate text-xs ${msg.read ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {msg.subject}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-slate-400">{msg.preview}</p>
                                {!msg.read && (
                                    <span className="mt-1.5 inline-block size-1.5 rounded-full bg-primary" />
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            {/* Message detail + reply */}
            {selected ? (
                <div className="flex flex-1 flex-col min-w-0">
                    {/* Header */}
                    <div className="border-b border-slate-200 px-6 py-4">
                        <h2 className="font-semibold text-slate-900">{selected.subject}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">From: <span className="text-slate-700">{selected.from}</span></p>
                    </div>

                    {/* Thread */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                        {/* Original message */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                            <p className="text-xs font-medium text-slate-500 mb-2">{selected.from} · {selected.time}</p>
                            <p className="text-sm text-slate-700 whitespace-pre-line">{selected.body}</p>
                        </div>

                        {/* Sent replies */}
                        {threadReplies.map((reply, i) => (
                            <div key={i} className="ml-8 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
                                <p className="text-xs font-medium text-primary mb-2">You · just now</p>
                                <p className="text-sm text-slate-700 whitespace-pre-line">{reply.text}</p>
                            </div>
                        ))}
                    </div>

                    {/* Reply box */}
                    <div className="border-t border-slate-200 px-6 py-4">
                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition">
                            <textarea
                                rows={4}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder={`Reply to ${selected.from}...`}
                                className="w-full resize-none px-4 pt-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                            />
                            <div className="flex justify-end border-t border-slate-100 px-3 py-2">
                                <button
                                    type="button"
                                    onClick={sendReply}
                                    disabled={!draft.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Send className="size-3.5" />
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                    Select a message to read
                </div>
            )}
        </div>
    )
}
