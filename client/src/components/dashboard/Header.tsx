import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import ProfileMenu from '@/components/dashboard/ProfileMenu.tsx'

type HeaderProps = {
    collapsed: boolean
    onToggleCollapse: () => void
    onOpenSidebar: () => void
}

export default function Header({ collapsed, onToggleCollapse, onOpenSidebar }: HeaderProps) {
    const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

    return (
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
            <div>
                <button type="button" onClick={onOpenSidebar} aria-label="Open sidebar" className="flex cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden">
                    <Menu className="size-5" />
                </button>
                <button type="button" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:flex">
                    <CollapseIcon className="size-5" />
                </button>
            </div>

            <ProfileMenu />
        </header>
    )
}
