import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { ArrowRight, Lock, Mail, Phone, User } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.tsx'
import InputField from '../components/InputField.tsx'
import { signupSchema, type SignupInput } from '../schemas/auth.ts'

type SignupErrors = Partial<Record<keyof SignupInput, string[]>>

export default function Signup() {
    const [errors, setErrors] = useState<SignupErrors>({})

    const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = signupSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
    }

    return (
        <AuthLayout title="Create your account" subtitle="Start finding and qualifying leads in minutes.">
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <InputField id="full_name" name="full_name" label="Full name" icon={User} placeholder="John Doe" autoComplete="name" required error={errors.full_name?.[0]} />
                <InputField id="email" name="email" type="email" label="Email" icon={Mail} placeholder="you@company.com" autoComplete="email" required error={errors.email?.[0]} />
                <InputField id="phone" name="phone" type="tel" label="Phone number" icon={Phone} placeholder="+1 555 000 0000" autoComplete="tel" required error={errors.phone?.[0]} />
                <InputField id="password" name="password" type="password" label="Password" icon={Lock} placeholder="Create a password" autoComplete="new-password" required error={errors.password?.[0]} />

                <button type="submit" className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 focus:outline-none">
                    Create account
                    <ArrowRight className="size-4" />
                </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link>
            </p>
        </AuthLayout>
    )
}
