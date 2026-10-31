import { useState, type SubmitEvent } from 'react'
import { z } from 'zod'
import { ListPlus, Tag } from 'lucide-react'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import { leadListSchema, type LeadListInput } from '@/schemas/lead.ts'

type LeadListErrors = Partial<Record<keyof LeadListInput, string[]>>

type SaveLeadListModalProps = {
    title: string
    // Follows the number of leads, e.g. "will be saved along with your search."
    description: string
    submitLabel: string
    leadCount: number
    onSave: (name: string) => Promise<unknown>
    onClose: () => void
    onSaved: (name: string) => void
}

export default function SaveLeadListModal({ title, description, submitLabel, leadCount, onSave, onClose, onSaved }: SaveLeadListModalProps) {
    const [errors, setErrors] = useState<LeadListErrors>({})
    const [serverError, setServerError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        const result = leadListSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)))

        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors)
            return
        }

        setErrors({})
        setServerError('')
        setLoading(true)

        try {
            await onSave(result.data.name)
            onSaved(result.data.name)
        } catch (err) {
            setServerError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="save-list-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ListPlus className="size-6" />
                </div>

                <h2 id="save-list-title" className="mt-5 text-2xl font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">{leadCount} {leadCount === 1 ? 'lead' : 'leads'}</span> {description}
                </p>

                <div className="mt-6">
                    {serverError && <FormAlert message={serverError} />}

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <InputField id="name" name="name" label="List name" icon={Tag} placeholder="e.g. Software companies in Stockholm" maxLength={100} autoFocus required error={errors.name?.[0]} />

                        <SubmitButton loading={loading}>{submitLabel}</SubmitButton>
                    </form>
                </div>

                <button type="button" onClick={onClose} disabled={loading} className="mt-4 w-full cursor-pointer text-sm text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed">
                    Cancel
                </button>
            </div>
        </div>
    )
}
