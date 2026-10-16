import { z } from 'zod'

export const loginSchema = z.object({
    email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
    password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({
    full_name: z.string().trim().min(1, 'Full name is required').min(2, 'Full name must be at least 2 characters'),
    email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
    phone: z.string().trim().min(1, 'Phone number is required').regex(/^\+?\d[\d\s-]{5,18}\d$/, 'Enter a valid phone number'),
    password: z.string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
