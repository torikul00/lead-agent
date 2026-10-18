import { addCompanyEmail, addContact, getRole } from '../../utils/helper.js';

const API_URL = 'https://api.hunter.io/v2';
const REQUEST_TIMEOUT_MS = 15000;

// Hunter charges credits for the emails it returns, so ask for a few decision makers only
const MAX_EMAILS = 3;

// Reasons behind Hunter's error statuses; they're only logged on the server, users see a general message
const HUNTER_ERRORS = {
    401: 'Hunter rejected the API key, check HUNTER_API_KEY',
    403: 'Hunter rate limit reached',
    429: 'Hunter credits for this month are used up',
};

// Personal emails of the company's decision makers, from Hunter's Domain Search
const searchDomain = async (domain) => {
    if (!process.env.HUNTER_API_KEY) throw new Error('HUNTER_API_KEY is not set');

    const params = new URLSearchParams({ domain, type: 'personal', decision_maker: 'true', limit: MAX_EMAILS });
    const response = await fetch(`${API_URL}/domain-search?${params}`, {
        headers: { 'X-API-KEY': process.env.HUNTER_API_KEY },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(HUNTER_ERRORS[response.status] ?? `Hunter request failed with status ${response.status}`);

    const { data } = await response.json();
    return data.emails ?? [];
};

// Hunter may give a full LinkedIn URL or just the handle
const toLinkedInUrl = (value) => {
    if (typeof value !== 'string' || !value) return null;
    return value.startsWith('http') ? value : `https://www.linkedin.com/in/${value}`;
};

export default {
    name: 'hunter',
    label: 'Hunter',

    // Adds the decision makers Hunter knows, or fills in the email, phone and LinkedIn of people already found
    async enrich(leads) {
        for (const lead of leads.filter((item) => item.domain)) {
            for (const item of await searchDomain(lead.domain)) {
                // Only emails Hunter found on a public page, never generated ones, and none it knows bounce
                if (!item.sources?.length || item.verification?.status === 'invalid') continue;

                const email = item.value.toLowerCase();

                // Credit the site where the email was published, not the provider
                const source = { source_name: item.sources[0].domain || 'Web', source_url: item.sources[0].uri };

                if (!item.first_name || !item.last_name) {
                    addCompanyEmail(lead, { email, ...source });
                    continue;
                }

                const title = item.position || 'Decision maker';
                addContact(lead, {
                    name: `${item.first_name} ${item.last_name}`,
                    title,
                    role: getRole(title) ?? 'Decision maker',
                    email,
                    phone: item.phone_number || null,
                    linkedin_url: toLinkedInUrl(item.linkedin),
                    ...source,
                });
            }
        }
    },
};
