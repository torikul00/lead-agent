import { z } from 'zod';
import { SOURCES } from '../sources/index.js';
import { DEFAULT_LEADS, MAX_COMPANY_EMAILS, MAX_CONTACTS, MAX_LEADS } from '../../utils/constants.js';

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];
const INDUSTRIES = ['Technology', 'Software', 'Financial Services', 'Healthcare', 'Marketing & Advertising', 'E-commerce & Retail', 'Telecommunications', 'Education', 'Manufacturing', 'Consulting'];
const SOURCE_NAMES = Object.keys(SOURCES);

// A city picked from the suggestions; its centre is where the search looks
const citySchema = z.object({
    name: z.string().trim().min(1, 'City is required').max(100, 'City is too long'),
    lat: z.number('Choose a city from the list').min(-90).max(90),
    lon: z.number('Choose a city from the list').min(-180).max(180),
});

export const generateLeadsSchema = z.object({
    country: z.string().trim().min(1, 'Country is required').max(100, 'Country is too long'),
    city: citySchema.optional(),
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

export const findCitiesSchema = z.object({
    country: z.string().trim().min(1, 'Country is required').max(100, 'Country is too long'),
    text: z.string().trim().min(2, 'Type at least 2 letters').max(100, 'City is too long'),
});

// The lead's current people and emails come along so Hunter's results merge into them
export const findEmailsSchema = z.object({
    domain: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Enter a valid domain'),
    contacts: z.array(contactSchema).max(MAX_CONTACTS).default([]),
    company_emails: z.array(companyEmailSchema).max(MAX_COMPANY_EMAILS).default([]),
});

// A lead as the search returned it
const savedLeadSchema = z.object({
    name: z.string().trim().min(1).max(300),
    website: z.string().trim().max(2000).nullable().default(null),
    domain: z.string().trim().max(253).nullable().default(null),
    country: z.string().trim().min(1).max(100),
    industry: z.string().trim().max(500).nullable().default(null),
    employee_count: z.number().min(0).nullable().default(null),
    address: z.string().trim().max(500).nullable().default(null),
    description: z.string().trim().max(5000).nullable().default(null),
    phone: z.string().trim().max(100).nullable().default(null),
    source_name: z.string().trim().min(1).max(50),
    source_url: z.string().trim().max(2000).nullable().default(null),
    mx_status: z.enum(['found', 'not_found', 'error', 'not_checked']),
    email_provider: z.string().trim().max(50).nullable().default(null),
    contacts: z.array(contactSchema).max(MAX_CONTACTS).default([]),
    company_emails: z.array(companyEmailSchema).max(MAX_COMPANY_EMAILS).default([]),
    score: z.number().min(0).max(100),
    fit_label: z.enum(['good_fit', 'needs_review', 'poor_fit']),
    score_reasons: z.array(z.string().trim().max(500)).max(20).default([]),
});

// A company email typed in by hand on a saved lead
export const addCompanyEmailSchema = z.object({
    email: z.string().trim().toLowerCase().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
});

const listName = z.string().trim().min(1, 'List name is required').max(100, 'List name must be 100 characters or less');

// A new list made from leads that are already saved
export const createLeadListSchema = z.object({
    name: listName,
    lead_ids: z
        .array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid lead'))
        .min(1, 'Choose at least one lead')
        .transform((ids) => [...new Set(ids)]),
});

export const saveLeadListSchema = z.object({
    name: listName,
    search_query: generateLeadsSchema,
    searched_at: z.coerce.date('Search time is invalid'),
    leads: z.array(savedLeadSchema).min(1, 'Choose at least one lead to save').max(MAX_LEADS, `You can save up to ${MAX_LEADS} leads`),
});
