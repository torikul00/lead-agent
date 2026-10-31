import { isValidObjectId } from 'mongoose';
import Lead from '../models/lead.model.js';
import LeadList from '../models/leadList.model.js';
import Category from '../models/category.model.js';
import Conversation from '../models/conversation.model.js';
import EmailMessage from '../models/emailMessage.model.js';
import { SOURCES } from '../sources/index.js';
import { ENRICHERS } from '../enrichers/index.js';
import hunter from '../enrichers/hunter.enricher.js';
import { searchCities } from '../sources/geoapify.source.js';
import { LEADS_PAGE_SIZE, MAX_COMPANY_EMAILS, SHORTLIST_SIZE } from '../../utils/constants.js';
import { checkMx, countEmails, dedupeLeads, escapeRegex, getLeadKey, normalizeDomain, rankLeads } from '../../utils/helper.js';

// POST /api/leads/generate_leads â€” find companies from the selected sources and return the top matches with their decision makers.
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
            const mx = await checkMx(lead.domain);
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

// POST /api/leads/find_cities â€” city suggestions for the search form while the user types
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

// POST /api/leads/find_emails â€” look up one company's decision makers on Hunter; it spends Hunter credits, so it only runs when asked
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

// Take a list off its leads; a lead left in no list is removed
const removeListFromLeads = async (listId, userId) => {
    await Lead.updateMany({ lead_list_ids: listId }, { $pull: { lead_list_ids: listId } });
    await Lead.deleteMany({ user_id: userId, lead_list_ids: { $size: 0 } });
};

// POST /api/leads/save_list â€” save the chosen leads as a named list, along with the search that found them
export const saveLeadList = async (req, res) => {
    try {
        const { name, search_query, searched_at, leads } = req.body;
        const list = await LeadList.create({ user_id: req.user._id, name, search_query, searched_at, lead_count: leads.length });

        // A company the user already saved stays one lead and joins this list; if saving fails the list is removed again, so no empty list is left behind
        try {
            const savedLeads = await Lead.find({ user_id: req.user._id }).select('domain name country').lean();
            const savedIds = new Map(savedLeads.map((lead) => [getLeadKey(lead), lead._id]));
            const existingIds = leads.map((lead) => savedIds.get(getLeadKey(lead))).filter(Boolean);
            const newLeads = leads.filter((lead) => !savedIds.has(getLeadKey(lead)));

            await Lead.updateMany({ _id: { $in: existingIds } }, { $addToSet: { lead_list_ids: list._id } });
            await Lead.insertMany(newLeads.map((lead) => ({ ...lead, user_id: req.user._id, lead_list_ids: [list._id], category_id: null })));
        } catch (err) {
            await removeListFromLeads(list._id, req.user._id);
            await LeadList.deleteOne({ _id: list._id });
            throw err;
        }

        return res.status(201).json({ list: formatLeadList(list) });
    } catch (err) {
        console.error('Saving lead list failed:', err);
        return res.status(500).json({ error: 'Could not save the list right now. Please try again.' });
    }
};

// POST /api/leads/create_list — make a new list from leads the user already saved; they stay in their other lists too
export const createLeadList = async (req, res) => {
    try {
        const { name, lead_ids: leadIds } = req.body;

        const leads = await Lead.find({ _id: { $in: leadIds }, user_id: req.user._id }).select('_id').lean();
        if (!leads.length) return res.status(404).json({ error: 'Leads not found.' });

        const list = await LeadList.create({ user_id: req.user._id, name, lead_count: leads.length });

        // Remove the list again if its leads can't be added, so no empty list is left behind
        try {
            await Lead.updateMany({ _id: { $in: leads.map((lead) => lead._id) } }, { $addToSet: { lead_list_ids: list._id } });
        } catch (err) {
            await LeadList.deleteOne({ _id: list._id });
            throw err;
        }

        return res.status(201).json({ list: formatLeadList(list) });
    } catch (err) {
        console.error('Creating lead list failed:', err);
        return res.status(500).json({ error: 'Could not create the list right now. Please try again.' });
    }
};

// GET /api/leads/lists â€” the user's saved lists, newest first
export const getLeadLists = async (req, res) => {
    try {
        const lists = await LeadList.find({ user_id: req.user._id }).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ lists: lists.map(formatLeadList) });
    } catch (err) {
        console.error('Loading lead lists failed:', err);
        return res.status(500).json({ error: 'Could not load your lists right now. Please try again.' });
    }
};

// DELETE /api/leads/lists/:id â€” remove a list, and its leads unless they're also in another list
export const deleteLeadList = async (req, res) => {
    try {
        const list = isValidObjectId(req.params.id) && await LeadList.findOneAndDelete({ _id: req.params.id, user_id: req.user._id }).lean();
        if (!list) return res.status(404).json({ error: 'List not found.' });

        await removeListFromLeads(list._id, req.user._id);
        return res.status(200).json({ message: 'List deleted.' });
    } catch (err) {
        console.error('Deleting lead list failed:', err);
        return res.status(500).json({ error: 'Could not delete the list right now. Please try again.' });
    }
};

// GET /api/leads/lists/:id â€” one of the user's lists with its leads, best score first
export const getLeadList = async (req, res) => {
    try {
        const list = isValidObjectId(req.params.id) && await LeadList.findOne({ _id: req.params.id, user_id: req.user._id }).lean();
        if (!list) {
            return res.status(404).json({ error: 'List not found.' });
        }

        const leads = await Lead.find({ lead_list_ids: list._id }).sort({ score: -1, _id: 1 }).populate('category_id', 'name color').select('-user_id -lead_list_ids -__v').lean();
        const formattedLeads = leads.map((lead) => ({ ...lead, id: lead._id }));
        return res.status(200).json({ list: formatLeadList(list), leads: formattedLeads });
    } catch (err) {
        console.error('Loading lead list failed:', err);
        return res.status(500).json({ error: 'Could not load this list right now. Please try again.' });
    }
};

// The Leads page's search box and category filter as a lead query
const buildLeadsQuery = async (userId, { search, category_id: categoryId }) => {
    const query = { user_id: userId };

    if (search) {
        const pattern = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
        query.$or = [{ name: pattern }, { domain: pattern }];
    }

    if (categoryId === 'uncategorized') {
        // Deleting a category leaves its id on the leads, so those count as uncategorized too
        query.category_id = { $nin: await Category.distinct('_id', { user_id: userId }) };
    } else if (categoryId && isValidObjectId(categoryId)) {
        query.category_id = categoryId;
    }

    return query;
};

// GET /api/leads — one page of the user's leads from all lists, best score first
export const getLeads = async (req, res) => {
    try {
        const query = await buildLeadsQuery(req.user._id, req.query);
        const total = await Lead.countDocuments(query);
        const totalPages = Math.ceil(total / LEADS_PAGE_SIZE);

        // A page past the end, e.g. after its last lead left the filter, shows the last page instead
        const requestedPage = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const page = Math.min(requestedPage, totalPages || 1);

        const leads = await Lead.find(query).sort({ score: -1, _id: 1 }).skip((page - 1) * LEADS_PAGE_SIZE).limit(LEADS_PAGE_SIZE).populate('category_id', 'name color').select('-user_id -lead_list_ids -__v').lean();
        const formattedLeads = leads.map((lead) => ({ ...lead, id: lead._id }));
        return res.status(200).json({ leads: formattedLeads, total, page, total_pages: totalPages });
    } catch (err) {
        console.error('Loading leads failed:', err);
        return res.status(500).json({ error: 'Could not load your leads right now. Please try again.' });
    }
};

// GET /api/leads/export — every lead matching the search and category filter, not only the page on screen
export const exportLeads = async (req, res) => {
    try {
        const query = await buildLeadsQuery(req.user._id, req.query);
        const leads = await Lead.find(query).sort({ score: -1, _id: 1 }).select('-user_id -lead_list_ids -__v').lean();
        return res.status(200).json({ leads });
    } catch (err) {
        console.error('Exporting leads failed:', err);
        return res.status(500).json({ error: 'Could not export your leads right now. Please try again.' });
    }
};

// DELETE /api/leads/:id — remove a lead with its conversations and their emails from LeadAgent; the mailbox itself isn't touched
export const deleteLead = async (req, res) => {
    try {
        const lead = isValidObjectId(req.params.id) && await Lead.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!lead) return res.status(404).json({ error: 'Lead not found.' });

        // The lead goes last, so a failed delete can be tried again without leaving conversations behind
        const conversationIds = await Conversation.distinct('_id', { user_id: req.user._id, lead_id: lead._id });
        await EmailMessage.deleteMany({ conversation_id: { $in: conversationIds } });
        await Conversation.deleteMany({ _id: { $in: conversationIds } });
        await Lead.deleteOne({ _id: lead._id });
        await LeadList.updateMany({ _id: { $in: lead.lead_list_ids } }, { $inc: { lead_count: -1 } });

        return res.status(200).json({ message: 'Lead deleted.' });
    } catch (err) {
        console.error('Deleting lead failed:', err);
        return res.status(500).json({ error: 'Could not delete the lead right now. Please try again.' });
    }
};

// PATCH /api/leads/:id/category â€” assign or clear a lead's category
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

// POST /api/leads/:id/company_emails — add a company email by hand; its source is "Manual"
export const addManualCompanyEmail = async (req, res) => {
    try {
        const lead = isValidObjectId(req.params.id) && await Lead.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!lead) return res.status(404).json({ error: 'Lead not found.' });

        const { email } = req.body;
        const isSaved = lead.company_emails.some((item) => item.email.toLowerCase() === email) || lead.contacts.some((contact) => contact.email?.toLowerCase() === email);
        if (isSaved) {
            return res.status(409).json({ error: 'This email is already saved for this lead.' });
        }
        if (lead.company_emails.length >= MAX_COMPANY_EMAILS) {
            return res.status(400).json({ error: `A lead can have up to ${MAX_COMPANY_EMAILS} company emails.` });
        }

        lead.company_emails.push({ email, source_name: 'Manual', source_url: null });
        await lead.save();
        return res.status(201).json({ company_emails: lead.company_emails });
    } catch (err) {
        console.error('Adding company email failed:', err);
        return res.status(500).json({ error: 'Could not add the email right now. Please try again.' });
    }
};
