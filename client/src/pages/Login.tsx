import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { Lock, Mail } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import useAuthStore from '@/store/auth.store.ts'
import AuthLayout from '@/components/AuthLayout.tsx'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import { loginSchema, type LoginInput } from '@/schemas/auth.ts'

type LoginErrors = Partial<Record<keyof LoginInput, string[]>>

export default function Login() {
    const navigate = useNavigate()
    const setUser = useAuthStore((state) => state.setUser)
    const [errors, setErrors] = useState<LoginErrors>({})
    const [serverError, setServerError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
        setServerError('')
        setLoading(true)

        try {
            const { data } = await api.post('/users/login', result.data)
            setUser(data.user)
            navigate('/')
        } catch (err) {
            setServerError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout title="Welcome back" subtitle="Log in to continue to your dashboard.">
            {serverError && <FormAlert message={serverError} />}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <InputField id="email" name="email" type="email" label="Email" icon={Mail} placeholder="you@company.com" autoComplete="email" required error={errors.email?.[0]} />
                <InputField id="password" name="password" type="password" label="Password" icon={Lock} placeholder="Enter your password" autoComplete="current-password" required error={errors.password?.[0]} />

                <SubmitButton loading={loading}>Log in</SubmitButton>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
                Don't have an account?{' '}
                <Link to="/signup" className="font-semibold text-primary hover:underline">Sign up</Link>
            </p>
        </AuthLayout>
    )
}
