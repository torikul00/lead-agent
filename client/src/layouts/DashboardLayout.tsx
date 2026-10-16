import { useState } from 'react'
import { Outlet } from 'react-router'
import Sidebar from '@/components/dashboard/Sidebar.tsx'
import Header from '@/components/dashboard/Header.tsx'

export default function DashboardLayout() {
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <div className="min-h-screen bg-slate-50">
            <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

            <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
                <Header collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} onOpenSidebar={() => setMobileOpen(true)} />
                <main className="p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
