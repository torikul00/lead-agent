// "common" lets work, school and personal Microsoft accounts sign in
const LOGIN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const API_URL = 'https://graph.microsoft.com/v1.0';
const REQUEST_TIMEOUT_MS = 15000;

// offline_access gives a refresh token; mail access is for emailing leads and finding their replies
const SCOPES = ['offline_access', 'User.Read', 'Mail.ReadWrite', 'Mail.Send'];

const redirectUri = () => `${process.env.SERVER_URL}/api/emails/mailboxes/outlook/callback`;

// Microsoft's JSON reply; the reason of a failed request only goes to the server log
const readResponse = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Microsoft request failed with status ${response.status}: ${data.error_description ?? data.error?.message ?? data.error ?? 'no details'}`);
    return data;
};

export default {
    name: 'outlook',

    // Microsoft's sign-in page; "select_account" lets the user pick the mailbox even when signed in to another one
    getAuthUrl(state) {
        if (!process.env.MICROSOFT_CLIENT_ID) throw new Error('MICROSOFT_CLIENT_ID is not set');

        const params = new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID,
            redirect_uri: redirectUri(),
            response_type: 'code',
            response_mode: 'query',
            scope: SCOPES.join(' '),
            prompt: 'select_account',
            state,
        });
        return `${LOGIN_URL}/authorize?${params}`;
    },

    // Swap the code from Microsoft's redirect for tokens, then look up the mailbox address
    async connect(code) {
        const tokens = await readResponse(await fetch(`${LOGIN_URL}/token`, {
            method: 'POST',
            body: new URLSearchParams({
                code,
                client_id: process.env.MICROSOFT_CLIENT_ID,
                client_secret: process.env.MICROSOFT_CLIENT_SECRET,
                redirect_uri: redirectUri(),
                grant_type: 'authorization_code',
                scope: SCOPES.join(' '),
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));
        if (!tokens.refresh_token) throw new Error('Microsoft returned no refresh token');

        const profile = await readResponse(await fetch(`${API_URL}/me?$select=mail,userPrincipalName`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        // Work accounts have "mail"; personal Outlook accounts may only have their sign-in address
        return {
            email: (profile.mail ?? profile.userPrincipalName).toLowerCase(),
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        };
    },

    // Microsoft has no way to revoke one app's token, so deleting it on our side is enough
    async revoke() {},
};
