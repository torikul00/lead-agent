import { z } from 'zod';

export const createCategorySchema = z.object({
    name: z.string().trim().min(1, 'Category name is required').max(100, 'Category name must be 100 characters or less'),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Choose a valid hex color'),
});
