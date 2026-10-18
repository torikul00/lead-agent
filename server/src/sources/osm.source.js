import { COUNTRY_CODES } from '../../utils/constants.js';
import { firstValue, isValidEmail, toWebsite } from '../../utils/helper.js';

// Public Overpass servers, tried in order because they are often busy or down
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const QUERY_TIMEOUT_S = 25;
const ROW_LIMIT = 300;

// OpenStreetMap tags of the businesses that belong to each industry option
const INDUSTRY_TAGS = {
    'Technology': ['["office"~"^(it|software|telecommunication)$"]'],
    'Software': ['["office"~"^(it|software)$"]'],
    'Financial Services': ['["office"~"^(financial|financial_advisor|insurance|accountant|tax_advisor)$"]', '["amenity"="bank"]'],
    'Healthcare': ['["healthcare"~"^(clinic|hospital|centre|laboratory)$"]', '["amenity"~"^(clinic|hospital)$"]'],
    'Marketing & Advertising': ['["office"~"^(advertising_agency|marketing)$"]'],
    'E-commerce & Retail': ['["shop"~"^(department_store|supermarket|mall|electronics|computer|clothes|furniture)$"]'],
    'Telecommunications': ['["office"="telecommunication"]', '["shop"="mobile_phone"]'],
    'Education': ['["amenity"~"^(university|college|school|language_school|training)$"]', '["office"="educational_institution"]'],
    'Manufacturing': ['["man_made"="works"]', '["industrial"="factory"]'],
    'Consulting': ['["office"="consulting"]'],
};

// Businesses in the country with the industry's tags and a website ("website" or "contact:website")
const buildQuery = (countryCode, filters) => `
    [out:json][timeout:${QUERY_TIMEOUT_S}];
    area["ISO3166-1"="${countryCode}"][admin_level=2]->.country;
    (
        ${filters.map((filter) => `nwr${filter}["website"](area.country); nwr${filter}["contact:website"](area.country);`).join('\n')}
    );
    out tags ${ROW_LIMIT};
`;

// Each server's failure is kept for the log, e.g. "overpass-api.de: UND_ERR_CONNECT_TIMEOUT"
const runQuery = async (query) => {
    const failures = [];

    for (const url of OVERPASS_URLS) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'User-Agent': `LeadAgent/1.0 (${process.env.CLIENT_URL})` },
                body: new URLSearchParams({ data: query }),
                signal: AbortSignal.timeout((QUERY_TIMEOUT_S + 5) * 1000),
            });
            const data = response.ok ? await response.json() : null;

            // A query that ran out of time still answers 200, with the error in "remark"
            if (data && !data.remark?.includes('error')) return data.elements;
            failures.push(`${new URL(url).hostname}: ${data?.remark ?? `HTTP ${response.status}`}`);
        } catch (err) {
            failures.push(`${new URL(url).hostname}: ${err.cause?.code ?? err.message}`);
        }
    }

    throw new Error(`No OpenStreetMap server answered (${failures.join('; ')})`);
};

// OpenStreetMap often has the business's own phone and email, so they come along
const toCandidates = (elements, country, industry) => elements.flatMap(({ type, id, tags = {} }) => {
    const website = toWebsite(tags.website ?? tags['contact:website']);
    if (!tags.name || !website) return [];

    const url = `https://www.openstreetmap.org/${type}/${id}`;
    const email = firstValue(tags.email ?? tags['contact:email'])?.toLowerCase();

    return [{
        name: tags.name,
        website,
        country,
        industry,
        employee_count: null,
        address: tags['addr:city'] ?? null,
        description: tags.description ?? null,
        phone: firstValue(tags.phone ?? tags['contact:phone']),
        company_emails: email && isValidEmail(email) ? [{ email, source_name: 'OpenStreetMap', source_url: url }] : [],
        source_name: 'OpenStreetMap',
        source_url: url,
    }];
});

export default {
    name: 'osm',
    label: 'OpenStreetMap',
    type: 'api',

    // Smaller, local companies; OpenStreetMap has no employee counts, so the size filter can't apply here
    async search({ country, industry }) {
        const countryCode = COUNTRY_CODES[country];
        const filters = INDUSTRY_TAGS[industry];
        if (!countryCode || !filters) return [];

        const elements = await runQuery(buildQuery(countryCode, filters));
        return toCandidates(elements, country, industry);
    },
};
