import express from "express";
import { config } from "./lib/config";
import { db } from "./lib/db";
import { redis } from "./lib/queue";
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

// Startup checks
async function checkConnections() {
  // Check Postgres
  try {
    await db.$queryRaw`SELECT 1`;
    console.log("[STARTUP] ✅ PostgreSQL connected");
  } catch (err) {
    console.error("[STARTUP] ❌ PostgreSQL connection failed:", (err as Error).message);
  }

  // Check Redis
  try {
    const pong = await redis.ping();
    if (pong === "PONG") {
      console.log("[STARTUP] ✅ Redis connected");
    }
  } catch (err) {
    console.error("[STARTUP] ❌ Redis connection failed:", (err as Error).message);
  }
}

// Start worker (processes queued messages)
createWorker();

// Start server
checkConnections().then(() => {
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
});
