import { z } from 'zod';
import { TEMPLATE_VARIANT_KEYS } from '../../utils/constants.js';

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
