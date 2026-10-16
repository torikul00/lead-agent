import ProfileForm from '@/components/profile/ProfileForm.tsx'
import ChangePasswordForm from '@/components/profile/ChangePasswordForm.tsx'

export default function Profile() {
    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
                <p className="mt-1 text-sm text-slate-500">Manage your personal information and password.</p>
            </div>

            <ProfileForm />
            <ChangePasswordForm />
        </div>
    )
}
