import { Resolver } from 'dns/promises';

const resolver = new Resolver({ timeout: 3000, tries: 1 });

// "https://www.Example.com/en" -> "example.com"
export const normalizeDomain = (website) => {
    try {
        return new URL(website).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

const normalizeName = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// One lead per company: by domain, or by name + country when there's no domain
export const dedupeLeads = (leads) => {
    const unique = new Map();
    for (const lead of leads) {
        const key = lead.domain ?? `${normalizeName(lead.name)}|${lead.country}`;
        if (!unique.has(key)) unique.set(key, lead);
    }
    return [...unique.values()];
};

// MX records only show the domain can receive mail, not that any address exists
export const checkMx = async (domain) => {
    if (!domain) return 'not_checked';
    try {
        const records = await resolver.resolveMx(domain);
        return records.length ? 'found' : 'not_found';
    } catch (err) {
        return ['ENOTFOUND', 'ENODATA'].includes(err.code) ? 'not_found' : 'error';
    }
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
const scoreLead = (lead, { company_size, keywords }) => {
    let score = 30;
    const reasons = [`Matches ${lead.country} and the selected industry`];

    if (!company_size) {
        score += 30;
    } else if (lead.employee_count === null) {
        score += 10;
        reasons.push('Employee count unknown');
    } else {
        // "51-200" -> [51, 200], "10001+" -> [10001, 0] (no upper limit)
        const [min, max] = company_size.split(/[-+]/).map(Number);
        if (lead.employee_count >= min && (!max || lead.employee_count <= max)) {
            score += 30;
            reasons.push(`${lead.employee_count} employees fits ${company_size}`);
        } else {
            reasons.push(`${lead.employee_count} employees is outside ${company_size}`);
        }
    }

    if (!keywords.length) {
        score += 30;
    } else {
        const words = toWords(`${lead.name} ${lead.industry ?? ''} ${lead.description ?? ''}`);
        const matched = keywords.filter((keyword) => matchesKeyword(words, keyword));
        score += Math.round((matched.length / keywords.length) * 30);
        reasons.push(matched.length ? `Matches keywords: ${matched.join(', ')}` : 'No keywords matched');
    }

    if (lead.mx_status === 'found') {
        score += 10;
        reasons.push('Mail server (MX) found');
    }

    return { score, fit_label: getFitLabel(score), score_reasons: reasons };
};

// Score every lead and sort best first
export const rankLeads = (leads, criteria) =>
    leads
        .map((lead) => ({ ...lead, ...scoreLead(lead, criteria) }))
        .sort((a, b) => b.score - a.score);
