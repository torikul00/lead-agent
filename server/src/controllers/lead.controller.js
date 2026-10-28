import { isValidObjectId } from 'mongoose';
import DomainMxRecord from '../models/domainMxRecord.model.js';
import Lead from '../models/lead.model.js';
import LeadList from '../models/leadList.model.js';
import Category from '../models/category.model.js';
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
        let leads = dedupeLeads(candidates.map((lead) => ({
            phone: null,
            company_emails: [],
            ...lead,
            domain: normalizeDomain(lead.website),
            mx_status: 'not_checked',
            email_provider: null,
            contacts: [],
        })));

        const domains = leads.map((lead) => lead.domain).filter(Boolean);
        if (domains.length) {
            const savedDomains = await Lead.distinct('domain', {
                user_id: req.user._id,
                domain: { $in: domains },
            });
            const savedDomainSet = new Set(savedDomains);
            leads = leads.filter((lead) => !savedDomainSet.has(lead.domain));
        }

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

// Only what the client shows for a list
const formatLeadList = (list) => ({
    id: list._id,
    name: list.name,
    lead_count: list.lead_count,
    created_at: list.createdAt,
});

// POST /api/leads/save_list — save the chosen leads as a named list, along with the search that found them
export const saveLeadList = async (req, res) => {
    try {
        const { name, search_query, searched_at, leads } = req.body;
        const list = await LeadList.create({ user_id: req.user._id, name, search_query, searched_at, lead_count: leads.length });

        // Remove the list again if its leads can't be saved, so no empty list is left behind
        try {
            await Lead.insertMany(leads.map((lead) => ({ ...lead, user_id: req.user._id, lead_list_id: list._id, category_id: null })));
        } catch (err) {
            await LeadList.deleteOne({ _id: list._id });
            throw err;
        }

        return res.status(201).json({ list: formatLeadList(list) });
    } catch (err) {
        console.error('Saving lead list failed:', err);
        return res.status(500).json({ error: 'Could not save the list right now. Please try again.' });
    }
};

// GET /api/leads/lists — the user's saved lists, newest first
export const getLeadLists = async (req, res) => {
    try {
        const lists = await LeadList.find({ user_id: req.user._id }).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ lists: lists.map(formatLeadList) });
    } catch (err) {
        console.error('Loading lead lists failed:', err);
        return res.status(500).json({ error: 'Could not load your lists right now. Please try again.' });
    }
};

// GET /api/leads/lists/:id — one of the user's lists with its leads, best score first
export const getLeadList = async (req, res) => {
    try {
        const list = isValidObjectId(req.params.id) && await LeadList.findOne({ _id: req.params.id, user_id: req.user._id }).lean();
        if (!list) {
            return res.status(404).json({ error: 'List not found.' });
        }

        const leads = await Lead.find({ lead_list_id: list._id }).sort({ score: -1, _id: 1 }).populate('category_id', 'name color').select('-user_id -lead_list_id -__v').lean();
        const formattedLeads = leads.map((lead) => ({ ...lead, id: lead._id }));
        return res.status(200).json({ list: formatLeadList(list), leads: formattedLeads });
    } catch (err) {
        console.error('Loading lead list failed:', err);
        return res.status(500).json({ error: 'Could not load this list right now. Please try again.' });
    }
};

// PATCH /api/leads/:id/category — assign or clear a lead's category
export const updateLeadCategory = async (req, res) => {
    try {
        const { category_id: categoryId } = req.body;
        if (categoryId) {
            const category = await Category.exists({ _id: categoryId, user_id: req.user._id });
            if (!category) return res.status(404).json({ error: 'Category not found.' });
        }

        const lead = await Lead.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            { category_id: categoryId },
            { new: true }
        ).populate('category_id', 'name color').lean();

        if (!lead) return res.status(404).json({ error: 'Lead not found.' });
        return res.status(200).json({ lead: { id: lead._id, category_id: lead.category_id } });
    } catch (err) {
        console.error('Updating lead category failed:', err);
        return res.status(500).json({ error: 'Could not update the lead category right now. Please try again.' });
    }
};
