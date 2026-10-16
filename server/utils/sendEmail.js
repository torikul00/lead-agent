import { Resend } from 'resend';

// Send an email through Resend. Throws a safe error if sending fails.
export const sendEmail = async ({ to, subject, html, text }) => {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        text,
    });

    if (error) {
        console.error('Resend error:', error);
        throw new Error('Failed to send email');
    }
    return data;
};

export const sendVerificationEmail = (to, code) =>
    sendEmail({
        to,
        subject: 'Your LeadAgent verification code',
        text: `Your LeadAgent verification code is ${code}. It expires in 10 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0f172a;">
                <h2 style="margin: 0 0 16px; color: #047857;">Verify your email</h2>
                <p style="margin: 0 0 24px;">Use the code below to verify your LeadAgent account.</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #ecfdf5; border-radius: 12px; color: #047857;">${code}</div>
                <p style="margin: 24px 0 0; font-size: 14px; color: #64748b;">This code expires in 10 minutes. If you didn't create an account, you can ignore this email.</p>
            </div>
        `,
    });
