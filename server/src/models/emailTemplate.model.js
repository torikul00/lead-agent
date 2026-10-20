import { Schema, model } from 'mongoose';
import { TEMPLATE_VARIANT_KEYS } from '../../utils/constants.js';

// A version of the email for leads on one email provider
const variantSchema = new Schema({
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
}, { _id: false });

// A reusable email; leads whose provider has no variant get the template's own subject and body
const emailTemplateSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
    },
    body: {
        type: String,
        required: true,
    },
    // { google_workspace: { subject, body } | null, microsoft_365: ..., other: ... }
    variants: Object.fromEntries(TEMPLATE_VARIANT_KEYS.map((key) => [key, { type: variantSchema, default: null }]))
}, { timestamps: true, collection: 'email_templates' });

emailTemplateSchema.index({ user_id: 1, updatedAt: -1 });

const EmailTemplate = model('EmailTemplate', emailTemplateSchema);

export default EmailTemplate;
