import { NavLink } from 'react-router'
import { LayoutDashboard, Radar, Search, X } from 'lucide-react'

const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/search-leads', label: 'Search leads', icon: Search },
]

type SidebarProps = {
    collapsed: boolean
    mobileOpen: boolean
    onClose: () => void
}

export default function Sidebar({ collapsed, mobileOpen, onClose }: SidebarProps) {
    return (
        <>
            {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}

            <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-all duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}>
                <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                            <Radar className="size-5" />
                        </div>
                        <span className={`text-lg font-semibold whitespace-nowrap text-slate-900 ${collapsed ? 'lg:hidden' : ''}`}>LeadAgent</span>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close sidebar" className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 lg:hidden">
                        <X className="size-5" />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 p-3">
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end
                            onClick={onClose}
                            title={collapsed ? label : undefined}
                            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${collapsed ? 'lg:justify-center' : ''} ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <Icon className="size-5 shrink-0" />
                            <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>
        </>
    )
}
