import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import LeadsTable from '@/components/leads/LeadsTable.tsx'
import type { Lead, LeadList } from '@/types/index.ts'

export default function LeadListDetails() {
    const { id } = useParams()
    const [list, setList] = useState<LeadList | null>(null)
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        api.get(`/leads/lists/${id}`)
            .then(({ data }) => {
                setList(data.list)
                setLeads(data.leads)
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [id])

    return (
        <div className="space-y-6">
            <div>
                <Link to="/lead-lists" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-primary">
                    <ArrowLeft className="size-4" />
                    Lead lists
                </Link>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">{list?.name ?? 'Lead list'}</h1>
                {list && (
                    <p className="mt-1 text-sm text-slate-500">
                        {list.lead_count} {list.lead_count === 1 ? 'lead' : 'leads'} · Saved {new Date(list.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                )}
            </div>

            {error && <FormAlert message={error} />}

            {loading && (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                </div>
            )}

            {!loading && list && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <LeadsTable leads={leads} />
                </section>
            )}
        </div>
    )
}
