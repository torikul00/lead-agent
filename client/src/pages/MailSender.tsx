import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import socket from '@/lib/socket.ts'
import FormAlert from '@/components/FormAlert.tsx'
import SelectField from '@/components/SelectField.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import type { Category, EmailTemplate, LeadList, Mailbox } from '@/types/index.ts'

type SendReport = {
    status: 'sending' | 'done' | 'stopped'
    current_lead: string | null
    success: number
    failed: number
    error?: string
}

const getReportMessage = (report: SendReport) => {
    if (report.status === 'done') return 'All done'
    if (report.status === 'stopped') return report.error
    return report.current_lead ? `Sending email to ${report.current_lead}` : 'Getting ready to send...'
}

export default function MailSender() {
    const [searchParams] = useSearchParams()
    const [lists, setLists] = useState<LeadList[]>([])
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    // The Lead lists page links here with the list already chosen
    const [listId, setListId] = useState(searchParams.get('list') ?? '')
    const [mailboxId, setMailboxId] = useState('')
    const [templateId, setTemplateId] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [loaded, setLoaded] = useState(false)
    const [starting, setStarting] = useState(false)
    const [error, setError] = useState('')
    const [report, setReport] = useState<SendReport | null>(null)

    useEffect(() => {
        Promise.all([api.get('/leads/lists'), api.get('/emails/mailboxes'), api.get('/emails/templates'), api.get('/categories')])
            .then(([listResponse, mailboxResponse, templateResponse, categoryResponse]) => {
                const connected = mailboxResponse.data.mailboxes.filter((mailbox: Mailbox) => mailbox.status === 'connected')
                setLists(listResponse.data.lists)
                setMailboxes(connected)
                setMailboxId(connected[0]?.id ?? '')
                setTemplates(templateResponse.data.templates)
                setCategories(categoryResponse.data.categories)
                setLoaded(true)
            })
            .catch((err) => setError(getErrorMessage(err)))
    }, [])

    // The send runs on the server, so the report is loaded on every visit and after a lost connection, then follows the live updates
    useEffect(() => {
        const loadReport = () => {
            api.get('/emails/send_list')
                .then(({ data }) => setReport(data.report))
                .catch((err) => setError(getErrorMessage(err)))
        }

        loadReport()
        socket.on('connect', loadReport)
        socket.on('mail_send_updated', setReport)
        return () => {
            socket.off('connect', loadReport)
            socket.off('mail_send_updated', setReport)
        }
    }, [])

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!listId || !mailboxId || !templateId) {
            setError('Choose a lead list, a mailbox and a template.')
            return
        }

        setError('')
        setStarting(true)

        try {
            const { data } = await api.post('/emails/send_list', { lead_list_id: listId, mailbox_id: mailboxId, template_id: templateId, category_id: categoryId || null })
            setReport(data.report)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setStarting(false)
        }
    }

    const sending = report?.status === 'sending'
    const canSend = mailboxes.length > 0 && templates.length > 0 && lists.length > 0

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
                <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
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

                    {canSend && (
                        <form onSubmit={handleSubmit} noValidate className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_9rem]">
                            <SelectField id="lead-list" label="Lead list" options={lists.map((list) => ({ value: list.id, label: `${list.name} (${list.lead_count} ${list.lead_count === 1 ? 'lead' : 'leads'})` }))} value={listId} onChange={setListId} placeholder="Choose a lead list" />
                            <SelectField id="template" label="Template" options={templates.map((template) => ({ value: template.id, label: template.name }))} value={templateId} onChange={setTemplateId} placeholder="Choose a template" />
                            <SelectField id="mailbox" label="From" options={mailboxes.map((mailbox) => ({ value: mailbox.id, label: mailbox.email }))} value={mailboxId} onChange={setMailboxId} />
                            <SelectField id="category" label="Move to category" options={[{ value: '', label: 'No change' }, ...categories.map((category) => ({ value: category.id, label: category.name, color: category.color }))]} value={categoryId} onChange={setCategoryId} />
                            <div className="md:col-span-2 xl:col-span-1">
                                <SubmitButton loading={starting || sending}>{sending ? 'Sending...' : 'Send Bulk'}</SubmitButton>
                            </div>
                        </form>
                    )}
                </section>
            )}

            {canSend && !report && (
                <section className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
                    <p className="text-sm text-slate-500">See the live report here after you click Send Bulk.</p>
                </section>
            )}

            {report && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                    <div className="flex items-center gap-2.5">
                        {sending && <LoaderCircle className="size-5 shrink-0 animate-spin text-primary" />}
                        {report.status === 'done' && <CircleCheck className="size-5 shrink-0 text-emerald-600" />}
                        {report.status === 'stopped' && <TriangleAlert className="size-5 shrink-0 text-amber-500" />}
                        <p className="min-w-0 truncate font-semibold text-slate-900">{getReportMessage(report)}</p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 px-4 py-3">
                            <p className="text-xs text-slate-500">Total success</p>
                            <p className="mt-0.5 text-2xl font-bold text-emerald-600">{report.success}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 px-4 py-3">
                            <p className="text-xs text-slate-500">Total failed</p>
                            <p className="mt-0.5 text-2xl font-bold text-red-600">{report.failed}</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}
