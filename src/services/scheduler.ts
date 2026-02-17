import { messageQueue } from "../lib/queue";
import { db } from "../lib/db";
import { MessageType, Channel } from "@prisma/client";

interface BookingData {
  patientId: string;
  appointmentId: string;
  scheduledAt: Date; // The consultation datetime
}

/**
 * Schedule all pre-consultation messages for a new booking.
 * Called when Cal.com fires a booking.created webhook.
 */
export async function schedulePreConsultMessages(booking: BookingData) {
  const now = new Date();
  const consultTime = booking.scheduledAt.getTime();
  const msUntilConsult = consultTime - now.getTime();

  const jobs: Array<{
    type: MessageType;
    channel: Channel;
    delay: number; // ms from now
  }> = [];

  // --- Section 1.1: Immediate messages (send now) ---
  jobs.push(
    { type: "CONFIRMATION_SMS", channel: "SMS", delay: 0 },
    { type: "CHATBOT_INTRO_SMS", channel: "CHATBOT", delay: 3 * 60_000 }, // +3 min
    { type: "CONFIRMATION_EMAIL", channel: "EMAIL", delay: 30_000 } // +30 sec
  );

  // --- Section 1.2: Pre-consult reminder (only if >24hrs away) ---
  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (msUntilConsult > twentyFourHours) {
    // Send 24 hours before consult
    jobs.push({
      type: "PRE_CONSULT_REMINDER_SMS",
      channel: "SMS",
      delay: msUntilConsult - twentyFourHours,
    });
  }

  // --- Section 1.3: Day-of messages ---
  // Morning voice call (9 AM on day of consult)
  const consultDate = new Date(booking.scheduledAt);
  const morningOf = new Date(consultDate);
  morningOf.setHours(9, 0, 0, 0);
  const msUntilMorning = morningOf.getTime() - now.getTime();
  if (msUntilMorning > 0) {
    jobs.push({
      type: "DAY_OF_VOICE_CALL",
      channel: "VOICE",
      delay: msUntilMorning,
    });
  }

  // T-2 hours
  const twoHoursBefore = msUntilConsult - 2 * 60 * 60 * 1000;
  if (twoHoursBefore > 0) {
    jobs.push(
      { type: "TWO_HOUR_REMINDER_SMS", channel: "SMS", delay: twoHoursBefore },
      {
        type: "TWO_HOUR_REMINDER_EMAIL",
        channel: "EMAIL",
        delay: twoHoursBefore,
      }
    );
  }

  // T-10 minutes
  const tenMinBefore = msUntilConsult - 10 * 60 * 1000;
  if (tenMinBefore > 0) {
    jobs.push({
      type: "TEN_MIN_REMINDER_SMS",
      channel: "SMS",
      delay: tenMinBefore,
    });
  }

  // --- Section 3: Schedule no-show cascade (cancelled if consult completes) ---
  // T+35 min
  jobs.push(
    {
      type: "NO_SHOW_INITIAL_SMS",
      channel: "SMS",
      delay: msUntilConsult + 35 * 60_000,
    },
    {
      type: "NO_SHOW_INITIAL_EMAIL",
      channel: "EMAIL",
      delay: msUntilConsult + 35 * 60_000,
    }
  );

  // T+2 hours
  jobs.push({
    type: "NO_SHOW_VOICE_CALL",
    channel: "VOICE",
    delay: msUntilConsult + 2 * 60 * 60 * 1000,
  });

  // T+1 day
  jobs.push(
    {
      type: "NO_SHOW_NEXT_DAY_SMS",
      channel: "SMS",
      delay: msUntilConsult + 24 * 60 * 60 * 1000,
    },
    {
      type: "NO_SHOW_NEXT_DAY_EMAIL",
      channel: "EMAIL",
      delay: msUntilConsult + 24 * 60 * 60 * 1000,
    },
    {
      type: "NO_SHOW_CHATBOT_SMS",
      channel: "CHATBOT",
      delay: msUntilConsult + 24 * 60 * 60 * 1000 + 30 * 60_000, // +30 min after texts
    }
  );

  // Escalation to Alex (T+48 hours)
  jobs.push({
    type: "NO_SHOW_ESCALATION",
    channel: "INTERNAL",
    delay: msUntilConsult + 48 * 60 * 60 * 1000,
  });

  // Create all jobs in BullMQ and track in database
  for (const job of jobs) {
    const scheduledFor = new Date(now.getTime() + job.delay);

    // Create BullMQ delayed job
    const bullJob = await messageQueue.add(
      job.type,
      {
        appointmentId: booking.appointmentId,
        patientId: booking.patientId,
        messageType: job.type,
        channel: job.channel,
      },
      { delay: Math.max(0, job.delay) } // Ensure non-negative delay
    );

    // Track in database
    await db.scheduledMessage.create({
      data: {
        appointmentId: booking.appointmentId,
        type: job.type,
        channel: job.channel,
        scheduledFor,
        jobId: bullJob.id,
      },
    });
  }

  console.log(
    `[SCHEDULER] Queued ${jobs.length} messages for appointment ${booking.appointmentId}`
  );
}

/**
 * Schedule post-consultation messages.
 * Called when appointment status changes to COMPLETED.
 */
export async function schedulePostConsultMessages(
  appointmentId: string,
  patientId: string
) {
  const now = new Date();

  const postConsultJobs = [
    { type: "POST_CONSULT_THANK_YOU_SMS" as MessageType, channel: "SMS" as Channel, delay: 0 },
    { type: "POST_CONSULT_SUMMARY_EMAIL" as MessageType, channel: "EMAIL" as Channel, delay: 60_000 }, // +1 min
    { type: "POST_CONSULT_CHATBOT_SMS" as MessageType, channel: "CHATBOT" as Channel, delay: 15 * 60_000 }, // +15 min
  ];

  for (const job of postConsultJobs) {
    const bullJob = await messageQueue.add(
      job.type,
      { appointmentId, patientId, messageType: job.type, channel: job.channel },
      { delay: job.delay }
    );

    await db.scheduledMessage.create({
      data: {
        appointmentId,
        type: job.type,
        channel: job.channel,
        scheduledFor: new Date(now.getTime() + job.delay),
        jobId: bullJob.id,
      },
    });
  }

  console.log(
    `[SCHEDULER] Queued post-consult messages for appointment ${appointmentId}`
  );
}

/**
 * Cancel all pending no-show messages for an appointment.
 * Called when appointment is marked COMPLETED or CANCELLED.
 */
export async function cancelNoShowMessages(appointmentId: string) {
  const pendingNoShows = await db.scheduledMessage.findMany({
    where: {
      appointmentId,
      status: { in: ["PENDING", "QUEUED"] },
      type: { in: [
        "NO_SHOW_INITIAL_SMS",
        "NO_SHOW_INITIAL_EMAIL",
        "NO_SHOW_VOICE_CALL",
        "NO_SHOW_NEXT_DAY_SMS",
        "NO_SHOW_NEXT_DAY_EMAIL",
        "NO_SHOW_CHATBOT_SMS",
        "NO_SHOW_ESCALATION",
      ]},
    },
  });

  for (const msg of pendingNoShows) {
    // Remove from BullMQ
    if (msg.jobId) {
      const job = await messageQueue.getJob(msg.jobId);
      if (job) await job.remove();
    }

    // Mark cancelled in DB
    await db.scheduledMessage.update({
      where: { id: msg.id },
      data: { status: "CANCELLED" },
    });
  }

  console.log(
    `[SCHEDULER] Cancelled ${pendingNoShows.length} no-show messages for appointment ${appointmentId}`
  );
}

/**
 * Cancel ALL pending messages for an appointment.
 * Called when a booking is cancelled or rescheduled.
 */
export async function cancelAllMessages(appointmentId: string) {
  const pending = await db.scheduledMessage.findMany({
    where: {
      appointmentId,
      status: { in: ["PENDING", "QUEUED"] },
    },
  });

  for (const msg of pending) {
    if (msg.jobId) {
      const job = await messageQueue.getJob(msg.jobId);
      if (job) await job.remove();
    }

    await db.scheduledMessage.update({
      where: { id: msg.id },
      data: { status: "CANCELLED" },
    });
  }

  console.log(
    `[SCHEDULER] Cancelled ALL ${pending.length} messages for appointment ${appointmentId}`
  );
}
