import { useEffect, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { LoaderCircle, Send, X } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import SelectField from '@/components/SelectField.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import type { EmailTemplate, Lead, Mailbox } from '@/types/index.ts'

type SendEmailModalProps = {
    lead: Lead
    onClose: () => void
    onSent: () => void
}

export default function SendEmailModal({ lead, onClose, onSent }: SendEmailModalProps) {
    const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [mailboxId, setMailboxId] = useState('')
    const [templateId, setTemplateId] = useState('')
    const [loaded, setLoaded] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        Promise.all([api.get('/emails/mailboxes'), api.get('/emails/templates')])
            .then(([mailboxResponse, templateResponse]) => {
                const connected = mailboxResponse.data.mailboxes.filter((mailbox: Mailbox) => mailbox.status === 'connected')
                setMailboxes(connected)
                setMailboxId(connected[0]?.id ?? '')
                setTemplates(templateResponse.data.templates)
                setLoaded(true)
            })
            .catch((err) => setError(getErrorMessage(err)))
    }, [])

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!mailboxId || !templateId) {
            setError('Choose a mailbox and a template.')
            return
        }

        setError('')
        setSending(true)
        try {
            const { data } = await api.post('/emails/send_bulk', { mailbox_id: mailboxId, template_id: templateId, lead_ids: [lead.id] })
            if (data.sent) {
                onSent()
                return
            }
            setError(data.skipped ? 'This lead has no company email to send to.' : 'Could not send the email. Please try again.')
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="send-email-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex items-start justify-between">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Send className="size-6" />
                    </div>
                    <button type="button" onClick={onClose} disabled={sending} aria-label="Close" className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed">
                        <X className="size-5" />
                    </button>
                </div>

                <h2 id="send-email-title" className="mt-5 text-2xl font-bold text-slate-900">Send email</h2>
                <p className="mt-1 text-sm text-slate-500">Send a template to {lead.name}'s company email.</p>

                <div className="mt-6">
                    {error && <FormAlert message={error} />}

                    {!loaded && !error && (
                        <div className="flex justify-center py-6">
                            <LoaderCircle className="size-6 animate-spin text-primary" />
                        </div>
                    )}

                    {loaded && !mailboxes.length && (
                        <p className="text-sm text-slate-600">
                            Connect a mailbox in <Link to="/settings" className="font-medium text-primary hover:underline">Settings</Link> before sending emails.
                        </p>
                    )}

                    {loaded && mailboxes.length > 0 && !templates.length && (
                        <p className="text-sm text-slate-600">
                            Create an <Link to="/email-templates/new" className="font-medium text-primary hover:underline">email template</Link> first.
                        </p>
                    )}

                    {loaded && mailboxes.length > 0 && templates.length > 0 && (
                        <form onSubmit={handleSubmit} noValidate className="space-y-5">
                            <SelectField id="mailbox" label="From" options={mailboxes.map((mailbox) => ({ value: mailbox.id, label: mailbox.email }))} value={mailboxId} onChange={setMailboxId} />
                            <SelectField id="template" label="Template" options={templates.map((template) => ({ value: template.id, label: template.name }))} value={templateId} onChange={setTemplateId} placeholder="Choose a template" />
                            <SubmitButton loading={sending}>Send email</SubmitButton>
                        </form>
                    )}
                </div>

                <button type="button" onClick={onClose} disabled={sending} className="mt-4 w-full cursor-pointer text-sm text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed">Cancel</button>
            </div>
        </div>
    )
}
