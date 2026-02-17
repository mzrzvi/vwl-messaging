import { Worker, Job } from "bullmq";
import { redis } from "../lib/queue";
import { db } from "../lib/db";
import { MessageType } from "@prisma/client";
import { sendSMS, makeVoiceCall, confirmationCallTwiML, noShowCallTwiML } from "../services/twilio";
import { sendEmail } from "../services/email";
import { generateProactiveMessage } from "../services/chatbot";
import { config } from "../lib/config";
import * as templates from "../templates/messages";

interface MessageJobData {
  appointmentId: string;
  patientId: string;
  messageType: MessageType;
  channel: string;
}

/**
 * Process a single queued message.
 */
async function processMessage(job: Job<MessageJobData>) {
  const { appointmentId, patientId, messageType } = job.data;

  // Check if appointment status has changed (e.g. cancelled)
  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true },
  });

  if (!appointment) {
    console.log(`[WORKER] Appointment ${appointmentId} not found, skipping`);
    return;
  }

  // Skip no-show messages if consult was completed
  if (
    messageType.startsWith("NO_SHOW_") &&
    appointment.status === "COMPLETED"
  ) {
    console.log(
      `[WORKER] Skipping ${messageType} — consult already completed`
    );
    await markMessage(job.id!, "CANCELLED");
    return;
  }

  // Skip all messages if appointment was cancelled
  if (appointment.status === "CANCELLED") {
    console.log(
      `[WORKER] Skipping ${messageType} — appointment cancelled`
    );
    await markMessage(job.id!, "CANCELLED");
    return;
  }

  const patient = appointment.patient;
  const templateData: templates.TemplateData = {
    patientName: patient.name.split(" ")[0], // First name
    consultDate: formatDate(appointment.scheduledAt),
    consultTime: formatTime(appointment.scheduledAt),
    consultLink: "https://cal.com/TODO/meeting-link", // TODO: store from Cal.com payload
    rescheduleLink: "https://cal.com/TODO/reschedule", // TODO: store from Cal.com payload
  };

  try {
    await markMessage(job.id!, "QUEUED");

    switch (messageType) {
      // --- Section 1.1: Immediate ---
      case "CONFIRMATION_SMS":
        await sendSMS(patient.phone, templates.confirmationSMS(templateData));
        break;

      case "CHATBOT_INTRO_SMS":
        await sendSMS(patient.phone, templates.chatbotIntroSMS(templateData));
        break;

      case "CONFIRMATION_EMAIL": {
        const email = templates.confirmationEmail(templateData);
        await sendEmail({ to: patient.email, ...email });
        break;
      }

      // --- Section 1.2: Pre-consult reminder ---
      case "PRE_CONSULT_REMINDER_SMS":
        await sendSMS(patient.phone, templates.preConsultReminderSMS(templateData));
        break;

      // --- Section 1.3: Day-of ---
      case "DAY_OF_VOICE_CALL":
        await makeVoiceCall(
          patient.phone,
          `${config.BASE_URL}/api/voice/confirmation-twiml?appointmentId=${appointmentId}`
        );
        break;

      case "TWO_HOUR_REMINDER_SMS":
        await sendSMS(patient.phone, templates.twoHourReminderSMS(templateData));
        break;

      case "TWO_HOUR_REMINDER_EMAIL": {
        const email = templates.twoHourReminderEmail(templateData);
        await sendEmail({ to: patient.email, ...email });
        break;
      }

      case "TEN_MIN_REMINDER_SMS":
        await sendSMS(patient.phone, templates.tenMinReminderSMS(templateData));
        break;

      // --- Section 2.1: Post-consult ---
      case "POST_CONSULT_THANK_YOU_SMS":
        await sendSMS(patient.phone, templates.postConsultThankYouSMS(templateData));
        break;

      case "POST_CONSULT_SUMMARY_EMAIL": {
        const email = templates.postConsultSummaryEmail(templateData);
        await sendEmail({ to: patient.email, ...email });
        break;
      }

      case "POST_CONSULT_CHATBOT_SMS": {
        const msg = await generateProactiveMessage(
          { patientId, conversationContext: "post_consult" },
          "The patient just finished their consultation. Ask if they have any follow-up questions and gently encourage them toward enrollment."
        );
        await sendSMS(patient.phone, msg);
        break;
      }

      // --- Section 3: No-show recovery ---
      case "NO_SHOW_INITIAL_SMS":
        // Also mark appointment as no-show
        await db.appointment.update({
          where: { id: appointmentId },
          data: { status: "NO_SHOW" },
        });
        await sendSMS(patient.phone, templates.noShowInitialSMS(templateData));
        break;

      case "NO_SHOW_INITIAL_EMAIL": {
        const email = templates.noShowInitialEmail(templateData);
        await sendEmail({ to: patient.email, ...email });
        break;
      }

      case "NO_SHOW_VOICE_CALL":
        await makeVoiceCall(
          patient.phone,
          `${config.BASE_URL}/api/voice/no-show-twiml?appointmentId=${appointmentId}`
        );
        break;

      case "NO_SHOW_NEXT_DAY_SMS":
        await sendSMS(patient.phone, templates.noShowNextDaySMS(templateData));
        break;

      case "NO_SHOW_NEXT_DAY_EMAIL": {
        const email = templates.noShowNextDayEmail(templateData);
        await sendEmail({ to: patient.email, ...email });
        break;
      }

      case "NO_SHOW_CHATBOT_SMS": {
        const msg = await generateProactiveMessage(
          { patientId, conversationContext: "no_show_recovery" },
          "The patient missed their consultation yesterday. Reach out warmly, ask if everything is okay, and offer to help reschedule."
        );
        await sendSMS(patient.phone, msg);
        break;
      }

      case "NO_SHOW_ESCALATION":
        // Notify Alex
        await sendSMS(
          config.ESCALATION_PHONE,
          `[VWL ESCALATION] Patient ${patient.name} (${patient.phone}) has not responded after no-show recovery. Manual outreach needed.`
        );
        await sendEmail({
          to: config.ESCALATION_EMAIL,
          subject: `Patient Escalation: ${patient.name}`,
          html: `<p>Patient <strong>${patient.name}</strong> (${patient.phone}, ${patient.email}) missed their consultation and has not responded to automated recovery messages.</p><p>Please reach out manually.</p>`,
        });
        break;

      default:
        console.warn(`[WORKER] Unknown message type: ${messageType}`);
    }

    await markMessage(job.id!, "SENT");
    console.log(`[WORKER] ✅ ${messageType} sent for appointment ${appointmentId}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[WORKER] ❌ ${messageType} failed: ${errMsg}`);
    await markMessage(job.id!, "FAILED", errMsg);
    throw error; // Re-throw so BullMQ retries
  }
}

// --- Helpers ---

async function markMessage(
  jobId: string,
  status: "QUEUED" | "SENT" | "FAILED" | "CANCELLED",
  error?: string
) {
  await db.scheduledMessage.updateMany({
    where: { jobId },
    data: {
      status,
      ...(status === "SENT" ? { sentAt: new Date() } : {}),
      ...(error ? { error } : {}),
    },
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// --- Create and export the worker ---

export function createWorker() {
  const worker = new Worker("messages", processMessage, {
    connection: redis,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.log(`[WORKER] Job ${job.id} completed: ${job.name}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[WORKER] Job ${job?.id} failed: ${err.message}`);
  });

  console.log("[WORKER] Message worker started");
  return worker;
}
