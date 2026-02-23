/**
 * Email Service using Resend
 */

import { Resend } from 'resend';

// Initialize Resend client
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return null;
  }
  return new Resend(apiKey);
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const resend = getResendClient();
  
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'discuss.watch <digest@discuss.watch>';

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      tags: options.tags,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Send digest email to a user
 */
export async function sendDigestEmail(
  userEmail: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  digestType: 'daily' | 'weekly'
): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendEmail({
    to: userEmail,
    subject,
    html: htmlContent,
    text: textContent,
    tags: [
      { name: 'type', value: 'digest' },
      { name: 'frequency', value: digestType },
    ],
  });
}

/**
 * Send a test digest email
 */
export async function sendTestDigestEmail(
  email: string,
  htmlContent: string,
  textContent: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail({
    to: email,
    subject: '👁️‍🗨️ [TEST] discuss.watch Weekly Digest',
    html: htmlContent,
    text: textContent,
    tags: [
      { name: 'type', value: 'test' },
    ],
  });
}
