# Valley Weight Loss — Messaging Automation

Custom backend replacing Lindy + Keragon. Handles the entire patient messaging lifecycle:
pre-consult reminders, day-of messaging, post-consult conversion, no-show recovery, 
and AI chatbot (Dr. Patel).

## Architecture

```
Cal.com (booking events)
    ↓ webhook
Express Server ──→ BullMQ (Redis) ──→ Worker
    ↓                                    ↓
  Prisma (Postgres)              Twilio (SMS/Voice)
                                 SendGrid (Email)
                                 Claude API (Chatbot)
```

## Stack

- **Runtime:** Node.js + TypeScript
- **Server:** Express
- **Database:** PostgreSQL (via Prisma ORM)
- **Queue:** BullMQ + Redis (delayed job scheduling)
- **SMS/Voice:** Twilio
- **Email:** SendGrid
- **Chatbot:** Anthropic Claude API
- **Hosting:** Railway (recommended)

## Quick Start (Local)

### Prerequisites
- Node.js 20+
- PostgreSQL running locally (or use Docker)
- Redis running locally (or use Docker)

### Setup

```bash
# Install dependencies
npm install

# Copy env and fill in your credentials
cp .env.example .env

# Push database schema
npx prisma db push

# Start dev server (auto-reloads)
npm run dev
```

### Test It

```bash
# 1. Simulate a booking (sends fake Cal.com webhook to localhost)
npm run test:booking

# 2. Check the dashboard
curl http://localhost:3000/api/admin/dashboard

# 3. View the appointment + all scheduled messages
curl http://localhost:3000/api/admin/appointment/<id>

# 4. Simulate consult completion (triggers post-consult flow)
npm run test:complete -- <appointmentId>
```

### Docker (Postgres + Redis)

```bash
docker run -d --name vwl-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker run -d --name vwl-redis -p 6379:6379 redis:7
```

## Deploy to Railway

1. Push to GitHub
2. Create a new Railway project
3. Add services:
   - **Web service** (from your repo) — runs `npm start`
   - **PostgreSQL** (Railway add-on)
   - **Redis** (Railway add-on)
4. Set environment variables (copy from `.env.example`)
   - Railway auto-fills `DATABASE_URL` and `REDIS_URL` when you link the add-ons
5. Deploy

### Configure Webhooks After Deploy

**Cal.com:**
- Go to Cal.com → Settings → Developer → Webhooks
- Delete all old Pipedream/Lindy webhooks
- Add: `https://your-app.railway.app/api/webhook/calcom`
- Events: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`

**Twilio:**
- Go to Twilio Console → Phone Numbers → your VWL number
- Set SMS webhook: `https://your-app.railway.app/api/webhook/twilio/sms` (POST)

## API Endpoints

### Webhooks (automated)
| Method | Path | Source |
|--------|------|--------|
| POST | `/api/webhook/calcom` | Cal.com booking events |
| POST | `/api/webhook/twilio/sms` | Twilio incoming SMS |
| GET | `/api/voice/confirmation-twiml` | Twilio voice (day-of call) |
| GET | `/api/voice/no-show-twiml` | Twilio voice (no-show call) |

### Admin (manual)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/dashboard` | System overview |
| GET | `/api/admin/appointments` | List appointments |
| GET | `/api/admin/appointment/:id` | Appointment detail + messages |
| POST | `/api/admin/appointment/:id/complete` | Mark consult done → triggers post-consult flow |

## Message Flow

### On Booking Created
1. **Immediately:** Confirmation SMS + Email + Chatbot intro SMS
2. **T-24hrs:** Pre-consult reminder SMS (if booked >24hrs ahead)
3. **Morning of:** Automated voice call (confirm/reschedule)
4. **T-2hrs:** Reminder SMS + Email with consult link
5. **T-10min:** Final SMS with consult link

### On Consult Completed
1. **Immediately:** Thank you SMS
2. **+1 min:** Post-consult summary email
3. **+15 min:** Dr. Patel chatbot follow-up SMS
4. No-show cascade is cancelled

### On No-Show (no completion by T+30min)
1. **T+35min:** SMS + Email (non-judgmental, reschedule link)
2. **T+2hrs:** Voice call (friendly check-in)
3. **T+1 day:** SMS + Email + Chatbot outreach
4. **T+2 days:** Escalation to Alex (SMS + Email)

## Customization

### Message Copy
All message templates are in `src/templates/messages.ts`. Edit the copy there
and redeploy. No need to touch any other files.

### Dr. Patel Chatbot
The system prompt is in `src/services/chatbot.ts`. Adjust personality, 
knowledge, and behavior there.

### Timing
All message delays are configured in `src/services/scheduler.ts`. Adjust
the `delay` values (in milliseconds) to change when messages fire.

## TODOs

- [ ] Store Cal.com meeting link + reschedule URL in appointment record
- [ ] Add webhook signature verification for Cal.com
- [ ] Add Twilio request validation middleware
- [ ] Build Sections 4 (enrolled patient lifecycle) + 5 (broadcast)
- [ ] Add simple admin UI (or use Prisma Studio for now)
- [ ] Set up monitoring/alerting for failed messages
