const SPARQL_URL = 'https://query.wikidata.org/sparql';
const QUERY_TIMEOUT_MS = 30000;
const ROW_LIMIT = 500;

// Wikidata industry items (P452) for each industry option, checked against live data
const INDUSTRY_ITEMS = {
    'Technology': ['Q880371', 'Q11661', 'Q11660', 'Q483639', 'Q3510521', 'Q2986369'],
    'Software': ['Q880371'],
    'Financial Services': ['Q837171', 'Q3435731', 'Q43183'],
    'Healthcare': ['Q31207', 'Q507443', 'Q7108'],
    'Marketing & Advertising': ['Q39809', 'Q37038', 'Q1323528'],
    'E-commerce & Retail': ['Q484847', 'Q126793'],
    'Telecommunications': ['Q418'],
    'Education': ['Q8434'],
    'Manufacturing': ['Q10861389', 'Q190117'],
    'Consulting': ['Q63769412'],
};

// Item types that are products or non-companies (software, website, brand, web app, online service, app, nonprofit, review site, SaaS, organization)
const EXCLUDED_TYPES = ['Q7397', 'Q35127', 'Q431289', 'Q189210', 'Q19967801', 'Q166142', 'Q163740', 'Q1340449', 'Q1254596', 'Q43229'];

const toItems = (ids) => ids.map((id) => `wd:${id}`).join(' ');

// The label service falls back to the bare Q-id when an item has no English name
const readLabel = (binding) => (binding && !/^Q\d+$/.test(binding.value) ? binding.value : null);

const runQuery = async (query) => {
    const response = await fetch(`${SPARQL_URL}?format=json&query=${encodeURIComponent(query)}`, {
        headers: {
            'Accept': 'application/sparql-results+json',
            // Wikidata requires a descriptive User-Agent with a contact URL
            'User-Agent': `LeadAgent/1.0 (${process.env.CLIENT_URL})`,
        },
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`Wikidata query failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.results.bindings;
};

// Find the country's item from its exact English name, e.g. "United States" -> Q30
const findCountryId = async (country) => {
    // JSON.stringify quotes and escapes the text so it's a safe SPARQL string
    const rows = await runQuery(`
        SELECT ?country WHERE {
            ?country rdfs:label ${JSON.stringify(country)}@en.
            VALUES ?type { wd:Q6256 wd:Q3624078 }
            ?country wdt:P31 ?type.
        }
        LIMIT 1
    `);

    return rows[0]?.country.value.split('/').pop() ?? null;
};

// Keep companies with no employee count, drop those outside the selected size
const buildSizeFilter = (companySize) => {
    if (!companySize) return '';

    // "51-200" -> [51, 200], "10001+" -> [10001, 0] (no upper limit)
    const [min, max] = companySize.split(/[-+]/).map(Number);
    const upper = max ? ` && ?employees <= ${max}` : '';
    return `FILTER(!BOUND(?employees) || (?employees >= ${min}${upper}))`;
};

const buildSearchQuery = (countryId, industryItems, companySize) => `
    SELECT ?company ?companyLabel ?description ?website ?employees ?industryLabel ?hqLabel WHERE {
        VALUES ?industry { ${toItems(industryItems)} }
        ?company wdt:P452 ?industry;
                 wdt:P17 wd:${countryId};
                 wdt:P856 ?website;
                 wikibase:sitelinks ?sitelinks.
        FILTER NOT EXISTS {
            VALUES ?excluded { ${toItems(EXCLUDED_TYPES)} }
            ?company wdt:P31 ?excluded.
        }
        FILTER NOT EXISTS { ?company wdt:P576 ?dissolved. }
        OPTIONAL { ?company wdt:P1128 ?employees. }
        ${buildSizeFilter(companySize)}
        OPTIONAL { ?company wdt:P159 ?hq. }
        OPTIONAL { ?company schema:description ?description. FILTER(LANG(?description) = "en") }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)
    LIMIT ${ROW_LIMIT}
`;

// Wikidata returns one row per website/industry/HQ combination, so group rows into one company each
const toCandidates = (rows, country) => {
    const companies = new Map();

    for (const row of rows) {
        const id = row.company.value.split('/').pop();
        const name = readLabel(row.companyLabel);
        if (!name) continue;

        if (!companies.has(id)) {
            companies.set(id, {
                name,
                website: row.website.value,
                country,
                industries: [],
                employee_count: null,
                address: readLabel(row.hqLabel),
                description: row.description?.value ?? null,
                source_name: 'Wikidata',
                source_url: `https://www.wikidata.org/wiki/${id}`,
            });
        }

        const company = companies.get(id);
        const industry = readLabel(row.industryLabel);
        if (industry && !company.industries.includes(industry)) {
            company.industries.push(industry);
        }
        if (row.employees) {
            company.employee_count = Math.max(company.employee_count ?? 0, Number(row.employees.value));
        }
    }

    return [...companies.values()].map(({ industries, ...company }) => ({
        ...company,
        industry: industries.join(', ') || null,
    }));
};

export default {
    name: 'wikidata',
    label: 'Wikidata',
    type: 'api',

    async search({ country, industry, company_size }) {
        const industryItems = INDUSTRY_ITEMS[industry];
        if (!industryItems) return [];

        const countryId = await findCountryId(country);
        if (!countryId) return [];

        const rows = await runQuery(buildSearchQuery(countryId, industryItems, company_size));
        return toCandidates(rows, country);
    },
};
