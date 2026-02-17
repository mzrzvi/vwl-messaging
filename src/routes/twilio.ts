import { Router, Request, Response } from "express";
import { db } from "../lib/db";
import { generateResponse } from "../services/chatbot";
import { sendSMS, confirmationCallTwiML, noShowCallTwiML } from "../services/twilio";

export const twilioRouter = Router();

/**
 * Twilio incoming SMS webhook.
 * When a patient texts back, route to Dr. Patel chatbot.
 */
twilioRouter.post("/webhook/twilio/sms", async (req: Request, res: Response) => {
  try {
    const { From: from, Body: body } = req.body;
    console.log(`[SMS IN] From ${from}: ${body}`);

    // Look up patient by phone
    const patient = await db.patient.findFirst({
      where: { phone: from },
      include: {
        appointments: {
          orderBy: { scheduledAt: "desc" },
          take: 1,
        },
      },
    });

    if (!patient) {
      console.log(`[SMS IN] Unknown sender: ${from}`);
      // Respond with empty TwiML (acknowledge but don't reply)
      return res.type("text/xml").send("<Response></Response>");
    }

    // Determine conversation context based on latest appointment status
    const latestAppointment = patient.appointments[0];
    let context = "pre_consult";
    if (latestAppointment) {
      switch (latestAppointment.status) {
        case "COMPLETED":
          context = "post_consult";
          break;
        case "NO_SHOW":
          context = "no_show_recovery";
          break;
        default:
          context = "pre_consult";
      }
    }

    // Generate Dr. Patel response
    const response = await generateResponse(body, {
      patientId: patient.id,
      conversationContext: context,
    });

    // Send response via Twilio (not TwiML reply, so we control the sender number)
    await sendSMS(from, response);

    // Return empty TwiML to acknowledge
    return res.type("text/xml").send("<Response></Response>");
  } catch (error) {
    console.error("[SMS IN] Error:", error);
    return res.type("text/xml").send("<Response></Response>");
  }
});

/**
 * TwiML endpoint: Morning-of confirmation call.
 * Twilio fetches this when the call connects.
 */
twilioRouter.get("/voice/confirmation-twiml", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.query;
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId as string },
      include: { patient: true },
    });

    if (!appointment) {
      return res.type("text/xml").send("<Response><Say>Goodbye.</Say></Response>");
    }

    const time = appointment.scheduledAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const twiml = confirmationCallTwiML(
      appointment.patient.name.split(" ")[0],
      time
    );
    return res.type("text/xml").send(twiml);
  } catch (error) {
    console.error("[VOICE] Confirmation TwiML error:", error);
    return res.type("text/xml").send("<Response><Say>We're sorry, there was an error. Goodbye.</Say></Response>");
  }
});

/**
 * TwiML endpoint: No-show recovery call.
 */
twilioRouter.get("/voice/no-show-twiml", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.query;
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId as string },
      include: { patient: true },
    });

    if (!appointment) {
      return res.type("text/xml").send("<Response><Say>Goodbye.</Say></Response>");
    }

    const twiml = noShowCallTwiML(appointment.patient.name.split(" ")[0]);
    return res.type("text/xml").send(twiml);
  } catch (error) {
    console.error("[VOICE] No-show TwiML error:", error);
    return res.type("text/xml").send("<Response><Say>We're sorry, there was an error. Goodbye.</Say></Response>");
  }
});

/**
 * Handle voice call keypress responses (confirmation call).
 */
twilioRouter.post("/voice/confirm-response", async (req: Request, res: Response) => {
  const { Digits: digits, CallSid: callSid } = req.body;
  console.log(`[VOICE] Confirm response: ${digits}`);

  if (digits === "1") {
    // Patient confirmed
    return res.type("text/xml").send(`
      <Response>
        <Say voice="Polly.Joanna">Thank you for confirming. We look forward to speaking with you today. Goodbye.</Say>
      </Response>
    `);
  } else if (digits === "2") {
    // Patient wants to reschedule — send them a text with the link
    return res.type("text/xml").send(`
      <Response>
        <Say voice="Polly.Joanna">No problem. We'll send you a text message with a link to reschedule. Goodbye.</Say>
      </Response>
    `);
  }

  return res.type("text/xml").send(`
    <Response>
      <Say voice="Polly.Joanna">We'll send you a text with your appointment details. Goodbye.</Say>
    </Response>
  `);
});

/**
 * Handle voice call keypress responses (no-show call).
 */
twilioRouter.post("/voice/reschedule-response", async (req: Request, res: Response) => {
  const { Digits: digits } = req.body;
  console.log(`[VOICE] Reschedule response: ${digits}`);

  if (digits === "1") {
    return res.type("text/xml").send(`
      <Response>
        <Say voice="Polly.Joanna">We'll text you a link to pick a new time right now. Take care!</Say>
      </Response>
    `);
  } else if (digits === "2") {
    return res.type("text/xml").send(`
      <Response>
        <Say voice="Polly.Joanna">Let me connect you with our team.</Say>
        <Dial>${process.env.ESCALATION_PHONE}</Dial>
      </Response>
    `);
  }

  return res.type("text/xml").send(`
    <Response>
      <Say voice="Polly.Joanna">We'll follow up by text. Take care!</Say>
    </Response>
  `);
});
