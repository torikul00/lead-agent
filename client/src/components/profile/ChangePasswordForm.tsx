import { useState, type SubmitEvent } from 'react'
import { z } from 'zod'
import { KeyRound, Lock } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import PasswordStrength from '@/components/PasswordStrength.tsx'
import { changePasswordSchema, type ChangePasswordInput } from '@/schemas/auth.ts'

type PasswordErrors = Partial<Record<keyof ChangePasswordInput, string[]>>

export default function ChangePasswordForm() {
    const [errors, setErrors] = useState<PasswordErrors>({})
    const [serverError, setServerError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [newPassword, setNewPassword] = useState('')

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = e.currentTarget
        const result = changePasswordSchema.safeParse(Object.fromEntries(new FormData(form)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
        setServerError('')
        setSuccessMessage('')
        setLoading(true)

        try {
            const { current_password, new_password } = result.data
            await api.patch('/users/me/password', { current_password, new_password })
            form.reset()
            setNewPassword('')
            setSuccessMessage('Password updated successfully.')
        } catch (err) {
            setServerError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <KeyRound className="size-7" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
                    <p className="text-sm text-slate-500">Use a strong password you don't use anywhere else.</p>
                </div>
            </div>

            <div className="mt-6">
                {serverError && <FormAlert message={serverError} />}
                {successMessage && <FormAlert type="success" message={successMessage} />}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    <InputField id="current_password" name="current_password" type="password" label="Current password" icon={Lock} placeholder="Enter your current password" autoComplete="current-password" required error={errors.current_password?.[0]} />

                    <div>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <InputField
                                id="new_password"
                                name="new_password"
                                type="password"
                                label="New password"
                                icon={Lock}
                                placeholder="Create a new password"
                                autoComplete="new-password"
                                required
                                error={errors.new_password?.[0]}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <InputField id="confirm_password" name="confirm_password" type="password" label="Confirm new password" icon={Lock} placeholder="Repeat the new password" autoComplete="new-password" required error={errors.confirm_password?.[0]} />
                        </div>
                        <PasswordStrength password={newPassword} />
                    </div>

                    <div className="sm:w-56">
                        <SubmitButton loading={loading}>Update password</SubmitButton>
                    </div>
                </form>
            </div>
        </section>
    )
}
