import { Schema, model } from 'mongoose';

// One email in a conversation, sent to the lead or received from them
const emailMessageSchema = new Schema({
    conversation_id: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    direction: {
        type: String,
        enum: ['sent', 'received'],
        required: true,
    },
    // Gmail or Outlook message id
    provider_message_id: {
        type: String,
        required: true,
    },
    // Emails that arrive can leave any of these empty
    from: {
        type: String,
        default: '',
    },
    to: {
        type: String,
        default: '',
    },
    subject: {
        type: String,
        default: '',
    },
    // HTML
    body: {
        type: String,
        default: '',
    },
    sent_at: {
        type: Date,
        required: true,
    },
}, { timestamps: true, collection: 'email_messages' });

emailMessageSchema.index({ conversation_id: 1, sent_at: 1 });
emailMessageSchema.index({ conversation_id: 1, provider_message_id: 1 }, { unique: true });

const EmailMessage = model('EmailMessage', emailMessageSchema);

export default EmailMessage;
