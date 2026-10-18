import { SOURCES } from '../sources/index.js';
import { ENRICHERS } from '../enrichers/index.js';
import { SHORTLIST_SIZE } from '../../utils/constants.js';
import { checkMx, dedupeLeads, normalizeDomain, rankLeads } from '../../utils/helper.js';

// POST /api/leads/generate_leads — find companies from the selected sources and return the top matches with their decision makers.
export const generateLeads = async (req, res) => {
    try {
        const { sources, limit } = req.body;
        console.log(sources)

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

        const leads = dedupeLeads(candidates.map((lead) => ({
            ...lead,
            domain: normalizeDomain(lead.website),
            mx_status: 'not_checked',
            phone: null,
            company_emails: [],
            contacts: [],
        })));

        // Check MX only for the best candidates to keep the search fast
        const shortlist = rankLeads(leads, req.body).slice(0, Math.max(limit, SHORTLIST_SIZE));
        await Promise.all(shortlist.map(async (lead) => {
            lead.mx_status = await checkMx(lead.domain);
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
