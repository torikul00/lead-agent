import { Download, X } from 'lucide-react'
import { LEAD_CSV_COLUMNS } from '@/constants/leads.ts'

type ExportLeadsModalProps = {
    total: number
    search: string
    category: string
    loading: boolean
    onConfirm: () => void
    onClose: () => void
}

// Shows what the file will contain before it downloads
export default function ExportLeadsModal({ total, search, category, loading, onConfirm, onClose }: ExportLeadsModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="export-leads-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex items-start justify-between">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Download className="size-6" />
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} aria-label="Close" className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed">
                        <X className="size-5" />
                    </button>
                </div>

                <h2 id="export-leads-title" className="mt-5 text-2xl font-bold text-slate-900">Export leads</h2>
                <p className="mt-2 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">{total} {total === 1 ? 'lead' : 'leads'}</span> will be exported to a CSV file.
                </p>

                <dl className="mt-5 space-y-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Search</dt>
                        <dd className="min-w-0 truncate font-medium text-slate-900">{search || 'None'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Category</dt>
                        <dd className="min-w-0 truncate font-medium text-slate-900">{category}</dd>
                    </div>
                </dl>

                <h3 className="mt-5 text-xs font-medium tracking-wide text-slate-500 uppercase">Included in the file</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {LEAD_CSV_COLUMNS.map((column) => (
                        <span key={column} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{column}</span>
                    ))}
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} disabled={loading} className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} disabled={loading} className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                        {loading ? 'Exporting...' : 'Export'}
                    </button>
                </div>
            </div>
        </div>
    )
}
