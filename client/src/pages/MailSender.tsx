import { useEffect, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { isAxiosError } from 'axios'
import { CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import SelectField from '@/components/SelectField.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import { MAX_LEADS } from '@/constants/leads.ts'
import type { EmailTemplate, Lead, LeadList, Mailbox } from '@/types/index.ts'

type SendResult = {
    sent: number
    skipped_leads: string[]
    failed_leads: string[]
}

export default function MailSender() {
    const [lists, setLists] = useState<LeadList[]>([])
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [listId, setListId] = useState('')
    const [mailboxId, setMailboxId] = useState('')
    const [templateId, setTemplateId] = useState('')
    const [loaded, setLoaded] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<SendResult | null>(null)

    useEffect(() => {
        Promise.all([api.get('/leads/lists'), api.get('/emails/mailboxes'), api.get('/emails/templates')])
            .then(([listResponse, mailboxResponse, templateResponse]) => {
                const connected = mailboxResponse.data.mailboxes.filter((mailbox: Mailbox) => mailbox.status === 'connected')
                setLists(listResponse.data.lists)
                setMailboxes(connected)
                setMailboxId(connected[0]?.id ?? '')
                setTemplates(templateResponse.data.templates)
                setLoaded(true)
            })
            .catch((err) => setError(getErrorMessage(err)))
    }, [])

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!listId || !mailboxId || !templateId) {
            setError('Choose a lead list, a mailbox and a template.')
            return
        }

        setError('')
        setResult(null)
        setSending(true)

        const total: SendResult = { sent: 0, skipped_leads: [], failed_leads: [] }
        const addToTotal = (part: SendResult) => {
            total.sent += part.sent
            total.skipped_leads.push(...part.skipped_leads)
            total.failed_leads.push(...part.failed_leads)
        }

        try {
            const { data } = await api.get(`/leads/lists/${listId}`)
            const leadIds = data.leads.map((lead: Lead) => lead.id)
            if (!leadIds.length) setError('This list has no leads.')

            // The server takes a limited number of leads per request, so a big list goes in parts
            for (let start = 0; start < leadIds.length; start += MAX_LEADS) {
                const { data: part } = await api.post('/emails/send_bulk', { mailbox_id: mailboxId, template_id: templateId, lead_ids: leadIds.slice(start, start + MAX_LEADS) })
                addToTotal(part)
            }
        } catch (err) {
            // If the mailbox disconnects halfway, the answer still says which emails went out before that
            if (isAxiosError(err) && err.response?.data?.failed_leads) addToTotal(err.response.data)
            setError(getErrorMessage(err))
        } finally {
            setResult(total)
            setSending(false)
        }
    }

    const problems = result ? [
        ...result.failed_leads.map((name) => ({ name, reason: 'Failed to send' })),
        ...result.skipped_leads.map((name) => ({ name, reason: 'No email to send to' })),
    ] : []
    const allSent = !error && !problems.length

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Mail Sender</h1>
                <p className="mt-1 text-sm text-slate-500">Send a template to every lead in a list.</p>
            </div>

            {error && <FormAlert message={error} />}

            {!loaded && !error && (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                </div>
            )}

            {loaded && (
                <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                    {!mailboxes.length && (
                        <p className="text-sm text-slate-600">
                            Connect a mailbox in <Link to="/settings" className="font-medium text-primary hover:underline">Settings</Link> before sending emails.
                        </p>
                    )}

                    {mailboxes.length > 0 && !templates.length && (
                        <p className="text-sm text-slate-600">
                            Create an <Link to="/email-templates/new" className="font-medium text-primary hover:underline">email template</Link> first.
                        </p>
                    )}

                    {mailboxes.length > 0 && templates.length > 0 && !lists.length && (
                        <p className="text-sm text-slate-600">
                            <Link to="/search-leads" className="font-medium text-primary hover:underline">Search for leads</Link> and save a list first.
                        </p>
                    )}

                    {mailboxes.length > 0 && templates.length > 0 && lists.length > 0 && (
                        <form onSubmit={handleSubmit} noValidate className="space-y-5">
                            <SelectField id="lead-list" label="Lead list" options={lists.map((list) => ({ value: list.id, label: `${list.name} (${list.lead_count} ${list.lead_count === 1 ? 'lead' : 'leads'})` }))} value={listId} onChange={setListId} placeholder="Choose a lead list" />
                            <SelectField id="mailbox" label="From" options={mailboxes.map((mailbox) => ({ value: mailbox.id, label: mailbox.email }))} value={mailboxId} onChange={setMailboxId} />
                            <SelectField id="template" label="Template" options={templates.map((template) => ({ value: template.id, label: template.name }))} value={templateId} onChange={setTemplateId} placeholder="Choose a template" />
                            <SubmitButton loading={sending}>{sending ? 'Sending...' : 'Send'}</SubmitButton>
                        </form>
                    )}
                </section>
            )}

            {result && (result.sent > 0 || problems.length > 0) && (
                <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                    <div className="flex items-center gap-2.5">
                        {allSent ? <CircleCheck className="size-5 shrink-0 text-emerald-600" /> : <TriangleAlert className="size-5 shrink-0 text-amber-500" />}
                        <h2 className="font-semibold text-slate-900">
                            {allSent ? `All ${result.sent} ${result.sent === 1 ? 'email' : 'emails'} sent` : `${result.sent} sent, ${result.failed_leads.length} failed, ${result.skipped_leads.length} skipped`}
                        </h2>
                    </div>

                    {problems.length > 0 && (
                        <ul className="mt-4 divide-y divide-slate-100">
                            {problems.map(({ name, reason }, index) => (
                                <li key={index} className="flex items-center justify-between gap-4 py-2 text-sm">
                                    <span className="min-w-0 truncate text-slate-900">{name}</span>
                                    <span className="shrink-0 text-slate-500">{reason}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    )
}
