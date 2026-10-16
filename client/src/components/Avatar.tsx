type AvatarProps = {
    name: string
    src: string | null
    size?: 'sm' | 'lg'
}

export default function Avatar({ name, src, size = 'sm' }: AvatarProps) {
    const sizeClass = size === 'lg' ? 'size-16 text-xl' : 'size-9 text-sm'
    const initials = name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()

    if (src) {
        return <img src={src} alt={name} className={`${sizeClass} shrink-0 rounded-full object-cover`} />
    }

    return (
        <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary`}>
            {initials}
        </div>
    )
}
