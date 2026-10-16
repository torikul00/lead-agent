import { z } from 'zod'

export const loginSchema = z.object({
    email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
    password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({
    full_name: z.string().trim().min(1, 'Full name is required').min(2, 'Full name must be at least 2 characters'),
    email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
    phone: z.string().trim().min(1, 'Phone number is required').regex(/^\+?\d[\d\s-]{5,18}\d$/, 'Enter a valid phone number'),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must include an uppercase letter')
        .regex(/[a-z]/, 'Password must include a lowercase letter')
        .regex(/\d/, 'Password must include a number')
        .regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
})

export const verifyEmailSchema = z.object({
    code: z.string().trim().min(1, 'Code is required').regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
