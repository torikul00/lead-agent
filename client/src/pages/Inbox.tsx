import { useEffect, useRef, useState, type SubmitEvent, type SyntheticEvent } from 'react'
import { LoaderCircle, Mail, Phone, Send } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import RichTextEditor from '@/components/emailTemplates/RichTextEditor.tsx'
import CategorySelect from '@/components/categories/CategorySelect.tsx'
import type { Category, Conversation, EmailMessage } from '@/types/index.ts'

type Thread = {
    conversation: Conversation
    messages: EmailMessage[]
}

// Today's conversations show the time, older ones the date
const formatListTime = (value: string) => {
    const date = new Date(value)
    return date.toDateString() === new Date().toDateString()
        ? date.toLocaleTimeString(undefined, { timeStyle: 'short' })
        : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

// The company's favicon, or its first letter when there's no domain
function LeadAvatar({ name, domain }: { name: string; domain: string | null }) {
    if (domain) {
        return (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`} alt={`${name} favicon`} width={32} height={32} className="rounded" />
            </div>
        )
    }

    return (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
            {name.charAt(0).toUpperCase()}
        </div>
    )
}

// The frame takes the email's full height, so its own scrollbar is hidden (it would also squeeze the content while measuring)
const EMAIL_STYLES = '<style>html{overflow:hidden}body{margin:0;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#334155;overflow-wrap:anywhere}body>:first-child{margin-top:0}body>:last-child{margin-bottom:0}img{max-width:100%;height:auto}.image-toggle{display:block;margin:8px 0;padding:6px 12px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;color:#475569;font:inherit;font-size:13px;cursor:pointer}.image-toggle:hover{border-color:#047857;color:#047857}</style>'

// Images wait behind a "View image" button, so a big picture doesn't fill the conversation; once shown, a "Hide image" button above each puts them away again
const prepareImages = (html: string, showImages: boolean) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('img').forEach((image) => {
        const button = doc.createElement('button')
        button.type = 'button'
        button.className = 'image-toggle'
        button.textContent = showImages ? 'Hide image' : 'View image'
        if (showImages) image.before(button)
        else image.replaceWith(button)
    })
    return doc.documentElement.outerHTML
}

// Email HTML is shown in a sandbox, so it can't run scripts or change the page's styles
function EmailBody({ html }: { html: string }) {
    const [height, setHeight] = useState(0)
    const [showImages, setShowImages] = useState(false)

    const handleLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
        const doc = event.currentTarget.contentDocument
        if (!doc) return

        setHeight(doc.documentElement.scrollHeight)

        // Scripts can't run inside the sandbox, so the page itself listens for clicks on the image buttons
        doc.addEventListener('click', (clickEvent) => {
            if (!(clickEvent.target as HTMLElement).closest('.image-toggle')) return
            clickEvent.preventDefault()
            // Collapse first, so the frame is measured again at the new content's height instead of keeping the old one
            setHeight(0)
            setShowImages((shown) => !shown)
        })
    }

    return (
        <iframe
            title="Email"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            srcDoc={`<base target="_blank">${EMAIL_STYLES}${prepareImages(html, showImages)}`}
            onLoad={handleLoad}
            style={{ height }}
            className="w-full border-0"
        />
    )
}

export default function Inbox() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [thread, setThread] = useState<Thread | null>(null)
    const [threadError, setThreadError] = useState('')
    const [draft, setDraft] = useState('')
    const [sending, setSending] = useState(false)
    const [replyError, setReplyError] = useState('')
    // Counts sent replies; a new count clears the editor and scrolls to the new email
    const [sentCount, setSentCount] = useState(0)
    // The conversation clicked last, so a slow answer for an earlier click is ignored
    const openedId = useRef<string | null>(null)
    const lastMessageRef = useRef<HTMLElement>(null)

    useEffect(() => {
        Promise.all([api.get('/emails/conversations'), api.get('/categories')])
            .then(([conversationResponse, categoryResponse]) => {
                setConversations(conversationResponse.data.conversations)
                setCategories(categoryResponse.data.categories)
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (sentCount) lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [sentCount])

    const openConversation = async (id: string) => {
        openedId.current = id
        setSelectedId(id)
        setThread(null)
        setThreadError('')
        setDraft('')
        setReplyError('')

        try {
            const { data } = await api.get(`/emails/conversations/${id}`)
            if (openedId.current !== id) return
            setThread(data)
            setConversations((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)))
        } catch (err) {
            if (openedId.current === id) setThreadError(getErrorMessage(err))
        }
    }

    const changeCategory = async (categoryId: string | null) => {
        const leadId = thread?.conversation.lead_id
        if (!leadId) return

        try {
            await api.patch(`/leads/${leadId}/category`, { category_id: categoryId })
            setThread((current) => (current?.conversation.lead_id === leadId ? { ...current, conversation: { ...current.conversation, category_id: categoryId } } : current))
        } catch (err) {
            setThreadError(getErrorMessage(err))
        }
    }

    const sendReply = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!thread || !draft) return

        const conversationId = thread.conversation.id
        setReplyError('')
        setSending(true)

        try {
            const { data } = await api.post(`/emails/conversations/${conversationId}/reply`, { body: draft })
            setThread((current) => (current?.conversation.id === conversationId ? { ...current, messages: [...current.messages, data.message] } : current))

            // The conversation moves to the top of the list, like a new email would
            setConversations((current) => {
                const replied = current.find((item) => item.id === conversationId)
                return replied ? [{ ...replied, last_message_at: data.message.sent_at }, ...current.filter((item) => item.id !== conversationId)] : current
            })

            setDraft('')
            setSentCount((count) => count + 1)
        } catch (err) {
            setReplyError(getErrorMessage(err))
        } finally {
            setSending(false)
        }
    }

    const unreadCount = conversations.filter((item) => !item.is_read).length

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white">

            {/* Conversation list */}
            <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h1 className="font-semibold text-slate-900">Inbox</h1>
                    {unreadCount > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                            {unreadCount}
                        </span>
                    )}
                </div>

                {loading && (
                    <div className="flex justify-center py-10">
                        <LoaderCircle className="size-6 animate-spin text-primary" />
                    </div>
                )}

                {error && (
                    <div className="px-4 pt-4">
                        <FormAlert message={error} />
                    </div>
                )}

                {!loading && !error && conversations.length === 0 && (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">No conversations yet. Email a lead from a saved lead list to start one.</p>
                )}

                <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                    {conversations.map((conversation) => (
                        <li key={conversation.id}>
                            <button
                                type="button"
                                onClick={() => openConversation(conversation.id)}
                                className={`flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${selectedId === conversation.id ? 'bg-primary/5' : ''}`}
                            >
                                <LeadAvatar name={conversation.lead_name} domain={conversation.domain} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`truncate text-sm ${conversation.is_read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                                            {conversation.lead_name}
                                        </span>
                                        <span className="shrink-0 text-xs text-slate-400">{formatListTime(conversation.last_message_at)}</span>
                                    </div>
                                    {conversation.domain && <p className="truncate text-xs text-slate-500">{conversation.domain}</p>}
                                    <p className={`mt-0.5 truncate text-xs ${conversation.is_read ? 'text-slate-400' : 'text-slate-600'}`}>{conversation.subject}</p>
                                </div>
                                {!conversation.is_read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            {/* Open conversation */}
            {selectedId ? (
                <div className="flex min-w-0 flex-1 flex-col">
                    {threadError && (
                        <div className="px-6 pt-6">
                            <FormAlert message={threadError} />
                        </div>
                    )}

                    {!thread && !threadError && (
                        <div className="flex flex-1 items-center justify-center">
                            <LoaderCircle className="size-6 animate-spin text-primary" />
                        </div>
                    )}

                    {thread && (
                        <>
                            <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
                                <LeadAvatar name={thread.conversation.lead_name} domain={thread.conversation.domain} />
                                <div className="min-w-0">
                                    <h2 className="truncate font-semibold text-slate-900">{thread.conversation.lead_name}</h2>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                        <a href={`mailto:${thread.conversation.lead_email}`} className="inline-flex items-center gap-1 transition hover:text-primary">
                                            <Mail className="size-3.5" />
                                            {thread.conversation.lead_email}
                                        </a>
                                        {thread.conversation.phone && (
                                            <a href={`tel:${thread.conversation.phone}`} className="inline-flex items-center gap-1 transition hover:text-primary">
                                                <Phone className="size-3.5" />
                                                {thread.conversation.phone}
                                            </a>
                                        )}
                                        {thread.conversation.lead_id && (
                                            <CategorySelect
                                                categories={categories}
                                                value={thread.conversation.category_id}
                                                onChange={changeCategory}
                                                label={`Category for ${thread.conversation.lead_name}`}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Your emails sit on the right, the lead's replies on the left */}
                            <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
                                <div className="space-y-4">
                                    {thread.messages.map((message, index) => {
                                        const sent = message.direction === 'sent'
                                        return (
                                            <article
                                                key={message.id}
                                                ref={index === thread.messages.length - 1 ? lastMessageRef : undefined}
                                                className={`max-w-3xl rounded-2xl border bg-white px-5 py-4 shadow-sm ${sent ? 'ml-auto border-primary/20' : 'border-slate-200'}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-slate-900">{message.subject}</p>
                                                        <p className={`text-xs font-medium ${sent ? 'text-primary' : 'text-slate-500'}`}>{sent ? 'You' : thread.conversation.lead_name}</p>
                                                    </div>
                                                    <span className="shrink-0 text-xs text-slate-400">{new Date(message.sent_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                </div>
                                                <div className="mt-3 border-t border-slate-100 pt-3">
                                                    <EmailBody html={message.body} />
                                                </div>
                                            </article>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Reply */}
                            <form onSubmit={sendReply} className="border-t border-slate-200 bg-white px-6 py-4">
                                {replyError && <FormAlert message={replyError} />}
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <RichTextEditor key={`${thread.conversation.id}-${sentCount}`} value={draft} onChange={setDraft} simple />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={sending || !draft}
                                        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                                        {sending ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
                    Select a conversation to read
                </div>
            )}
        </div>
    )
}
