export type User = {
    id: string
    full_name: string
    email: string
    phone: string
    avatar: string | null
    is_email_verified: boolean
}

export type City = {
    name: string
    region: string | null
    lat: number
    lon: number
}

export type MxStatus = 'found' | 'not_found' | 'error' | 'not_checked'

export type FitLabel = 'good_fit' | 'needs_review' | 'poor_fit'

export type Contact = {
    name: string
    title: string
    role: string
    email: string | null
    phone: string | null
    linkedin_url: string | null
    source_name: string
    source_url: string
}

export type CompanyEmail = {
    email: string
    source_name: string
    source_url: string
}

export type Lead = {
    id?: string
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
    email_provider: string | null
    phone: string | null
    company_emails: CompanyEmail[]
    contacts: Contact[]
    score: number
    fit_label: FitLabel
    score_reasons: string[]
    category_id?: string | null | { _id: string; name: string; color: string }
    is_mail_sent?: boolean
}

export type LeadList = {
    id: string
    name: string
    lead_count: number
    created_at: string
}

export type Category = {
    id: string
    name: string
    slug: string
    color: string
    created_at: string
}

export type TemplateVariantKey = 'google_workspace' | 'microsoft_365' | 'zoho' | 'godaddy' | 'hostinger' | 'titan' | 'ionos' | 'namecheap' | 'other'

export type EmailContent = {
    subject: string
    body: string
}

export type EmailTemplate = EmailContent & {
    id: string
    name: string
    variants: Record<TemplateVariantKey, EmailContent | null>
    updated_at: string
}

export type MailboxProvider = 'gmail' | 'outlook'

export type Mailbox = {
    id: string
    provider: MailboxProvider
    email: string
    status: 'connected' | 'disconnected'
}

export type Conversation = {
    id: string
    lead_id: string | null
    lead_name: string
    domain: string | null
    phone: string | null
    category_id: string | null
    lead_email: string
    subject: string
    snippet: string
    last_message_at: string
    is_read: boolean
}

export type EmailMessage = {
    id: string
    direction: 'sent' | 'received'
    from: string
    to: string
    subject: string
    body: string
    sent_at: string
}

export type AuthState = {
    user: User | null
    loading: boolean
    setUser: (user: User | null) => void
    fetchUser: () => Promise<void>
    logout: () => Promise<void>
}
