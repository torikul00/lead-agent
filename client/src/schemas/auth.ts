import { z } from 'zod'

const email = z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address'))
const full_name = z.string().trim().min(1, 'Full name is required').min(2, 'Full name must be at least 2 characters')
const phone = z.string().trim().min(1, 'Phone number is required').regex(/^\+?\d[\d\s-]{5,18}\d$/, 'Enter a valid phone number')
const password = z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/\d/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a symbol')

export const loginSchema = z.object({
    email,
    password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({ full_name, email, phone, password })

export const verifyEmailSchema = z.object({
    code: z.string().trim().min(1, 'Code is required').regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export const profileSchema = z.object({ full_name, phone })

// Same limits as the server's avatar upload
export const avatarSchema = z
    .file()
    .max(2 * 1024 * 1024, 'Image must be 2MB or smaller')
    .mime(['image/jpeg', 'image/png', 'image/webp'], 'Only JPG, PNG or WEBP images are allowed')

export const changePasswordSchema = z
    .object({
        current_password: z.string().min(1, 'Current password is required'),
        new_password: password,
        confirm_password: z.string().min(1, 'Please confirm your new password'),
    })
    .refine((data) => data.new_password === data.confirm_password, {
        error: 'Passwords do not match',
        path: ['confirm_password'],
    })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
