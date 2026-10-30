import type { FitLabel, MxStatus } from '@/types/index.ts'

// Country names must match Wikidata's English names exactly
export const COUNTRIES = [
    'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'Denmark', 'Egypt', 'Estonia', 'Finland',
    'France', 'Germany', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Kenya', 'Malaysia',
    'Mexico', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', "People's Republic of China", 'Philippines', 'Poland', 'Portugal',
    'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea','Sweden', 'Spain', 'Switzerland', 'Turkey', 'United Arab Emirates', 'United Kingdom',
    'United States', 'Vietnam',
] as const

// Must match the server's industry list
export const INDUSTRIES = [
    'Technology', 'Software', 'Financial Services', 'Healthcare', 'Marketing & Advertising',
    'E-commerce & Retail', 'Telecommunications', 'Education', 'Manufacturing', 'Consulting',
] as const

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'] as const

export const DEFAULT_LEADS = 10
export const MAX_LEADS = 50
export const MAX_KEYWORDS = 10

export const FIT_LABELS: Record<FitLabel, { label: string; className: string }> = {
    good_fit: { label: 'Good fit', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
    needs_review: { label: 'Needs review', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
    poor_fit: { label: 'Poor fit', className: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
}

export const MX_LABELS: Record<MxStatus, { label: string; dot: string }> = {
    found: { label: 'MX found', dot: 'bg-emerald-500' },
    not_found: { label: 'No MX', dot: 'bg-red-500' },
    error: { label: 'Check failed', dot: 'bg-amber-500' },
    not_checked: { label: 'Not checked', dot: 'bg-slate-300' },
}

export const SCORE_BARS: Record<FitLabel, string> = {
    good_fit: 'bg-emerald-500',
    needs_review: 'bg-amber-400',
    poor_fit: 'bg-slate-400',
}
