import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string
    icon: LucideIcon
    error?: string
}

export default function InputField({ label, icon: Icon, error, id, type = 'text', ...props }: InputFieldProps) {
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'

    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
            <div className="group relative">
                <Icon className={`pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 transition ${error ? 'text-red-500' : 'text-slate-400 group-focus-within:text-primary'}`} />
                <input
                    id={id}
                    type={isPassword && showPassword ? 'text' : type}
                    aria-invalid={!!error}
                    className={`w-full rounded-xl border bg-white py-3 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${error ? 'border-red-500 focus:ring-red-500/15' : 'border-slate-200 focus:border-primary focus:ring-primary/15'} ${isPassword ? 'pr-11' : 'pr-4'}`}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute top-1/2 right-3.5 -translate-y-1/2 cursor-pointer text-slate-400 transition hover:text-slate-600"
                    >
                        {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                )}
            </div>
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        </div>
    )
}
