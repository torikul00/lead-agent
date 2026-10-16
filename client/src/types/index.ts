export type User = {
    id: string
    full_name: string
    email: string
    phone: string
    avatar: string | null
    is_email_verified: boolean
}

export type AuthState = {
    user: User | null
    loading: boolean
    setUser: (user: User | null) => void
    fetchUser: () => Promise<void>
    logout: () => Promise<void>
}
