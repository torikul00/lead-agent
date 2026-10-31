import { z } from 'zod';
import { MAX_LEADS, TEMPLATE_VARIANT_KEYS } from '../../utils/constants.js';

// The editor's HTML keeps its tags even when empty ("<p></p>"), so check for text inside
const hasText = (html) => html.replace(/<[^>]*>/g, '').trim().length > 0;

const subject = z.string().trim().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or less');
const body = z.string().max(10000, 'Email body is too long').refine(hasText, 'Email body is required');

// A provider variant is either complete or null
const variant = z.object({ subject, body }).nullable().default(null);

export const emailTemplateSchema = z.object({
    name: z.string().trim().min(1, 'Template name is required').max(100, 'Template name must be 100 characters or less'),
    subject,
    body,
    variants: z
        .object(Object.fromEntries(TEMPLATE_VARIANT_KEYS.map((key) => [key, variant])))
        .default(Object.fromEntries(TEMPLATE_VARIANT_KEYS.map((key) => [key, null]))),
});

// A reply written in the Inbox; it can also be just an image
export const replySchema = z.object({
    body: z.string().max(10000, 'Reply is too long').refine((html) => hasText(html) || /<img\s/i.test(html), 'Write a message or add an image'),
});

const objectId = (message) => z.string().regex(/^[a-f\d]{24}$/i, message);

// One template sent from one of the user's mailboxes to several saved leads
export const sendBulkEmailSchema = z.object({
    mailbox_id: objectId('Choose a mailbox to send from'),
    template_id: objectId('Choose a template'),
    lead_ids: z
        .array(objectId('Invalid lead'))
        .min(1, 'Choose at least one lead')
        .max(MAX_LEADS, `You can email up to ${MAX_LEADS} leads at a time`)
        .transform((ids) => [...new Set(ids)]),
});

// One template sent from one of the user's mailboxes to every lead in a list
export const sendListSchema = z.object({
    lead_list_id: objectId('Choose a lead list'),
    mailbox_id: objectId('Choose a mailbox to send from'),
    template_id: objectId('Choose a template'),
    // Optional: the category a lead moves to once its email is sent
    category_id: objectId('Invalid category').nullable().default(null),
});
