import { lookup } from 'dns/promises';
import { BlockList } from 'net';
import { load } from 'cheerio';
import { ENRICH_CONCURRENCY } from '../../utils/constants.js';
import { addCompanyEmail, addContact, getRole, normalizeDomain, normalizePersonName, runWithConcurrency } from '../../utils/helper.js';

const SOURCE_NAME = 'Company website';
const PAGE_TIMEOUT_MS = 5000;
const SITE_TIME_BUDGET_MS = 15000;
const MAX_PAGE_BYTES = 2_000_000;
const MAX_EXTRA_PAGES = 3;
const MAX_REDIRECTS = 3;

// Words in a link's address or text that point to a page worth reading, best first: team pages list people, contact, about and legal pages list emails
const PAGE_KEYWORDS = ['team', 'leadership', 'management', 'founders', 'executive', 'people', 'directors', 'contact', 'kontakt', 'contacto', 'contatti', 'about', 'ueber-uns', 'a-propos', 'company', 'impressum', 'imprint', 'legal-notice', 'mentions-legales'];

// Words that show a short capitalized text is a heading, button or company, not a person's name
const NOT_NAME_WORDS = new Set([
    'our', 'the', 'and', 'of', 'for', 'with', 'to', 'at', 'in', 'us', 'all', 'more', 'meet', 'about', 'contact', 'get', 'touch',
    'read', 'learn', 'view', 'see', 'profile', 'bio', 'team', 'leadership', 'management', 'board', 'directors', 'executive',
    'executives', 'founders', 'partners', 'people', 'staff', 'office', 'members', 'home', 'news', 'blog', 'careers', 'jobs',
    'services', 'solutions', 'products', 'company', 'privacy', 'policy', 'terms', 'linkedin', 'twitter', 'email', 'call',
    'book', 'demo', 'case', 'studies', 'support', 'sales', 'pricing', 'resources', 'events', 'press', 'research', 'labs',
    'technologies', 'systems', 'software', 'consulting', 'digital', 'media', 'capital', 'ventures', 'group', 'international',
    'global', 'inc', 'llc', 'ltd', 'gmbh', 'corp', 'limited', 'new', 'york', 'united', 'states', 'kingdom', 'partner',
    'apply', 'now', 'join', 'become', 'find', 'start', 'try', 'free', 'sign', 'login', 'register', 'download', 'subscribe',
    'follow', 'share', 'watch', 'explore', 'discover', 'request', 'schedule', 'talk', 'chat', 'here', 'click', 'menu',
    'search', 'back', 'next', 'top', 'rights', 'reserved', 'copyright', 'cookie', 'cookies', 'settings', 'help', 'center', 'portal', 'program',
]);

// Lowercase parts of names like "Ludwig van Beethoven"
const NAME_PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'da', 'di', 'du', 'del', 'della', 'la', 'le', 'bin', 'al']);

// Mailboxes shared by a team, so they stay company emails even when shown on a person's card
const SHARED_MAILBOXES = new Set(['info', 'contact', 'hello', 'office', 'sales', 'support', 'admin', 'mail', 'team', 'enquiries', 'inquiries', 'press', 'media', 'marketing', 'careers', 'jobs', 'hr', 'billing', 'help', 'service', 'kontakt']);

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const VALID_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

// Private, loopback and link-local addresses: a website taken from Wikidata must never make the server call itself or its own network
const PRIVATE_ADDRESSES = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16]]) {
    PRIVATE_ADDRESSES.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10]]) {
    PRIVATE_ADDRESSES.addSubnet(address, prefix, 'ipv6');
}

const safeDecode = (text) => {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
};

// Only http(s) on the default port, on a host that resolves to public addresses
const isPublicUrl = async (url) => {
    if (!['http:', 'https:'].includes(url.protocol) || url.port) return false;
    try {
        const addresses = await lookup(url.hostname, { all: true });
        return addresses.every(({ address, family }) => !PRIVATE_ADDRESSES.check(address, family === 6 ? 'ipv6' : 'ipv4'));
    } catch {
        return false;
    }
};

// Read at most MAX_PAGE_BYTES, so a huge page can't fill the server's memory
const readLimited = async (response) => {
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body ?? []) {
        chunks.push(chunk);
        size += chunk.length;
        if (size >= MAX_PAGE_BYTES) break;
    }
    return Buffer.concat(chunks).toString('utf8');
};

// GET a page and follow redirects, but only to public hosts; null when blocked or redirected too many times
const fetchPage = async (startUrl) => {
    let url = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        if (!(await isPublicUrl(url))) return null;

        const response = await fetch(url, {
            redirect: 'manual',
            headers: {
                'Accept': 'text/html,*/*;q=0.8',
                'User-Agent': `LeadAgent/1.0 (${process.env.CLIENT_URL})`,
            },
            signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        });

        const location = response.headers.get('location');
        if (response.status >= 300 && response.status < 400 && location) {
            response.body?.cancel();
            url = new URL(location, url);
            continue;
        }

        if (!response.ok) response.body?.cancel();
        return {
            url,
            status: response.status,
            type: response.headers.get('content-type') ?? '',
            text: response.ok ? await readLimited(response) : '',
        };
    }
    return null;
};

const isHtml = (page) => page?.status < 300 && page.type.includes('text/html');

// Disallow rules for every crawler ("*") or for LeadAgent; consecutive User-agent lines share the rules below them
const parseRobots = (text) => {
    const rules = [];
    let applies = false;
    let readingAgents = false;

    for (const line of text.split(/\r?\n/)) {
        const [field, ...rest] = line.split('#')[0].split(':');
        const key = field.trim().toLowerCase();
        const value = rest.join(':').trim();
        if (!key) continue;

        if (key === 'user-agent') {
            const matches = value === '*' || value.toLowerCase().includes('leadagent');
            applies = readingAgents ? applies || matches : matches;
            readingAgents = true;
        } else {
            readingAgents = false;
            if (key === 'disallow' && applies && value) rules.push(value);
        }
    }
    return rules;
};

// The site's robots.txt rules: [] when it has none, null when it can't be read (the site is skipped, like search engines do)
const getRobotsRules = async (origin) => {
    const robots = await fetchPage(new URL('/robots.txt', origin));
    if (!robots || robots.status >= 500) return null;
    return robots.status < 300 ? parseRobots(robots.text) : [];
};

// In a rule, "*" matches anything and "$" marks the end of the address
const isAllowed = (url, rules) => {
    const path = `${url.pathname}${url.search}`;
    return !rules.some((rule) => new RegExp(`^${rule.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`).test(path));
};

// Text pieces directly inside an element, without its children's text: "Jane Smith<br>CEO" -> ["Jane Smith", "CEO"]
const ownTexts = ($, el) => $(el).contents().filter((_, node) => node.type === 'text').map((_, node) => node.data.replace(/\s+/g, ' ').trim()).get().filter(Boolean);

const ownText = ($, el) => ownTexts($, el).join(' ');

// All text on the page with spaces between elements, so "info@acme.com</p><p>Call us" doesn't run together
const pageText = ($) => $('body, body *').contents().filter((_, node) => node.type === 'text').map((_, node) => node.data).get().join(' ');

// "Jane Smith" or "Ludwig van Beethoven": 2-4 capitalized words that aren't a heading like "Our Team"
const looksLikeName = (text) => {
    const words = text.split(' ');
    if (text.length > 40 || words.length < 2 || words.length > 4 || getRole(text)) return false;
    return words.every((word) => NAME_PARTICLES.has(word) || (/^\p{Lu}[\p{L}'’.-]*$/u.test(word) && !NOT_NAME_WORDS.has(word.toLowerCase())));
};

// A short title that holds a decision-maker role at this company, not "CEO at another company" from a customer quote or a sentence
const isDecisionMakerTitle = (text) => text.length <= 60 && text.split(' ').length <= 8 && !/\d|\s(at|@)\s/i.test(text) && Boolean(getRole(text));

// Walk up from a title to the smallest block that holds exactly one name: that block is the person's card
const findCard = ($, el) => {
    let block = $(el);
    for (let depth = 0; depth < 4 && block.length; depth++) {
        const names = new Set(block.find('*').addBack().toArray().map((node) => ownText($, node)).filter(looksLikeName));
        if (names.size > 1) return null;
        if (names.size === 1) {
            return {
                name: [...names][0],
                email: block.find('a[href^="mailto:"]').attr('href'),
                linkedin_url: block.find('a[href*="linkedin.com/in/"]').attr('href'),
            };
        }
        block = block.parent();
    }
    return null;
};

// People shown as "Jane Smith, CEO", "CEO: Jane Smith", or a card with a name next to a title
const findPeople = ($) => {
    const people = [];

    // Menus, buttons and customer quotes mention other companies' leaders or calls to action, not this company's people
    $('nav, button, select, blockquote, [class*="testimonial"], [class*="review"], [class*="quote"]').remove();

    $('body *').each((_, el) => {
        const parts = ownTexts($, el);
        const text = parts.join(' ');
        if (!text || text.length > 100) return;

        const pair = text.match(/^(.+?)\s*[,|–—-]\s+(.+)$/);
        const colon = text.indexOf(':');

        if (parts.length === 2 && looksLikeName(parts[0]) && isDecisionMakerTitle(parts[1])) {
            people.push({ name: parts[0], title: parts[1] });
        } else if (pair && looksLikeName(pair[1]) && isDecisionMakerTitle(pair[2])) {
            people.push({ name: pair[1], title: pair[2] });
        } else if (pair && isDecisionMakerTitle(pair[1]) && looksLikeName(pair[2])) {
            people.push({ name: pair[2], title: pair[1] });
        } else if (colon > 0 && isDecisionMakerTitle(text.slice(0, colon).trim())) {
            // "Geschäftsführer: Max Mustermann, Erika Musterfrau" on legal pages
            const title = text.slice(0, colon).trim();
            for (const name of text.slice(colon + 1).split(/,|;|&|\band\b|\bund\b/)) {
                if (looksLikeName(name.trim())) people.push({ name: name.trim(), title });
            }
        } else if (isDecisionMakerTitle(text) && !$(el).closest('a, button').length) {
            const card = findCard($, el);
            if (card) people.push({ ...card, title: text });
        }
    });

    return people;
};

// Every object in a JSON-LD block, including nested ones like an organization's founder
const flattenJsonLd = (value, found = []) => {
    if (Array.isArray(value)) {
        value.forEach((item) => flattenJsonLd(item, found));
    } else if (value && typeof value === 'object') {
        found.push(value);
        Object.values(value).forEach((item) => flattenJsonLd(item, found));
    }
    return found;
};

// schema.org data that many sites add for search engines: company email and phone, people with a job title, founders
const readStructuredData = ($) => {
    const found = { people: [], emails: [], phones: [] };

    $('script[type="application/ld+json"]').each((_, el) => {
        let data;
        try {
            data = JSON.parse($(el).text());
        } catch {
            return;
        }

        for (const item of flattenJsonLd(data)) {
            if ([].concat(item['@type']).includes('Person')) {
                const title = [].concat(item.jobTitle)[0];
                const linkedin = [].concat(item.sameAs).find((link) => typeof link === 'string' && link.includes('linkedin.com/in/'));
                if (typeof item.name === 'string' && typeof title === 'string') {
                    found.people.push({ name: item.name, title, email: item.email, linkedin_url: linkedin });
                }
            } else {
                found.emails.push(...[].concat(item.email).filter((email) => typeof email === 'string'));
                found.phones.push(...[].concat(item.telephone).filter((phone) => typeof phone === 'string'));
            }

            for (const founder of [].concat(item.founder)) {
                const name = typeof founder === 'string' ? founder : founder?.name;
                if (typeof name === 'string') found.people.push({ name, title: 'Founder' });
            }
        }
    });

    return found;
};

// Emails from mailto links and the page text, including "name [at] company [dot] com"
const findEmails = ($) => {
    const links = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href')).get();
    const text = pageText($).replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@').replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
    return [...links, ...(text.match(EMAIL_PATTERN) ?? [])];
};

// Same-site links that look like team, contact, about or legal pages, best first
const pickPages = ($, homeUrl) => {
    const ranks = new Map();

    $('a[href]').each((_, el) => {
        let url;
        try {
            url = new URL($(el).attr('href'), homeUrl);
        } catch {
            return;
        }
        url.hash = '';
        if (normalizeDomain(url.href) !== normalizeDomain(homeUrl.href) || url.href === homeUrl.href) return;
        if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?)$/i.test(url.pathname)) return;

        const words = `${url.pathname} ${$(el).text()}`.toLowerCase();
        const rank = PAGE_KEYWORDS.findIndex((keyword) => words.includes(keyword));
        if (rank !== -1 && rank < (ranks.get(url.href) ?? Infinity)) ranks.set(url.href, rank);
    });

    return [...ranks].sort((a, b) => a[1] - b[1]).slice(0, MAX_EXTRA_PAGES).map(([href]) => new URL(href));
};

// Everything one page shows; structured data is read before scripts are removed
const readPage = ($, url) => {
    const { people, emails, phones } = readStructuredData($);
    $('script, style, noscript, template, svg').remove();
    emails.push(...findEmails($));
    phones.push($('a[href^="tel:"]').first().attr('href'));
    people.push(...findPeople($));
    return { url: url.href, people, emails, phones };
};

// "mailto:Info%40Acme.com?subject=Hi" -> "info@acme.com"; null for anything that isn't a plain address
const cleanEmail = (raw) => {
    if (typeof raw !== 'string') return null;
    const email = safeDecode(raw).replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    return VALID_EMAIL.test(email) && !/^(no-?reply|do-?not-?reply)@/.test(email) ? email : null;
};

// Keep only phone characters and require at least 7 digits
const cleanPhone = (raw) => {
    if (typeof raw !== 'string') return null;
    const phone = safeDecode(raw).replace(/^tel:/i, '').replace(/[^\d+()\-. ]/g, '').trim();
    return phone.replace(/\D/g, '').length >= 7 ? phone : null;
};

// An absolute LinkedIn profile address, or null
const cleanLinkedIn = (href, pageUrl) => {
    if (typeof href !== 'string') return null;
    try {
        const url = new URL(href, pageUrl);
        return /(^|\.)linkedin\.com$/.test(url.hostname) && url.pathname.startsWith('/in/') ? url.href : null;
    } catch {
        return null;
    }
};

// "jane.smith@acme.com" belongs to Jane Smith when it holds her first and last name
const findOwner = (contacts, email) => {
    const local = email.split('@')[0].replace(/[^a-z]/g, '');
    const owners = contacts.filter((contact) => {
        const parts = normalizePersonName(contact.name).split(' ').filter((part) => part.length > 2);
        return parts.length >= 2 && local.includes(parts[0]) && local.includes(parts.at(-1));
    });
    return owners.length === 1 ? owners[0] : null;
};

// Add what the pages show; only emails on the company's own domain count, so agency or plugin addresses are skipped
const addFindings = (lead, pages, domains) => {
    const isCompanyEmail = (email) => domains.some((domain) => domain && (email.endsWith(`@${domain}`) || email.endsWith(`.${domain}`)));

    for (const page of pages) {
        for (const person of page.people) {
            const name = person.name.replace(/\s+/g, ' ').trim();
            const title = person.title.replace(/\s+/g, ' ').trim();
            if (!looksLikeName(name) || !isDecisionMakerTitle(title)) continue;

            const email = cleanEmail(person.email);
            addContact(lead, {
                name,
                title,
                role: getRole(title),
                email: email && isCompanyEmail(email) && !SHARED_MAILBOXES.has(email.split('@')[0]) ? email : null,
                linkedin_url: cleanLinkedIn(person.linkedin_url, page.url),
                source_name: SOURCE_NAME,
                source_url: page.url,
            });
        }
    }

    for (const page of pages) {
        for (const raw of page.emails) {
            const email = cleanEmail(raw);
            if (!email || !isCompanyEmail(email)) continue;

            const owner = findOwner(lead.contacts, email);
            if (owner && !owner.email) owner.email = email;
            else addCompanyEmail(lead, { email, source_name: SOURCE_NAME, source_url: page.url });
        }
        lead.phone ??= page.phones.map(cleanPhone).find(Boolean) ?? null;
    }
};

// Read the homepage and up to three team, contact or about pages, one request at a time
const enrichLead = async (lead) => {
    const start = new URL(lead.website);
    const rules = await getRobotsRules(start.origin);
    if (!rules || !isAllowed(start, rules)) return;

    const deadline = Date.now() + SITE_TIME_BUDGET_MS;
    const home = await fetchPage(start);
    if (!isHtml(home)) return;

    // Pick links before reading, because reading removes the menus
    const $home = load(home.text);
    const links = pickPages($home, home.url).filter((link) => isAllowed(link, rules));
    const pages = [readPage($home, home.url)];

    for (const link of links) {
        if (Date.now() > deadline) break;
        const page = await fetchPage(link).catch(() => null);
        if (isHtml(page)) pages.push(readPage(load(page.text), page.url));
    }

    addFindings(lead, pages, [lead.domain, normalizeDomain(home.url.href)]);
};

export default {
    name: 'website',
    label: SOURCE_NAME,

    async enrich(leads) {
        await runWithConcurrency(leads.filter((lead) => lead.website), ENRICH_CONCURRENCY, async (lead) => {
            try {
                await enrichLead(lead);
            } catch {
                // Unreachable, slow or blocked sites are skipped
            }
        });
    },
};
