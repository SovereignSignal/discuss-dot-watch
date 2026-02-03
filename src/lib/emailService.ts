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

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Gov Watch <digest@gov-watch.app>';

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
 * Send batch digest emails
 */
export async function sendBatchDigestEmails(
  recipients: Array<{
    email: string;
    html: string;
    text: string;
    subject: string;
  }>,
  digestType: 'daily' | 'weekly'
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Resend has a batch API, but for simplicity we'll send one at a time
  // with a small delay to respect rate limits
  for (const recipient of recipients) {
    try {
      const result = await sendDigestEmail(
        recipient.email,
        recipient.subject,
        recipient.html,
        recipient.text,
        digestType
      );

      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`${recipient.email}: ${result.error}`);
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.failed++;
      results.errors.push(`${recipient.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results;
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
    subject: '🗳️ [TEST] Gov Watch Weekly Digest',
    html: htmlContent,
    text: textContent,
    tags: [
      { name: 'type', value: 'test' },
    ],
  });
}
