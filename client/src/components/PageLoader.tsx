import { Radar } from 'lucide-react'

export default function PageLoader() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
            <div className="relative">
                <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/30" />
                <div className="relative flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
                    <Radar className="size-7" />
                </div>
            </div>

            <h1 className="mt-6 text-2xl font-bold text-slate-900">Lead Agent</h1>
            <p className="mt-1 text-sm text-slate-500">Preparing your workspace...</p>
        </div>
    )
}
