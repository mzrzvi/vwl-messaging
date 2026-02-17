# CLAUDE.md — Valley Weight Loss Messaging Automation

## Project Overview

Custom Node.js/TypeScript backend that automates the entire patient messaging lifecycle for Valley Weight Loss (VWL). Replaces Lindy + Keragon with a single deployable app.

**What it does:**
- Receives Cal.com booking webhooks
- Schedules timed SMS, email, and voice calls via BullMQ/Redis
- Runs "Dr. Patel" AI chatbot (Claude API) for patient conversations
- Handles no-show recovery cascades with automatic escalation
- Provides admin API for marking consults complete and viewing status

**Stack:** Express, Prisma (PostgreSQL), BullMQ (Redis), Twilio, SendGrid, Anthropic Claude API

**Deployment target:** Railway (Postgres + Redis as add-ons)

## Architecture

```
Cal.com ──webhook──→ Express Server ──→ BullMQ (Redis) ──→ Worker
                          │                                   │
                      Prisma (PG)                     Twilio (SMS/Voice)
                          │                           SendGrid (Email)
                     Patient DB                       Claude API (Chatbot)
                     Appointments
                     Messages
                     Conversations
```

### Key flows:
1. **Booking created** → scheduler queues all pre-consult + no-show messages with precise delays
2. **Consult completed** (admin endpoint) → cancels no-show cascade, queues post-consult messages
3. **Patient texts back** → routed to Dr. Patel chatbot, response sent via Twilio
4. **No response after no-show cascade** → escalation to Alex (human team member)

## File Structure

```
src/
  index.ts                    # Express server entry point
  lib/
    config.ts                 # Zod-validated env vars
    db.ts                     # Prisma client singleton
    queue.ts                  # BullMQ queue + Redis connection
  routes/
    calcom.ts                 # POST /api/webhook/calcom — booking events
    twilio.ts                 # POST /api/webhook/twilio/sms — incoming SMS
                              # GET  /api/voice/* — TwiML endpoints
    admin.ts                  # GET/POST /api/admin/* — manual controls
  services/
    scheduler.ts              # Maps bookings → timed BullMQ jobs
    twilio.ts                 # SMS sending + TwiML generation
    email.ts                  # SendGrid email sending
    chatbot.ts                # Dr. Patel AI chatbot (Claude API)
  jobs/
    message-worker.ts         # BullMQ worker — processes all message types
  templates/
    messages.ts               # All SMS + email copy (edit copy HERE)
  scripts/
    test-booking.ts           # Simulate Cal.com booking locally
    test-complete.ts          # Simulate marking consult complete
prisma/
  schema.prisma               # Database schema
```

## Development Commands

```bash
npm install                          # Install deps
cp .env.example .env                 # Set up env vars
npx prisma db push                   # Push schema to DB
npm run dev                          # Start dev server (tsx watch)
npm run test:booking                 # Simulate a Cal.com booking
npm run test:complete -- <id>        # Mark appointment complete
npx prisma studio                    # Visual DB browser
```

## Conventions

- **All message copy** lives in `src/templates/messages.ts` — never hardcode copy elsewhere
- **All timing/scheduling logic** lives in `src/services/scheduler.ts` — delays are in milliseconds
- **Environment variables** are validated via Zod in `src/lib/config.ts` — add new ones there first
- **Database changes** go through Prisma schema → `npx prisma db push` (dev) or `npx prisma migrate dev` (prod)
- Use `console.log` with prefixes: `[CALCOM]`, `[SMS]`, `[EMAIL]`, `[VOICE]`, `[WORKER]`, `[SCHEDULER]`, `[ADMIN]`, `[CHATBOT]`
- Voice calls use TwiML served from Express endpoints, not Twilio Studio
- Dr. Patel chatbot conversations are stored in the `Conversation` + `ConversationMessage` tables for context
- BullMQ jobs store their ID in `ScheduledMessage.jobId` so they can be cancelled when status changes

## Important Patterns

### Adding a new message type:
1. Add enum value to `MessageType` in `prisma/schema.prisma`
2. Add template function in `src/templates/messages.ts`
3. Add scheduling logic in `src/services/scheduler.ts`
4. Add processing case in `src/jobs/message-worker.ts` switch statement
5. Run `npx prisma db push`

### Cancellation logic:
- `cancelNoShowMessages()` — called when consult completes (keeps pre-consult messages)
- `cancelAllMessages()` — called on booking cancel/reschedule (nukes everything)
- Worker also does a runtime check: skips no-show messages if status is COMPLETED

## Known TODOs

- Store Cal.com meeting link + reschedule URL in Appointment model
- Add Cal.com webhook signature verification
- Add Twilio request validation middleware
- Build Section 4 (enrolled patient lifecycle: post-injection, weekly drips, review requests, upsells)
- Build Section 5 (broadcast/mass messaging)
- Build admin UI (currently API-only, Prisma Studio works for now)
- Set up error monitoring (Sentry or similar)
- Add rate limiting to webhook endpoints

## External Services

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| Cal.com | Booking triggers | https://app.cal.com/settings/developer/webhooks |
| Twilio | SMS + Voice | https://console.twilio.com |
| SendGrid | Email | https://app.sendgrid.com |
| Anthropic | Dr. Patel chatbot | https://console.anthropic.com |
| Railway | Hosting + PG + Redis | https://railway.app/dashboard |

## Testing

For local testing without sending real messages, you can:
1. Use Twilio test credentials (messages won't actually send)
2. Comment out the actual send calls in the worker and just log
3. Use `npm run test:booking` to fire fake webhooks at localhost
4. Use Prisma Studio (`npx prisma studio`) to inspect DB state
5. Use the admin dashboard endpoint to see message queue status
