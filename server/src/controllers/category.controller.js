import Category from '../models/category.model.js';
import { isValidObjectId } from 'mongoose';

const formatCategory = (category) => ({
    id: category._id,
    name: category.name,
    slug: category.slug,
    color: category.color,
    created_at: category.createdAt,
});

const makeSlug = (name) =>
    name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'category';

// GET /api/categories
export const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ user_id: req.user._id }).sort({ name: 1 }).lean();
        return res.status(200).json({ categories: categories.map(formatCategory) });
    } catch (err) {
        console.error('Loading categories failed:', err);
        return res.status(500).json({ error: 'Could not load categories right now. Please try again.' });
    }
};

// POST /api/categories
export const createCategory = async (req, res) => {
    try {
        const category = await Category.create({
            ...req.body,
            slug: makeSlug(req.body.name),
            user_id: req.user._id,
        });
        return res.status(201).json({ category: formatCategory(category) });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ error: 'A category with this name already exists.' });
        }
        console.error('Creating category failed:', err);
        return res.status(500).json({ error: 'Could not create the category right now. Please try again.' });
    }
};

// PATCH /api/categories/:id
export const updateCategory = async (req, res) => {
    try {
        const category = isValidObjectId(req.params.id) && await Category.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            { ...req.body, slug: makeSlug(req.body.name) },
            { new: true, runValidators: true }
        ).lean();

        if (!category) {
            return res.status(404).json({ error: 'Category not found.' });
        }

        return res.status(200).json({ category: formatCategory(category) });
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ error: 'A category with this name already exists.' });
        }
        console.error('Updating category failed:', err);
        return res.status(500).json({ error: 'Could not update the category right now. Please try again.' });
    }
};

// DELETE /api/categories/:id
export const deleteCategory = async (req, res) => {
    try {
        const result = isValidObjectId(req.params.id) && await Category.deleteOne({ _id: req.params.id, user_id: req.user._id });
        if (!result?.deletedCount) {
            return res.status(404).json({ error: 'Category not found.' });
        }

        return res.status(200).json({ message: 'Category deleted.' });
    } catch (err) {
        console.error('Deleting category failed:', err);
        return res.status(500).json({ error: 'Could not delete the category right now. Please try again.' });
    }
};
