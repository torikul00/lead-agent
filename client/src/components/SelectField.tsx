import Select, { type ClassNamesConfig } from 'react-select'
import type { LucideIcon } from 'lucide-react'

export type SelectOption = {
    value: string
    label: string
    icon?: LucideIcon
}

type SelectFieldProps = {
    id: string
    label: string
    options: SelectOption[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    searchable?: boolean
    error?: string
}

const controlClass = (isFocused: boolean, hasError: boolean) => {
    if (isFocused) return 'border-primary ring-4 ring-primary/15'
    if (hasError) return 'border-red-500'
    return 'border-slate-200 hover:border-slate-300'
}

const optionClass = (isSelected: boolean, isFocused: boolean) => {
    if (isSelected) return 'bg-primary/10 font-medium text-primary'
    if (isFocused) return 'bg-slate-100 text-slate-900'
    return 'text-slate-700'
}

// Shared look for every dropdown, so the city search matches the other fields
export const selectClassNames = <Option,>(hasError: boolean): ClassNamesConfig<Option, false> => ({
    control: ({ isFocused }) => `min-h-11 cursor-pointer rounded-xl border bg-white px-3.5 text-sm transition ${controlClass(isFocused, hasError)}`,
    placeholder: () => 'text-slate-400',
    singleValue: () => 'text-slate-900',
    input: () => 'text-slate-900',
    indicatorsContainer: () => 'text-slate-400',
    clearIndicator: () => 'cursor-pointer px-1 transition hover:text-slate-600',
    dropdownIndicator: ({ selectProps }) => `transition ${selectProps.menuIsOpen ? 'rotate-180' : ''}`,
    menu: () => 'z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg',
    option: ({ isSelected, isFocused }) => `cursor-pointer rounded-lg px-3 py-2 text-sm ${optionClass(isSelected, isFocused)}`,
    noOptionsMessage: () => 'px-3 py-2 text-sm text-slate-500',
    loadingMessage: () => 'px-3 py-2 text-sm text-slate-500',
})

export default function SelectField({ id, label, options, value, onChange, placeholder, searchable = false, error }: SelectFieldProps) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
            <Select
                inputId={id}
                unstyled
                options={options}
                value={options.find((option) => option.value === value) ?? null}
                onChange={(option) => onChange(option?.value ?? '')}
                placeholder={placeholder}
                isSearchable={searchable}
                menuPlacement="auto"
                formatOptionLabel={({ label: optionLabel, icon: Icon }) => (
                    <span className="flex items-center gap-2.5">
                        {Icon && <Icon className="size-4 shrink-0 text-primary" />}
                        {optionLabel}
                    </span>
                )}
                classNames={selectClassNames<SelectOption>(!!error)}
            />
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        </div>
    )
}
