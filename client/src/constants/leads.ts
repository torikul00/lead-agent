// Country names must match Wikidata's English names exactly
export const COUNTRIES = [
    'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'Denmark', 'Egypt', 'Estonia', 'Finland',
    'France', 'Germany', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Kenya', 'Malaysia',
    'Mexico', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', "People's Republic of China", 'Philippines', 'Poland', 'Portugal',
    'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Turkey', 'United Arab Emirates', 'United Kingdom',
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
