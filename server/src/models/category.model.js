import { Schema, model } from 'mongoose';

const categorySchema = new Schema({
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
    slug: {
        type: String,
        required: true,
        trim: true,
    },
    color: {
        type: String,
        required: true,
        match: /^#[0-9A-Fa-f]{6}$/,
    },
}, { timestamps: true, collection: 'categories' });

categorySchema.index({ user_id: 1, slug: 1 }, { unique: true });

const Category = model('Category', categorySchema);

export default Category;
