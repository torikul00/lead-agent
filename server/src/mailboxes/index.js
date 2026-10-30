import gmail from './gmail.mailbox.js';
import outlook from './outlook.mailbox.js';
import { decrypt, encrypt } from '../../utils/helper.js';

// Mail providers a user can connect, by the name used in the routes and saved on the mailbox. To add one, create its file and register it here.
export const MAILBOXES = { gmail, outlook };

// Access tokens are renewed this long before they expire, so one doesn't run out mid-request
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// A working access token for the mailbox document, renewed and saved when it's about to expire
const getAccessToken = async (mailbox) => {
    if (mailbox.token_expires_at > Date.now() + TOKEN_REFRESH_MARGIN_MS) return decrypt(mailbox.access_token);

    let tokens;
    try {
        tokens = await MAILBOXES[mailbox.provider].refresh(decrypt(mailbox.refresh_token));
    } catch (err) {
        // Access was revoked or the login expired, so the user has to connect the mailbox again
        if (err.code === 'mailbox_disconnected') {
            mailbox.set({ refresh_token: null, access_token: null, token_expires_at: null, status: 'disconnected' });
            await mailbox.save();
        }
        throw err;
    }

    mailbox.set({ refresh_token: encrypt(tokens.refresh_token), access_token: encrypt(tokens.access_token), token_expires_at: tokens.token_expires_at });
    await mailbox.save();
    return tokens.access_token;
};

// Send an email from the mailbox; returns the provider's message and thread ids
export const sendFromMailbox = async (mailbox, email) => MAILBOXES[mailbox.provider].send(await getAccessToken(mailbox), email);
