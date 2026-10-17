export type User = {
    id: string
    full_name: string
    email: string
    phone: string
    avatar: string | null
    is_email_verified: boolean
}

export type MxStatus = 'found' | 'not_found' | 'error' | 'not_checked'

export type FitLabel = 'good_fit' | 'needs_review' | 'poor_fit'

export type Lead = {
    name: string
    website: string
    domain: string | null
    country: string
    industry: string | null
    employee_count: number | null
    address: string | null
    description: string | null
    source_name: string
    source_url: string | null
    mx_status: MxStatus
    score: number
    fit_label: FitLabel
    score_reasons: string[]
}

export type AuthState = {
    user: User | null
    loading: boolean
    setUser: (user: User | null) => void
    fetchUser: () => Promise<void>
    logout: () => Promise<void>
}
