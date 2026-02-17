import { Router, Request, Response } from "express";
import { db } from "../lib/db";
import {
  schedulePreConsultMessages,
  cancelAllMessages,
} from "../services/scheduler";

export const calcomRouter = Router();

/**
 * Cal.com webhook handler.
 * Receives: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
 *
 * Cal.com payload shape (key fields):
 * {
 *   triggerEvent: "BOOKING_CREATED",
 *   payload: {
 *     uid: "booking-uid",
 *     title: "Weight Loss Consultation",
 *     startTime: "2026-03-04T14:00:00Z",
 *     endTime: "2026-03-04T14:30:00Z",
 *     attendees: [{ name: "John Doe", email: "john@email.com", phone: "+15551234567" }],
 *     metadata: { videoCallUrl: "https://..." },
 *     rescheduleUrl: "https://cal.com/reschedule/...",
 *   }
 * }
 */
calcomRouter.post("/webhook/calcom", async (req: Request, res: Response) => {
  try {
    const { triggerEvent, payload } = req.body;
    console.log(`[CALCOM] Received event: ${triggerEvent}`);

    // TODO: Verify webhook signature if CALCOM_WEBHOOK_SECRET is set
    // const signature = req.headers['x-cal-signature-256'];

    switch (triggerEvent) {
      case "BOOKING_CREATED": {
        const attendee = payload.attendees?.[0];
        if (!attendee) {
          console.error("[CALCOM] No attendee in booking payload");
          return res.status(400).json({ error: "No attendee found" });
        }

        // Upsert patient
        const patient = await db.patient.upsert({
          where: { email: attendee.email },
          create: {
            name: attendee.name,
            email: attendee.email,
            phone: attendee.phone || attendee.phoneNumber || "",
          },
          update: {
            name: attendee.name,
            phone: attendee.phone || attendee.phoneNumber || undefined,
          },
        });

        // Create appointment
        const appointment = await db.appointment.create({
          data: {
            patientId: patient.id,
            calComBookingId: payload.uid,
            scheduledAt: new Date(payload.startTime),
            status: "SCHEDULED",
          },
        });

        // Schedule all messages
        await schedulePreConsultMessages({
          patientId: patient.id,
          appointmentId: appointment.id,
          scheduledAt: new Date(payload.startTime),
        });

        console.log(
          `[CALCOM] Booking created: ${patient.name} on ${payload.startTime}`
        );
        return res.json({ ok: true, appointmentId: appointment.id });
      }

      case "BOOKING_CANCELLED": {
        const appointment = await db.appointment.findUnique({
          where: { calComBookingId: payload.uid },
        });

        if (appointment) {
          await db.appointment.update({
            where: { id: appointment.id },
            data: { status: "CANCELLED" },
          });
          await cancelAllMessages(appointment.id);
          console.log(`[CALCOM] Booking cancelled: ${payload.uid}`);
        }

        return res.json({ ok: true });
      }

      case "BOOKING_RESCHEDULED": {
        // Cancel old messages, create new appointment with new messages
        const oldAppointment = await db.appointment.findUnique({
          where: { calComBookingId: payload.uid },
        });

        if (oldAppointment) {
          await db.appointment.update({
            where: { id: oldAppointment.id },
            data: { status: "RESCHEDULED" },
          });
          await cancelAllMessages(oldAppointment.id);

          // Create new appointment
          const newAppointment = await db.appointment.create({
            data: {
              patientId: oldAppointment.patientId,
              calComBookingId: payload.rescheduleUid || payload.uid,
              scheduledAt: new Date(payload.startTime),
              status: "SCHEDULED",
            },
          });

          await schedulePreConsultMessages({
            patientId: oldAppointment.patientId,
            appointmentId: newAppointment.id,
            scheduledAt: new Date(payload.startTime),
          });
        }

        return res.json({ ok: true });
      }

      default:
        console.log(`[CALCOM] Unhandled event: ${triggerEvent}`);
        return res.json({ ok: true });
    }
  } catch (error) {
    console.error("[CALCOM] Webhook error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
