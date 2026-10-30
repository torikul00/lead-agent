import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Search, ArrowLeft, LoaderCircle } from 'lucide-react'
import Select from 'react-select'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import LeadsTable from '@/components/leads/LeadsTable.tsx'
import SendEmailModal from '@/components/leads/SendEmailModal.tsx'
import LeadDetailsModal from '@/components/leads/LeadDetailsModal.tsx'
import type { Category, Lead, LeadList } from '@/types/index.ts'

export default function LeadListDetails() {
    const { id } = useParams()
    const [list, setList] = useState<LeadList | null>(null)
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [categories, setCategories] = useState<Category[]>([])
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [sendingTo, setSendingTo] = useState<Lead | null>(null)
    const [viewingLead, setViewingLead] = useState<Lead | null>(null)

    useEffect(() => {
        Promise.all([api.get(`/leads/lists/${id}`), api.get('/categories')])
            .then(([listResponse, categoryResponse]) => {
                setList(listResponse.data.list)
                setLeads(listResponse.data.leads)
                setCategories(categoryResponse.data.categories)
            })
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [id])

    const filteredLeads = leads.filter((lead) => {
        const query = search.trim().toLowerCase()
        const matchesSearch = !query || lead.name.toLowerCase().includes(query) || lead.domain?.toLowerCase().includes(query)
        const assignedCategory = typeof lead.category_id === 'object' && lead.category_id ? lead.category_id._id : lead.category_id
        const matchesCategory = !categoryFilter || (categoryFilter === 'uncategorized' ? !assignedCategory : assignedCategory === categoryFilter)
        return matchesSearch && matchesCategory
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-4">
                        <Link to="/lead-lists" className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-primary">
                            <ArrowLeft className="size-4" />
                            Lead lists
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900">{list?.name ?? 'Lead list'}</h1>
                    </div>
                    {list && (
                        <p className="mt-1 text-sm text-slate-500">
                            {list.lead_count} {list.lead_count === 1 ? 'lead' : 'leads'} · Saved {new Date(list.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search leads..."
                            aria-label="Search leads"
                            className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15 sm:w-56"
                        />
                    </label>
                    <Select
                        unstyled
                        options={[
                            { value: '', label: 'All categories' },
                            { value: 'uncategorized', label: 'Uncategorized' },
                            ...categories.map((category) => ({ value: category.id, label: category.name })),
                        ]}
                        value={[
                            { value: '', label: 'All categories' },
                            { value: 'uncategorized', label: 'Uncategorized' },
                            ...categories.map((category) => ({ value: category.id, label: category.name })),
                        ].find((option) => option.value === categoryFilter)}
                        onChange={(option) => setCategoryFilter(option?.value ?? '')}
                        isSearchable={false}
                        placeholder="All categories"
                        classNames={{
                            control: ({ isFocused }) => `min-h-9 w-full cursor-pointer rounded-lg border bg-white px-2.5 text-sm transition sm:w-56 ${isFocused ? 'border-primary ring-4 ring-primary/15' : 'border-slate-200 hover:border-slate-300'}`,
                            singleValue: () => 'text-slate-700',
                            indicatorsContainer: () => 'text-slate-400',
                            dropdownIndicator: () => 'p-1',
                            menu: () => 'z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg',
                            option: ({ isSelected, isFocused }) => `cursor-pointer rounded-md px-2.5 py-2 text-sm ${isSelected ? 'bg-primary/10 font-medium text-primary' : isFocused ? 'bg-slate-100 text-slate-900' : 'text-slate-700'}`,
                        }}
                    />
                </div>
            </div>

            {error && <FormAlert message={error} />}

            {loading && (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                </div>
            )}

            {!loading && list && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <LeadsTable
                        leads={filteredLeads}
                        categories={categories}
                        onCategoryChange={async (lead, categoryId) => {
                            try {
                                const { data } = await api.patch(`/leads/${lead.id}/category`, { category_id: categoryId })
                                setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, category_id: data.lead.category_id } : item))
                            } catch (err) {
                                setError(getErrorMessage(err))
                            }
                        }}
                        onSendEmail={setSendingTo}
                        onOpenLead={setViewingLead}
                    />
                </section>
            )}

            {viewingLead && (
                <LeadDetailsModal
                    lead={viewingLead}
                    onClose={() => setViewingLead(null)}
                    onLeadUpdate={(updated) => {
                        setLeads((current) => current.map((item) => (item.id === updated.id ? updated : item)))
                        setViewingLead(updated)
                    }}
                />
            )}

            {sendingTo && (
                <SendEmailModal
                    lead={sendingTo}
                    onClose={() => setSendingTo(null)}
                    onSent={() => {
                        setLeads((current) => current.map((item) => item.id === sendingTo.id ? { ...item, is_mail_sent: true } : item))
                        setSendingTo(null)
                    }}
                />
            )}
        </div>
    )
}
