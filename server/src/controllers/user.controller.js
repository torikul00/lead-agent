import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import VerificationCode from '../models/verificationCode.model.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../../config/authCookie.js';
import { sendVerificationEmail } from '../../utils/sendEmail.js';
import { deleteFromR2, keyFromPublicUrl } from '../../utils/r2.js';

const MAX_VERIFICATION_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

// Build a signed JWT. authMiddleware reads `decoded.payload`, so keep it nested.
const signToken = (user) => jwt.sign({ payload: { id: user._id } }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Set the httpOnly auth cookie on the response.
const setAuthCookie = (res, user) => {
    res.cookie(AUTH_COOKIE_NAME, signToken(user), getAuthCookieOptions());
};

// Strip sensitive fields before sending a user back to the client.
const sanitizeUser = (user) => ({
    id: user._id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    is_email_verified: user.is_email_verified,
});

// Create a fresh verification code for the user and email it.
const sendNewCode = async (user) => {
    const code = await VerificationCode.createForUser(user._id);
    await sendVerificationEmail(user.email, code);
};

// POST /api/users/register — create the user, log them in, and email a verification code.
export const registerUser = async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered Try login instead' });
        }

        // password is hashed by the model's pre-save hook
        const user = await User.create({ full_name, email, phone, password });
        setAuthCookie(res, user);

        try {
            await sendNewCode(user);
        } catch {
            // The user can still request a new code from the verify popup
        }

        return res.status(201).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/users/verify_email — check the 6-digit code for the logged-in user.
export const verifyEmail = async (req, res) => {
    try {
        if (req.user.is_email_verified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        const verification = await VerificationCode.findOne({ user_id: req.user._id });
        if (!verification || verification.expires_at < new Date()) {
            return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
        }
        if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
            return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
        }

        if (!verification.compareCode(req.body.code)) {
            verification.attempts += 1;
            await verification.save();
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        const user = await User.findByIdAndUpdate(req.user._id, { is_email_verified: true }, { new: true });
        await verification.deleteOne();

        return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/users/resend_verification — send a fresh code to the logged-in user.
export const resendVerificationCode = async (req, res) => {
    try {
        if (req.user.is_email_verified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        const existing = await VerificationCode.findOne({ user_id: req.user._id });
        if (existing) {
            const retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - (Date.now() - existing.last_sent_at) / 1000);
            if (retryAfter > 0) {
                return res.status(429).json({
                    error: `Please wait ${retryAfter}s before requesting a new code.`,
                    retry_after: retryAfter,
                });
            }
        }

        await sendNewCode(req.user);
        return res.status(200).json({ message: 'A new verification code has been sent to your email.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/users/login
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Deactivated accounts can't sign in.
        if (user.is_active === false) {
            return res.status(403).json({
                error: 'Your account has been deactivated. Please contact support.',
            });
        }

        // Unverified users can log in; the client shows the verify popup until they verify
        setAuthCookie(res, user);
        return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// GET /api/users/me — current logged-in user (authMiddleware loads it fresh from the DB).
export const getMe = (req, res) => {
    return res.status(200).json({ user: sanitizeUser(req.user) });
};

// PATCH /api/users/me — update the logged-in user's profile.
// Accepts multipart/form-data: full_name, phone, and an optional `avatar` file.
export const updateMe = async (req, res) => {
    try {
        const updates = { ...req.body };
        if (req.file) {
            updates.avatar = req.file.url;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true,
        });

        // Remove the old photo from R2 once the new one is saved
        if (req.file && req.user.avatar) {
            await deleteFromR2(keyFromPublicUrl(req.user.avatar));
        }

        return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// PATCH /api/users/me/password — change the logged-in user's password.
export const changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        // req.user is loaded without the password, so fetch it again
        const user = await User.findById(req.user._id);
        if (!(await user.comparePassword(current_password))) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        user.password = new_password; // hashed by the model's pre-save hook
        await user.save();

        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/users/logout
export const logoutUser = (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
    return res.status(200).json({ message: 'Logged out' });
};
