import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import User from '../src/models/user.model.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../config/authCookie.js';

// Verify the token, then load the user fresh from the DB. We don't trust the
// role (or anything else) baked into the token payload — only the id is used,
// and the authoritative user record is read from the database on every request.
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

        // A deactivated account loses access immediately (strict check so legacy
        // records without the field stay active).
        if (user.is_active === false) {
            res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
            return res.status(403).json({ error: 'Your account has been deactivated' });
        }

        // Trust the database record, not the token payload.
        req.user = user;
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

export default authMiddleware;
