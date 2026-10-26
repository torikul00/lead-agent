import { Schema, model } from 'mongoose';

const contactSchema = new Schema({
    name: { type: String, required: true },
    title: { type: String, required: true },
    role: { type: String, required: true },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    linkedin_url: { type: String, default: null },
    source_name: String,
    source_url: String,
}, { _id: false });

const companyEmailSchema = new Schema({
    email: { type: String, required: true },
    source_name: String,
    source_url: String,
}, { _id: false });

// A lead saved into a list, stored as the search returned it
const leadSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    lead_list_id: {
        type: Schema.Types.ObjectId,
        ref: 'LeadList',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    website: {
        type: String,
        default: null,
    },
    domain: {
        type: String,
        default: null,
    },
    country: {
        type: String,
        required: true,
    },
    industry: {
        type: String,
        default: null,
    },
    employee_count: {
        type: Number,
        default: null,
    },
    address: {
        type: String,
        default: null,
    },
    description: {
        type: String,
        default: null,
    },
    phone: {
        type: String,
        default: null,
    },
    source_name: {
        type: String,
        required: true,
    },
    source_url: {
        type: String,
        default: null,
    },
    mx_status: {
        type: String,
        enum: ['found', 'not_found', 'error', 'not_checked'],
        default: 'not_checked',
    },
    email_provider: {
        type: String,
        default: null,
    },
    contacts: {
        type: [contactSchema],
        default: [],
    },
    company_emails: {
        type: [companyEmailSchema],
        default: [],
    },
    score: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
    },
    fit_label: {
        type: String,
        enum: ['good_fit', 'needs_review', 'poor_fit'],
        required: true,
    },
    score_reasons: {
        type: [String],
        default: [],
    }
}, { timestamps: true });

leadSchema.index({ lead_list_id: 1, score: -1 });
leadSchema.index({ user_id: 1, domain: 1 });

const Lead = model('Lead', leadSchema);

export default Lead;
