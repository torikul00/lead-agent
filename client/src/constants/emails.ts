// Placeholders a template can use; each is filled in with the lead's details
export const TEMPLATE_PLACEHOLDERS = ['companyName', 'contactName', 'domain'] as const

// Provider versions of a template; leads on any provider not listed by name use "Other"
export const TEMPLATE_VARIANTS = [
    { key: 'google_workspace', label: 'Google Workspace' },
    { key: 'microsoft_365', label: 'Microsoft 365' },
    { key: 'zoho', label: 'Zoho' },
    { key: 'godaddy', label: 'GoDaddy' },
    { key: 'hostinger', label: 'Hostinger' },
    { key: 'titan', label: 'Titan' },
    { key: 'ionos', label: 'IONOS' },
    { key: 'namecheap', label: 'Namecheap' },
    { key: 'other', label: 'Other' },
] as const
