import { useState, type SubmitEvent } from 'react'
import { z } from 'zod'
import { KeyRound, MailCheck } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import useAuthStore from '@/store/auth.store.ts'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import { verifyEmailSchema, type VerifyEmailInput } from '@/schemas/auth.ts'

type VerifyErrors = Partial<Record<keyof VerifyEmailInput, string[]>>

export default function VerifyEmailModal({ email }: { email: string }) {
    const setUser = useAuthStore((state) => state.setUser)
    const logout = useAuthStore((state) => state.logout)
    const [errors, setErrors] = useState<VerifyErrors>({})
    const [serverError, setServerError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [resending, setResending] = useState(false)

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = verifyEmailSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
        setServerError('')
        setSuccessMessage('')
        setLoading(true)

        try {
            const { data } = await api.post('/users/verify_email', result.data)
            setUser(data.user)
        } catch (err) {
            setServerError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        setServerError('')
        setSuccessMessage('')
        setResending(true)

        try {
            const { data } = await api.post('/users/resend_verification')
            setSuccessMessage(data.message)
        } catch (err) {
            setServerError(getErrorMessage(err))
        } finally {
            setResending(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="verify-email-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MailCheck className="size-6" />
                </div>

                <h2 id="verify-email-title" className="mt-5 text-2xl font-bold text-slate-900">Verify your email</h2>
                <p className="mt-2 text-sm text-slate-500">
                    Enter the 6-digit code sent to <span className="font-medium text-slate-700">{email}</span>
                </p>

                <div className="mt-6">
                    {serverError && <FormAlert message={serverError} />}
                    {successMessage && <FormAlert type="success" message={successMessage} />}

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <InputField id="code" name="code" label="Verification code" icon={KeyRound} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required error={errors.code?.[0]} />

                        <SubmitButton loading={loading}>Verify email</SubmitButton>
                    </form>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm">
                    <button type="button" onClick={handleResend} disabled={resending} className="cursor-pointer font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60">
                        {resending ? 'Sending...' : 'Resend code'}
                    </button>
                    <button type="button" onClick={logout} className="cursor-pointer text-slate-500 transition hover:text-slate-700">
                        Log out
                    </button>
                </div>
            </div>
        </div>
    )
}
