import { AlertTriangle, X } from 'lucide-react'

type ConfirmationModalProps = {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    loading?: boolean
    onConfirm: () => void
    onClose: () => void
}

export default function ConfirmationModal({
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    loading = false,
    onConfirm,
    onClose,
}: ConfirmationModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex items-start justify-between">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                        <AlertTriangle className="size-6" />
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} aria-label="Close" className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed">
                        <X className="size-5" />
                    </button>
                </div>

                <h2 id="confirmation-modal-title" className="mt-5 text-2xl font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={onClose} disabled={loading} className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                        {cancelLabel}
                    </button>
                    <button type="button" onClick={onConfirm} disabled={loading} className="cursor-pointer rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {loading ? 'Deleting...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
