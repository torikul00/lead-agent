import { isValidObjectId } from 'mongoose';
import EmailTemplate from '../models/emailTemplate.model.js';

// Only what the client needs for a template
const formatTemplate = (template) => ({
    id: template._id,
    name: template.name,
    subject: template.subject,
    body: template.body,
    variants: template.variants,
    updated_at: template.updatedAt,
});

// GET /api/emails/templates — the user's templates, last edited first
export const getTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.find({ user_id: req.user._id }).sort({ updatedAt: -1 }).lean();
        return res.status(200).json({ templates: templates.map(formatTemplate) });
    } catch (err) {
        console.error('Loading email templates failed:', err);
        return res.status(500).json({ error: 'Could not load your templates right now. Please try again.' });
    }
};

// GET /api/emails/templates/:id — one of the user's templates
export const getTemplate = async (req, res) => {
    try {
        const template = isValidObjectId(req.params.id) && await EmailTemplate.findOne({ _id: req.params.id, user_id: req.user._id }).lean();
        if (!template) {
            return res.status(404).json({ error: 'Template not found.' });
        }

        return res.status(200).json({ template: formatTemplate(template) });
    } catch (err) {
        console.error('Loading email template failed:', err);
        return res.status(500).json({ error: 'Could not load this template right now. Please try again.' });
    }
};

// POST /api/emails/templates
export const createTemplate = async (req, res) => {
    try {
        const template = await EmailTemplate.create({ ...req.body, user_id: req.user._id });
        return res.status(201).json({ template: formatTemplate(template) });
    } catch (err) {
        console.error('Creating email template failed:', err);
        return res.status(500).json({ error: 'Could not save the template right now. Please try again.' });
    }
};

// PATCH /api/emails/templates/:id — the whole template is sent, so it replaces the saved one
export const updateTemplate = async (req, res) => {
    try {
        const template = isValidObjectId(req.params.id) && await EmailTemplate.findOneAndUpdate(
            { _id: req.params.id, user_id: req.user._id },
            req.body,
            { new: true, runValidators: true }
        ).lean();
        if (!template) {
            return res.status(404).json({ error: 'Template not found.' });
        }

        return res.status(200).json({ template: formatTemplate(template) });
    } catch (err) {
        console.error('Updating email template failed:', err);
        return res.status(500).json({ error: 'Could not save the template right now. Please try again.' });
    }
};

// DELETE /api/emails/templates/:id
export const deleteTemplate = async (req, res) => {
    try {
        const result = isValidObjectId(req.params.id) && await EmailTemplate.deleteOne({ _id: req.params.id, user_id: req.user._id });
        if (!result?.deletedCount) {
            return res.status(404).json({ error: 'Template not found.' });
        }

        return res.status(200).json({ message: 'Template deleted.' });
    } catch (err) {
        console.error('Deleting email template failed:', err);
        return res.status(500).json({ error: 'Could not delete the template right now. Please try again.' });
    }
};
