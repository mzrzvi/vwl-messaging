import { Router, Request, Response } from "express";
import { db } from "../lib/db";
import {
  cancelNoShowMessages,
  schedulePostConsultMessages,
} from "../services/scheduler";

export const adminRouter = Router();

/**
 * Mark an appointment as completed.
 * Triggers post-consult flow + cancels no-show cascade.
 *
 * POST /api/admin/appointment/:id/complete
 *
 * This replaces the AdvanceMD manual status update.
 * Can be called manually, from AdvanceMD webhook, or via a simple UI.
 */
adminRouter.post(
  "/admin/appointment/:id/complete",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const appointment = await db.appointment.findUnique({
        where: { id },
        include: { patient: true },
      });

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      if (appointment.status === "COMPLETED") {
        return res.json({ ok: true, message: "Already completed" });
      }

      // Update status
      await db.appointment.update({
        where: { id },
        data: { status: "COMPLETED" },
      });

      // Cancel no-show messages
      await cancelNoShowMessages(id);

      // Schedule post-consult messages
      await schedulePostConsultMessages(id, appointment.patientId);

      console.log(
        `[ADMIN] Appointment ${id} marked complete for ${appointment.patient.name}`
      );
      return res.json({ ok: true, message: "Marked complete, post-consult flow triggered" });
    } catch (error) {
      console.error("[ADMIN] Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * View appointment details + all scheduled/sent messages.
 *
 * GET /api/admin/appointment/:id
 */
adminRouter.get(
  "/admin/appointment/:id",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const appointment = await db.appointment.findUnique({
        where: { id },
        include: {
          patient: true,
          messages: { orderBy: { scheduledFor: "asc" } },
        },
      });

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      return res.json(appointment);
    } catch (error) {
      console.error("[ADMIN] Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * List all appointments (with optional status filter).
 *
 * GET /api/admin/appointments?status=SCHEDULED
 */
adminRouter.get("/admin/appointments", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const appointments = await db.appointment.findMany({
      where: status ? { status: status as any } : undefined,
      include: { patient: true },
      orderBy: { scheduledAt: "desc" },
      take: 50,
    });

    return res.json(appointments);
  } catch (error) {
    console.error("[ADMIN] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Dashboard — quick summary of system status.
 *
 * GET /api/admin/dashboard
 */
adminRouter.get("/admin/dashboard", async (req: Request, res: Response) => {
  try {
    const [
      totalAppointments,
      scheduled,
      completed,
      noShows,
      pendingMessages,
      sentMessages,
      failedMessages,
    ] = await Promise.all([
      db.appointment.count(),
      db.appointment.count({ where: { status: "SCHEDULED" } }),
      db.appointment.count({ where: { status: "COMPLETED" } }),
      db.appointment.count({ where: { status: "NO_SHOW" } }),
      db.scheduledMessage.count({ where: { status: "PENDING" } }),
      db.scheduledMessage.count({ where: { status: "SENT" } }),
      db.scheduledMessage.count({ where: { status: "FAILED" } }),
    ]);

    return res.json({
      appointments: { total: totalAppointments, scheduled, completed, noShows },
      messages: { pending: pendingMessages, sent: sentMessages, failed: failedMessages },
    });
  } catch (error) {
    console.error("[ADMIN] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
