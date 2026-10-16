import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { ArrowRight, Lock, Mail } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.tsx'
import InputField from '../components/InputField.tsx'
import { loginSchema, type LoginInput } from '../schemas/auth.ts'

type LoginErrors = Partial<Record<keyof LoginInput, string[]>>

export default function Login() {
    const [errors, setErrors] = useState<LoginErrors>({})

    const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
    }

    return (
        <AuthLayout title="Welcome back" subtitle="Log in to continue to your dashboard.">
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <InputField id="email" name="email" type="email" label="Email" icon={Mail} placeholder="you@company.com" autoComplete="email" required error={errors.email?.[0]} />
                <InputField id="password" name="password" type="password" label="Password" icon={Lock} placeholder="Enter your password" autoComplete="current-password" required error={errors.password?.[0]} />

                <button type="submit" className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 focus:outline-none">
                    Log in
                    <ArrowRight className="size-4" />
                </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
                Don't have an account?{' '}
                <Link to="/signup" className="font-semibold text-primary hover:underline">Sign up</Link>
            </p>
        </AuthLayout>
    )
}
