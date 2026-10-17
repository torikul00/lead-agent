import { io } from 'socket.io-client'

// Same server as the API (without /api); the auth store connects it after login
const socket = io(new URL(import.meta.env.VITE_API_URL).origin, {
    autoConnect: false,
    withCredentials: true,
})

export default socket
