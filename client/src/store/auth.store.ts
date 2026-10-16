import { create } from 'zustand'
import api from '@/lib/axios.ts'
import type { AuthState } from '@/types/index.ts'

const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    loading: true,

    setUser: (user) => set({ user }),

    // Restore the session from the auth cookie
    fetchUser: async () => {
        try {
            const { data } = await api.get('/users/me')
            set({ user: data.user })
        } catch {
            set({ user: null })
        } finally {
            set({ loading: false })
        }
    },

    logout: async () => {
        await api.post('/users/logout')
        set({ user: null })
    },
}))

// Restore the session as soon as the app loads
useAuthStore.getState().fetchUser()

export default useAuthStore
