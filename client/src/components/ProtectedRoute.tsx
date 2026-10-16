import { Navigate, Outlet } from 'react-router'
import useAuthStore from '@/store/auth.store.ts'
import PageLoader from '@/components/PageLoader.tsx'
import VerifyEmailModal from '@/components/VerifyEmailModal.tsx'

export default function ProtectedRoute() {
    const user = useAuthStore((state) => state.user)
    const loading = useAuthStore((state) => state.loading)

    if (loading) return <PageLoader />
    if (!user) return <Navigate to="/login" replace />

    return (
        <>
            <Outlet />
            {!user.is_email_verified && <VerifyEmailModal email={user.email} />}
        </>
    )
}
