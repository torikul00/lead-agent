import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import User from '../src/models/user.model.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../config/authCookie.js';

// Routes an unverified user still needs so the client can show the verify popup
const UNVERIFIED_ROUTES = ['GET /api/users/me', 'POST /api/users/verify_email', 'POST /api/users/resend_verification'];

// Verify the token, then load the user fresh from the DB.
const authMiddleware = async (req, res, next) => {
    const token = req.cookies[AUTH_COOKIE_NAME];
    if (!token) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Token is not valid' });
    }

    try {
        const userId = decoded?.payload?.id;

        // A stale cookie (e.g. an old integer id) won't cast to an ObjectId —
        // clear it and report unauthenticated instead of throwing a 500.
        if (!isValidObjectId(userId)) {
            res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
            return res.status(401).json({ error: 'Invalid session' });
        }

        const user = await User.findById(userId).select('-password');
        if (!user) {
            res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
            return res.status(401).json({ error: 'User no longer exists' });
        }
        if (user.is_active === false) {
            res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
            return res.status(403).json({ error: 'Your account has been deactivated' });
        }

        if (!user.is_email_verified && !UNVERIFIED_ROUTES.includes(`${req.method} ${req.baseUrl}${req.path}`)) {
            return res.status(403).json({ error: 'Please verify your email first.', needs_verification: true });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

export default authMiddleware;
