import { randomBytes } from 'crypto';
import { isValidObjectId } from 'mongoose';
import Mailbox from '../models/mailbox.model.js';
import redis from '../../config/redis.js';
import { MAILBOXES } from '../mailboxes/index.js';
import { decrypt, encrypt } from '../../utils/helper.js';

// The user has this long to finish signing in with Google or Microsoft
const STATE_TTL_SECONDS = 10 * 60;

const stateKey = (state) => `mailbox_oauth:${state}`;

// Settings shows a message for each result: connected, cancelled, missing_permissions or error
const settingsUrl = (result) => `${process.env.CLIENT_URL}/settings?mailbox=${result}`;

// Only what the client needs for a mailbox, never its tokens
const formatMailbox = (mailbox) => ({
    id: mailbox._id,
    provider: mailbox.provider,
    email: mailbox.email,
    status: mailbox.status,
});

// GET /api/emails/mailboxes — the user's mailboxes, in the order they were added
export const getMailboxes = async (req, res) => {
    try {
        const mailboxes = await Mailbox.find({ user_id: req.user._id }).sort({ createdAt: 1 }).lean();
        return res.status(200).json({ mailboxes: mailboxes.map(formatMailbox) });
    } catch (err) {
        console.error('Loading mailboxes failed:', err);
        return res.status(500).json({ error: 'Could not load your mailboxes right now. Please try again.' });
    }
};

// GET /api/emails/mailboxes/:provider/connect — the sign-in page the client sends the user to
export const connectMailbox = async (req, res) => {
    const { provider } = req.params;
    if (!Object.hasOwn(MAILBOXES, provider)) {
        return res.status(404).json({ error: 'This email provider is not supported.' });
    }

    try {
        // A one-time value that ties the provider's redirect back to this user
        const state = randomBytes(24).toString('hex');
        const url = MAILBOXES[provider].getAuthUrl(state);
        await redis.set(stateKey(state), JSON.stringify({ user_id: req.user._id, provider }), 'EX', STATE_TTL_SECONDS);

        return res.status(200).json({ url });
    } catch (err) {
        console.error('Starting mailbox connection failed:', err);
        return res.status(500).json({ error: 'Could not connect your mailbox right now. Please try again.' });
    }
};

// GET /api/emails/mailboxes/:provider/callback — Google or Microsoft send the browser back here after sign-in
export const mailboxCallback = async (req, res) => {
    const { code, state, error } = req.query;

    try {
        // getdel so the same state can't be used twice
        const saved = typeof state === 'string' && await redis.getdel(stateKey(state));
        const session = saved && JSON.parse(saved);
        if (!session || session.provider !== req.params.provider) {
            return res.redirect(settingsUrl('error'));
        }

        if (error === 'access_denied') return res.redirect(settingsUrl('cancelled'));
        if (error || typeof code !== 'string') {
            console.error('Mailbox sign-in returned an error:', error, req.query.error_description);
            return res.redirect(settingsUrl('error'));
        }

        const account = await MAILBOXES[session.provider].connect(code);

        // Connecting an address again reuses its mailbox, so it keeps everything saved for it
        await Mailbox.findOneAndUpdate(
            { user_id: session.user_id, email: account.email },
            {
                provider: session.provider,
                refresh_token: encrypt(account.refresh_token),
                access_token: encrypt(account.access_token),
                token_expires_at: account.token_expires_at,
                status: 'connected',
            },
            { upsert: true, runValidators: true }
        );

        return res.redirect(settingsUrl('connected'));
    } catch (err) {
        if (err.code === 'missing_permissions') return res.redirect(settingsUrl('missing_permissions'));

        console.error('Connecting mailbox failed:', err);
        return res.redirect(settingsUrl('error'));
    }
};

// POST /api/emails/mailboxes/:id/disconnect — remove the saved tokens but keep the mailbox
export const disconnectMailbox = async (req, res) => {
    try {
        const mailbox = isValidObjectId(req.params.id) && await Mailbox.findOne({ _id: req.params.id, user_id: req.user._id });
        if (!mailbox) {
            return res.status(404).json({ error: 'Mailbox not found.' });
        }

        // Also remove the access on the provider's side; if that fails the mailbox is still disconnected here
        if (mailbox.refresh_token) {
            try {
                await MAILBOXES[mailbox.provider].revoke(decrypt(mailbox.refresh_token));
            } catch (err) {
                console.error('Revoking mailbox access failed:', err);
            }
        }

        mailbox.set({ refresh_token: null, access_token: null, token_expires_at: null, status: 'disconnected' });
        await mailbox.save();

        return res.status(200).json({ mailbox: formatMailbox(mailbox) });
    } catch (err) {
        console.error('Disconnecting mailbox failed:', err);
        return res.status(500).json({ error: 'Could not disconnect the mailbox right now. Please try again.' });
    }
};
