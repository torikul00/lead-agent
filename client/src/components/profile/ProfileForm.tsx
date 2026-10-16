import { useState, type ChangeEvent, type SubmitEvent } from 'react'
import { z } from 'zod'
import { Camera, Mail, Phone, User } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import useAuthStore from '@/store/auth.store.ts'
import Avatar from '@/components/Avatar.tsx'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import { avatarSchema, profileSchema, type ProfileInput } from '@/schemas/auth.ts'

type ProfileErrors = Partial<Record<keyof ProfileInput, string[]>>

export default function ProfileForm() {
    const user = useAuthStore((state) => state.user)
    const setUser = useAuthStore((state) => state.setUser)
    const [errors, setErrors] = useState<ProfileErrors>({})
    const [serverError, setServerError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [avatarError, setAvatarError] = useState('')

    if (!user) return null

    const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return

        const result = avatarSchema.safeParse(file)
        if (!result.success) {
            setAvatarError(result.error.issues[0].message)
            return
        }

        if (avatarPreview) URL.revokeObjectURL(avatarPreview)
        setAvatarError('')
        setAvatarFile(file)
        setAvatarPreview(URL.createObjectURL(file))
    }

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = profileSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
        setServerError('')
        setSuccessMessage('')
        setLoading(true)

        // Multipart so the photo can be uploaded together with the other fields
        const body = new FormData()
        body.append('full_name', result.data.full_name)
        body.append('phone', result.data.phone)
        if (avatarFile) body.append('avatar', avatarFile)

        try {
            const { data } = await api.patch('/users/me', body)
            setUser(data.user)
            if (avatarPreview) URL.revokeObjectURL(avatarPreview)
            setAvatarFile(null)
            setAvatarPreview(null)
            setSuccessMessage('Profile updated successfully.')
        } catch (err) {
            setServerError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Avatar name={user.full_name} src={avatarPreview ?? user.avatar} size="lg" />
                    <label htmlFor="avatar" title="Change photo" className="absolute -right-1 -bottom-1 flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow transition hover:bg-primary/90">
                        <Camera className="size-3.5" />
                    </label>
                    <input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="sr-only" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Personal information</h2>
                    <p className="text-sm text-slate-500">Update your photo, name and phone number.</p>
                    <p className="mt-0.5 text-xs text-slate-400">JPG, PNG or WEBP. Max 2MB.</p>
                </div>
            </div>
            {avatarError && <p className="mt-3 text-sm text-red-600">{avatarError}</p>}

            <div className="mt-6">
                {serverError && <FormAlert message={serverError} />}
                {successMessage && <FormAlert type="success" message={successMessage} />}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <InputField id="full_name" name="full_name" label="Full name" icon={User} defaultValue={user.full_name} autoComplete="name" required error={errors.full_name?.[0]} />
                        <InputField id="phone" name="phone" type="tel" label="Phone number" icon={Phone} defaultValue={user.phone} autoComplete="tel" required error={errors.phone?.[0]} />
                    </div>
                    <InputField id="email" type="email" label="Email" icon={Mail} defaultValue={user.email} disabled />

                    <div className="sm:w-56">
                        <SubmitButton loading={loading}>Save changes</SubmitButton>
                    </div>
                </form>
            </div>
        </section>
    )
}
