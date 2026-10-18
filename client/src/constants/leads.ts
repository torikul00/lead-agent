// Country names must match Wikidata's English names exactly
export const COUNTRIES = [
    'Sweden'
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
