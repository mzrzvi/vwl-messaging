/**
 * Test script: Mark an appointment as completed.
 *
 * Usage: npm run test:complete -- <appointmentId>
 *
 * This triggers the post-consult conversion flow and cancels no-show messages.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  const appointmentId = process.argv[2];

  if (!appointmentId) {
    console.log("Usage: npm run test:complete -- <appointmentId>");
    console.log("\nGet appointment IDs from: GET /api/admin/appointments");
    process.exit(1);
  }

  console.log(`🧪 Marking appointment ${appointmentId} as complete...`);

  const res = await fetch(
    `${BASE_URL}/api/admin/appointment/${appointmentId}/complete`,
    { method: "POST" }
  );

  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (data.ok) {
    console.log("\n✅ Post-consult flow triggered!");
    console.log("   - Thank you SMS queued");
    console.log("   - Summary email queued");
    console.log("   - Dr. Patel chatbot follow-up queued (15 min)");
    console.log("   - No-show messages cancelled");
  }
}

main().catch(console.error);
