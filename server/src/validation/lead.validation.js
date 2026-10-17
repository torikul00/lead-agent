import { z } from 'zod';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];

export const generateLeadsSchema = z.object({
    country: z.string().trim().min(1, 'Country is required').max(100, 'Country is too long'),
    industry: z.string().trim().min(1, 'Industry is required').max(100, 'Industry is too long'),
    company_size: z.enum(COMPANY_SIZES, 'Choose a valid company size').optional(),
    keywords: z
        .array(z.string().trim().min(1, 'Keywords cannot be empty').max(50, 'Each keyword must be 50 characters or less'))
        .max(10, 'Use up to 10 keywords')
        .default([]),
});
