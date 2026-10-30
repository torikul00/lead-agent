import { useState, type ReactNode, type SubmitEvent } from 'react'
import { Building2, ExternalLink, Globe, LoaderCircle, MailCheck, MapPin, Phone, Plus, Server, Users, X, type LucideIcon } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import { ContactItem, EmailLink, SourceLink } from '@/components/leads/LeadsTable.tsx'
import { FIT_LABELS, MX_LABELS, SCORE_BARS } from '@/constants/leads.ts'
import type { Lead } from '@/types/index.ts'

type LeadDetailsModalProps = {
    lead: Lead
    onClose: () => void
    // Gets the lead back after a change, such as an added email; without it the modal is read-only
    onLeadUpdate?: (lead: Lead) => void
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section>
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">{title}</h3>
                {action}
            </div>
            <div className="mt-2">{children}</div>
        </section>
    )
}

// One labelled fact in the details grid
function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
                <p className="text-xs text-slate-500">{label}</p>
                <div className="mt-0.5 text-sm font-medium break-words text-slate-900">{children}</div>
            </div>
        </div>
    )
}

// Everything known about a lead; it only needs the lead itself, so any page can open it
export default function LeadDetailsModal({ lead, onClose, onLeadUpdate }: LeadDetailsModalProps) {
    const [addingEmail, setAddingEmail] = useState(false)
    const [newEmail, setNewEmail] = useState('')
    const [savingEmail, setSavingEmail] = useState(false)
    const [emailError, setEmailError] = useState('')
    const fit = FIT_LABELS[lead.fit_label]
    const mx = MX_LABELS[lead.mx_status]
    const category = typeof lead.category_id === 'object' ? lead.category_id : null
    // Only a saved lead can get new emails
    const canAddEmail = Boolean(lead.id && onLeadUpdate)

    // An email typed in by hand is saved with "Manual" as its source
    const addEmail = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        setEmailError('')
        setSavingEmail(true)

        try {
            const { data } = await api.post(`/leads/${lead.id}/company_emails`, { email: newEmail })
            onLeadUpdate?.({ ...lead, company_emails: data.company_emails })
            setNewEmail('')
            setAddingEmail(false)
        } catch (err) {
            setEmailError(getErrorMessage(err))
        } finally {
            setSavingEmail(false)
        }
    }

    const cancelAddEmail = () => {
        setAddingEmail(false)
        setNewEmail('')
        setEmailError('')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="lead-details-title" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start gap-4 border-b border-slate-200 px-6 py-5 sm:px-8">
                    {lead.domain ? (
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                            <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(lead.domain)}&sz=128`} alt={`${lead.name} favicon`} width={40} height={40} className="rounded" />
                        </div>
                    ) : (
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
                            {lead.name.charAt(0).toUpperCase()}
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <h2 id="lead-details-title" className="text-xl font-bold text-slate-900">{lead.name}</h2>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {lead.domain && (
                                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-primary">
                                    {lead.domain}
                                    <ExternalLink className="size-3.5" />
                                </a>
                            )}
                            {category && (
                                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${category.color}1a`, color: category.color }}>
                                    {category.name}
                                </span>
                            )}
                            {lead.is_mail_sent && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                    <MailCheck className="size-3.5" />
                                    Emailed
                                </span>
                            )}
                        </div>
                    </div>

                    <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                        <X className="size-5" />
                    </button>
                </div>

                <div className="space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Detail icon={Building2} label="Industry">
                            <span className="capitalize">{lead.industry ?? '—'}</span>
                        </Detail>
                        <Detail icon={Users} label="Employees">{lead.employee_count?.toLocaleString() ?? '—'}</Detail>
                        <Detail icon={MapPin} label="Location">{lead.address ? `${lead.address}, ${lead.country}` : lead.country}</Detail>
                        <Detail icon={Phone} label="Phone">
                            {lead.phone ? <a href={`tel:${lead.phone}`} className="transition hover:text-primary">{lead.phone}</a> : '—'}
                        </Detail>
                        <Detail icon={Server} label="Mail server">
                            <span className="inline-flex items-center gap-2">
                                <span className={`size-2 rounded-full ${mx.dot}`} />
                                {lead.email_provider ?? mx.label}
                            </span>
                        </Detail>
                        <Detail icon={Globe} label="Found on">
                            {lead.source_url ? (
                                <a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-primary">
                                    {lead.source_name}
                                    <ExternalLink className="size-3.5" />
                                </a>
                            ) : lead.source_name}
                        </Detail>
                    </div>

                    <Section
                        title="Company emails"
                        action={canAddEmail && !addingEmail && (
                            <button type="button" onClick={() => setAddingEmail(true)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                                <Plus className="size-3.5" />
                                Add email
                            </button>
                        )}
                    >
                        {lead.company_emails.length > 0 && (
                            <ul className="space-y-1">
                                {lead.company_emails.map((item) => (
                                    <li key={item.email} className="flex items-center gap-2">
                                        <EmailLink email={item.email} />
                                        <SourceLink name={item.source_name} url={item.source_url} />
                                    </li>
                                ))}
                            </ul>
                        )}
                        {lead.company_emails.length === 0 && !addingEmail && <p className="text-sm text-slate-500">No company email found.</p>}

                        {addingEmail && (
                            <form onSubmit={addEmail} noValidate className="mt-3 flex flex-wrap items-center gap-2">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(event) => setNewEmail(event.target.value)}
                                    placeholder="name@company.com"
                                    aria-label="New company email"
                                    autoFocus
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15 sm:max-w-sm"
                                />
                                <button type="submit" disabled={savingEmail || !newEmail.trim()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                                    {savingEmail && <LoaderCircle className="size-4 animate-spin" />}
                                    Save
                                </button>
                                <button type="button" onClick={cancelAddEmail} disabled={savingEmail} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed">
                                    Cancel
                                </button>
                            </form>
                        )}
                        {emailError && <p className="mt-1.5 text-sm text-red-600">{emailError}</p>}
                    </Section>

                    <Section title="Score">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-slate-900">{lead.score}</span>
                            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${SCORE_BARS[lead.fit_label]}`} style={{ width: `${lead.score}%` }} />
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${fit.className}`}>{fit.label}</span>
                        </div>
                        {lead.score_reasons.length > 0 && (
                            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                                {lead.score_reasons.map((reason) => <li key={reason}>{reason}</li>)}
                            </ul>
                        )}
                    </Section>

                    <Section title="About">
                        <p className="text-sm text-slate-700">{lead.description ?? 'No description available.'}</p>
                    </Section>

                    <Section title="Decision makers">
                        {lead.contacts.length > 0 ? (
                            <ul className="grid gap-2 sm:grid-cols-2">
                                {lead.contacts.map((contact) => <ContactItem key={contact.name} contact={contact} />)}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-500">No decision makers found.</p>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    )
}
