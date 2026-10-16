import type { ReactNode } from 'react'
import { Radar, Search, ShieldCheck, Sparkles } from 'lucide-react'

const features = [
    { icon: Search, text: 'Discover companies by country and industry' },
    { icon: ShieldCheck, text: 'Verify domains and MX records' },
    { icon: Sparkles, text: 'Qualify leads with AI match scores' },
]

type AuthLayoutProps = {
    title: string
    subtitle: string
    wide?: boolean
    children: ReactNode
}

export default function AuthLayout({ title, subtitle, wide, children }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen bg-slate-50">
            <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
                <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10" />
                <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" />

                <div className="relative flex items-center gap-2.5 text-lg font-semibold">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                        <Radar className="size-5" />
                    </div>
                    LeadAgent
                </div>

                <div className="relative max-w-md">
                    <h2 className="text-4xl leading-tight font-bold">Find and qualify your next customers with AI</h2>
                    <p className="mt-4 text-white/75">Search, verify, and score companies in one simple workflow.</p>
                    <ul className="mt-10 space-y-4">
                        {features.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
                                    <Icon className="size-4" />
                                </div>
                                <span className="text-sm text-white/90">{text}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-sm text-white/60">© {new Date().getFullYear()} LeadAgent</p>
            </aside>

            <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
                <div className={`w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-10 ${wide ? 'max-w-xl' : 'max-w-md'}`}>
                    <div className="mb-10 flex items-center gap-2.5 text-lg font-semibold text-slate-900 lg:hidden">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
                            <Radar className="size-5" />
                        </div>
                        LeadAgent
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
                    <p className="mt-2 text-slate-500">{subtitle}</p>
                    <div className="mt-8">{children}</div>
                </div>
            </main>
        </div>
    )
}
