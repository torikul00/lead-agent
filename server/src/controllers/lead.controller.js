import DomainMxRecord from '../models/domainMxRecord.model.js';
import { SOURCES } from '../sources/index.js';
import { ENRICHERS } from '../enrichers/index.js';
import hunter from '../enrichers/hunter.enricher.js';
import { searchCities } from '../sources/geoapify.source.js';
import { SHORTLIST_SIZE } from '../../utils/constants.js';
import { countEmails, dedupeLeads, normalizeDomain, rankLeads } from '../../utils/helper.js';

// POST /api/leads/generate_leads — find companies from the selected sources and return the top matches with their decision makers.
export const generateLeads = async (req, res) => {
    try {
        const { sources, limit } = req.body;

        // Run sources in parallel; a failed source is skipped instead of failing the whole search
        const results = await Promise.allSettled(sources.map((name) => SOURCES[name].search(req.body)));

        const candidates = [];
        const failedSources = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                candidates.push(...result.value);
            } else {
                failedSources.push(sources[index]);
                console.error(`Lead source "${sources[index]}" failed:`, result.reason);
            }
        });

        if (failedSources.length === sources.length) {
            return res.status(502).json({ error: 'Could not reach the lead sources right now. Please try again.' });
        }

        // Some sources already know the company's phone or an email (OpenStreetMap), so those are kept
        const leads = dedupeLeads(candidates.map((lead) => ({
            phone: null,
            company_emails: [],
            ...lead,
            domain: normalizeDomain(lead.website),
            mx_status: 'not_checked',
            email_provider: null,
            contacts: [],
        })));

        // Check MX only for the best candidates to keep the search fast; leads without a domain stay "not_checked"
        const shortlist = rankLeads(leads, req.body).slice(0, Math.max(limit, SHORTLIST_SIZE));
        await Promise.all(shortlist.map(async (lead) => {
            if (!lead.domain) return;
            const mx = await DomainMxRecord.getMx(lead.domain);
            lead.mx_status = mx.mx_status;
            lead.email_provider = mx.email_provider;
        }));

        // Find people and emails for the final leads only; a failed enricher is skipped like a failed source
        const topLeads = rankLeads(shortlist, req.body).slice(0, limit);
        for (const enricher of ENRICHERS) {
            try {
                await enricher.enrich(topLeads);
            } catch (err) {
                console.error(`Lead enricher "${enricher.name}" failed:`, err);
            }
        }

        // Score again so the people and emails found count
        return res.status(200).json({
            leads: rankLeads(topLeads, req.body),
            failed_sources: failedSources,
        });
    } catch (err) {
        console.error('Lead generation failed:', err);
        return res.status(500).json({ error: 'Could not generate leads right now. Please try again.' });
    }
};

// POST /api/leads/find_cities — city suggestions for the search form while the user types
export const findCities = async (req, res) => {
    try {
        const cities = await searchCities(req.body.country, req.body.text);
        return res.status(200).json({ cities });
    } catch (err) {
        // The reason (bad key, no credits left...) stays in the server log; users get a general message
        console.error('City search failed:', err);
        return res.status(502).json({ error: 'Could not load cities right now. Please try again.' });
    }
};

// POST /api/leads/find_emails — look up one company's decision makers on Hunter; it spends Hunter credits, so it only runs when asked
export const findEmails = async (req, res) => {
    try {
        const lead = req.body;
        const emailsBefore = countEmails(lead);
        await hunter.enrich([lead]);

        return res.status(200).json({
            contacts: lead.contacts,
            company_emails: lead.company_emails,
            new_emails: countEmails(lead) - emailsBefore,
        });
    } catch (err) {
        // The reason (bad key, no credits left...) stays in the server log; users get a general message
        console.error('Email lookup failed:', err);
        return res.status(502).json({ error: 'Could not find emails right now. Please try again later.' });
    }
};
