import { useState, type SubmitEvent } from 'react'
import { z } from 'zod'
import { ListPlus, Tag } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import InputField from '@/components/InputField.tsx'
import FormAlert from '@/components/FormAlert.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'
import { leadListSchema, type LeadListInput, type LeadSearchInput } from '@/schemas/lead.ts'
import type { Lead } from '@/types/index.ts'

type LeadListErrors = Partial<Record<keyof LeadListInput, string[]>>

type SaveLeadListModalProps = {
    leads: Lead[]
    searchQuery: LeadSearchInput
    searchedAt: string
    onClose: () => void
    onSaved: (name: string) => void
}

export default function SaveLeadListModal({ leads, searchQuery, searchedAt, onClose, onSaved }: SaveLeadListModalProps) {
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
            await api.post('/leads/save_list', { name: result.data.name, search_query: searchQuery, searched_at: searchedAt, leads })
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

                <h2 id="save-list-title" className="mt-5 text-2xl font-bold text-slate-900">Save leads list</h2>
                <p className="mt-2 text-sm text-slate-500">
                    <span className="font-medium text-slate-700">{leads.length} {leads.length === 1 ? 'lead' : 'leads'}</span> will be saved along with your search.
                </p>

                <div className="mt-6">
                    {serverError && <FormAlert message={serverError} />}

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <InputField id="name" name="name" label="List name" icon={Tag} placeholder="e.g. Software companies in Stockholm" maxLength={100} autoFocus required error={errors.name?.[0]} />

                        <SubmitButton loading={loading}>Save list</SubmitButton>
                    </form>
                </div>

                <button type="button" onClick={onClose} disabled={loading} className="mt-4 w-full cursor-pointer text-sm text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed">
                    Cancel
                </button>
            </div>
        </div>
    )
}
