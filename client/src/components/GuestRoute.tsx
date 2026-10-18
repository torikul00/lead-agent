import { Navigate, Outlet } from 'react-router'
import useAuthStore from '@/store/auth.store.ts'
import PageLoader from '@/components/PageLoader.tsx'

export default function GuestRoute() {
    const user = useAuthStore((state) => state.user)
    const loading = useAuthStore((state) => state.loading)

    if (loading) return <PageLoader />
    return user ? <Navigate to="/search-leads" replace /> : <Outlet />
}
