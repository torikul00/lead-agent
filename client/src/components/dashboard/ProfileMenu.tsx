import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import useAuthStore from '@/store/auth.store.ts'
import Avatar from '@/components/Avatar.tsx'

export default function ProfileMenu() {
    const user = useAuthStore((state) => state.user)
    const logout = useAuthStore((state) => state.logout)
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close the menu when clicking anywhere outside it
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    if (!user) return null

    return (
        <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex cursor-pointer items-center gap-2.5 rounded-xl p-1.5 pr-2.5 transition hover:bg-slate-100">
                <Avatar name={user.full_name} src={user.avatar} />
                <span className="hidden text-sm font-medium text-slate-700 sm:block">{user.full_name}</span>
                <ChevronDown className={`size-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
                        <p className="truncate text-sm text-slate-500">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                        <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">
                            <UserRound className="size-4" />
                            Profile
                        </Link>
                        <button type="button" onClick={logout} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50">
                            <LogOut className="size-4" />
                            Log out
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
