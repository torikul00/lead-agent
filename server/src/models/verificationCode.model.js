import { Schema, model } from 'mongoose';
import crypto from 'crypto';

const verificationCodeSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    code: {
        type: String,
        required: true,
    },
    expires_at: {
        type: Date,
        required: true,
        expires: 0,
    },
    attempts: {
        type: Number,
        default: 0,
    }
}, { timestamps: true, collection: 'verification_codes' });

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

// Create or replace the user's code with a fresh 10-minute one and return the plain code
verificationCodeSchema.statics.createForUser = async function (userId) {
    const code = crypto.randomInt(100000, 1000000).toString();

    await this.findOneAndUpdate(
        { user_id: userId },
        { code: hashCode(code), expires_at: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 },
        { upsert: true }
    );
    return code;
};

verificationCodeSchema.methods.compareCode = function (code) {
    return hashCode(code) === this.code;
};

const VerificationCode = model('VerificationCode', verificationCodeSchema);

export default VerificationCode;
