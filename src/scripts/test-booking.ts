/**
 * Test script: Simulate a Cal.com booking.
 *
 * Usage: npm run test:booking
 *
 * This sends a fake BOOKING_CREATED webhook to your local server,
 * which triggers the entire pre-consultation message flow.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Schedule the test booking for 2 hours from now (so you can see day-of messages queue)
const consultTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

const payload = {
  triggerEvent: "BOOKING_CREATED",
  payload: {
    uid: `test-booking-${Date.now()}`,
    title: "Weight Loss Consultation",
    startTime: consultTime.toISOString(),
    endTime: new Date(consultTime.getTime() + 30 * 60 * 1000).toISOString(),
    attendees: [
      {
        name: "Test Patient",
        email: "test@example.com",
        phone: "+15551234567", // Replace with your test number
      },
    ],
    metadata: {
      videoCallUrl: "https://cal.com/video/test-meeting",
    },
    rescheduleUrl: "https://cal.com/reschedule/test-booking",
  },
};

async function main() {
  console.log("🧪 Sending test BOOKING_CREATED webhook...");
  console.log(`   Consult scheduled for: ${consultTime.toLocaleString()}`);
  console.log(`   Sending to: ${BASE_URL}/api/webhook/calcom\n`);

  const res = await fetch(`${BASE_URL}/api/webhook/calcom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (data.ok) {
    console.log(`\n✅ Booking created! Appointment ID: ${data.appointmentId}`);
    console.log("\nCheck the dashboard: GET /api/admin/dashboard");
    console.log(`View appointment: GET /api/admin/appointment/${data.appointmentId}`);
    console.log(
      `\nTo test post-consult: POST /api/admin/appointment/${data.appointmentId}/complete`
    );
  }
}

main().catch(console.error);
