import { useEffect, useState } from 'react'
import { LoaderCircle, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import moment from 'moment'
import api from '@/lib/axios.ts'
import getErrorMessage from '@/lib/getErrorMessage.ts'
import FormAlert from '@/components/FormAlert.tsx'
import AddCategoryModal from '@/components/categories/AddCategoryModal.tsx'
import ConfirmationModal from '@/components/ConfirmationModal.tsx'
import type { Category } from '@/types/index.ts'

export default function Categories() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category>()
    const [deletingCategory, setDeletingCategory] = useState<Category>()
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        if (!deletingCategory) return

        setDeleting(true)
        setError('')
        try {
            await api.delete(`/categories/${deletingCategory.id}`)
            setCategories((current) => current.filter((item) => item.id !== deletingCategory.id))
            setDeletingCategory(undefined)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setDeleting(false)
        }
    }

    useEffect(() => {
        api.get('/categories')
            .then(({ data }) => setCategories(data.categories))
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
                    <p className="mt-1 text-sm text-slate-500">Create labels to organize your leads.</p>
                </div>
                <button type="button" onClick={() => { setEditingCategory(undefined); setShowModal(true) }} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90">
                    <Plus className="size-4" />
                    Add category
                </button>
            </div>

            {error && <FormAlert message={error} />}

            {loading && <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16"><LoaderCircle className="size-8 animate-spin text-primary" /></div>}

            {!loading && !error && categories.length === 0 && (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Tag className="size-6" /></div>
                    <p className="mt-4 font-medium text-slate-900">No categories yet</p>
                    <p className="mt-1 text-sm text-slate-500">Add your first category to get started.</p>
                </div>
            )}

            {!loading && categories.length > 0 && (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-120 text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium tracking-wide text-slate-500 uppercase">
                                <tr><th className="px-6 py-3">Name</th><th className="px-4 py-3">Color</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categories.map((category) => (
                                    <tr key={category.id} className="transition hover:bg-slate-50/80">
                                        <td className="px-6 py-4"><span className="inline-flex items-center gap-2 font-medium text-slate-900"><span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</span></td>
                                        <td className="px-4 py-4"><span className="inline-flex items-center gap-2 font-mono text-xs uppercase text-slate-500"><span className="size-4 rounded-full border border-slate-200" style={{ backgroundColor: category.color }} />{category.color}</span></td>
                                        <td className="px-4 py-4 text-slate-600">{moment(category.created_at).format('D MMM YYYY')}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button type="button" onClick={() => { setEditingCategory(category); setShowModal(true) }} aria-label={`Edit ${category.name}`} className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-primary"><Pencil className="size-4" /></button>
                                                <button type="button" onClick={() => setDeletingCategory(category)} aria-label={`Delete ${category.name}`} className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {showModal && <AddCategoryModal category={editingCategory} onClose={() => { setShowModal(false); setEditingCategory(undefined) }} onSaved={(category) => {
                setCategories((current) => {
                    const exists = current.some((item) => item.id === category.id)
                    const next = exists ? current.map((item) => item.id === category.id ? category : item) : [...current, category]
                    return next.sort((a, b) => a.name.localeCompare(b.name))
                })
                setShowModal(false)
                setEditingCategory(undefined)
            }} />}

            {deletingCategory && <ConfirmationModal
                title="Delete category?"
                message={`Are you sure you want to delete "${deletingCategory.name}"? This action cannot be undone.`}
                onClose={() => { if (!deleting) setDeletingCategory(undefined) }}
                onConfirm={() => void handleDelete()}
                loading={deleting}
            />}
        </div>
    )
}
