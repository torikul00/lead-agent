import { CircleAlert, CircleCheck } from 'lucide-react'

type FormAlertProps = {
    message: string
    type?: 'error' | 'success'
}

export default function FormAlert({ message, type = 'error' }: FormAlertProps) {
    const isError = type === 'error'
    const Icon = isError ? CircleAlert : CircleCheck

    return (
        <div role="alert" className={`mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            {message}
        </div>
    )
}
