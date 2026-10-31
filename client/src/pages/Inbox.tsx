import { useEffect, useEffectEvent, useRef, useState, type SubmitEvent, type SyntheticEvent } from 'react'
import { EllipsisVertical, LoaderCircle, Mail, Phone, RefreshCw, Send, Trash2 } from 'lucide-react'
import api from '@/lib/axios.ts'
import socket from '@/lib/socket.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import useInboxStore from '@/store/inbox.store.ts'
import FormAlert from '@/components/FormAlert.tsx'
import ConfirmationModal from '@/components/ConfirmationModal.tsx'
import MailboxProviderIcon from '@/components/MailboxProviderIcon.tsx'
import RichTextEditor from '@/components/emailTemplates/RichTextEditor.tsx'
import CategorySelect from '@/components/categories/CategorySelect.tsx'
import type { Category, Conversation, EmailMessage, MailboxProvider } from '@/types/index.ts'

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

// The company's favicon, or its first letter when there's no domain; the corner badge shows which mailbox the conversation is through
function LeadAvatar({ name, domain, provider }: { name: string; domain: string | null; provider: MailboxProvider }) {
    return (
        <div className="relative shrink-0">
            {domain ? (
                <div className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`} alt={`${name} favicon`} width={32} height={32} className="rounded" />
                </div>
            ) : (
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                    {name.charAt(0).toUpperCase()}
                </div>
            )}
            <MailboxProviderIcon provider={provider} className="absolute -right-1 -bottom-1 size-4 rounded-full bg-white ring-2 ring-white" />
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

// The ⋮ menu in the conversation header; for now it only has delete
function ConversationMenu({ onDelete }: { onDelete: () => void }) {
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close the menu when clicking anywhere outside it
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setOpen(!open)} aria-label="Conversation options" aria-expanded={open} className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                <EllipsisVertical className="size-5" />
            </button>

            {open && (
                <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false)
                            onDelete()
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                    >
                        <Trash2 className="size-4" />
                        Delete conversation
                    </button>
                </div>
            )}
        </div>
    )
}

export default function Inbox() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState(false)
    const [error, setError] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [thread, setThread] = useState<Thread | null>(null)
    const [threadError, setThreadError] = useState('')
    const [draft, setDraft] = useState('')
    const [sending, setSending] = useState(false)
    const [replyError, setReplyError] = useState('')
    // Counts sent replies; a new count clears the editor
    const [sentCount, setSentCount] = useState(0)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    // The conversation clicked last, so a slow answer for an earlier click is ignored
    const openedId = useRef<string | null>(null)
    const threadRef = useRef<HTMLDivElement>(null)
    const threadContentRef = useRef<HTMLDivElement>(null)
    // While the conversation is scrolled to the bottom it stays there, also as email bodies load or new emails arrive
    const atBottom = useRef(true)
    const fetchUnreadCount = useInboxStore((state) => state.fetchUnreadCount)

    useEffect(() => {
        Promise.all([api.get('/emails/conversations'), api.get('/categories')])
            .then(([conversationResponse, categoryResponse]) => {
                setConversations(conversationResponse.data.conversations)
                setCategories(categoryResponse.data.categories)
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [])

    // Email bodies finish loading after the conversation opens and grow, so the scroll follows them while it's at the bottom
    useEffect(() => {
        const container = threadRef.current
        const content = threadContentRef.current
        if (!container || !content) return

        const observer = new ResizeObserver(() => {
            if (atBottom.current) container.scrollTop = container.scrollHeight
        })
        observer.observe(content)
        return () => observer.disconnect()
    }, [thread?.conversation.id])

    const openConversation = async (id: string) => {
        openedId.current = id
        atBottom.current = true
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
            fetchUnreadCount()
        } catch (err) {
            if (openedId.current === id) setThreadError(getErrorMessage(err))
        }
    }

    // Reload the list, and the open conversation when it may have new emails; the open one counts as read since it's on screen
    const reloadInbox = async (changedIds?: string[]) => {
        const openId = openedId.current
        const { data } = await api.get('/emails/conversations')
        setConversations(data.conversations.map((item: Conversation) => (item.id === openId ? { ...item, is_read: true } : item)))

        if (openId && (!changedIds || changedIds.includes(openId))) {
            const { data: threadData } = await api.get(`/emails/conversations/${openId}`)
            if (openedId.current === openId) setThread(threadData)
        }

        // Updated last, after the open conversation was marked read
        fetchUnreadCount()
    }

    // The server reports new emails (usually lead replies) as soon as it saves them
    const onInboxUpdated = useEffectEvent((changedIds: string[]) => {
        // A failed background reload is fixed by the next update or refresh
        reloadInbox(changedIds).catch(() => {})
    })

    useEffect(() => {
        const handleInboxUpdated = ({ conversation_ids }: { conversation_ids: string[] }) => onInboxUpdated(conversation_ids)
        socket.on('inbox_updated', handleInboxUpdated)
        return () => {
            socket.off('inbox_updated', handleInboxUpdated)
        }
    }, [])

    // Check the mailboxes right away instead of waiting for the next automatic check
    const checkReplies = async () => {
        setChecking(true)
        setError('')

        try {
            await api.post('/emails/check_replies')
            await reloadInbox()
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setChecking(false)
        }
    }

    const changeCategory = async (categoryId: string | null) => {
        const leadId = thread?.conversation.lead_id
        if (!leadId) return

        try {
            await api.patch(`/leads/${leadId}/category`, { category_id: categoryId })
            setThread((current) => (current?.conversation.lead_id === leadId ? { ...current, conversation: { ...current.conversation, category_id: categoryId } } : current))
            // Every conversation with this lead shows the new category tag
            setConversations((current) => current.map((item) => (item.lead_id === leadId ? { ...item, category_id: categoryId } : item)))
        } catch (err) {
            setThreadError(getErrorMessage(err))
        }
    }

    // Removed from LeadAgent only; the emails stay in the mailbox
    const deleteConversation = async () => {
        if (!thread) return
        const conversationId = thread.conversation.id
        setDeleteLoading(true)

        try {
            await api.delete(`/emails/conversations/${conversationId}`)
            setConversations((current) => current.filter((item) => item.id !== conversationId))
            openedId.current = null
            setSelectedId(null)
            setThread(null)
            fetchUnreadCount()
        } catch (err) {
            setThreadError(getErrorMessage(err))
        } finally {
            setDeleteLoading(false)
            setConfirmDelete(false)
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
            atBottom.current = true
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
        // The negative margins cancel the dashboard's page padding, so the inbox fills everything below the header
        <div className="-m-4 flex h-[calc(100vh-4rem)] overflow-hidden bg-white sm:-m-6 lg:-m-8">

            {/* Conversation list */}
            <aside className="flex w-96 shrink-0 flex-col border-r border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <h1 className="font-semibold text-slate-900">Inbox</h1>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={checkReplies}
                        disabled={checking}
                        title="Check for new replies"
                        aria-label="Check for new replies"
                        className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`size-4 ${checking ? 'animate-spin' : ''}`} />
                    </button>
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
                    {conversations.map((conversation) => {
                        const category = categories.find((item) => item.id === conversation.category_id)
                        return (
                            <li key={conversation.id}>
                                <button
                                    type="button"
                                    onClick={() => openConversation(conversation.id)}
                                    className={`flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${selectedId === conversation.id ? 'bg-primary/5' : ''}`}
                                >
                                    <LeadAvatar name={conversation.lead_name} domain={conversation.domain} provider={conversation.provider} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`truncate text-sm ${conversation.is_read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                                                {conversation.lead_name}
                                            </span>
                                            <span className="shrink-0 text-xs text-slate-400">{formatListTime(conversation.last_message_at)}</span>
                                        </div>
                                        {conversation.domain && <p className="truncate text-xs text-slate-500">{conversation.domain}</p>}
                                        {/* The category color tints the tag: a light background with the color as text */}
                                        {category && (
                                            <span className="mt-1 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${category.color}1a`, color: category.color }}>
                                                {category.name}
                                            </span>
                                        )}
                                    </div>
                                    {!conversation.is_read && <span className="size-2 shrink-0 rounded-full bg-blue-500" />}
                                </button>
                            </li>
                        )
                    })}
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
                                <LeadAvatar name={thread.conversation.lead_name} domain={thread.conversation.domain} provider={thread.conversation.provider} />
                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate font-semibold text-slate-900">{thread.conversation.lead_name}</h2>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
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
                                        {/* The negative margin keeps the taller dropdown from pushing the email and phone away from the name */}
                                        {thread.conversation.lead_id && (
                                            <div className="-my-1">
                                                <CategorySelect
                                                    categories={categories}
                                                    value={thread.conversation.category_id}
                                                    onChange={changeCategory}
                                                    label={`Category for ${thread.conversation.lead_name}`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <ConversationMenu onDelete={() => setConfirmDelete(true)} />
                            </div>

                            {/* Your emails sit on the right, the lead's replies on the left */}
                            <div
                                ref={threadRef}
                                // Within 40px of the bottom counts as at the bottom; scrolling up stops following new emails
                                onScroll={(event) => {
                                    const container = event.currentTarget
                                    atBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < 40
                                }}
                                className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6"
                            >
                                <div ref={threadContentRef} className="space-y-4">
                                    {thread.messages.map((message) => {
                                        const sent = message.direction === 'sent'
                                        return (
                                            <article
                                                key={message.id}
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

            {confirmDelete && thread && (
                <ConfirmationModal
                    title="Delete conversation"
                    message={`Delete your conversation with ${thread.conversation.lead_name}? It's removed from LeadAgent only; the emails stay in your mailbox.`}
                    confirmLabel="Delete conversation"
                    loading={deleteLoading}
                    onConfirm={deleteConversation}
                    onClose={() => setConfirmDelete(false)}
                />
            )}
        </div>
    )
}
