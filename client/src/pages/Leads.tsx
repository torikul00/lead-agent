import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ListPlus, LoaderCircle, Search, Users } from 'lucide-react'
import Select from 'react-select'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import exportLeadsCsv from '@/lib/exportLeadsCsv.ts'
import useInboxStore from '@/store/inbox.store.ts'
import FormAlert from '@/components/FormAlert.tsx'
import ConfirmationModal from '@/components/ConfirmationModal.tsx'
import LeadsTable from '@/components/leads/LeadsTable.tsx'
import LeadDetailsModal from '@/components/leads/LeadDetailsModal.tsx'
import ExportLeadsModal from '@/components/leads/ExportLeadsModal.tsx'
import SaveLeadListModal from '@/components/leads/SaveLeadListModal.tsx'
import type { Category, Lead } from '@/types/index.ts'

type CategoryFilterOption = {
    value: string
    label: string
    color?: string
}

const categoryFilterClassNames = {
    control: ({ isFocused }: { isFocused: boolean }) => `min-h-9 w-full cursor-pointer rounded-lg border bg-white px-2.5 text-sm transition sm:w-64 ${isFocused ? 'border-primary ring-4 ring-primary/15' : 'border-slate-200 hover:border-slate-300'}`,
    singleValue: () => 'text-slate-700',
    indicatorsContainer: () => 'text-slate-400',
    dropdownIndicator: () => 'p-1',
    menu: () => 'z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg',
    option: ({ isSelected, isFocused }: { isSelected: boolean; isFocused: boolean }) => `cursor-pointer rounded-md px-2.5 py-2 text-sm ${isSelected ? 'bg-primary/10 font-medium text-primary' : isFocused ? 'bg-slate-100 text-slate-900' : 'text-slate-700'}`,
}

const arrowClass = 'cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40'

// The first page, the last page and the pages next to the current one; null marks a gap
const getPageNumbers = (page: number, totalPages: number) => {
    const numbers: (number | null)[] = []
    for (let number = 1; number <= totalPages; number++) {
        if (number === 1 || number === totalPages || Math.abs(number - page) <= 1) numbers.push(number)
        else if (numbers[numbers.length - 1] !== null) numbers.push(null)
    }
    return numbers
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
    return (
        <nav aria-label="Pagination" className="flex items-center gap-1">
            <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page" className={arrowClass}>
                <ChevronLeft className="size-4" />
            </button>
            {getPageNumbers(page, totalPages).map((number, index) => (number === null ? (
                <span key={`gap-${index}`} className="px-1 text-sm text-slate-400">…</span>
            ) : (
                <button
                    key={number}
                    type="button"
                    onClick={() => onChange(number)}
                    aria-current={number === page ? 'page' : undefined}
                    className={`min-w-9 cursor-pointer rounded-lg px-2 py-1.5 text-sm font-medium transition ${number === page ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    {number}
                </button>
            )))}
            <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Next page" className={arrowClass}>
                <ChevronRight className="size-4" />
            </button>
        </nav>
    )
}

export default function Leads() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [categories, setCategories] = useState<Category[]>([])
    const [search, setSearch] = useState('')
    // What the list shows; a new value here loads the leads again
    const [filters, setFilters] = useState({ search: '', category_id: '', page: 1 })
    const [loading, setLoading] = useState(true)
    const [exportOpen, setExportOpen] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState('')
    const [selected, setSelected] = useState<string[]>([])
    const [creatingList, setCreatingList] = useState(false)
    const [savedMessage, setSavedMessage] = useState('')
    const [viewingLead, setViewingLead] = useState<Lead | null>(null)
    const [deletingLead, setDeletingLead] = useState<Lead | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const fetchUnreadCount = useInboxStore((state) => state.fetchUnreadCount)

    useEffect(() => {
        api.get('/categories')
            .then(({ data }) => setCategories(data.categories))
            .catch((err) => setError(getErrorMessage(err)))
    }, [])

    useEffect(() => {
        // A slow answer for an earlier search or page is ignored
        let stale = false

        api.get('/leads', { params: filters })
            .then(({ data }) => {
                if (stale) return
                setLeads(data.leads)
                setTotal(data.total)
                setPage(data.page)
                setTotalPages(data.total_pages)
            })
            .catch((err) => {
                if (!stale) setError(getErrorMessage(err))
            })
            .finally(() => {
                if (!stale) setLoading(false)
            })

        return () => {
            stale = true
        }
    }, [filters])

    const applyFilters = (changes: Partial<typeof filters>) => {
        setLoading(true)
        setError('')
        setSavedMessage('')
        setFilters((current) => ({ ...current, ...changes }))
    }

    // Waits until typing pauses, so every keystroke doesn't call the API
    const handleSearch = (text: string) => {
        setSearch(text)
        clearTimeout(searchTimer.current)
        searchTimer.current = setTimeout(() => applyFilters({ search: text.trim(), page: 1 }), 300)
    }

    const handleCategoryChange = async (lead: Lead, categoryId: string | null) => {
        try {
            await api.patch(`/leads/${lead.id}/category`, { category_id: categoryId })
            // Load the page again, since the lead may no longer match the category filter
            applyFilters({})
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }

    const handleDelete = async () => {
        if (!deletingLead) return
        setDeleteLoading(true)

        try {
            await api.delete(`/leads/${deletingLead.id}`)
            setSelected((current) => current.filter((id) => id !== deletingLead.id))
            // Load the page again so the next leads move up; the unread badge may change with the deleted conversations
            applyFilters({})
            fetchUnreadCount()
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setDeleteLoading(false)
            setDeletingLead(null)
        }
    }

    const handleListCreated = (name: string) => {
        setCreatingList(false)
        setSelected([])
        setSavedMessage(`Created "${name}" with ${selected.length} ${selected.length === 1 ? 'lead' : 'leads'}.`)
    }

    // Exports every lead matching the filters, not only the page on screen
    const handleExport = async () => {
        setExporting(true)
        setError('')

        try {
            const { data } = await api.get('/leads/export', { params: filters })
            exportLeadsCsv(data.leads)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setExporting(false)
            setExportOpen(false)
        }
    }

    const categoryOptions: CategoryFilterOption[] = [
        { value: '', label: 'All categories' },
        { value: 'uncategorized', label: 'Uncategorized', color: '#94a3b8' },
        ...categories.map((category) => ({ value: category.id, label: category.name, color: category.color })),
    ]
    const selectedCategory = categoryOptions.find((option) => option.value === filters.category_id) ?? categoryOptions[0]
    const isFiltered = Boolean(filters.search || filters.category_id)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
                    <p className="mt-1 text-sm text-slate-500">All the leads saved in your lists.</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                    <label className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => handleSearch(event.target.value)}
                            placeholder="Search by name or domain..."
                            aria-label="Search leads by name or domain"
                            className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/15 sm:w-64"
                        />
                    </label>
                    <Select<CategoryFilterOption>
                        unstyled
                        options={categoryOptions}
                        value={selectedCategory}
                        onChange={(option) => applyFilters({ category_id: option?.value ?? '', page: 1 })}
                        isSearchable={false}
                        placeholder="All categories"
                        aria-label="Filter by category"
                        classNames={categoryFilterClassNames}
                        formatOptionLabel={(option) => (
                            <span className="flex items-center gap-2">
                                {option.color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />}
                                {option.label}
                            </span>
                        )}
                    />
                    <button type="button" onClick={() => setCreatingList(true)} disabled={!selected.length} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                        <ListPlus className="size-4" />
                        Create List
                    </button>
                    <button type="button" onClick={() => setExportOpen(true)} disabled={!total} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                        <Download className="size-4" />
                        Export
                    </button>
                </div>
            </div>

            {error && <FormAlert message={error} />}
            {savedMessage && <FormAlert type="success" message={savedMessage} />}

            {loading && !leads.length && (
                <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
                    <LoaderCircle className="size-8 animate-spin text-primary" />
                </div>
            )}

            {!loading && !error && !leads.length && (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Users className="size-6" />
                    </div>
                    <p className="mt-4 font-medium text-slate-900">{isFiltered ? 'No leads match' : 'No saved leads yet'}</p>
                    <p className="mt-1 text-sm text-slate-500">{isFiltered ? 'Try a different search or category.' : 'Search for leads, then click Save leads list.'}</p>
                </div>
            )}

            {leads.length > 0 && (
                <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white transition ${loading ? 'opacity-60' : ''}`}>
                    <LeadsTable leads={leads} selected={selected} onSelectedChange={setSelected} categories={categories} onCategoryChange={handleCategoryChange} onOpenLead={setViewingLead} onDeleteLead={setDeletingLead} rowOpensLead />

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3">
                        <p className="text-sm text-slate-500">{total} {total === 1 ? 'lead' : 'leads'}</p>
                        {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={(next) => applyFilters({ page: next })} />}
                    </div>
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

            {deletingLead && (
                <ConfirmationModal
                    title="Delete lead"
                    message={`Delete "${deletingLead.name}"? This permanently removes the lead from all its lists, along with its conversations; the emails stay in your mailbox.`}
                    confirmLabel="Delete lead"
                    loading={deleteLoading}
                    onConfirm={handleDelete}
                    onClose={() => setDeletingLead(null)}
                />
            )}

            {creatingList && (
                <SaveLeadListModal
                    title="Create list"
                    description="will be added to the new list."
                    submitLabel="Create list"
                    leadCount={selected.length}
                    onSave={(name) => api.post('/leads/create_list', { name, lead_ids: selected })}
                    onClose={() => setCreatingList(false)}
                    onSaved={handleListCreated}
                />
            )}

            {exportOpen && (
                <ExportLeadsModal
                    total={total}
                    search={filters.search}
                    category={selectedCategory.label}
                    loading={exporting}
                    onConfirm={handleExport}
                    onClose={() => setExportOpen(false)}
                />
            )}
        </div>
    )
}
