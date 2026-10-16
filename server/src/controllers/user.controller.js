import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import User from '../models/user.model.js';
import VerificationCode from '../models/verificationCode.model.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from '../../config/authCookie.js';
import { sendVerificationEmail } from '../../utils/sendEmail.js';

const MAX_VERIFICATION_ATTEMPTS = 5;

// Build a signed JWT. authMiddleware reads `decoded.payload`, so keep it nested.
const signToken = (user) =>
    jwt.sign(
        { payload: { id: user._id, role: user.role } },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

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
    role: user.role,
    is_email_verified: user.is_email_verified,
});

// POST /api/user/register — create user and email them a verification code.
export const registerUser = async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        if (!full_name || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // password is hashed by the model's pre-save hook
        const user = await User.create({ full_name, email, phone, password });

        try {
            const code = await VerificationCode.createForUser(user._id);
            await sendVerificationEmail(user.email, code);
        } catch {
            // Remove the account so the user can register again
            await User.deleteOne({ _id: user._id });
            await VerificationCode.deleteOne({ user_id: user._id });
            return res.status(500).json({ error: 'Could not send verification email. Please try again.' });
        }

        return res.status(201).json({
            message: 'Account created. Check your email for the verification code.',
            email: user.email,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/users/verify_email — check the 6-digit code and log the user in.
export const verifyEmail = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        if (user.is_email_verified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        const verification = await VerificationCode.findOne({ user_id: user._id });
        if (!verification || verification.expires_at < new Date()) {
            return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
        }
        if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
            return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
        }

        if (!verification.compareCode(code)) {
            verification.attempts += 1;
            await verification.save();
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        user.is_email_verified = true;
        await user.save();
        await verification.deleteOne();

        setAuthCookie(res, user);
        return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/users/resend_verification — send a fresh code to an unverified user.
export const resendVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'Account not found' });
        }
        if (user.is_email_verified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        const code = await VerificationCode.createForUser(user._id);
        await sendVerificationEmail(user.email, code);

        return res.status(200).json({ message: 'A new verification code has been sent to your email.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/user/login
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Deactivated accounts can't sign in.
        if (user.is_active === false) {
            return res.status(403).json({
                error: 'Your account has been deactivated. Please contact support.',
            });
        }

        if (!user.is_email_verified) {
            return res.status(403).json({
                error: 'Please verify your email before logging in.',
                needs_verification: true,
            });
        }

        setAuthCookie(res, user);
        return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// GET /api/user/me — current logged-in user (protected).
export const getMe = async (req, res) => {
    try {
        // A stale cookie (e.g. an old integer id) won't cast to an ObjectId.
        // Clear it and report unauthenticated instead of throwing a 500.
        if (!isValidObjectId(req.user.id)) {
            res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
            return res.status(401).json({ error: 'Invalid session' });
        }

        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// PATCH /api/user/me — update the logged-in user's profile.
// Accepts multipart/form-data: full_name, phone, and an optional `avatar` file.
export const updateMe = async (req, res) => {
    try {
        if (!isValidObjectId(req.user.id)) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        const updates = {};
        const { full_name, phone } = req.body;

        if (typeof full_name === 'string' && full_name.trim()) {
            updates.full_name = full_name.trim();
        }
        if (typeof phone === 'string' && phone.trim()) {
            updates.phone = phone.trim();
        }
        if (req.file) {
            updates.avatar = req.file.url;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }

        const user = await User.findByIdAndUpdate(req.user.id, updates, {
            new: true,
            runValidators: true,
        }).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json({ user: sanitizeUser(user) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// PATCH /api/user/me/password — change the logged-in user's password.
export const changePassword = async (req, res) => {
    try {
        if (!isValidObjectId(req.user.id)) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res
                .status(400)
                .json({ error: 'Current and new password are required' });
        }
        if (new_password.length < 6) {
            return res
                .status(400)
                .json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await user.comparePassword(current_password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        user.password = new_password; // hashed by the model's pre-save hook
        await user.save();

        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// POST /api/user/logout
export const logoutUser = (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());
    return res.status(200).json({ message: 'Logged out' });
};

// Shape a student row (with its enrollment count) for the admin list.
const sanitizeStudent = (user, enrollmentsCount = 0) => ({
    id: user._id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    is_active: user.is_active,
    enrollments_count: enrollmentsCount,
    createdAt: user.createdAt,
});