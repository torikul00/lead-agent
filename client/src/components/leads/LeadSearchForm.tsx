import { useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { z } from 'zod'
import { Briefcase, Code, Cpu, Factory, GraduationCap, HeartPulse, Landmark, Megaphone, RadioTower, ShoppingCart, Tag, X, type LucideIcon } from 'lucide-react'
import SelectField from '@/components/SelectField.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import CityField from '@/components/leads/CityField.tsx'
import { COMPANY_SIZES, COUNTRIES, DEFAULT_LEADS, INDUSTRIES, MAX_KEYWORDS, MAX_LEADS } from '@/constants/leads.ts'
import { leadSearchSchema, type LeadSearchInput } from '@/schemas/lead.ts'
import type { City } from '@/types/index.ts'

const INDUSTRY_ICONS: Record<(typeof INDUSTRIES)[number], LucideIcon> = {
    'Technology': Cpu,
    'Software': Code,
    'Financial Services': Landmark,
    'Healthcare': HeartPulse,
    'Marketing & Advertising': Megaphone,
    'E-commerce & Retail': ShoppingCart,
    'Telecommunications': RadioTower,
    'Education': GraduationCap,
    'Manufacturing': Factory,
    'Consulting': Briefcase,
}

const industryOptions = INDUSTRIES.map((name) => ({ value: name, label: name, icon: INDUSTRY_ICONS[name] }))
const countryOptions = COUNTRIES.map((name) => ({ value: name, label: name }))
const sizeOptions = [{ value: '', label: 'Any size' }, ...COMPANY_SIZES.map((size) => ({ value: size, label: `${size} employees` }))]

type SearchErrors = Partial<Record<keyof LeadSearchInput, string[]>>

type LeadSearchFormProps = {
    loading: boolean
    onSearch: (criteria: LeadSearchInput) => void
}

export default function LeadSearchForm({ loading, onSearch }: LeadSearchFormProps) {
    const [industry, setIndustry] = useState('')
    const [country, setCountry] = useState('Sweden')
    const [city, setCity] = useState<City | null>(null)
    const [companySize, setCompanySize] = useState('')
    const [limit, setLimit] = useState(DEFAULT_LEADS)
    const [keywords, setKeywords] = useState<string[]>([])
    const [keywordInput, setKeywordInput] = useState('')
    const [errors, setErrors] = useState<SearchErrors>({})

    const addKeyword = () => {
        const keyword = keywordInput.trim()
        setKeywordInput('')
        if (!keyword || keywords.length >= MAX_KEYWORDS) return
        if (keywords.some((item) => item.toLowerCase() === keyword.toLowerCase())) return
        setKeywords([...keywords, keyword])
    }

    // Enter or comma adds the keyword, Backspace on an empty input removes the last one
    const handleKeywordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addKeyword()
        } else if (e.key === 'Backspace' && !keywordInput && keywords.length) {
            setKeywords(keywords.slice(0, -1))
        }
    }

    // A city belongs to one country, so picking another country clears it
    const changeCountry = (value: string) => {
        setCountry(value)
        setCity(null)
    }

    const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()

        // Include a keyword that was typed but not added with Enter
        const pending = keywordInput.trim()
        const allKeywords = pending && !keywords.includes(pending) ? [...keywords, pending] : keywords
        setKeywords(allKeywords)
        setKeywordInput('')

        const result = leadSearchSchema.safeParse({
            country,
            city: city ? { name: city.name, lat: city.lat, lon: city.lon } : undefined,
            industry,
            company_size: companySize || undefined,
            keywords: allKeywords,
            limit,
        })

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
        onSearch(result.data)
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <SelectField id="industry" label="Industry" options={industryOptions} value={industry} onChange={setIndustry} placeholder="Select an industry" error={errors.industry?.[0]} />
                <SelectField id="country" label="Country" options={countryOptions} value={country} onChange={changeCountry} searchable />
                <CityField country={country} value={city} onChange={setCity} />
                <SelectField id="company_size" label="Company size" options={sizeOptions} value={companySize} onChange={setCompanySize} />

                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="limit" className="text-sm font-medium text-slate-700">Number of leads</label>
                        <span className="rounded-md bg-primary/10 px-2 text-sm font-semibold text-primary">{limit}</span>
                    </div>
                    <div className="flex h-11 items-center gap-3">
                        <span className="text-xs text-slate-400">1</span>
                        <input id="limit" type="range" min={1} max={MAX_LEADS} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full cursor-pointer accent-primary" />
                        <span className="text-xs text-slate-400">{MAX_LEADS}</span>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="keyword" className="text-sm font-medium text-slate-700">
                            Keywords <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <span className="text-xs text-slate-400">{keywords.length}/{MAX_KEYWORDS}</span>
                    </div>
                    <div className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-white px-3.5 py-1.5 transition focus-within:ring-4 ${errors.keywords ? 'border-red-500 focus-within:ring-red-500/15' : 'border-slate-200 focus-within:border-primary focus-within:ring-primary/15'}`}>
                        <Tag className="size-4 shrink-0 text-slate-400" />
                        {keywords.map((keyword) => (
                            <span key={keyword} className="flex items-center gap-1 rounded-lg bg-primary/10 py-0.5 pr-1 pl-2.5 text-sm font-medium text-primary">
                                {keyword}
                                <button type="button" onClick={() => setKeywords(keywords.filter((item) => item !== keyword))} aria-label={`Remove ${keyword}`} className="cursor-pointer rounded p-0.5 transition hover:bg-primary/15">
                                    <X className="size-3.5" />
                                </button>
                            </span>
                        ))}
                        <input
                            id="keyword"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={handleKeywordKeyDown}
                            maxLength={50}
                            disabled={keywords.length >= MAX_KEYWORDS}
                            placeholder={keywords.length >= MAX_KEYWORDS ? 'Keyword limit reached' : 'e.g. Cloud Computing, then press Enter'}
                            className="min-w-48 flex-1 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="shrink-0 lg:w-44">
                    <SubmitButton loading={loading}>Find leads</SubmitButton>
                </div>
            </div>
            {errors.keywords && <p className="mt-1.5 text-sm text-red-600">{errors.keywords[0]}</p>}
        </form>
    )
}
