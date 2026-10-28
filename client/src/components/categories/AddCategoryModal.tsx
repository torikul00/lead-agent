import { useState, type SubmitEvent } from 'react'
import { Palette, Tag, X } from 'lucide-react'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import InputField from '@/components/InputField.tsx'
import SubmitButton from '@/components/SubmitButton.tsx'

type AddCategoryModalProps = {
    category?: { id: string; name: string; slug: string; color: string; created_at: string }
    onClose: () => void
    onSaved: (category: { id: string; name: string; slug: string; color: string; created_at: string }) => void
}

export default function AddCategoryModal({ category, onClose, onSaved }: AddCategoryModalProps) {
    const [name, setName] = useState(category?.name ?? '')
    const [color, setColor] = useState(category?.color ?? '#2563eb')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!name.trim()) {
            setError('Category name is required.')
            return
        }

        setError('')
        setLoading(true)
        try {
            const { data } = category
                ? await api.patch(`/categories/${category.id}`, { name, color })
                : await api.post('/categories', { name, color })
            onSaved(data.category)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="category-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="flex items-start justify-between">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Tag className="size-6" />
                    </div>
                    <button type="button" onClick={onClose} disabled={loading} aria-label="Close" className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed">
                        <X className="size-5" />
                    </button>
                </div>

                <h2 id="category-title" className="mt-5 text-2xl font-bold text-slate-900">{category ? 'Edit category' : 'Add category'}</h2>
                <p className="mt-1 text-sm text-slate-500">{category ? 'Update the category name or color.' : 'Create a category to organize your leads later.'}</p>

                <div className="mt-6">
                    {error && <FormAlert message={error} />}
                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <InputField id="category-name" label="Name" icon={Tag} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Hot prospects" maxLength={100} autoFocus required />

                        <div>
                            <label htmlFor="category-color" className="mb-1.5 block text-sm font-medium text-slate-700">Color</label>
                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                                <Palette className="size-5 text-slate-400" />
                                <input id="category-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="size-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                                <span className="font-mono text-sm uppercase text-slate-600">{color}</span>
                            </div>
                        </div>

                        <SubmitButton loading={loading}>{category ? 'Save changes' : 'Add category'}</SubmitButton>
                    </form>
                </div>

                <button type="button" onClick={onClose} disabled={loading} className="mt-4 w-full cursor-pointer text-sm text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed">Cancel</button>
            </div>
        </div>
    )
}
