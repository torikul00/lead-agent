// Lead search: default and maximum number of leads, and how many top candidates get the slower MX check
export const DEFAULT_LEADS = 10;
export const MAX_LEADS = 50;
export const SHORTLIST_SIZE = 20;

// ISO 3166-1 codes for the countries the search form offers, used by the map-based sources
export const COUNTRY_CODES = {
    'Australia': 'AU', 'Austria': 'AT', 'Bangladesh': 'BD', 'Belgium': 'BE', 'Brazil': 'BR', 'Canada': 'CA', 'Denmark': 'DK',
    'Egypt': 'EG', 'Estonia': 'EE', 'Finland': 'FI', 'France': 'FR', 'Germany': 'DE', 'India': 'IN', 'Indonesia': 'ID',
    'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT', 'Japan': 'JP', 'Kenya': 'KE', 'Malaysia': 'MY', 'Mexico': 'MX',
    'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nigeria': 'NG', 'Norway': 'NO', 'Pakistan': 'PK', "People's Republic of China": 'CN',
    'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT', 'Saudi Arabia': 'SA', 'Singapore': 'SG', 'South Africa': 'ZA',
    'South Korea': 'KR', 'Spain': 'ES', 'Sweden': 'SE', 'Switzerland': 'CH', 'Turkey': 'TR', 'United Arab Emirates': 'AE',
    'United Kingdom': 'GB', 'United States': 'US', 'Vietnam': 'VN',
};

// Contact finding: how many company websites are read at once, and the most people and emails kept per lead
export const ENRICH_CONCURRENCY = 8;
export const MAX_CONTACTS = 10;
export const MAX_COMPANY_EMAILS = 5;
