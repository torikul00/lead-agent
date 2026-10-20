import { Schema, model } from 'mongoose';
import { MX_CACHE_DAYS } from '../../utils/constants.js';
import { checkMx } from '../../utils/helper.js';

// Mail server details per domain, shared by all users since they're the same for everyone
const domainMxRecordSchema = new Schema({
    domain: {
        type: String,
        required: true,
        unique: true,
    },
    mx_records: {
        type: [{ _id: false, exchange: String, priority: Number }],
        default: [],
    },
    email_provider: {
        type: String,
        default: null,
    },
    mx_status: {
        type: String,
        enum: ['found', 'not_found', 'error'],
        required: true,
    },
    mx_checked_at: {
        type: Date,
        required: true,
    }
}, { timestamps: true, collection: 'domain_mx_records' });

// Reuse a recent stored result, otherwise look the domain up and store it; failed lookups are always retried
domainMxRecordSchema.statics.getMx = async function (domain) {
    const freshSince = new Date(Date.now() - MX_CACHE_DAYS * 24 * 60 * 60 * 1000);
    const stored = await this.findOne({ domain, mx_status: { $ne: 'error' }, mx_checked_at: { $gte: freshSince } }).lean();
    if (stored) return stored;

    const result = await checkMx(domain);
    await this.updateOne({ domain }, { ...result, mx_checked_at: new Date() }, { upsert: true });
    return result;
};

const DomainMxRecord = model('DomainMxRecord', domainMxRecordSchema);

export default DomainMxRecord;
