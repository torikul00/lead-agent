import { useState } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import api from '@/lib/axios.ts'

// Sample criteria until the search form is built
const samplePayload = {
    country: 'United States',
    industry: 'Technology',
    company_size: '51-200',
    keywords: ['Software Development', 'Artificial Intelligence', 'Cloud Computing'],
}

export default function SearchLeads() {
    const [loading, setLoading] = useState(false)

    const handleGenerate = async () => {
        setLoading(true)
        try {
            const { data } = await api.post('/leads/generate_leads', samplePayload)
            console.log(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Search leads</h1>

            <button type="button" onClick={handleGenerate} disabled={loading} className="mt-6 flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70">
                {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {loading ? 'Generating...' : 'Generate leads'}
            </button>
        </div>
    )
}
