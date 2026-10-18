import { z } from 'zod'
import { COMPANY_SIZES, COUNTRIES, INDUSTRIES, MAX_KEYWORDS, MAX_LEADS } from '@/constants/leads.ts'

export const leadSearchSchema = z.object({
    country: z.enum(COUNTRIES, 'Choose a country'),
    city: z.object({ name: z.string(), lat: z.number(), lon: z.number() }).optional(),
    industry: z.enum(INDUSTRIES, 'Choose an industry'),
    company_size: z.enum(COMPANY_SIZES).optional(),
    keywords: z
        .array(z.string().trim().min(1).max(50, 'Each keyword must be 50 characters or less'))
        .max(MAX_KEYWORDS, `Use up to ${MAX_KEYWORDS} keywords`),
    limit: z
        .number()
        .int()
        .min(1, 'Choose at least 1 lead')
        .max(MAX_LEADS, `You can request up to ${MAX_LEADS} leads`),
})

export type LeadSearchInput = z.infer<typeof leadSearchSchema>
