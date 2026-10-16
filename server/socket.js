import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME } from './config/authCookie.js';

let io = null;

/** In-memory: one row per connection (multi-tab = multiple rows for same user). @type {ConnectedUser[]} */
let connectedUsers = [];

/**
 * @typedef {{ socketId: string, userId: number, email: string }} ConnectedUser
 */

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO is not attached. ensure attachSocketIO() runs before listen() in index.js.');
  }
  return io;
}

/** Snapshot for routes / debugging; do not mutate the array from outside. */
export function getConnectedUsers() {
  return connectedUsers.map((c) => ({ ...c }));
}

function pushConnected(entry) {
  connectedUsers = [...connectedUsers, entry];
}

function removeBySocketId(socketId) {
  connectedUsers = connectedUsers.filter((c) => c.socketId !== socketId);
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
    pushConnected({ socketId: socket.id, userId: id });

    socket.on('disconnect', (reason) => {
      removeBySocketId(socket.id);
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}
