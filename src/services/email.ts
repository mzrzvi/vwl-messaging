import sgMail from "@sendgrid/mail";
import { config } from "../lib/config";

sgMail.setApiKey(config.SENDGRID_API_KEY);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plain text fallback
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  await sgMail.send({
    to: options.to,
    from: {
      email: config.SENDGRID_FROM_EMAIL,
      name: config.SENDGRID_FROM_NAME,
    },
    subject: options.subject,
    html: options.html,
    text: options.text || stripHtml(options.html),
  });
  console.log(`[EMAIL] Sent to ${options.to}: ${options.subject}`);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
