/**
 * All message templates for VWL patient messaging.
 *
 * NOTE: These are starter templates. Replace with client-approved copy.
 * Keep SMS under 160 chars where possible (or accept multi-segment).
 */

export interface TemplateData {
  patientName: string;
  consultDate: string; // e.g. "Tuesday, March 4th"
  consultTime: string; // e.g. "2:00 PM"
  consultLink: string; // Video call link
  rescheduleLink: string; // Cal.com reschedule URL
}

// =============================================================================
// Section 1.1 — Immediately After Scheduling
// =============================================================================

export function confirmationSMS(d: TemplateData): string {
  return `Hi ${d.patientName}! Your consultation with Valley Weight Loss is confirmed for ${d.consultDate} at ${d.consultTime}. This is a physician-led medical consultation — we're here to help you reach your goals. Questions? Just reply to this text.`;
}

export function chatbotIntroSMS(d: TemplateData): string {
  return `Hi ${d.patientName}, this is Dr. Patel's assistant at Valley Weight Loss. I'm available 24/7 to answer any questions before your consultation — medications, pricing, what to expect, anything. Just text me here!`;
}

export function confirmationEmail(d: TemplateData): { subject: string; html: string } {
  return {
    subject: `Your Valley Weight Loss Consultation — ${d.consultDate} at ${d.consultTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5282;">Your Consultation is Confirmed</h2>
        <p>Hi ${d.patientName},</p>
        <p>Thank you for scheduling your consultation with Valley Weight Loss. Here are your details:</p>
        
        <div style="background: #f7fafc; border-left: 4px solid #2c5282; padding: 16px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Date:</strong> ${d.consultDate}</p>
          <p style="margin: 0;"><strong>Time:</strong> ${d.consultTime}</p>
          <p style="margin: 0;"><strong>Link:</strong> <a href="${d.consultLink}">Join Consultation</a></p>
        </div>

        <h3>What to Expect</h3>
        <p>Your consultation is a one-on-one conversation with our medical team. We'll discuss your health history, weight loss goals, and whether our physician-led program is right for you. There's no pressure and no obligation.</p>

        <h3>How We're Different</h3>
        <p>Valley Weight Loss is not an app or a telehealth mill. You'll work directly with Dr. Patel and our medical team — real physicians providing personalized, FDA-approved treatment plans.</p>

        <p>Need to reschedule? <a href="${d.rescheduleLink}">Click here</a> or reply to our text.</p>

        <p>We look forward to speaking with you!</p>
        <p>— The Valley Weight Loss Team</p>
      </div>
    `,
  };
}

// =============================================================================
// Section 1.2 — Pre-Consult Reminder (24-48hrs before)
// =============================================================================

export function preConsultReminderSMS(d: TemplateData): string {
  return `Friendly reminder: your Valley Weight Loss consultation is tomorrow, ${d.consultDate} at ${d.consultTime}. If you need to change the time, just text us here and we'll take care of it.`;
}

// =============================================================================
// Section 1.3 — Day-of Consult
// =============================================================================

export function twoHourReminderSMS(d: TemplateData): string {
  return `Your Valley Weight Loss consultation is in 2 hours at ${d.consultTime}. Here's your link to join: ${d.consultLink}`;
}

export function twoHourReminderEmail(d: TemplateData): { subject: string; html: string } {
  return {
    subject: `Your consultation is in 2 hours — ${d.consultTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5282;">Your Consultation is Coming Up</h2>
        <p>Hi ${d.patientName},</p>
        <p>Just a reminder — your consultation is at <strong>${d.consultTime}</strong> today.</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${d.consultLink}" style="background: #2c5282; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 16px;">Join Your Consultation</a>
        </div>

        <p>No special preparation needed — just be ready to have an open conversation about your goals.</p>
        <p>— Valley Weight Loss</p>
      </div>
    `,
  };
}

export function tenMinReminderSMS(d: TemplateData): string {
  return `Starting soon! Your consultation is in 10 minutes. Join here: ${d.consultLink}`;
}

// =============================================================================
// Section 2.1 — Post-Consult Follow-Up
// =============================================================================

export function postConsultThankYouSMS(d: TemplateData): string {
  return `Thanks for meeting with us today, ${d.patientName}! Dr. Patel and our team are here to support your next steps. We're sending over a summary email with everything we discussed. Questions? Just text us.`;
}

export function postConsultSummaryEmail(d: TemplateData): { subject: string; html: string } {
  return {
    subject: `Your Consultation Summary — Valley Weight Loss`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5282;">Thanks for Your Consultation</h2>
        <p>Hi ${d.patientName},</p>
        <p>It was great speaking with you today. Here's a recap of what we discussed:</p>

        <div style="background: #f7fafc; border-left: 4px solid #2c5282; padding: 16px; margin: 20px 0;">
          <p><strong>Your Recommended Plan</strong></p>
          <p>Based on your consultation, our team will follow up with specific plan recommendations tailored to your goals.</p>
        </div>

        <h3>Next Steps</h3>
        <p>When you're ready to move forward, simply reply to this email or text us. We offer flexible payment options and our team is here to answer any remaining questions.</p>

        <h3>Have Questions?</h3>
        <p>Dr. Patel's assistant is available by text anytime. Just reply to the text message we sent earlier.</p>

        <p>We're excited to support your journey!</p>
        <p>— Valley Weight Loss</p>
      </div>
    `,
  };
}

// =============================================================================
// Section 3 — No-Show Recovery
// =============================================================================

export function noShowInitialSMS(d: TemplateData): string {
  return `Hi ${d.patientName}, we missed you at your consultation today. No worries at all — life happens! When you're ready, here's a link to reschedule at a time that works: ${d.rescheduleLink}`;
}

export function noShowInitialEmail(d: TemplateData): { subject: string; html: string } {
  return {
    subject: `We missed you — let's reschedule your consultation`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5282;">We Missed You Today</h2>
        <p>Hi ${d.patientName},</p>
        <p>We noticed you weren't able to make your consultation, and that's completely okay. We'd love to get you rescheduled at a time that works better.</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${d.rescheduleLink}" style="background: #2c5282; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 16px;">Reschedule Now</a>
        </div>

        <p>Your consultation is free and takes about 15 minutes. We're here whenever you're ready.</p>
        <p>— Valley Weight Loss</p>
      </div>
    `,
  };
}

export function noShowNextDaySMS(d: TemplateData): string {
  return `Hi ${d.patientName}, just checking in from Valley Weight Loss. Your free consultation is still available whenever you're ready. Reschedule here: ${d.rescheduleLink} — or just text us if you have any questions first.`;
}

export function noShowNextDayEmail(d: TemplateData): { subject: string; html: string } {
  return {
    subject: `Your consultation is still available — Valley Weight Loss`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c5282;">Still Thinking It Over?</h2>
        <p>Hi ${d.patientName},</p>
        <p>We wanted to follow up and let you know your free consultation is still available. If you had questions or concerns, Dr. Patel's assistant can help — just reply to our text.</p>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${d.rescheduleLink}" style="background: #2c5282; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-size: 16px;">Reschedule Your Consultation</a>
        </div>

        <p>— Valley Weight Loss</p>
      </div>
    `,
  };
}
