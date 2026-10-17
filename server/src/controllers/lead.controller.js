import { SOURCES } from '../sources/index.js';
import { MAX_RESULTS, SHORTLIST_SIZE } from '../../utils/constants.js';
import { checkMx, dedupeLeads, normalizeDomain, rankLeads } from '../../utils/helper.js';

// POST /api/leads/generate_leads — find companies from the selected sources and return the top matches.
export const generateLeads = async (req, res) => {
    try {
        const { sources } = req.body;

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

        const leads = dedupeLeads(candidates.map((lead) => ({ ...lead, domain: normalizeDomain(lead.website), mx_status: 'not_checked' })));

        // Check MX only for the best candidates to keep the search fast
        const shortlist = rankLeads(leads, req.body).slice(0, SHORTLIST_SIZE);
        await Promise.all(shortlist.map(async (lead) => {
            lead.mx_status = await checkMx(lead.domain);
        }));

        return res.status(200).json({
            leads: rankLeads(shortlist, req.body).slice(0, MAX_RESULTS),
            failed_sources: failedSources,
        });
    } catch (err) {
        console.error('Lead generation failed:', err);
        return res.status(500).json({ error: 'Could not generate leads right now. Please try again.' });
    }
};
