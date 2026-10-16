import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { Lock, Mail, Phone, User } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import useAuthStore from '@/store/auth.store.ts'
import AuthLayout from '@/components/AuthLayout.tsx'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import PasswordStrength from '@/components/PasswordStrength.tsx'
import { signupSchema, type SignupInput } from '@/schemas/auth.ts'

type SignupErrors = Partial<Record<keyof SignupInput, string[]>>

export default function Signup() {
    const navigate = useNavigate()
    const setUser = useAuthStore((state) => state.setUser)
    const [errors, setErrors] = useState<SignupErrors>({})
    const [serverError, setServerError] = useState('')
    const [loading, setLoading] = useState(false)
    const [password, setPassword] = useState('')

    // Always show the scrollbar so the page doesn't shift when errors appear
    useEffect(() => {
        document.documentElement.style.overflowY = 'scroll'
        return () => {
            document.documentElement.style.overflowY = ''
        }
    }, [])

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = signupSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
        setServerError('')
        setLoading(true)

        try {
            const { data } = await api.post('/users/register', result.data)
            setUser(data.user)
            navigate('/')
        } catch (err) {
            setServerError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout wide title="Create your account" subtitle="Start finding and qualifying leads in minutes.">
            {serverError && <FormAlert message={serverError} />}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                    <InputField id="full_name" name="full_name" label="Full name" icon={User} placeholder="John Doe" autoComplete="name" required error={errors.full_name?.[0]} />
                    <InputField id="phone" name="phone" type="tel" label="Phone number" icon={Phone} placeholder="+1 555 000 0000" autoComplete="tel" required error={errors.phone?.[0]} />
                </div>
                <InputField id="email" name="email" type="email" label="Email" icon={Mail} placeholder="you@company.com" autoComplete="email" required error={errors.email?.[0]} />
                <div>
                    <InputField
                        id="password"
                        name="password"
                        type="password"
                        label="Password"
                        icon={Lock}
                        placeholder="Create a password"
                        autoComplete="new-password"
                        required
                        error={errors.password?.[0]}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <PasswordStrength password={password} />
                </div>

                <SubmitButton loading={loading}>Create account</SubmitButton>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link>
            </p>
        </AuthLayout>
    )
}
