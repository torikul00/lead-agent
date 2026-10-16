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
            <div style="background: #f1f5f9; padding: 32px 16px; font-family: Arial, Helvetica, sans-serif;">
                <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; color: #0f172a;">
                    <p style="margin: 0 0 24px; font-size: 18px; font-weight: bold; color: #047857;">LeadAgent</p>
                    <h1 style="margin: 0 0 8px; font-size: 22px;">Verify your email</h1>
                    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #475569;">Enter this code to finish creating your account.</p>
                    <div style="padding: 16px; border-radius: 12px; background: #ecfdf5; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #047857;">${code}</div>
                    <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.5; color: #64748b;">This code expires in 10 minutes. If you didn't sign up for LeadAgent, you can safely ignore this email.</p>
                </div>
            </div>
        `,
    });
