import { z } from 'zod';

export const updateLeadCategorySchema = z.object({
    category_id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid category').nullable(),
});
