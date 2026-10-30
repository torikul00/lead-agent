import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { LoaderCircle, Mail, Plus, RefreshCw, Unplug } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import { MAILBOX_PROVIDERS } from '@/constants/emails.ts'
import type { Mailbox, MailboxProvider } from '@/types/index.ts'

type Alert = {
    message: string
    type: 'error' | 'success'
}

// The server adds ?mailbox=<result> when Google or Microsoft send the user back here
const CONNECT_RESULTS: Record<string, Alert> = {
    connected: { message: 'Mailbox connected.', type: 'success' },
    cancelled: { message: 'Connecting the mailbox was cancelled.', type: 'error' },
    missing_permissions: { message: 'Please allow LeadAgent to both read and send email, then try again.', type: 'error' },
    error: { message: 'Could not connect your mailbox. Please try again.', type: 'error' },
}

export default function Settings() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
    const [loading, setLoading] = useState(true)
    const [alert, setAlert] = useState<Alert | null>(() => CONNECT_RESULTS[searchParams.get('mailbox') ?? ''] ?? null)
    // The provider being connected or the mailbox being disconnected
    const [busy, setBusy] = useState<string | null>(null)

    useEffect(() => {
        api.get('/emails/mailboxes')
            .then(({ data }) => setMailboxes(data.mailboxes))
            .catch((err) => setAlert({ message: getErrorMessage(err), type: 'error' }))
            .finally(() => setLoading(false))
    }, [])

    // Drop the sign-in result from the URL so a refresh doesn't show it again
    useEffect(() => {
        if (searchParams.has('mailbox')) setSearchParams({}, { replace: true })
    }, [searchParams, setSearchParams])

    const connect = async (provider: MailboxProvider) => {
        setBusy(provider)
        setAlert(null)

        try {
            const { data } = await api.get(`/emails/mailboxes/${provider}/connect`)
            // Google or Microsoft send the user back to this page when they're done
            window.location.href = data.url
        } catch (err) {
            setAlert({ message: getErrorMessage(err), type: 'error' })
            setBusy(null)
        }
    }

    const disconnect = async (mailbox: Mailbox) => {
        if (!window.confirm(`Disconnect ${mailbox.email}? You can connect it again any time.`)) return
        setBusy(mailbox.id)
        setAlert(null)

        try {
            const { data } = await api.post(`/emails/mailboxes/${mailbox.id}/disconnect`)
            setMailboxes((current) => current.map((item) => (item.id === mailbox.id ? data.mailbox : item)))
        } catch (err) {
            setAlert({ message: getErrorMessage(err), type: 'error' })
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                <p className="mt-1 text-sm text-slate-500">Manage the mailboxes you email your leads from.</p>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-slate-900">Email accounts</h2>
                <p className="text-sm text-slate-500">Lead emails are sent from your own mailbox. Only your conversations with leads show in the Inbox.</p>

                <div className="mt-6">
                    {alert && <FormAlert message={alert.message} type={alert.type} />}

                    <div className="grid gap-3 sm:grid-cols-2">
                        {MAILBOX_PROVIDERS.map(({ key, label, description }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => connect(key)}
                                disabled={busy !== null}
                                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    {busy === key ? <LoaderCircle className="size-5 animate-spin" /> : <Plus className="size-5" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-slate-900">Connect {label}</p>
                                    <p className="text-xs text-slate-500">{description}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {loading && (
                        <div className="mt-6 flex justify-center py-6">
                            <LoaderCircle className="size-6 animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && mailboxes.length === 0 && (
                        <p className="mt-6 text-sm text-slate-500">No mailboxes connected yet.</p>
                    )}

                    {!loading && mailboxes.length > 0 && (
                        <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
                            {mailboxes.map((mailbox) => {
                                const connected = mailbox.status === 'connected'
                                const provider = MAILBOX_PROVIDERS.find(({ key }) => key === mailbox.provider)

                                return (
                                    <li key={mailbox.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Mail className="size-5 shrink-0 text-slate-400" />
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-slate-900">{mailbox.email}</p>
                                                <p className="text-xs text-slate-500">{provider?.label}</p>
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${connected ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20'}`}>
                                                {connected ? 'Connected' : 'Disconnected'}
                                            </span>
                                        </div>

                                        {connected ? (
                                            <button type="button" onClick={() => disconnect(mailbox)} disabled={busy !== null} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                                                {busy === mailbox.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Unplug className="size-3.5" />}
                                                Disconnect
                                            </button>
                                        ) : (
                                            <button type="button" onClick={() => connect(mailbox.provider)} disabled={busy !== null} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                                                <RefreshCw className="size-3.5" />
                                                Connect again
                                            </button>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    )
}
