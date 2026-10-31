import nodemailer from 'nodemailer';
import { escapeHtml } from '../../utils/helper.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API_URL = 'https://gmail.googleapis.com/gmail/v1';
const REQUEST_TIMEOUT_MS = 15000;

// Read access to find lead replies, send access to email leads
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

const redirectUri = () => `${process.env.SERVER_URL}/api/emails/mailboxes/gmail/callback`;

// Builds the raw email the Gmail API expects, without sending it
const mailBuilder = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });

// Google's JSON reply; the reason of a failed request only goes to the server log
const readResponse = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        // "invalid_grant" means the user revoked access or the login expired
        const code = data.error === 'invalid_grant' ? 'mailbox_disconnected' : undefined;
        throw Object.assign(new Error(`Google request failed with status ${response.status}: ${data.error_description ?? data.error?.message ?? data.error ?? 'no details'}`), { code });
    }
    return data;
};

// "Jane Doe <jane@acme.se>" -> "jane@acme.se"
const toAddress = (value) => (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase();

// The first part of this type that has content, searching inside multipart sections
const findPart = (part, mimeType) => {
    if (part.mimeType === mimeType && part.body?.data) return part;
    for (const child of part.parts ?? []) {
        const found = findPart(child, mimeType);
        if (found) return found;
    }
    return null;
};

const decodePart = (part) => Buffer.from(part.body.data, 'base64url').toString('utf8');

export default {
    name: 'gmail',

    // Google's sign-in page; "offline" with "consent" makes Google return a refresh token every time
    getAuthUrl(state) {
        if (!process.env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not set');

        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri(),
            response_type: 'code',
            scope: SCOPES.join(' '),
            access_type: 'offline',
            prompt: 'consent',
            state,
        });
        return `${AUTH_URL}?${params}`;
    },

    // Swap the code from Google's redirect for tokens, then look up the mailbox address
    async connect(code) {
        const tokens = await readResponse(await fetch(TOKEN_URL, {
            method: 'POST',
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri(),
                grant_type: 'authorization_code',
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        // Google lets the user untick permissions; without both we can't send or find replies
        const granted = tokens.scope?.split(' ') ?? [];
        if (!SCOPES.every((scope) => granted.includes(scope))) {
            throw Object.assign(new Error('Not every Gmail permission was granted'), { code: 'missing_permissions' });
        }
        if (!tokens.refresh_token) throw new Error('Google returned no refresh token');

        const profile = await readResponse(await fetch(`${API_URL}/users/me/profile`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        return {
            email: profile.emailAddress.toLowerCase(),
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        };
    },

    // A new access token; Google keeps the same refresh token
    async refresh(refreshToken) {
        const tokens = await readResponse(await fetch(TOKEN_URL, {
            method: 'POST',
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                grant_type: 'refresh_token',
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        return {
            refresh_token: tokens.refresh_token ?? refreshToken,
            access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        };
    },

    // Send an email, or a reply when replyTo holds the thread and the email being answered; Gmail fills in the From address
    async send(accessToken, { to, subject, html, replyTo }) {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const email = { to, subject, html };

        // Gmail keeps a reply in the thread only when it points to the answered email's Message-ID
        if (replyTo) {
            const original = await readResponse(await fetch(`${API_URL}/users/me/messages/${replyTo.message_id}?format=metadata`, {
                headers,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            }));
            const header = (name) => original.payload.headers.find((item) => item.name.toLowerCase() === name)?.value;
            email.inReplyTo = header('message-id');
            email.references = [header('references'), header('message-id')].filter(Boolean).join(' ');
        }

        const { message, messageId } = await mailBuilder.sendMail(email);

        const sent = await readResponse(await fetch(`${API_URL}/users/me/messages/send`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: message.toString('base64url'), threadId: replyTo?.thread_id }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        return { message_id: sent.id, thread_id: sent.threadId, internet_message_id: messageId };
    },

    // Ids and threads of every email since the given time, sent ones included
    async listMessages(accessToken, since) {
        const messages = [];
        let pageToken = '';

        do {
            const params = new URLSearchParams({ q: `after:${Math.floor(since.getTime() / 1000)}`, maxResults: '100' });
            if (pageToken) params.set('pageToken', pageToken);

            const page = await readResponse(await fetch(`${API_URL}/users/me/messages?${params}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            }));
            messages.push(...(page.messages ?? []).map((item) => ({ id: item.id, thread_id: item.threadId })));
            pageToken = page.nextPageToken;
        } while (pageToken);

        return messages;
    },

    // One email with its sender, subject and body; a plain-text email is wrapped as simple HTML
    async getMessage(accessToken, id) {
        const message = await readResponse(await fetch(`${API_URL}/users/me/messages/${id}?format=full`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        const header = (name) => message.payload.headers.find((item) => item.name.toLowerCase() === name)?.value ?? '';
        const html = findPart(message.payload, 'text/html');
        const text = findPart(message.payload, 'text/plain');

        return {
            id: message.id,
            thread_id: message.threadId,
            internet_message_id: header('message-id'),
            // A reply is also matched by these, in case Gmail ever puts it in a different threadId than the email it's answering
            in_reply_to_ids: `${header('references')} ${header('in-reply-to')}`.match(/<[^<>]+>/g) ?? [],
            from: toAddress(header('from')),
            to: toAddress(header('to')),
            subject: header('subject'),
            body: html ? decodePart(html) : `<div style="white-space:pre-wrap">${escapeHtml(text ? decodePart(text) : '')}</div>`,
            sent_at: new Date(Number(message.internalDate)),
        };
    },

    // Remove the app's access on Google's side as well
    async revoke(refreshToken) {
        await readResponse(await fetch(REVOKE_URL, {
            method: 'POST',
            body: new URLSearchParams({ token: refreshToken }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));
    },
};
