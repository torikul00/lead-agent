import { Queue, Worker } from 'bullmq';
import Mailbox from '../models/mailbox.model.js';
import Lead from '../models/lead.model.js';
import EmailTemplate from '../models/emailTemplate.model.js';
import Conversation from '../models/conversation.model.js';
import EmailMessage from '../models/emailMessage.model.js';
import { sendFromMailbox } from './index.js';
import { redisConnection } from '../../config/redis.js';
import { notifyMailSendUpdated } from '../../socket.js';
import { MAIL_SEND_CONCURRENCY, MAIL_SEND_MAX_RESTARTS, TEMPLATE_VARIANT_KEYS } from '../../utils/constants.js';
import { chooseLeadEmail, escapeHtml, toSnippet } from '../../utils/helper.js';

const QUEUE_NAME = 'mail_send';
const PLACEHOLDER = /\{\{(\w+)\}\}/g;

const queue = new Queue(QUEUE_NAME, { connection: redisConnection });
queue.on('error', (err) => console.error('Mail send queue error:', err.message));

// One job per user, kept after it finishes so its report is still there after a refresh
const jobId = (userId) => `send_${userId}`;

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

// Email the template to one lead and start a conversation with them; false when the lead has no email to send to
export const sendTemplateToLead = async (mailbox, template, lead) => {
    const email = chooseLeadEmail(lead);
    if (!email) return false;

    const { subject, body } = fillTemplate(template, lead);
    const sent = await sendFromMailbox(mailbox, { to: email, subject, html: body });
    const sentAt = new Date();

    // A lead already emailed from this mailbox keeps its one conversation, which follows the newest email so Inbox replies answer that one
    const conversation = await Conversation.findOneAndUpdate(
        { mailbox_id: mailbox._id, lead_id: lead._id },
        {
            lead_email: email,
            subject,
            thread_id: sent.thread_id,
            snippet: toSnippet(body),
            last_message_at: sentAt,
            $setOnInsert: { user_id: mailbox.user_id, provider: mailbox.provider, lead_name: lead.name },
        },
        { upsert: true, new: true, sort: { last_message_at: -1 } },
    );

    await EmailMessage.create({
        conversation_id: conversation._id,
        user_id: mailbox.user_id,
        direction: 'sent',
        provider_message_id: sent.message_id,
        internet_message_id: sent.internet_message_id || null,
        from: mailbox.email,
        to: email,
        subject,
        body,
        sent_at: sentAt,
    });

    await Lead.updateOne({ _id: lead._id }, { is_mail_sent: true });
    return true;
};

// The report of the user's latest send; null when they haven't sent one
export const getMailSendReport = async (userId) => {
    const job = await queue.getJob(jobId(userId));
    return job ? job.progress || job.data.report : null;
};

// Queue a send to run in the background; null when the user's last one is still running
export const startMailSend = async ({ userId, mailboxId, templateId, categoryId, leadIds }) => {
    const id = jobId(userId);
    const lastJob = await queue.getJob(id);
    if (lastJob && !(await lastJob.isCompleted()) && !(await lastJob.isFailed())) return null;
    await lastJob?.remove();

    const report = { status: 'sending', current_lead: null, done: 0, success: 0, failed: 0 };
    await queue.add('send_list', { user_id: userId, mailbox_id: mailboxId, template_id: templateId, category_id: categoryId, lead_ids: leadIds, report }, { jobId: id });
    return report;
};

// Email the leads one at a time, so a big list doesn't run into the provider's rate limits
const sendList = async (job) => {
    const { user_id: userId, mailbox_id: mailboxId, template_id: templateId, category_id: categoryId, lead_ids: leadIds } = job.data;

    // A job picked up again after a server restart carries on from its saved report
    let report = job.progress || job.data.report;

    const update = async (changes) => {
        report = { ...report, ...changes };
        await job.updateProgress(report);
        notifyMailSendUpdated(userId, report);
    };

    const stop = (error) => update({ status: 'stopped', current_lead: null, error });

    const mailbox = await Mailbox.findOne({ _id: mailboxId, user_id: userId });
    const template = await EmailTemplate.findOne({ _id: templateId, user_id: userId }).lean();
    if (!template) return stop('The email template was deleted.');

    for (const leadId of leadIds.slice(report.done)) {
        // The mailbox's login stopped working, so the other emails would fail too
        if (mailbox?.status !== 'connected') return stop('Your mailbox was disconnected. Connect it again in Settings.');

        const lead = await Lead.findOne({ _id: leadId, user_id: userId }).lean();
        await update({ current_lead: lead?.name ?? null });

        let sent = false;
        try {
            // A lead deleted since the send started counts as failed, like one with no email
            sent = Boolean(lead) && await sendTemplateToLead(mailbox, template, lead);
            if (sent && categoryId) await Lead.updateOne({ _id: leadId }, { category_id: categoryId });
        } catch (err) {
            console.error(`Emailing lead ${leadId} failed:`, err);
        }

        await update({ done: report.done + 1, success: report.success + (sent ? 1 : 0), failed: report.failed + (sent ? 0 : 1) });
    }

    await update({ status: 'done', current_lead: null });
};

// Run queued sends; anything unexpected that stops a job is reported, so the page doesn't stay on "sending"
export const startMailSender = () => {
    const worker = new Worker(QUEUE_NAME, sendList, {
        connection: { ...redisConnection, maxRetriesPerRequest: null },
        concurrency: MAIL_SEND_CONCURRENCY,
        maxStalledCount: MAIL_SEND_MAX_RESTARTS,
    });

    worker.on('error', (err) => console.error('Mail send worker error:', err.message));
    worker.on('failed', (job, err) => {
        console.error(`Mail send ${job?.id} failed:`, err);
        if (!job) return;

        const report = { ...(job.progress || job.data.report), status: 'stopped', current_lead: null, error: 'Sending stopped unexpectedly.' };
        job.updateProgress(report).catch((updateErr) => console.error('Saving the mail send report failed:', updateErr.message));
        notifyMailSendUpdated(job.data.user_id, report);
    });
};
