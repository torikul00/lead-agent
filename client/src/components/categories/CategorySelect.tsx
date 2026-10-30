import Select from 'react-select'
import type { Category } from '@/types/index.ts'

type CategoryOption = {
    value: string
    label: string
    color: string
}

const classNames = {
    control: ({ isFocused }: { isFocused: boolean }) => `min-h-7 min-w-48 cursor-pointer rounded-lg border bg-white px-2 text-xs transition ${isFocused ? 'border-primary ring-4 ring-primary/15' : 'border-slate-200 hover:border-slate-300'}`,
    valueContainer: () => 'px-1',
    singleValue: () => 'text-slate-700',
    input: () => 'text-slate-700',
    indicatorsContainer: () => 'text-slate-400',
    dropdownIndicator: () => 'p-1',
    menu: () => 'z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg',
    option: ({ isSelected, isFocused }: { isSelected: boolean; isFocused: boolean }) => `cursor-pointer rounded-md px-2 py-1.5 text-xs ${isSelected ? 'bg-primary/10 font-medium text-primary' : isFocused ? 'bg-slate-100 text-slate-900' : 'text-slate-700'}`,
}

type CategorySelectProps = {
    categories: Category[]
    value: string | null
    onChange: (categoryId: string | null) => void
    label: string
}

// A lead's category, with each category's color shown as a dot
export default function CategorySelect({ categories, value, onChange, label }: CategorySelectProps) {
    const options: CategoryOption[] = [
        { value: '', label: 'Uncategorized', color: '#94a3b8' },
        ...categories.map((category) => ({ value: category.id, label: category.name, color: category.color })),
    ]

    return (
        <Select<CategoryOption>
            unstyled
            options={options}
            value={options.find((option) => option.value === (value ?? '')) ?? options[0]}
            onChange={(option) => onChange(option?.value || null)}
            isSearchable={false}
            menuPlacement="auto"
            classNames={classNames}
            formatOptionLabel={(option) => (
                <span className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                    {option.label}
                </span>
            )}
            aria-label={label}
        />
    )
}
