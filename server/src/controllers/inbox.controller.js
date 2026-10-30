import { isValidObjectId } from 'mongoose';
import Mailbox from '../models/mailbox.model.js';
import Lead from '../models/lead.model.js';
import EmailTemplate from '../models/emailTemplate.model.js';
import Conversation from '../models/conversation.model.js';
import EmailMessage from '../models/emailMessage.model.js';
import { sendFromMailbox } from '../mailboxes/index.js';
import { syncUserMailboxes } from '../mailboxes/sync.js';
import { TEMPLATE_VARIANT_KEYS } from '../../utils/constants.js';
import { chooseLeadEmail, escapeHtml, toSnippet } from '../../utils/helper.js';

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

// The template's version for the lead's email provider ("Microsoft 365" -> microsoft_365), with {{placeholders}} filled in; company addresses have no contact name
const fillTemplate = (template, lead) => {
    const key = lead.email_provider?.toLowerCase().replace(/ /g, '_');
    const content = template.variants?.[TEMPLATE_VARIANT_KEYS.includes(key) ? key : 'other'] ?? template;
    const values = { companyName: lead.name, contactName: '', domain: lead.domain ?? '' };

    // Unknown placeholders stay as they are; values going into the HTML body are escaped
    const fill = (text, escape) => text.replace(PLACEHOLDER, (match, name) => {
        if (!Object.hasOwn(values, name)) return match;
        return escape ? escapeHtml(values[name]) : values[name];
    });

    return { subject: fill(content.subject, false), body: fill(content.body, true) };
};

// Lead details the Inbox shows with a conversation
const LEAD_FIELDS = 'name domain phone category_id';

// The lead's current details come from the populated lead; a deleted lead falls back to the saved name
const formatConversation = (conversation) => {
    const lead = conversation.lead_id;
    return {
        id: conversation._id,
        lead_id: lead?._id ?? null,
        lead_name: lead?.name ?? conversation.lead_name,
        domain: lead?.domain ?? null,
        phone: lead?.phone ?? null,
        category_id: lead?.category_id ?? null,
        lead_email: conversation.lead_email,
        subject: conversation.subject,
        snippet: conversation.snippet,
        last_message_at: conversation.last_message_at,
        is_read: conversation.is_read,
    };
};

const formatMessage = (message) => ({
    id: message._id,
    direction: message.direction,
    from: message.from,
    to: message.to,
    subject: message.subject,
    body: message.body,
    sent_at: message.sent_at,
});

// GET /api/emails/conversations — the user's lead conversations, latest first
export const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ user_id: req.user._id })
            .sort({ last_message_at: -1 })
            .populate('lead_id', LEAD_FIELDS)
            .lean();
        return res.status(200).json({ conversations: conversations.map(formatConversation) });
    } catch (err) {
        console.error('Loading conversations failed:', err);
        return res.status(500).json({ error: 'Could not load your inbox right now. Please try again.' });
    }
};

// GET /api/emails/conversations/:id — one conversation with its emails, oldest first; opening it marks it read
export const getConversation = async (req, res) => {
    try {
        const conversation = isValidObjectId(req.params.id) && await Conversation.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            { is_read: true },
            { new: true }
        ).populate('lead_id', LEAD_FIELDS).lean();

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        const messages = await EmailMessage.find({ conversation_id: conversation._id }).sort({ sent_at: 1 }).lean();
        return res.status(200).json({ conversation: formatConversation(conversation), messages: messages.map(formatMessage) });
    } catch (err) {
        console.error('Loading conversation failed:', err);
        return res.status(500).json({ error: 'Could not load this conversation right now. Please try again.' });
    }
};

// DELETE /api/emails/conversations/:id — remove a conversation and its emails from LeadAgent; the mailbox itself isn't touched
export const deleteConversation = async (req, res) => {
    try {
        const conversation = isValidObjectId(req.params.id) && await Conversation.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        await EmailMessage.deleteMany({ conversation_id: conversation._id });
        return res.status(200).json({ message: 'Conversation deleted.' });
    } catch (err) {
        console.error('Deleting conversation failed:', err);
        return res.status(500).json({ error: 'Could not delete the conversation right now. Please try again.' });
    }
};

// POST /api/emails/check_replies — check the user's mailboxes now instead of waiting for the next automatic check
export const checkReplies = async (req, res) => {
    try {
        await syncUserMailboxes(req.user._id);
        return res.status(200).json({ message: 'Mailboxes checked.' });
    } catch (err) {
        console.error('Checking for replies failed:', err);
        return res.status(500).json({ error: 'Could not check for replies right now. Please try again.' });
    }
};

// GET /api/emails/unread_count — conversations with an unread reply, for the sidebar badge
export const getUnreadCount = async (req, res) => {
    try {
        const count = await Conversation.countDocuments({ user_id: req.user._id, is_read: false });
        return res.status(200).json({ count });
    } catch (err) {
        console.error('Counting unread conversations failed:', err);
        return res.status(500).json({ error: 'Could not load your unread count right now.' });
    }
};

// POST /api/emails/conversations/:id/reply — answer in the same thread, from the mailbox the conversation started from
export const replyToConversation = async (req, res) => {
    try {
        const conversation = isValidObjectId(req.params.id) && await Conversation.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found.' });
        }

        const mailbox = await Mailbox.findOne({ _id: conversation.mailbox_id, user_id: req.user._id });
        if (mailbox?.status !== 'connected') {
            return res.status(400).json({ error: 'The mailbox for this conversation is disconnected. Connect it again in Settings.' });
        }

        // The reply answers the latest email in the thread
        const lastMessage = await EmailMessage.findOne({ conversation_id: conversation._id }).sort({ sent_at: -1 }).lean();
        const subject = /^re:/i.test(conversation.subject) ? conversation.subject : `Re: ${conversation.subject}`;
        const { body } = req.body;

        const sent = await sendFromMailbox(mailbox, {
            to: conversation.lead_email,
            subject,
            html: body,
            replyTo: { thread_id: conversation.thread_id, message_id: lastMessage.provider_message_id },
        });
        const sentAt = new Date();

        const message = await EmailMessage.create({
            conversation_id: conversation._id,
            user_id: req.user._id,
            direction: 'sent',
            provider_message_id: sent.message_id,
            from: mailbox.email,
            to: conversation.lead_email,
            subject,
            body,
            sent_at: sentAt,
        });

        conversation.set({ snippet: toSnippet(body), last_message_at: sentAt });
        await conversation.save();

        return res.status(201).json({ message: formatMessage(message) });
    } catch (err) {
        if (err.code === 'mailbox_disconnected') {
            return res.status(400).json({ error: 'Your mailbox was disconnected. Connect it again in Settings.' });
        }
        console.error('Replying to conversation failed:', err);
        return res.status(500).json({ error: 'Could not send your reply right now. Please try again.' });
    }
};

// POST /api/emails/send_bulk — email a template to each chosen lead and start a conversation with each
export const sendBulkEmailToLead = async (req, res) => {
    try {
        const { mailbox_id: mailboxId, template_id: templateId, lead_ids: leadIds } = req.body;

        const mailbox = await Mailbox.findOne({ _id: mailboxId, user_id: req.user._id });
        if (!mailbox) {
            return res.status(404).json({ error: 'Mailbox not found.' });
        }
        if (mailbox.status !== 'connected') {
            return res.status(400).json({ error: 'This mailbox is disconnected. Connect it again in Settings.' });
        }

        const template = await EmailTemplate.findOne({ _id: templateId, user_id: req.user._id }).lean();
        if (!template) {
            return res.status(404).json({ error: 'Template not found.' });
        }

        const leads = await Lead.find({ _id: { $in: leadIds }, user_id: req.user._id }).lean();

        // Leads that weren't found or have no email are skipped
        const result = { sent: 0, skipped: leadIds.length - leads.length, failed: 0 };

        // One at a time, so a big batch doesn't run into the provider's rate limits
        for (const lead of leads) {
            const email = chooseLeadEmail(lead);
            if (!email) {
                result.skipped++;
                continue;
            }

            const { subject, body } = fillTemplate(template, lead);

            try {
                const sent = await sendFromMailbox(mailbox, { to: email, subject, html: body });
                const sentAt = new Date();

                const conversation = await Conversation.create({
                    user_id: req.user._id,
                    mailbox_id: mailbox._id,
                    lead_id: lead._id,
                    lead_name: lead.name,
                    lead_email: email,
                    subject,
                    thread_id: sent.thread_id,
                    snippet: toSnippet(body),
                    last_message_at: sentAt,
                });

                await EmailMessage.create({
                    conversation_id: conversation._id,
                    user_id: req.user._id,
                    direction: 'sent',
                    provider_message_id: sent.message_id,
                    from: mailbox.email,
                    to: email,
                    subject,
                    body,
                    sent_at: sentAt,
                });

                await Lead.updateOne({ _id: lead._id }, { is_mail_sent: true });
                result.sent++;
            } catch (err) {
                console.error(`Emailing lead ${lead._id} failed:`, err);
                result.failed++;

                // The mailbox's login stopped working, so the other emails would fail too
                if (mailbox.status === 'disconnected') break;
            }
        }

        if (mailbox.status === 'disconnected') {
            return res.status(400).json({ error: 'Your mailbox was disconnected. Connect it again in Settings.', ...result });
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('Sending bulk email failed:', err);
        return res.status(500).json({ error: 'Could not send the emails right now. Please try again.' });
    }
};
