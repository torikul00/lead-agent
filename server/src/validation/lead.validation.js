import { z } from 'zod';
import { SOURCES } from '../sources/index.js';
import { DEFAULT_LEADS, MAX_COMPANY_EMAILS, MAX_CONTACTS, MAX_LEADS } from '../../utils/constants.js';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];
const INDUSTRIES = ['Technology', 'Software', 'Financial Services', 'Healthcare', 'Marketing & Advertising', 'E-commerce & Retail', 'Telecommunications', 'Education', 'Manufacturing', 'Consulting'];
const SOURCE_NAMES = Object.keys(SOURCES);

export const generateLeadsSchema = z.object({
    country: z.string().trim().min(1, 'Country is required').max(100, 'Country is too long'),
    industry: z.enum(INDUSTRIES, 'Choose a valid industry'),
    company_size: z.enum(COMPANY_SIZES, 'Choose a valid company size').optional(),
    keywords: z
        .array(z.string().trim().min(1, 'Keywords cannot be empty').max(50, 'Each keyword must be 50 characters or less'))
        .max(10, 'Use up to 10 keywords')
        .default([]),
    limit: z
        .number('Lead count must be a number')
        .int('Lead count must be a whole number')
        .min(1, 'Request at least 1 lead')
        .max(MAX_LEADS, `You can request up to ${MAX_LEADS} leads`)
        .default(DEFAULT_LEADS),
    sources: z
        .array(z.enum(SOURCE_NAMES, 'Choose a valid source'))
        .min(1, 'Choose at least one source')
        .transform((names) => [...new Set(names)])
        .default(SOURCE_NAMES),
});

const contactSchema = z.object({
    name: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(100),
    role: z.string().trim().min(1).max(50),
    email: z.string().trim().max(254).nullable().default(null),
    phone: z.string().trim().max(50).nullable().default(null),
    linkedin_url: z.string().trim().max(500).nullable().default(null),
    source_name: z.string().trim().max(50),
    source_url: z.string().trim().max(2000),
});

const companyEmailSchema = z.object({
    email: z.string().trim().max(254),
    source_name: z.string().trim().max(50),
    source_url: z.string().trim().max(2000),
});

// The lead's current people and emails come along so Hunter's results merge into them
export const findEmailsSchema = z.object({
    domain: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Enter a valid domain'),
    contacts: z.array(contactSchema).max(MAX_CONTACTS).default([]),
    company_emails: z.array(companyEmailSchema).max(MAX_COMPANY_EMAILS).default([]),
});
