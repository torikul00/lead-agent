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
    if (!response.ok) {
        // "invalid_grant" means the user revoked access or the login expired
        const code = data.error === 'invalid_grant' ? 'mailbox_disconnected' : undefined;
        throw Object.assign(new Error(`Microsoft request failed with status ${response.status}: ${data.error_description ?? data.error?.message ?? data.error ?? 'no details'}`), { code });
    }
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

    // A new access token; Microsoft usually sends a new refresh token too, which replaces the old one
    async refresh(refreshToken) {
        const tokens = await readResponse(await fetch(`${LOGIN_URL}/token`, {
            method: 'POST',
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: process.env.MICROSOFT_CLIENT_ID,
                client_secret: process.env.MICROSOFT_CLIENT_SECRET,
                grant_type: 'refresh_token',
                scope: SCOPES.join(' '),
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        return {
            refresh_token: tokens.refresh_token ?? refreshToken,
            access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000),
        };
    },

    // Send an email, or a reply when replyTo holds the email being answered; it's a draft first because sending directly doesn't return the conversation id
    async send(accessToken, { to, subject, html, replyTo }) {
        // Immutable ids stay the same when a message moves from Drafts to Sent Items
        const headers = { Authorization: `Bearer ${accessToken}`, Prefer: 'IdType="ImmutableId"' };
        const content = { body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: to } }] };

        // A reply starts from Outlook's own reply draft, which keeps it in the conversation and sets the "RE:" subject
        const draft = await readResponse(await fetch(replyTo ? `${API_URL}/me/messages/${replyTo.message_id}/createReply` : `${API_URL}/me/messages`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(replyTo ? { message: content } : { subject, ...content }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        await readResponse(await fetch(`${API_URL}/me/messages/${draft.id}/send`, {
            method: 'POST',
            headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        return { message_id: draft.id, thread_id: draft.conversationId };
    },

    // Ids and conversations of every email since the given time, sent ones included; drafts are skipped
    async listMessages(accessToken, since) {
        const messages = [];
        let url = `${API_URL}/me/messages?$filter=${encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`)}&$select=id,conversationId,isDraft&$top=100`;

        while (url) {
            const page = await readResponse(await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'IdType="ImmutableId"' },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            }));
            messages.push(...page.value.filter((item) => !item.isDraft).map((item) => ({ id: item.id, thread_id: item.conversationId })));
            url = page['@odata.nextLink'];
        }

        return messages;
    },

    // One email with its sender, subject and body as HTML
    async getMessage(accessToken, id) {
        const message = await readResponse(await fetch(`${API_URL}/me/messages/${id}?$select=id,conversationId,from,toRecipients,subject,body,sentDateTime,receivedDateTime`, {
            headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'IdType="ImmutableId", outlook.body-content-type="html"' },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }));

        return {
            id: message.id,
            thread_id: message.conversationId,
            from: message.from?.emailAddress?.address?.toLowerCase() ?? '',
            to: message.toRecipients?.[0]?.emailAddress?.address?.toLowerCase() ?? '',
            subject: message.subject ?? '',
            body: message.body?.content ?? '',
            sent_at: new Date(message.sentDateTime ?? message.receivedDateTime),
        };
    },

    // Microsoft has no way to revoke one app's token, so deleting it on our side is enough
    async revoke() {},
};
