import { Fragment, useState } from 'react'
import { Check, ChevronDown, ExternalLink } from 'lucide-react'
import type { FitLabel, Lead, MxStatus } from '@/types/index.ts'

const FIT_LABELS: Record<FitLabel, { label: string; className: string }> = {
    good_fit: { label: 'Good fit', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
    needs_review: { label: 'Needs review', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
    poor_fit: { label: 'Poor fit', className: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
}

const MX_LABELS: Record<MxStatus, { label: string; dot: string }> = {
    found: { label: 'MX found', dot: 'bg-emerald-500' },
    not_found: { label: 'No MX', dot: 'bg-red-500' },
    error: { label: 'Check failed', dot: 'bg-amber-500' },
    not_checked: { label: 'Not checked', dot: 'bg-slate-300' },
}

const SCORE_BARS: Record<FitLabel, string> = {
    good_fit: 'bg-emerald-500',
    needs_review: 'bg-amber-400',
    poor_fit: 'bg-slate-400',
}

export default function LeadsTable({ leads }: { leads: Lead[] }) {
    const [openRow, setOpenRow] = useState<string | null>(null)

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    <tr>
                        <th className="px-6 py-3">Company</th>
                        <th className="px-4 py-3">Industry</th>
                        <th className="px-4 py-3">Employees</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Mail server</th>
                        <th className="px-4 py-3">Score</th>
                        <th className="w-12 px-4 py-3"><span className="sr-only">Details</span></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => {
                        const key = lead.domain ?? lead.name
                        const open = openRow === key
                        const fit = FIT_LABELS[lead.fit_label]
                        const mx = MX_LABELS[lead.mx_status]

                        return (
                            <Fragment key={key}>
                                <tr className={`transition hover:bg-slate-50/80 ${open ? 'bg-slate-50/80' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                                                {lead.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-slate-900">{lead.name}</p>
                                                {lead.domain && (
                                                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-primary">
                                                        {lead.domain}
                                                        <ExternalLink className="size-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <p className="max-w-[200px] truncate text-slate-600 capitalize" title={lead.industry ?? undefined}>{lead.industry ?? '—'}</p>
                                    </td>
                                    <td className="px-4 py-4 text-slate-600">{lead.employee_count?.toLocaleString() ?? '—'}</td>
                                    <td className="px-4 py-4">
                                        <p className="text-slate-900">{lead.address ?? '—'}</p>
                                        <p className="text-xs text-slate-500">{lead.country}</p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="inline-flex items-center gap-2 text-slate-600">
                                            <span className={`size-2 rounded-full ${mx.dot}`} />
                                            {mx.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="w-7 font-semibold text-slate-900">{lead.score}</span>
                                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                                <div className={`h-full rounded-full ${SCORE_BARS[lead.fit_label]}`} style={{ width: `${lead.score}%` }} />
                                            </div>
                                        </div>
                                        <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${fit.className}`}>{fit.label}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <button type="button" onClick={() => setOpenRow(open ? null : key)} aria-expanded={open} aria-label={open ? 'Hide details' : 'Show details'} className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                                            <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
                                        </button>
                                    </td>
                                </tr>

                                {open && (
                                    <tr className="bg-slate-50/80">
                                        <td colSpan={7} className="px-6 pt-1 pb-6">
                                            <div className="grid gap-6 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
                                                <div>
                                                    <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">About</h3>
                                                    <p className="mt-2 text-sm text-slate-700">{lead.description ?? 'No description available.'}</p>
                                                    {lead.source_url && (
                                                        <a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                                                            View on {lead.source_name}
                                                            <ExternalLink className="size-3.5" />
                                                        </a>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Why this score</h3>
                                                    <ul className="mt-2 space-y-1.5">
                                                        {lead.score_reasons.map((reason) => (
                                                            <li key={reason} className="flex items-start gap-2 text-sm text-slate-700">
                                                                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                                                                {reason}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
