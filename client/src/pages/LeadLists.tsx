import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Eye, List, LoaderCircle, Send } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import type { LeadList } from '@/types/index.ts'

export default function LeadLists() {
    const [lists, setLists] = useState<LeadList[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        api.get('/leads/lists')
            .then(({ data }) => setLists(data.lists))
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Lead lists</h1>
                <p className="mt-1 text-sm text-slate-500">Leads you saved from your searches.</p>
            </div>

            {error && <FormAlert message={error} />}

            {loading && (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                </div>
            )}

            {!loading && !error && lists.length === 0 && (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <List className="size-6" />
                    </div>
                    <p className="mt-4 font-medium text-slate-900">No saved lists yet</p>
                    <p className="mt-1 text-sm text-slate-500">Search for leads, then click Save leads list.</p>
                </div>
            )}

            {!loading && lists.length > 0 && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-160 text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-4 py-3">Saved</th>
                                    <th className="px-4 py-3">Leads</th>
                                    <th className="py-3 pr-6 pl-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lists.map((list) => (
                                    <tr key={list.id} className="transition hover:bg-slate-50/80">
                                        <td className="px-6 py-4 font-medium text-slate-900">{list.name}</td>
                                        <td className="px-4 py-4 text-slate-600">{new Date(list.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                        <td className="px-4 py-4 text-slate-600">{list.lead_count}</td>
                                        <td className="py-4 pr-6 pl-4">
                                            <div className="flex justify-end gap-2">
                                                <Link to={`/lead-lists/${list.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                                                    <Eye className="size-3.5" />
                                                    View leads
                                                </Link>
                                                {/* Placeholder until sending emails is built */}
                                                <button type="button" disabled title="Coming soon" className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-400">
                                                    <Send className="size-3.5" />
                                                    Send email
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    )
}
