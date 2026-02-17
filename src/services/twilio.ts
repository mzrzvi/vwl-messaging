import twilio from "twilio";
import { config } from "../lib/config";

const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

export async function sendSMS(to: string, body: string): Promise<string> {
  const message = await client.messages.create({
    to,
    from: config.TWILIO_PHONE_NUMBER,
    body,
  });
  console.log(`[SMS] Sent to ${to}: ${message.sid}`);
  return message.sid;
}

export async function makeVoiceCall(
  to: string,
  twimlUrl: string
): Promise<string> {
  const call = await client.calls.create({
    to,
    from: config.TWILIO_PHONE_NUMBER,
    url: twimlUrl, // Points to our TwiML endpoint
  });
  console.log(`[VOICE] Called ${to}: ${call.sid}`);
  return call.sid;
}

/**
 * Generate TwiML for the morning-of confirmation call.
 * Called by Twilio when the call connects.
 */
export function confirmationCallTwiML(patientName: string, time: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello ${patientName}. This is Valley Weight Loss calling to confirm your consultation today at ${time}.
  </Say>
  <Gather numDigits="1" action="${config.BASE_URL}/api/voice/confirm-response" method="POST">
    <Say voice="Polly.Joanna">
      Press 1 to confirm your appointment. Press 2 if you need to reschedule.
    </Say>
  </Gather>
  <Say voice="Polly.Joanna">
    We didn't receive a response. We'll send you a text with your appointment details. Goodbye.
  </Say>
</Response>`;
}

/**
 * Generate TwiML for the no-show recovery call.
 */
export function noShowCallTwiML(patientName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello ${patientName}. This is Valley Weight Loss. We noticed you weren't able to make your consultation today, and we wanted to check in.
  </Say>
  <Gather numDigits="1" action="${config.BASE_URL}/api/voice/reschedule-response" method="POST">
    <Say voice="Polly.Joanna">
      We'd love to help you reschedule at a time that works better. Press 1 and we'll send you a link to pick a new time. Press 2 if you'd like to speak with someone from our team.
    </Say>
  </Gather>
  <Say voice="Polly.Joanna">
    No worries. We'll follow up with a text message. Take care.
  </Say>
</Response>`;
}
