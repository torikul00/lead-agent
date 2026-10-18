import { useRef } from 'react'
import AsyncSelect from 'react-select/async'
import api from '@/lib/axios.ts'
import { selectClassNames } from '@/components/SelectField.tsx'
import type { City } from '@/types/index.ts'

type CityOption = {
    value: string
    label: string
    city: City
}

type CityFieldProps = {
    country: string
    value: City | null
    onChange: (city: City | null) => void
}

const toOption = (city: City): CityOption => ({ value: `${city.name}|${city.region}`, label: city.name, city })

export default function CityField({ country, value, onChange }: CityFieldProps) {
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Waits until typing pauses, so every keystroke doesn't call the API
    const loadOptions = (text: string) => new Promise<CityOption[]>((resolve) => {
        clearTimeout(timer.current)
        if (text.trim().length < 2) return resolve([])

        timer.current = setTimeout(async () => {
            try {
                const { data } = await api.post('/leads/find_cities', { country, text: text.trim() })
                resolve(data.cities.map(toOption))
            } catch {
                resolve([])
            }
        }, 300)
    })

    return (
        <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-slate-700">
                City <span className="font-normal text-slate-400">(optional)</span>
            </label>
            {/* A new country starts a fresh search, without the last country's cached suggestions */}
            <AsyncSelect
                key={country}
                inputId="city"
                unstyled
                cacheOptions
                isClearable
                loadOptions={loadOptions}
                value={value ? toOption(value) : null}
                onChange={(option) => onChange(option?.city ?? null)}
                placeholder="Any city"
                noOptionsMessage={({ inputValue }) => (inputValue.trim().length < 2 ? 'Type at least 2 letters' : 'No cities found')}
                loadingMessage={() => 'Searching cities...'}
                formatOptionLabel={(option, { context }) => (context === 'value' ? option.city.name : (
                    <span className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate">{option.city.name}</span>
                        {option.city.region && <span className="shrink-0 text-[11px] text-slate-400">{option.city.region}</span>}
                    </span>
                ))}
                menuPlacement="auto"
                classNames={selectClassNames<CityOption>(false)}
            />
        </div>
    )
}
