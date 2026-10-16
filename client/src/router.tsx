import { BrowserRouter, Route, Routes } from 'react-router'
import ProtectedRoute from '@/components/ProtectedRoute.tsx'
import GuestRoute from '@/components/GuestRoute.tsx'
import DashboardLayout from '@/layouts/DashboardLayout.tsx'
import Overview from '@/pages/Overview.tsx'
import Profile from '@/pages/Profile.tsx'
import Login from '@/pages/Login.tsx'
import Signup from '@/pages/Signup.tsx'

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<ProtectedRoute />}>
                    <Route element={<DashboardLayout />}>
                        <Route path="/" element={<Overview />} />
                        <Route path="/profile" element={<Profile />} />
                    </Route>
                </Route>

                <Route element={<GuestRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
