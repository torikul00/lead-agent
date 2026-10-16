import express from 'express';
import './loadEnv.js'
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { createHttpServer } from './socket.js';
import cors from 'cors';
import cookieParser from 'cookie-parser'
import helmet from 'helmet';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import userRoutes from './src/routes/user.routes.js';

connectDB();

const PORT = process.env.PORT || 8000;
const app = express();

// App Middlewares
// crossOriginResourcePolicy relaxed so /uploads (and any self-hosted asset)
// can still be loaded by the client from a different origin (e.g. the
// separate api.* subdomain in production).
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    exposedHeaders: [
        'Content-Length',
        'Content-Disposition',
        'Accept-Ranges',
        'Content-Range',
    ],
}));

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

app.get("/health", async (req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    let dbConnected = mongoose.connection.readyState === 1;
    if (dbConnected) {
        try {
            await mongoose.connection.db.admin().ping();
        } catch {
            dbConnected = false;
        }
    }
    return res.status(dbConnected ? 200 : 503).json({
        message: "Server is running",
        database: {
            connected: dbConnected,
            state: states[mongoose.connection.readyState] ?? 'unknown',
        },
    });
});


// Routes
app.use('/api', apiLimiter);
app.use('/api/users', userRoutes);

// One HTTP server: REST + Socket.IO on the same port (Render / Netlify-friendly)
const httpServer = createHttpServer(app);
httpServer.listen(PORT, () => {
    console.log(`Server (HTTP + Socket.IO) is running on port ${PORT}`);
});