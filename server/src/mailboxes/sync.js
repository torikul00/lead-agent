import Mailbox from '../models/mailbox.model.js';
import Conversation from '../models/conversation.model.js';
import EmailMessage from '../models/emailMessage.model.js';
import { MAILBOXES, getAccessToken } from './index.js';
import { notifyInboxUpdated } from '../../socket.js';
import { toSnippet } from '../../utils/helper.js';
import { MAILBOX_SYNC_MINUTES } from '../../utils/constants.js';

// Each check also looks a few minutes before the last one, so an email arriving mid-check isn't missed; saved emails are skipped
const LOOK_BACK_MS = 5 * 60 * 1000;

// Checks running right now by mailbox id, so a refresh joins a running check instead of starting a second one
const runningChecks = new Map();

// Save the new emails in the mailbox's lead conversations; anything not from the mailbox itself is the lead's reply
const checkMailbox = async (mailbox) => {
    const conversations = await Conversation.find({ mailbox_id: mailbox._id });
    if (!conversations.length) return;

    // The first check goes back to the oldest conversation
    const startedAt = new Date();
    const since = mailbox.last_synced_at
        ? new Date(mailbox.last_synced_at.getTime() - LOOK_BACK_MS)
        : new Date(Math.min(...conversations.map((conversation) => conversation.createdAt.getTime())));

    const conversationIds = conversations.map((conversation) => conversation._id);
    const byThread = new Map(conversations.map((conversation) => [conversation.thread_id, conversation]));
    const byId = new Map(conversations.map((conversation) => [String(conversation._id), conversation]));

    // A reply's References/In-Reply-To header points at one of these; used when the provider puts the reply in a different thread than the email it's answering
    const sentMessages = await EmailMessage.find({ conversation_id: { $in: conversationIds }, direction: 'sent', internet_message_id: { $ne: null } }).lean();
    const byMessageId = new Map(sentMessages.map((message) => [message.internet_message_id, byId.get(String(message.conversation_id))]));

    const provider = MAILBOXES[mailbox.provider];
    const accessToken = await getAccessToken(mailbox);
    const changed = new Set();

    for (const { id, thread_id: threadId } of await provider.listMessages(accessToken, since)) {
        if (await EmailMessage.exists({ conversation_id: { $in: conversationIds }, provider_message_id: id })) continue;

        let conversation = byThread.get(threadId);
        let email = null;

        if (!conversation) {
            email = await provider.getMessage(accessToken, id);
            conversation = email.in_reply_to_ids.map((messageId) => byMessageId.get(messageId)).find(Boolean);
        }
        if (!conversation) continue;

        email ??= await provider.getMessage(accessToken, id);
        const direction = email.from === mailbox.email ? 'sent' : 'received';

        await EmailMessage.create({
            conversation_id: conversation._id,
            user_id: conversation.user_id,
            direction,
            provider_message_id: id,
            internet_message_id: email.internet_message_id || null,
            from: email.from,
            to: email.to,
            subject: email.subject,
            body: email.body,
            sent_at: email.sent_at,
        });

        if (email.sent_at > conversation.last_message_at) conversation.set({ last_message_at: email.sent_at, snippet: toSnippet(email.body) });
        if (direction === 'received') conversation.is_read = false;
        await conversation.save();
        changed.add(String(conversation._id));
    }

    mailbox.last_synced_at = startedAt;
    await mailbox.save();

    if (changed.size) notifyInboxUpdated(mailbox.user_id, [...changed]);
};

// Check one mailbox, or join the check that's already running for it
export const syncMailbox = (mailbox) => {
    const key = String(mailbox._id);
    if (!runningChecks.has(key)) {
        runningChecks.set(key, checkMailbox(mailbox).finally(() => runningChecks.delete(key)));
    }
    return runningChecks.get(key);
};

// A failing mailbox is only logged, so it doesn't stop the others
const syncAndLog = (mailbox) => syncMailbox(mailbox).catch((err) => console.error(`Checking mailbox ${mailbox.email} failed:`, err));

// Check all of a user's connected mailboxes, for the Inbox refresh button
export const syncUserMailboxes = async (userId) => {
    const mailboxes = await Mailbox.find({ user_id: userId, status: 'connected' });
    await Promise.all(mailboxes.map(syncAndLog));
};

// Check every connected mailbox now, then every few minutes
export const startMailboxSync = () => {
    const syncAll = async () => {
        try {
            const mailboxes = await Mailbox.find({ status: 'connected' });
            for (const mailbox of mailboxes) await syncAndLog(mailbox);
        } catch (err) {
            console.error('Checking mailboxes failed:', err);
        }
    };

    syncAll();
    setInterval(syncAll, MAILBOX_SYNC_MINUTES * 60 * 1000);
};
