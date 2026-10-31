import type { MailboxProvider } from '@/types/index.ts'

const LOGOS: Record<MailboxProvider, string> = {
    gmail: '/gmail.webp',
    outlook: '/outlook.png',
}

type Props = {
    provider: MailboxProvider
    className?: string
}

export default function MailboxProviderIcon({ provider, className }: Props) {
    return <img src={LOGOS[provider]} alt={provider} className={`object-contain ${className ?? ''}`} />
}
