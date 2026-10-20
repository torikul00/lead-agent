import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, FileText, LoaderCircle, Mail } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import RichTextEditor from '@/components/emailTemplates/RichTextEditor.tsx'
import { TEMPLATE_VARIANTS } from '@/constants/emails.ts'
import type { EmailContent, EmailTemplate, TemplateVariantKey } from '@/types/index.ts'

type TabKey = 'default' | TemplateVariantKey

const TABS = [{ key: 'default', label: 'Default' }, ...TEMPLATE_VARIANTS] as const

const EMPTY_CONTENT: EmailContent = { subject: '', body: '' }

const EMPTY_CONTENTS = Object.fromEntries(TABS.map(({ key }) => [key, EMPTY_CONTENT])) as Record<TabKey, EmailContent>

// Used for both creating (/email-templates/new) and editing (/email-templates/:id/edit)
export default function EmailTemplateForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [contents, setContents] = useState(EMPTY_CONTENTS)
    const [activeTab, setActiveTab] = useState<TabKey>('default')
    const [loading, setLoading] = useState(Boolean(id))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!id) return

        api.get(`/emails/templates/${id}`)
            .then(({ data }) => {
                const template: EmailTemplate = data.template
                setName(template.name)
                setContents({
                    ...Object.fromEntries(TEMPLATE_VARIANTS.map(({ key }) => [key, template.variants[key] ?? EMPTY_CONTENT])),
                    default: { subject: template.subject, body: template.body },
                } as Record<TabKey, EmailContent>)
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [id])

    const updateContent = (field: keyof EmailContent, value: string) => {
        setContents((current) => ({ ...current, [activeTab]: { ...current[activeTab], [field]: value } }))
    }

    // The default email is required; a variant needs both a subject and a body, or neither
    const validate = () => {
        if (!name.trim()) return 'Template name is required.'
        if (!contents.default.subject.trim() || !contents.default.body) return 'Add a subject and a body to the default email.'

        const incomplete = TEMPLATE_VARIANTS.find(({ key }) => Boolean(contents[key].subject.trim()) !== Boolean(contents[key].body))
        return incomplete ? `${incomplete.label}: add both a subject and a body, or leave both empty.` : ''
    }

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const message = validate()

        if (message) {
            setError(message)
            return
        }

        setError('')
        setSaving(true)

        // An empty variant is sent as null, so leads on that provider get the default email
        const variants = Object.fromEntries(TEMPLATE_VARIANTS.map(({ key }) => [key, contents[key].subject.trim() ? contents[key] : null]))
        const payload = { name, subject: contents.default.subject, body: contents.default.body, variants }

        try {
            if (id) await api.patch(`/emails/templates/${id}`, payload)
            else await api.post('/emails/templates', payload)
            navigate('/email-templates')
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSaving(false)
        }
    }

    const activeLabel = TABS.find((tab) => tab.key === activeTab)?.label
    let tabHint = 'Sent to every lead whose email provider has no version of its own.'
    if (activeTab === 'other') tabHint = 'Sent instead of the default to leads on any other email provider. Leave empty to use the default.'
    else if (activeTab !== 'default') tabHint = `Sent instead of the default to leads on ${activeLabel}. Leave empty to use the default.`

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div>
                <Link to="/email-templates" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-primary">
                    <ArrowLeft className="size-4" />
                    Email templates
                </Link>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">{id ? 'Edit template' : 'New template'}</h1>
                <p className="mt-1 text-sm text-slate-500">Placeholders like {'{{companyName}}'} are filled in with each lead's details.</p>
            </div>

            {loading ? (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                </div>
            ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                    {error && <FormAlert message={error} />}

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <InputField id="name" label="Template name" icon={FileText} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Intro for software companies" maxLength={100} required />

                        <div>
                            <div role="tablist" className="flex flex-wrap gap-1.5">
                                {TABS.map((tab) => {
                                    const filled = tab.key !== 'default' && Boolean(contents[tab.key].subject.trim())

                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            role="tab"
                                            aria-selected={activeTab === tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${activeTab === tab.key ? 'border-primary/30 bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            {tab.label}
                                            {filled && <span className="size-1.5 rounded-full bg-primary" />}
                                        </button>
                                    )
                                })}
                            </div>
                            <p className="mt-3 text-sm text-slate-500">{tabHint}</p>
                        </div>

                        <InputField id="subject" label="Subject" icon={Mail} value={contents[activeTab].subject} onChange={(e) => updateContent('subject', e.target.value)} placeholder="e.g. Quick question for {{companyName}}" maxLength={200} />

                        <div>
                            <p className="mb-1.5 text-sm font-medium text-slate-700">Email body</p>
                            {/* Keyed by tab so the editor reloads with that tab's content */}
                            <RichTextEditor key={activeTab} value={contents[activeTab].body} onChange={(html) => updateContent('body', html)} />
                        </div>

                        <div className="sm:w-56">
                            <SubmitButton loading={saving}>Save template</SubmitButton>
                        </div>
                    </form>
                </section>
            )}
        </div>
    )
}
