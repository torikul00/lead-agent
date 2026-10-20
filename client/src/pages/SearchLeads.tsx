import { useState } from 'react'
import { Download, LoaderCircle, SearchX, Sparkles, TriangleAlert } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import exportLeadsCsv from '@/lib/exportLeadsCsv.ts'
import FormAlert from '@/components/FormAlert.tsx'
import LeadSearchForm from '@/components/leads/LeadSearchForm.tsx'
import LeadsTable from '@/components/leads/LeadsTable.tsx'
import type { LeadSearchInput } from '@/schemas/lead.ts'
import type { Lead } from '@/types/index.ts'

type SearchResult = {
    leads: Lead[]
    failed_sources: string[]
}

export default function SearchLeads() {
    const [result, setResult] = useState<SearchResult | null>(null)
    const [selected, setSelected] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSearch = async (criteria: LeadSearchInput) => {
        setLoading(true)
        setError('')
        setSelected([])
        console.log(criteria);
        try {
            const { data } = await api.post('/leads/generate_leads', criteria)
            setResult(data)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    // Swap in a lead after Hunter adds its emails
    const updateLead = (updated: Lead) => {
        setResult((current) => current && { ...current, leads: current.leads.map((lead) => (lead.domain === updated.domain ? updated : lead)) })
    }

    // Export only the checked companies, or every lead when none are checked
    const exportCsv = (leads: Lead[]) => {
        const selectedLeads = leads.filter((lead) => selected.includes(lead.domain ?? lead.name))
        exportLeadsCsv(selectedLeads.length ? selectedLeads : leads)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Search leads</h1>
                <p className="mt-1 text-sm text-slate-500">Choose your ideal customer profile and we'll find matching companies.</p>
            </div>

            <LeadSearchForm loading={loading} onSearch={handleSearch} />

            {error && <FormAlert message={error} />}

            {loading && (
                <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                    <p className="mt-4 font-medium text-slate-900">Finding leads...</p>
                    <p className="mt-1 text-sm text-slate-500">Searching sources, checking each domain and reading company websites for decision makers. This can take up to a minute.</p>
                </div>
            )}

            {!loading && !result && !error && (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Sparkles className="size-6" />
                    </div>
                    <p className="mt-4 font-medium text-slate-900">Your leads will appear here</p>
                    <p className="mt-1 text-sm text-slate-500">Pick an industry and country, then click Find leads.</p>
                </div>
            )}

            {!loading && result && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
                        <div>
                            <h2 className="font-semibold text-slate-900">
                                {result.leads.length} {result.leads.length === 1 ? 'lead' : 'leads'} found
                            </h2>
                            {result.failed_sources.length > 0 && (
                                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-amber-600">
                                    <TriangleAlert className="size-4" />
                                    Some sources didn't respond, so results may be incomplete.
                                </p>
                            )}
                        </div>

                        {result.leads.length > 0 && (
                            <button type="button" onClick={() => exportCsv(result.leads)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                                <Download className="size-4" />
                                {selected.length ? 'Export Selected' : 'Export All'}
                            </button>
                        )}
                    </div>

                    {result.leads.length > 0 ? (
                        <>
                            <LeadsTable leads={result.leads} selected={selected} onSelectedChange={setSelected} onLeadUpdate={updateLead} />
                        </>
                    ) : (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <SearchX className="size-8 text-slate-400" />
                            <p className="mt-4 font-medium text-slate-900">No companies matched</p>
                            <p className="mt-1 text-sm text-slate-500">Try another industry, a different size or fewer keywords.</p>
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}
