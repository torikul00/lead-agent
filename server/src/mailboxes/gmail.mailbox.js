const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API_URL = 'https://gmail.googleapis.com/gmail/v1';
const REQUEST_TIMEOUT_MS = 15000;

// Read access to find lead replies, send access to email leads
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

const redirectUri = () => `${process.env.SERVER_URL}/api/emails/mailboxes/gmail/callback`;

// Google's JSON reply; the reason of a failed request only goes to the server log
const readResponse = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Google request failed with status ${response.status}: ${data.error_description ?? data.error?.message ?? data.error ?? 'no details'}`);
    return data;
};

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

    // Remove the app's access on Google's side as well
    async revoke(refreshToken) {
        await readResponse(await fetch(REVOKE_URL, {
            method: 'POST',
            body: new URLSearchParams({ token: refreshToken }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));
    },
};
