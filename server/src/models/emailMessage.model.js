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
    from: {
        type: String,
        required: true,
    },
    to: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    // HTML
    body: {
        type: String,
        required: true,
    },
    sent_at: {
        type: Date,
        required: true,
    },
}, { timestamps: true, collection: 'email_messages' });

emailMessageSchema.index({ conversation_id: 1, sent_at: 1 });

const EmailMessage = model('EmailMessage', emailMessageSchema);

export default EmailMessage;
