import { Schema, model } from 'mongoose';

// One email thread with a lead; the lead's name and email are copied in so it still shows if the lead list is deleted
const conversationSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    mailbox_id: {
        type: Schema.Types.ObjectId,
        ref: 'Mailbox',
        required: true,
    },
    // Copied from the mailbox, so the Inbox can show the provider icon without a lookup
    provider: {
        type: String,
        enum: ['gmail', 'outlook'],
        required: true,
    },
    lead_id: {
        type: Schema.Types.ObjectId,
        ref: 'Lead',
        required: true,
    },
    lead_name: {
        type: String,
        required: true,
    },
    // Empty when the email went to a company address
    contact_name: {
        type: String,
        default: null,
    },
    lead_email: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    // Gmail thread id or Outlook conversation id, used to match the lead's replies
    thread_id: {
        type: String,
        required: true,
    },
    snippet: {
        type: String,
        default: '',
    },
    last_message_at: {
        type: Date,
        required: true,
    },
    is_read: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true, collection: 'conversations' });

conversationSchema.index({ user_id: 1, last_message_at: -1 });
conversationSchema.index({ mailbox_id: 1, thread_id: 1 });

const Conversation = model('Conversation', conversationSchema);

export default Conversation;
