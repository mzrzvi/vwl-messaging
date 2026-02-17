import express from "express";
import { config } from "./lib/config";
import { calcomRouter } from "./routes/calcom";
import { twilioRouter } from "./routes/twilio";
import { adminRouter } from "./routes/admin";
import { createWorker } from "./jobs/message-worker";

const app = express();

// Parse JSON (for Cal.com webhooks, admin routes)
app.use(express.json());

// Parse URL-encoded (for Twilio webhooks)
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api", calcomRouter);
app.use("/api", twilioRouter);
app.use("/api", adminRouter);

// Start worker (processes queued messages)
createWorker();

// Start server
app.listen(config.PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║       Valley Weight Loss Messaging Server        ║
╠══════════════════════════════════════════════════╣
║  Server:  http://localhost:${config.PORT}                ║
║  Health:  http://localhost:${config.PORT}/health         ║
╠══════════════════════════════════════════════════╣
║  Webhooks:                                       ║
║    Cal.com  → POST /api/webhook/calcom           ║
║    Twilio   → POST /api/webhook/twilio/sms       ║
║  Admin:                                          ║
║    Dashboard     → GET  /api/admin/dashboard     ║
║    Appointments  → GET  /api/admin/appointments  ║
║    Complete      → POST /api/admin/appointment/  ║
║                         :id/complete             ║
╚══════════════════════════════════════════════════╝
  `);
});
