import { Schema, model } from 'mongoose';

// A Gmail or Outlook mailbox a user connected to send lead emails from; its tokens are saved encrypted
const mailboxSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    provider: {
        type: String,
        enum: ['gmail', 'outlook'],
        required: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    refresh_token: {
        type: String,
        default: null,
    },
    access_token: {
        type: String,
        default: null,
    },
    token_expires_at: {
        type: Date,
        default: null,
    },
    // "disconnected" keeps the mailbox (and later its conversations) without its tokens, until it's connected again
    status: {
        type: String,
        enum: ['connected', 'disconnected'],
        default: 'connected',
    },
}, { timestamps: true, collection: 'mailboxes' });

mailboxSchema.index({ user_id: 1, email: 1 }, { unique: true });

const Mailbox = model('Mailbox', mailboxSchema);

export default Mailbox;
