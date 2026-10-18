import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME } from './config/authCookie.js';
import redis from './config/redis.js';

let io = null;

// Redis hash of socketId -> userId, one field per connection so each open tab counts
const ONLINE_USERS_KEY = 'online_users';

export function getIO() {
    if (!io) {
        throw new Error('Socket.IO is not attached. ensure attachSocketIO() runs before listen() in index.js.');
    }
    return io;
}

// All open connections from Redis, for routes / debugging
export async function getConnectedUsers() {
    const users = await redis.hgetall(ONLINE_USERS_KEY);
    return Object.entries(users).map(([socketId, userId]) => ({ socketId, userId }));
}

async function pushConnected({ socketId, userId }) {
    try {
        await redis.hset(ONLINE_USERS_KEY, { [socketId]: userId });
    } catch (err) {
        console.error(`[socket] failed to add online user: ${err.message}`);
    }
}

async function removeBySocketId(socketId) {
    try {
        await redis.hdel(ONLINE_USERS_KEY, socketId);
    } catch (err) {
        console.error(`[socket] failed to remove online user: ${err.message}`);
    }
}

function userRoom(userId) {
    return `user:${userId}`;
}

export function notifyUserSessionInvalidated(userId, reason = 'password_changed') {
    if (!io) return;
    io.to(userRoom(userId)).emit('session_invalidated', { reason });
}

export function createHttpServer(app) {
    const httpServer = createServer(app);
    attachSocketIO(httpServer);
    return httpServer;
}

export function attachSocketIO(httpServer) {
    if (io) {
        return io;
    }

    io = new Server(httpServer, {
        path: '/socket.io',
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true,
        },
    });

    // A restart drops every connection without running disconnect, so start with an empty list
    redis.del(ONLINE_USERS_KEY).catch((err) => console.error(`[socket] failed to clear online users: ${err.message}`));

    io.use((socket, next) => {
        const raw = socket.handshake.headers.cookie;
        const cookies = parseCookie(raw || '');
        const token = cookies[AUTH_COOKIE_NAME];
        if (!token) {
            return next(new Error('Unauthorized'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.data.user = decoded.payload;
            next();
        } catch {
            return next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        const { id } = socket.data.user;
        socket.join(userRoom(id));
        const added = pushConnected({ socketId: socket.id, userId: id });

        socket.on('disconnect', async (reason) => {
            // Wait for the add so a quick disconnect can't leave a stale online user
            await added;
            await removeBySocketId(socket.id);
        });
    });

    return io;
}
