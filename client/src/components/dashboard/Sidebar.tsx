import { useEffect } from 'react'
import { NavLink } from 'react-router'
import { Inbox, List, Mail, Radar, Search, Settings, Tag, Users, X } from 'lucide-react'
import socket from '@/lib/socket.ts'
import useInboxStore from '@/store/inbox.store.ts'

const navItems = [
    { to: '/search-leads', label: 'Search leads', icon: Search },
    { to: '/leads', label: 'Leads', icon: Users },
    { to: '/lead-lists', label: 'Lead lists', icon: List },
    { to: '/inbox', label: 'Inbox', icon: Inbox },
    { to: '/email-templates', label: 'Email templates', icon: Mail },
    { to: '/categories', label: 'Categories', icon: Tag },
    { to: '/settings', label: 'Settings', icon: Settings },
]

type SidebarProps = {
    collapsed: boolean
    mobileOpen: boolean
    onClose: () => void
}

export default function Sidebar({ collapsed, mobileOpen, onClose }: SidebarProps) {
    const unreadCount = useInboxStore((state) => state.unreadCount)
    const fetchUnreadCount = useInboxStore((state) => state.fetchUnreadCount)

    // Load the unread count, and update it whenever new emails arrive
    useEffect(() => {
        fetchUnreadCount()
        socket.on('inbox_updated', fetchUnreadCount)
        return () => {
            socket.off('inbox_updated', fetchUnreadCount)
        }
    }, [fetchUnreadCount])

    return (
        <>
            {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}

            <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-all duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}>
                <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                            <Radar className="size-5" />
                        </div>
                        <span className={`text-lg font-semibold whitespace-nowrap text-slate-900 ${collapsed ? 'lg:hidden' : ''}`}>Lead Agent</span>
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
                            onClick={onClose}
                            title={collapsed ? label : undefined}
                            className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${collapsed ? 'lg:justify-center' : ''} ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <Icon className="size-5 shrink-0" />
                            <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                            {to === '/inbox' && unreadCount > 0 && (
                                <span className={`ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white ${collapsed ? 'lg:absolute lg:top-0.5 lg:right-1 lg:px-1.5' : ''}`}>
                                    {unreadCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </aside>
        </>
    )
}
