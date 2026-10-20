import { Resolver } from 'dns/promises';
import { MAX_COMPANY_EMAILS, MAX_CONTACTS } from './constants.js';

const resolver = new Resolver({ timeout: 3000, tries: 1 });

// "https://www.Example.com/en" -> "example.com"
export const normalizeDomain = (website) => {
    try {
        return new URL(website).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

// Social profiles aren't company websites
const SOCIAL_SITES = ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com'];

// Map data can hold several values in one field: "+46 8 123; +46 8 456" -> "+46 8 123"
export const firstValue = (value) => (typeof value === 'string' ? value.split(';')[0].trim() || null : null);

// "www.acme.se" -> "https://www.acme.se/"; null for social profiles or anything that isn't a web address
export const toWebsite = (value) => {
    const website = firstValue(value);
    if (!website) return null;
    try {
        const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
        const isSocial = SOCIAL_SITES.some((site) => url.hostname === site || url.hostname.endsWith(`.${site}`));
        return isSocial ? null : url.href;
    } catch {
        return null;
    }
};

export const isValidEmail = (email) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email);

const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// "José García" -> "jose garcia", so the same person from two sources matches
export const normalizePersonName = (name) => normalizeName(name.normalize('NFD').replace(/\p{M}/gu, ''));

// One lead per company: by domain, or by name + country when there's no domain
export const dedupeLeads = (leads) => {
    const unique = new Map();
    for (const lead of leads) {
        const key = lead.domain ?? `${normalizeName(lead.name)}|${lead.country}`;
        if (!unique.has(key)) unique.set(key, lead);
    }
    return [...unique.values()];
};

// Mail hosts of known providers, matched against a domain's MX hosts
const EMAIL_PROVIDERS = [
    ['Google Workspace', /(^|\.)(google|googlemail)\.com$/],
    ['Microsoft 365', /\.mail\.protection\.outlook\.com$|\.mx\.microsoft$/],
    ['Zoho', /(^|\.)zoho(mail)?\.[a-z.]+$/],
    ['Proton Mail', /(^|\.)protonmail\.ch$/],
    ['Fastmail', /(^|\.)messagingengine\.com$/],
    ['Yandex 360', /(^|\.)yandex\.(net|ru)$/],
    ['iCloud', /(^|\.)mail\.icloud\.com$/],
    ['Amazon WorkMail', /^inbound-smtp\.[a-z0-9-]+\.amazonaws\.com$/],
    ['GoDaddy', /(^|\.)secureserver\.net$/],
    ['IONOS', /(^|\.)(ionos\.[a-z.]+|1and1\.[a-z.]+|kundenserver\.de)$/],
    ['OVH', /(^|\.)ovh\.net$/],
    ['Titan', /(^|\.)titan\.email$/],
    ['Hostinger', /(^|\.)hostinger\.com$/],
    ['Namecheap', /(^|\.)privateemail\.com$/],
    ['Rackspace', /(^|\.)emailsrvr\.com$/],
];

// ["aspmx.l.google.com", ...] -> "Google Workspace"; a mail host on the company's own domain is "Self-hosted"
const detectEmailProvider = (hosts, domain) => {
    const provider = EMAIL_PROVIDERS.find(([, pattern]) => hosts.some((host) => pattern.test(host)));
    if (provider) return provider[0];
    return hosts.some((host) => host === domain || host.endsWith(`.${domain}`)) ? 'Self-hosted' : 'Other';
};

// MX records only show the domain can receive mail, not that any address exists
export const checkMx = async (domain) => {
    try {
        // A "null MX" (a single "." record) means the domain takes no mail, so it's dropped
        const records = (await resolver.resolveMx(domain))
            .map((record) => ({ exchange: record.exchange.toLowerCase().replace(/\.$/, ''), priority: record.priority }))
            .filter((record) => record.exchange)
            .sort((a, b) => a.priority - b.priority);

        if (!records.length) return { mx_status: 'not_found', mx_records: [], email_provider: null };
        return { mx_status: 'found', mx_records: records, email_provider: detectEmailProvider(records.map((record) => record.exchange), domain) };
    } catch (err) {
        // ENOTFOUND: the domain doesn't exist, ENODATA: it has no MX records; anything else (timeout...) is a failed lookup
        const mxStatus = ['ENOTFOUND', 'ENODATA'].includes(err.code) ? 'not_found' : 'error';
        return { mx_status: mxStatus, mx_records: [], email_provider: null };
    }
};

// Run fn for every item, at most `limit` at a time
export const runWithConcurrency = async (items, limit, fn) => {
    let next = 0;
    const worker = async () => {
        while (next < items.length) await fn(items[next++]);
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

// Decision-maker roles, highest priority first, matched against job titles
const ROLES = [
    ['CEO', /\b(ceo|chief executive)\b/i],
    ['Founder', /founder|\bfounding partner\b/i],
    ['Owner', /(?<!product )\bowner\b/i],
    ['President', /(?<!vice[ -])\bpresident\b/i],
    ['Managing Director', /\bmanaging director\b|gesch(ä|ae)ftsf(ü|ue)hrer/i],
    ['CTO', /\b(cto|chief technology|chief technical)\b/i],
    ['CFO', /\b(cfo|chief financial)\b/i],
    ['COO', /\b(coo|chief operating)\b/i],
    ['CMO', /\b(cmo|chief marketing)\b/i],
    ['Partner', /\bpartner$/i],
    ['Chair', /(?<!vice[ -])\bchair(man|woman|person)?\b/i],
];
const ROLE_ORDER = ROLES.map(([role]) => role);

// Titles that mention a role without holding it, e.g. "Assistant to the CEO" or "Former CFO"
const NOT_HOLDING_ROLE = /\b(assistant|intern|former|ex|retired|emeritus|advisor|adviser)\b/i;

// "Co-Founder & Chief Executive Officer" -> "CEO"; null when the title isn't a decision maker
export const getRole = (title) => {
    if (NOT_HOLDING_ROLE.test(title)) return null;
    return ROLES.find(([, pattern]) => pattern.test(title))?.[0] ?? null;
};

// Same person when first and last names match, so "Jane Q. Smith" and "Jane Smith" merge
const isSamePerson = (a, b) => {
    const first = normalizePersonName(a).split(' ');
    const second = normalizePersonName(b).split(' ');
    return first[0] === second[0] && first.at(-1) === second.at(-1);
};

// Known roles in priority order; any other role (e.g. "Decision maker" from Hunter) goes last
const roleRank = (role) => (ROLE_ORDER.includes(role) ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length);

// Add a person once per lead, most senior first; a second source only fills in what's missing
export const addContact = (lead, contact) => {
    const existing = lead.contacts.find((item) => isSamePerson(item.name, contact.name));
    if (existing) {
        existing.email ??= contact.email;
        existing.phone ??= contact.phone;
        existing.linkedin_url ??= contact.linkedin_url;
        return;
    }

    if (lead.contacts.length >= MAX_CONTACTS) return;
    lead.contacts.push(contact);
    lead.contacts.sort((a, b) => roleRank(a.role) - roleRank(b.role));
};

// Emails a lead has, on the company and on its people
export const countEmails = (lead) => lead.company_emails.length + lead.contacts.filter((contact) => contact.email).length;

// Add a company email once, unless it already belongs to one of the lead's people
export const addCompanyEmail = (lead, entry) => {
    if (lead.company_emails.length >= MAX_COMPANY_EMAILS) return;
    if (lead.company_emails.some((item) => item.email === entry.email)) return;
    if (lead.contacts.some((contact) => contact.email === entry.email)) return;
    lead.company_emails.push(entry);
};

const toWords = (text) => new Set(text.toLowerCase().match(/[a-z0-9]+/g));

// A keyword matches when at least half of its words appear, e.g. "Software Development" matches "software industry"
const matchesKeyword = (words, keyword) => {
    const keywordWords = keyword.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    const found = keywordWords.filter((word) => words.has(word)).length;
    return keywordWords.length > 0 && found >= Math.ceil(keywordWords.length / 2);
};

const getFitLabel = (score) => {
    if (score >= 70) return 'good_fit';
    if (score >= 40) return 'needs_review';
    return 'poor_fit';
};

// Rule-based score (0-100) with a readable reason for each rule
const scoreLead = (lead, { company_size, keywords, city }) => {
    let score = 20;
    const reasons = [`Matches ${city ? `${city.name}, ` : ''}${lead.country} and the selected industry`];

    if (!company_size) {
        score += 25;
    } else if (lead.employee_count === null) {
        score += 10;
        reasons.push('Employee count unknown');
    } else {
        // "51-200" -> [51, 200], "10001+" -> [10001, 0] (no upper limit)
        const [min, max] = company_size.split(/[-+]/).map(Number);
        if (lead.employee_count >= min && (!max || lead.employee_count <= max)) {
            score += 25;
            reasons.push(`${lead.employee_count} employees fits ${company_size}`);
        } else {
            reasons.push(`${lead.employee_count} employees is outside ${company_size}`);
        }
    }

    if (!keywords.length) {
        score += 25;
    } else {
        const words = toWords(`${lead.name} ${lead.industry ?? ''} ${lead.description ?? ''}`);
        const matched = keywords.filter((keyword) => matchesKeyword(words, keyword));
        score += Math.round((matched.length / keywords.length) * 25);
        reasons.push(matched.length ? `Matches keywords: ${matched.join(', ')}` : 'No keywords matched');
    }

    if (lead.mx_status === 'found') {
        score += 10;
        reasons.push('Mail server (MX) found');
    }

    if (lead.contacts.length) {
        const [first] = lead.contacts;
        const others = lead.contacts.length - 1;
        score += 10;
        reasons.push(`Decision maker found: ${first.name} (${first.role})${others ? ` and ${others} more` : ''}`);
    }

    if (lead.company_emails.length || lead.contacts.some((contact) => contact.email)) {
        score += 10;
        reasons.push('Email address found');
    }

    return { score, fit_label: getFitLabel(score), score_reasons: reasons };
};

// Score every lead and sort best first
export const rankLeads = (leads, criteria) =>
    leads
        .map((lead) => ({ ...lead, ...scoreLead(lead, criteria) }))
        .sort((a, b) => b.score - a.score);
