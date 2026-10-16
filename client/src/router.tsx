import { BrowserRouter, Route, Routes } from 'react-router'
import ProtectedRoute from '@/components/ProtectedRoute.tsx'
import GuestRoute from '@/components/GuestRoute.tsx'
import Home from '@/pages/Home.tsx'
import Login from '@/pages/Login.tsx'
import Signup from '@/pages/Signup.tsx'

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Home />} />
                </Route>

                <Route element={<GuestRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />                </Route>
            </Routes>
        </BrowserRouter>
    )
}
