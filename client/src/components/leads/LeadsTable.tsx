import { Fragment, useState, type SyntheticEvent } from 'react'
import { Check, Copy, ExternalLink, LoaderCircle, Mail, MailCheck, Phone, Send } from 'lucide-react'
import Select from 'react-select'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import { FIT_LABELS, MX_LABELS, SCORE_BARS } from '@/constants/leads.ts'
import type { Category, Contact, Lead } from '@/types/index.ts'

type CategoryOption = {
    value: string
    label: string
    color: string
}

const categorySelectClassNames = {
    control: ({ isFocused }: { isFocused: boolean }) => `min-h-9 min-w-40 cursor-pointer rounded-lg border bg-white px-2 text-xs transition ${isFocused ? 'border-primary ring-4 ring-primary/15' : 'border-slate-200 hover:border-slate-300'}`,
    valueContainer: () => 'px-1',
    singleValue: () => 'text-slate-700',
    input: () => 'text-slate-700',
    indicatorsContainer: () => 'text-slate-400',
    dropdownIndicator: () => 'p-1',
    menu: () => 'z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg',
    option: ({ isSelected, isFocused }: { isSelected: boolean; isFocused: boolean }) => `cursor-pointer rounded-md px-2 py-1.5 text-xs ${isSelected ? 'bg-primary/10 font-medium text-primary' : isFocused ? 'bg-slate-100 text-slate-900' : 'text-slate-700'}`,
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }

    return (
        <button type="button" onClick={copy} aria-label={`Copy ${text}`} className="cursor-pointer rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
        </button>
    )
}

export function EmailLink({ email }: { email: string }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-0.5">
            <a href={`mailto:${email}`} className="truncate text-sm text-primary hover:underline">{email}</a>
            <CopyButton text={email} />
        </span>
    )
}

// Icon link to where an item was found; the source name shows on hover. Items added by hand have no page, so their source shows as text
export function SourceLink({ name, url }: { name: string; url: string | null }) {
    if (!url) return <span className="shrink-0 text-xs text-slate-400">{name}</span>

    return (
        <a href={url} target="_blank" rel="noopener noreferrer" title={`Found on ${name}`} aria-label={`Found on ${name}`} className="shrink-0 text-slate-300 transition hover:text-primary">
            <ExternalLink className="size-3.5" />
        </a>
    )
}

export function ContactItem({ contact }: { contact: Contact }) {
    return (
        <li className="min-w-0 rounded-lg border border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium text-slate-900">{contact.name}</span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs leading-none font-medium text-primary">{contact.role}</span>
                </p>
                <SourceLink name={contact.source_name} url={contact.source_url} />
            </div>
            {contact.title !== contact.role && <p className="truncate text-xs text-slate-500" title={contact.title}>{contact.title}</p>}

            {(contact.email || contact.phone || contact.linkedin_url) && (
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                    {contact.email && <EmailLink email={contact.email} />}
                    {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600 transition hover:text-primary">
                            <Phone className="size-3" />
                            {contact.phone}
                        </a>
                    )}
                    {contact.linkedin_url && (
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-slate-500 transition hover:text-primary">LinkedIn</a>
                    )}
                </div>
            )}
        </li>
    )
}

// Looks the company up on Hunter; that spends Hunter credits, so it only runs on click
function FindEmailsButton({ lead, onUpdate }: { lead: Lead; onUpdate: (lead: Lead) => void }) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

    const findEmails = async () => {
        setLoading(true)
        setMessage(null)

        try {
            const { data } = await api.post('/leads/find_emails', { domain: lead.domain, contacts: lead.contacts, company_emails: lead.company_emails })
            onUpdate({ ...lead, contacts: data.contacts, company_emails: data.company_emails })
            setMessage({ text: data.new_emails ? `${data.new_emails} new ${data.new_emails === 1 ? 'email' : 'emails'} found` : 'No new emails found', error: false })
        } catch (err) {
            setMessage({ text: getErrorMessage(err), error: true })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {message && <span className={`text-xs ${message.error ? 'text-red-600' : 'text-slate-500'}`}>{message.text}</span>}
            <button type="button" onClick={findEmails} disabled={loading} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                {loading ? 'Finding emails...' : 'Find emails'}
            </button>
        </div>
    )
}

// Selecting rows and finding emails are optional, so a saved list can show the table read-only
type LeadsTableProps = {
    leads: Lead[]
    selected?: string[]
    onSelectedChange?: (selected: string[]) => void
    onLeadUpdate?: (lead: Lead) => void
    categories?: Category[]
    onCategoryChange?: (lead: Lead, categoryId: string | null) => Promise<void>
    onSendEmail?: (lead: Lead) => void
    onOpenLead?: (lead: Lead) => void
}

export default function LeadsTable({ leads, selected = [], onSelectedChange, onLeadUpdate, categories = [], onCategoryChange, onSendEmail, onOpenLead }: LeadsTableProps) {
    const [openRow, setOpenRow] = useState<string | null>(null)
    const allSelected = leads.length > 0 && selected.length === leads.length

    const toggleAll = () => onSelectedChange?.(allSelected ? [] : leads.map((lead) => lead.domain ?? lead.name))

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-260 text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    <tr>
                        {onSelectedChange && (
                            <th className="w-10 py-3 pr-2 pl-6">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = selected.length > 0 && !allSelected
                                    }}
                                    onChange={toggleAll}
                                    aria-label="Select all companies"
                                    className="size-4 cursor-pointer accent-primary"
                                />
                            </th>
                        )}
                        <th className={`py-3 ${onSelectedChange ? 'px-4' : 'px-6'}`}>Company</th>
                        {onCategoryChange && <th className="px-4 py-3">Category</th>}
                        <th className="px-4 py-3">Industry</th>
                        <th className="px-4 py-3">Employees</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Contacts</th>
                        <th className="px-4 py-3">Mail server</th>
                        <th className="py-3 pr-6 pl-4">Score</th>
                        {onSendEmail && <th className="py-3 pr-6 pl-2"><span className="sr-only">Send email</span></th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => {
                        const key = lead.domain ?? lead.name
                        const open = openRow === key
                        const checked = selected.includes(key)
                        const fit = FIT_LABELS[lead.fit_label]
                        const mx = MX_LABELS[lead.mx_status]
                        const [firstContact] = lead.contacts
                        const emailCount = lead.company_emails.length + lead.contacts.filter((contact) => contact.email).length
                        const toggle = () => setOpenRow(open ? null : key)
                        const assignedCategory = typeof lead.category_id === 'object' && lead.category_id ? lead.category_id._id : lead.category_id
                        const categoryOptions: CategoryOption[] = [
                            { value: '', label: 'Uncategorized', color: '#94a3b8' },
                            ...categories.map((category) => ({ value: category.id, label: category.name, color: category.color })),
                        ]
                        const selectedCategory = categoryOptions.find((category) => category.value === (assignedCategory ?? '')) ?? categoryOptions[0]

                        // The logo and name open the lead's details, without also expanding the row
                        const openDetails = (event: SyntheticEvent) => {
                            event.stopPropagation()
                            onOpenLead?.(lead)
                        }

                        const logo = lead.domain ? (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                                <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(lead.domain)}&sz=128`} alt={`${lead.name} favicon`} width={32} height={32} className="rounded" />
                            </div>
                        ) : (
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                                {lead.name.charAt(0).toUpperCase()}
                            </div>
                        )

                        return (
                            <Fragment key={key}>
                                {/* The whole row opens the details; Enter or Space does the same for keyboard users */}
                                <tr
                                    onClick={toggle}
                                    onKeyDown={(e) => {
                                        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
                                        e.preventDefault()
                                        toggle()
                                    }}
                                    tabIndex={0}
                                    aria-expanded={open}
                                    className={`cursor-pointer transition outline-none hover:bg-slate-50/80 focus-visible:bg-slate-100 ${open ? 'bg-slate-50/80' : ''}`}
                                >
                                    {onSelectedChange && (
                                        <td className="py-4 pr-2 pl-6" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => onSelectedChange(checked ? selected.filter((item) => item !== key) : [...selected, key])}
                                                aria-label={`Select ${lead.name}`}
                                                className="size-4 cursor-pointer accent-primary"
                                            />
                                        </td>
                                    )}
                                    <td className={`py-4 ${onSelectedChange ? 'px-4' : 'px-6'}`}>
                                        <div className="flex items-center gap-3">
                                            {onOpenLead ? (
                                                <button type="button" onClick={openDetails} aria-label={`View details of ${lead.name}`} className="shrink-0 cursor-pointer rounded-xl transition hover:opacity-80">
                                                    {logo}
                                                </button>
                                            ) : logo}
                                            <div className="min-w-0">
                                                {onOpenLead ? (
                                                    <button type="button" onClick={openDetails} className="block max-w-full cursor-pointer truncate text-left font-medium text-slate-900 transition hover:text-primary">
                                                        {lead.name}
                                                    </button>
                                                ) : (
                                                    <p className="truncate font-medium text-slate-900">{lead.name}</p>
                                                )}
                                                {lead.domain && (
                                                    <a href={lead.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-primary">
                                                        {lead.domain}
                                                        <ExternalLink className="size-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    {onCategoryChange && (
                                        <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                                            <Select<CategoryOption>
                                                unstyled
                                                options={categoryOptions}
                                                value={selectedCategory}
                                                onChange={(option) => void onCategoryChange(lead, option?.value || null)}
                                                isSearchable={false}
                                                menuPlacement="auto"
                                                classNames={categorySelectClassNames}
                                                formatOptionLabel={(option) => (
                                                    <span className="flex items-center gap-2">
                                                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                                                        {option.label}
                                                    </span>
                                                )}
                                                aria-label={`Category for ${lead.name}`}
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-4">
                                        <p className="max-w-50 truncate text-slate-600 capitalize" title={lead.industry ?? undefined}>{lead.industry ?? '—'}</p>
                                    </td>
                                    <td className="px-4 py-4 text-slate-600">{lead.employee_count?.toLocaleString() ?? '—'}</td>
                                    <td className="px-4 py-4">
                                        <p className="text-slate-900">{lead.address ?? '—'}</p>
                                        <p className="text-xs text-slate-500">{lead.country}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        {firstContact && (
                                            <>
                                                <p className="max-w-45 truncate font-medium text-slate-900">{firstContact.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {firstContact.role}
                                                    {lead.contacts.length > 1 && ` · +${lead.contacts.length - 1} more`}
                                                </p>
                                            </>
                                        )}
                                        {emailCount > 0 && (
                                            <p className={`flex items-center gap-1 text-xs text-slate-500 ${firstContact ? 'mt-1' : ''}`}>
                                                <Mail className="size-3.5" />
                                                {emailCount} {emailCount === 1 ? 'email' : 'emails'}
                                            </p>
                                        )}
                                        {!firstContact && !emailCount && <span className="text-slate-600">—</span>}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex items-center gap-2 text-slate-600">
                                            <span className={`size-2 rounded-full ${mx.dot}`} />
                                            {lead.email_provider ?? mx.label}
                                        </span>
                                    </td>
                                    <td className="py-4 pr-6 pl-4">
                                        <div className="flex items-center gap-3">
                                            <span className="w-7 font-semibold text-slate-900">{lead.score}</span>
                                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                                <div className={`h-full rounded-full ${SCORE_BARS[lead.fit_label]}`} style={{ width: `${lead.score}%` }} />
                                            </div>
                                        </div>
                                        <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${fit.className}`}>{fit.label}</span>
                                    </td>
                                    {onSendEmail && (
                                        <td className="py-4 pr-6 pl-2 text-right" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => onSendEmail(lead)}
                                                disabled={!lead.company_emails.length}
                                                title={!lead.company_emails.length ? 'No company email' : lead.is_mail_sent ? 'Email sent · send again' : 'Send email'}
                                                aria-label={`Send email to ${lead.name}`}
                                                className={`cursor-pointer rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${lead.is_mail_sent ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-500 hover:bg-primary/10 hover:text-primary'}`}
                                            >
                                                {lead.is_mail_sent ? <MailCheck className="size-4" /> : <Send className="size-4" />}
                                            </button>
                                        </td>
                                    )}
                                </tr>

                                {open && (
                                    <tr className="bg-slate-50/80">
                                        <td colSpan={(onSelectedChange ? 8 : 7) + (onCategoryChange ? 1 : 0) + (onSendEmail ? 1 : 0)} className="px-6 pb-4">
                                            <div className="grid grid-cols-[1fr_2fr_1fr] gap-6 rounded-xl border border-slate-200 bg-white p-4">
                                                <div>
                                                    <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">About</h3>
                                                    <p className="mt-1.5 text-sm text-slate-700">{lead.description ?? 'No description available.'}</p>
                                                </div>

                                                <div className="min-w-0">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Decision makers</h3>
                                                        {lead.domain && onLeadUpdate && <FindEmailsButton lead={lead} onUpdate={onLeadUpdate} />}
                                                    </div>
                                                    {lead.contacts.length > 0 ? (
                                                        <ul className="mt-2 grid grid-cols-2 gap-2">
                                                            {lead.contacts.map((contact) => <ContactItem key={contact.name} contact={contact} />)}
                                                        </ul>
                                                    ) : (
                                                        <p className="mt-2 text-sm text-slate-500">No decision makers found.</p>
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Company contact</h3>
                                                    {lead.company_emails.length > 0 ? (
                                                        <ul className="mt-1.5 space-y-1">
                                                            {lead.company_emails.map((item) => (
                                                                <li key={item.email} className="flex items-center justify-between gap-2">
                                                                    <EmailLink email={item.email} />
                                                                    <SourceLink name={item.source_name} url={item.source_url} />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="mt-1.5 text-sm text-slate-500">No company email found.</p>
                                                    )}
                                                    {lead.phone && (
                                                        <a href={`tel:${lead.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-700 transition hover:text-primary">
                                                            <Phone className="size-3.5 text-slate-400" />
                                                            {lead.phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
