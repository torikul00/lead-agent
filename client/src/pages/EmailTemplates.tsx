import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FileText, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import { TEMPLATE_VARIANTS } from '@/constants/emails.ts'
import type { EmailTemplate } from '@/types/index.ts'

export default function EmailTemplates() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        api.get('/emails/templates')
            .then(({ data }) => setTemplates(data.templates))
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [])

    const deleteTemplate = async (template: EmailTemplate) => {
        if (!window.confirm(`Delete "${template.name}"? This can't be undone.`)) return
        setError('')

        try {
            await api.delete(`/emails/templates/${template.id}`)
            setTemplates((current) => current.filter((item) => item.id !== template.id))
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Email templates</h1>
                    <p className="mt-1 text-sm text-slate-500">Reusable emails for your saved leads, with versions for each email provider.</p>
                </div>
                <Link to="/email-templates/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90">
                    <Plus className="size-4" />
                    New template
                </Link>
            </div>

            {error && <FormAlert message={error} />}

            {loading && (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                </div>
            )}

            {!loading && !error && templates.length === 0 && (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileText className="size-6" />
                    </div>
                    <p className="mt-4 font-medium text-slate-900">No templates yet</p>
                    <p className="mt-1 text-sm text-slate-500">Create a template to start emailing your saved leads.</p>
                </div>
            )}

            {!loading && templates.length > 0 && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-200 text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-4 py-3">Subject</th>
                                    <th className="px-4 py-3">Variants</th>
                                    <th className="px-4 py-3">Last updated</th>
                                    <th className="py-3 pr-6 pl-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {templates.map((template) => {
                                    const variants = TEMPLATE_VARIANTS.filter(({ key }) => template.variants[key])

                                    return (
                                        <tr key={template.id} className="transition hover:bg-slate-50/80">
                                            <td className="px-6 py-4 font-medium text-slate-900">{template.name}</td>
                                            <td className="px-4 py-4">
                                                <p className="max-w-60 truncate text-slate-600" title={template.subject}>{template.subject}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                {variants.length ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {variants.map(({ key, label }) => (
                                                            <span key={key} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{label}</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">Default only</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-slate-600">{new Date(template.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                            <td className="py-4 pr-6 pl-4">
                                                <div className="flex justify-end gap-2">
                                                    <Link to={`/email-templates/${template.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                                                        <Pencil className="size-3.5" />
                                                        Edit
                                                    </Link>
                                                    <button type="button" onClick={() => deleteTemplate(template)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50">
                                                        <Trash2 className="size-3.5" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    )
}
