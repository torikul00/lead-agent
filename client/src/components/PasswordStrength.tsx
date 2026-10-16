import { passwordStrength } from 'check-password-strength'
import { Check, X } from 'lucide-react'

const rules = [
    { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
    { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
    { label: 'One lowercase letter', test: (value: string) => /[a-z]/.test(value) },
    { label: 'One number', test: (value: string) => /\d/.test(value) },
    { label: 'One symbol', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

// Indexed by the strength id: 0 Too weak, 1 Weak, 2 Medium, 3 Strong
const barColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-400', 'bg-primary']
const textColors = ['text-red-600', 'text-orange-600', 'text-amber-600', 'text-primary']

export default function PasswordStrength({ password }: { password: string }) {
    const strength = passwordStrength(password)

    return (
        <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
                <div className="grid flex-1 grid-cols-4 gap-1.5">
                    {[0, 1, 2, 3].map((level) => (
                        <div key={level} className={`h-1.5 rounded-full transition ${password && level <= strength.id ? barColors[strength.id] : 'bg-slate-200'}`} />
                    ))}
                </div>
                <span className={`w-16 text-right text-xs font-medium ${password ? textColors[strength.id] : 'text-slate-400'}`}>
                    {password ? strength.value : 'Strength'}
                </span>
            </div>

            <ul className="mt-2.5 grid gap-1.5 text-xs sm:grid-cols-2">
                {rules.map((rule) => {
                    const passed = rule.test(password)
                    return (
                        <li key={rule.label} className={`flex items-center gap-1.5 ${passed ? 'text-primary' : 'text-slate-500'}`}>
                            {passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                            {rule.label}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
