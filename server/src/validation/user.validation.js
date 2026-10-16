import { z } from 'zod';

const email = z.string().trim().toLowerCase().min(1, 'Email is required').pipe(z.email('Enter a valid email address'));
const password = z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/\d/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');
const full_name = z.string().trim().min(1, 'Full name is required').min(2, 'Full name must be at least 2 characters');
const phone = z.string().trim().min(1, 'Phone number is required').regex(/^\+?\d[\d\s-]{5,18}\d$/, 'Enter a valid phone number');

export const registerSchema = z.object({ full_name, email, phone, password });

export const loginSchema = z.object({
    email,
    password: z.string().min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const updateMeSchema = z.object({
    full_name: full_name.optional(),
    phone: phone.optional(),
});

export const changePasswordSchema = z.object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: password,
});
