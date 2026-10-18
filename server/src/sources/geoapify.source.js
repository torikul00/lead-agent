import { COUNTRY_CODES } from '../../utils/constants.js';
import { firstValue, isValidEmail, toWebsite } from '../../utils/helper.js';

const PLACES_URL = 'https://api.geoapify.com/v2/places';
const REQUEST_TIMEOUT_MS = 20000;
const HUB_RADIUS_M = 100000;
const ROW_LIMIT = 500;

// Geoapify can't search a whole country (very large areas come back nearly empty), so each country is searched
// in 100 km circles around up to five business cities, spread out to cover different regions: [longitude, latitude]
const COUNTRY_HUBS = {
    'Australia': [[151.2093, -33.8688], [144.9631, -37.8136], [153.0251, -27.4698], [115.8605, -31.9505], [138.6007, -34.9285]],
    'Austria': [[16.3738, 48.2082], [15.4395, 47.0707], [14.2858, 48.3069], [13.0550, 47.8095], [11.4041, 47.2692]],
    'Bangladesh': [[90.4125, 23.8103], [91.7832, 22.3569], [89.5403, 22.8456], [88.6042, 24.3745], [91.8687, 24.8949]],
    'Belgium': [[4.3517, 50.8503], [3.7174, 51.0543], [5.5797, 50.6326]],
    'Brazil': [[-46.6333, -23.5505], [-43.1729, -22.9068], [-43.9378, -19.9167], [-49.2733, -25.4284], [-47.8825, -15.7942]],
    'Canada': [[-79.3832, 43.6532], [-73.5673, 45.5017], [-123.1207, 49.2827], [-114.0719, 51.0447], [-75.6972, 45.4215]],
    'Denmark': [[12.5683, 55.6761], [10.2039, 56.1629], [10.4024, 55.4038], [9.9217, 57.0488]],
    'Egypt': [[31.2357, 30.0444], [29.9187, 31.2001], [32.3019, 31.2653]],
    'Estonia': [[24.7536, 59.4370], [26.7290, 58.3780], [24.4971, 58.3859]],
    'Finland': [[24.9384, 60.1699], [23.7610, 61.4978], [22.2666, 60.4518], [25.4651, 65.0121], [25.7473, 62.2426]],
    'France': [[2.3522, 48.8566], [4.8357, 45.7640], [5.3698, 43.2965], [1.4442, 43.6047], [3.0573, 50.6292]],
    'Germany': [[13.4050, 52.5200], [11.5820, 48.1351], [9.9937, 53.5511], [8.6821, 50.1109], [6.9603, 50.9375]],
    'India': [[77.5946, 12.9716], [72.8777, 19.0760], [77.1025, 28.7041], [78.4867, 17.3850], [80.2707, 13.0827]],
    'Indonesia': [[106.8456, -6.2088], [112.7521, -7.2575], [107.6191, -6.9175], [98.6722, 3.5952], [110.4203, -6.9667]],
    'Ireland': [[-6.2603, 53.3498], [-8.4863, 51.8985], [-9.0568, 53.2707]],
    'Israel': [[34.7818, 32.0853], [34.9896, 32.7940], [34.7913, 31.2520]],
    'Italy': [[9.1900, 45.4642], [12.4964, 41.9028], [7.6869, 45.0703], [14.2681, 40.8518], [11.3426, 44.4949]],
    'Japan': [[139.6917, 35.6895], [135.5023, 34.6937], [136.9066, 35.1815], [130.4017, 33.5904], [141.3545, 43.0618]],
    'Kenya': [[36.8219, -1.2921], [39.6682, -4.0435], [34.7680, -0.0917], [35.2698, 0.5143]],
    'Malaysia': [[101.6869, 3.1390], [100.3327, 5.4141], [103.7414, 1.4927], [116.0735, 5.9804], [110.3593, 1.5533]],
    'Mexico': [[-99.1332, 19.4326], [-103.3496, 20.6597], [-100.3161, 25.6866], [-100.3899, 20.5888], [-117.0382, 32.5149]],
    'Netherlands': [[4.9041, 52.3676], [4.4777, 51.9244], [5.4697, 51.4416], [6.5665, 53.2194]],
    'New Zealand': [[174.7633, -36.8485], [174.7762, -41.2865], [172.6362, -43.5321], [175.2793, -37.7870], [170.5028, -45.8788]],
    'Nigeria': [[3.3792, 6.5244], [7.3986, 9.0765], [7.0498, 4.8156], [3.9470, 7.3775], [8.5920, 12.0022]],
    'Norway': [[10.7522, 59.9139], [5.3221, 60.3913], [10.3951, 63.4305], [5.7331, 58.9700], [7.9956, 58.1599]],
    'Pakistan': [[67.0011, 24.8607], [74.3587, 31.5204], [73.0479, 33.6844], [73.1350, 31.4504], [71.5249, 34.0151]],
    "People's Republic of China": [[116.4074, 39.9042], [121.4737, 31.2304], [114.0579, 22.5431], [120.1551, 30.2741], [104.0665, 30.5728]],
    'Philippines': [[120.9842, 14.5995], [123.8854, 10.3157], [125.6128, 7.1907]],
    'Poland': [[21.0122, 52.2297], [19.9450, 50.0647], [17.0385, 51.1079], [16.9252, 52.4064], [18.6466, 54.3520]],
    'Portugal': [[-9.1393, 38.7223], [-8.6291, 41.1579], [-8.4103, 40.2033], [-7.9304, 37.0194]],
    'Saudi Arabia': [[46.6753, 24.7136], [39.1925, 21.4858], [50.1033, 26.4207], [39.5692, 24.5247]],
    'Singapore': [[103.8198, 1.3521]],
    'South Africa': [[28.0473, -26.2041], [18.4241, -33.9249], [31.0218, -29.8587], [25.6022, -33.9608], [26.2041, -29.0852]],
    'South Korea': [[126.9780, 37.5665], [129.0756, 35.1796], [128.6014, 35.8714], [127.3845, 36.3504], [126.8526, 35.1595]],
    'Spain': [[-3.7038, 40.4168], [2.1734, 41.3851], [-0.3763, 39.4699], [-5.9845, 37.3891], [-2.9350, 43.2630]],
    'Sweden': [[18.0686, 59.3293], [11.9746, 57.7089], [13.0038, 55.6050], [15.6214, 58.4108], [20.2630, 63.8258]],
    'Switzerland': [[8.5417, 47.3769], [6.1432, 46.2044], [7.4474, 46.9480], [8.9511, 46.0037]],
    'Turkey': [[28.9784, 41.0082], [32.8597, 39.9334], [27.1428, 38.4237], [30.7133, 36.8969], [35.3213, 37.0000]],
    'United Arab Emirates': [[55.2708, 25.2048], [54.3773, 24.4539], [55.7447, 24.2075]],
    'United Kingdom': [[-0.1276, 51.5072], [-2.2426, 53.4808], [-1.8904, 52.4862], [-3.1883, 55.9533], [-2.5879, 51.4545]],
    'United States': [[-74.0060, 40.7128], [-122.4194, 37.7749], [-118.2437, 34.0522], [-87.6298, 41.8781], [-97.7431, 30.2672]],
    'Vietnam': [[106.6297, 10.8231], [105.8342, 21.0278], [108.2022, 16.0544], [105.7469, 10.0452]],
};

// Geoapify place categories for each industry option; the places themselves are OpenStreetMap data hosted by Geoapify
const INDUSTRY_CATEGORIES = {
    'Technology': ['office.it', 'office.telecommunication'],
    'Software': ['office.it'],
    'Financial Services': ['office.financial', 'office.financial_advisor', 'office.insurance', 'office.accountant', 'office.tax_advisor', 'service.financial.bank'],
    'Healthcare': ['healthcare.clinic_or_praxis', 'healthcare.hospital'],
    'Marketing & Advertising': ['office.advertising_agency'],
    'E-commerce & Retail': ['commercial.department_store', 'commercial.supermarket', 'commercial.shopping_mall', 'commercial.elektronics', 'commercial.clothing', 'commercial.furniture_and_interior'],
    'Telecommunications': ['office.telecommunication'],
    'Education': ['education.university', 'education.college', 'education.school', 'education.language_school', 'office.educational_institution'],
    'Manufacturing': ['production.factory'],
    'Consulting': ['office.consulting'],
};

// Geoapify's short OpenStreetMap element types
const OSM_TYPES = { n: 'node', w: 'way', r: 'relation' };

// Reasons behind Geoapify's error statuses, for the server log
const GEOAPIFY_ERRORS = {
    401: 'Geoapify rejected the API key, check GEOAPIFY_API_KEY',
    429: 'Geoapify daily credits or rate limit reached',
};

// Named places of the categories within 100 km of one hub; each request costs one credit on the free plan
const searchHub = async (categories, [lon, lat]) => {
    const params = new URLSearchParams({
        categories: categories.join(','),
        filter: `circle:${lon},${lat},${HUB_RADIUS_M}`,
        conditions: 'named',
        limit: ROW_LIMIT,
        apiKey: process.env.GEOAPIFY_API_KEY,
    });
    const response = await fetch(`${PLACES_URL}?${params}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    if (!response.ok) {
        const { message } = await response.json().catch(() => ({}));
        throw new Error(GEOAPIFY_ERRORS[response.status] ?? `Geoapify request failed with status ${response.status}: ${message}`);
    }

    const data = await response.json();
    return data.features ?? [];
};

// Hubs are searched one after another to stay under the free plan's 5 requests per second; one failed hub doesn't drop the others
const searchCountry = async (hubs, categories) => {
    if (!process.env.GEOAPIFY_API_KEY) throw new Error('GEOAPIFY_API_KEY is not set');

    const features = [];
    let lastError = null;
    for (const hub of hubs) {
        try {
            features.push(...await searchHub(categories, hub));
        } catch (err) {
            lastError = err;
        }
    }

    if (!features.length && lastError) throw lastError;
    return features;
};

// The website, phone and email come from the place itself or its OpenStreetMap tags ("datasource.raw")
const toCandidates = (features, country, industry) => features.flatMap(({ properties: place = {} }) => {
    // Circles near a border reach into the next country
    if (place.country_code !== COUNTRY_CODES[country].toLowerCase()) return [];

    const raw = place.datasource?.raw ?? {};
    const website = toWebsite(place.website ?? raw.website ?? raw['contact:website']);
    if (!place.name || !website) return [];

    const url = OSM_TYPES[raw.osm_type] && raw.osm_id ? `https://www.openstreetmap.org/${OSM_TYPES[raw.osm_type]}/${raw.osm_id}` : null;
    const email = firstValue(place.contact?.email ?? raw.email ?? raw['contact:email'])?.toLowerCase();

    return [{
        name: place.name,
        website,
        country,
        industry,
        employee_count: null,
        address: place.city ?? null,
        description: null,
        phone: firstValue(place.contact?.phone ?? raw.phone ?? raw['contact:phone']),
        company_emails: email && isValidEmail(email) ? [{ email, source_name: 'Geoapify', source_url: url ?? 'https://www.geoapify.com/' }] : [],
        source_name: 'Geoapify',
        source_url: url,
    }];
});

export default {
    name: 'geoapify',
    label: 'Geoapify',
    type: 'api',

    // Smaller, local companies from OpenStreetMap data; there are no employee counts, so the size filter can't apply here
    async search({ country, industry }) {
        const hubs = COUNTRY_HUBS[country];
        const categories = INDUSTRY_CATEGORIES[industry];
        if (!hubs || !categories || !COUNTRY_CODES[country]) return [];

        const features = await searchCountry(hubs, categories);
        return toCandidates(features, country, industry);
    },
};
