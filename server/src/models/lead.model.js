import { Schema, model } from 'mongoose';

const leadSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    search_job_id: {
        type: Schema.Types.ObjectId,
        ref: 'SearchJob',
        default: null,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    normalized_name: {
        type: String,
        required: true,
    },
    domain: {
        type: String,
        default: null,
    },
    normalized_domain: {
        type: String,
        default: null,
    },
    country: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        default: null,
    },
    employee_count: {
        type: Number,
        default: null,
    },
    employee_range: {
        type: String,
        default: null,
    },
    description: {
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
    website_status: {
        type: String,
        enum: ['reachable', 'unreachable', 'error', 'not_checked'],
        default: 'not_checked',
    },
    ai_score: {
        type: Number,
        min: 0,
        max: 100,
        default: null,
    },
    fit_label: {
        type: String,
        enum: ['good_fit', 'needs_review', 'poor_fit', null],
        default: null,
    },
    ai_reason: {
        type: String,
        default: null,
    },
    missing_information: {
        type: [String],
        default: [],
    },
    last_checked_at: {
        type: Date,
        default: null,
    }
}, { timestamps: true });

// One lead per domain for each user; leads without a domain are deduplicated in code
leadSchema.index({ user_id: 1, normalized_domain: 1 }, { unique: true, partialFilterExpression: { normalized_domain: { $type: 'string' } } });
leadSchema.index({ user_id: 1, createdAt: -1 });

const Lead = model('Lead', leadSchema);

export default Lead;
