import type { ReactNode } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'

type SubmitButtonProps = {
    loading: boolean
    children: ReactNode
}

export default function SubmitButton({ loading, children }: SubmitButtonProps) {
    return (
        <button type="submit" disabled={loading} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70">
            {children}
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        </button>
    )
}
