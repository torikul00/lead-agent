import { create } from 'zustand'
import api from '@/lib/axios.ts'
import type { InboxState } from '@/types/index.ts'

// Conversations with an unread reply, shown as a badge on the sidebar's Inbox link
const useInboxStore = create<InboxState>()((set) => ({
    unreadCount: 0,

    fetchUnreadCount: async () => {
        try {
            const { data } = await api.get('/emails/unread_count')
            set({ unreadCount: data.count })
        } catch {
            // The badge keeps its last count until the next update
        }
    },
}))

export default useInboxStore
