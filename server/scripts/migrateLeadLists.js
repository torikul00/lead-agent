import '../loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Lead from '../src/models/lead.model.js';
import LeadList from '../src/models/leadList.model.js';
import Conversation from '../src/models/conversation.model.js';
import { addCompanyEmail, addContact, getLeadKey } from '../utils/helper.js';

// One-time move from lead_list_id to lead_list_ids, safe to run again. From server/: npx cross-env NODE_ENV=development node scripts/migrateLeadLists.js

// Each lead keeps the list it was saved into; this uses the raw collection because lead_list_id is no longer in the schema
const moveToListIds = () => Lead.collection.updateMany(
    { lead_list_id: { $exists: true } },
    [
        { $set: { lead_list_ids: { $setUnion: [{ $ifNull: ['$lead_list_ids', []] }, ['$lead_list_id']] } } },
        { $unset: 'lead_list_id' },
    ],
);

// A company saved twice becomes one lead: the best scored one stays and takes over what the others had
const mergeDuplicates = async () => {
    const leads = await Lead.find().sort({ score: -1, _id: 1 });

    const companies = new Map();
    for (const lead of leads) {
        const key = `${lead.user_id}|${getLeadKey(lead)}`;
        companies.set(key, [...(companies.get(key) ?? []), lead.toObject()]);
    }

    let merged = 0;
    for (const [lead, ...duplicates] of companies.values()) {
        if (!duplicates.length) continue;

        for (const duplicate of duplicates) {
            lead.category_id ??= duplicate.category_id;
            lead.is_mail_sent ||= duplicate.is_mail_sent;
            lead.lead_list_ids.push(...duplicate.lead_list_ids);
            duplicate.contacts.forEach((contact) => addContact(lead, contact));
            duplicate.company_emails.forEach((item) => addCompanyEmail(lead, item));
        }

        const { category_id, is_mail_sent, contacts, company_emails } = lead;
        const listIds = [...new Set(lead.lead_list_ids.map(String))];
        const duplicateIds = duplicates.map((duplicate) => duplicate._id);

        // The duplicates go last, so a run that stops halfway can be repeated without losing anything
        await Lead.updateOne({ _id: lead._id }, { category_id, is_mail_sent, contacts, company_emails, lead_list_ids: listIds });
        await Conversation.updateMany({ lead_id: { $in: duplicateIds } }, { lead_id: lead._id });
        await Lead.deleteMany({ _id: { $in: duplicateIds } });
        merged += duplicates.length;
    }

    return merged;
};

// A list shrinks when two of its leads were the same company
const recountLists = async () => {
    const lists = await LeadList.find().select('_id').lean();
    for (const list of lists) {
        const count = await Lead.countDocuments({ lead_list_ids: list._id });
        await LeadList.updateOne({ _id: list._id }, { lead_count: count });
    }
};

await connectDB();

try {
    const { modifiedCount } = await moveToListIds();
    const merged = await mergeDuplicates();
    await recountLists();

    // The old field's index is useless now; on a second run it's already gone
    await Lead.collection.dropIndex('lead_list_id_1_score_-1').catch(() => {});

    console.log(`Done: ${modifiedCount} leads moved, ${merged} duplicates merged.`);
} finally {
    await mongoose.disconnect();
}
