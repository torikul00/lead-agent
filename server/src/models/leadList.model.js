import { Schema, model } from 'mongoose';

// A named set of leads the user saved, with the search that found them; lists made on the Leads page have no search
const leadListSchema = new Schema({
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
    search_query: {
        country: String,
        city: { name: String, lat: Number, lon: Number },
        industry: String,
        company_size: String,
        keywords: [String],
        limit: Number,
        sources: [String],
    },
    searched_at: {
        type: Date,
        default: null,
    },
    lead_count: {
        type: Number,
        required: true,
    }
}, { timestamps: true, collection: 'lead_lists' });

leadListSchema.index({ user_id: 1, createdAt: -1 });

const LeadList = model('LeadList', leadListSchema);

export default LeadList;
