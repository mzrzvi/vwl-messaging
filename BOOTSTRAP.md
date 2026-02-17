# VWL Messaging — Claude Code Bootstrap Prompt

Copy everything below the line and paste it as your first prompt in Claude Code from the project root directory.

---

## Bootstrap Prompt

```
I'm building a patient messaging automation system for Valley Weight Loss (VWL). The codebase is already scaffolded in this directory — read CLAUDE.md first for full context.

Here's what I need you to do:

### 1. Set up MCP servers

Add these MCP servers to my project config (.mcp.json):

**Postgres (via @anthropic/mcp-postgres or similar):**
- Connect to my local Postgres so you can inspect/query the DB directly
- Connection string will be in .env as DATABASE_URL

**Filesystem:**
- So you can read/write project files

**Fetch:**
- So you can test webhook endpoints by making HTTP requests to localhost:3000

Here's the .mcp.json to create:

{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://postgres:postgres@localhost:5432/vwl"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}

### 2. Bootstrap the local environment

Run these in order:
1. `npm install`
2. Make sure Docker containers for Postgres and Redis are running:
   - `docker run -d --name vwl-postgres -e POSTGRES_DB=vwl -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`
   - `docker run -d --name vwl-redis -p 6379:6379 redis:7`
3. Create .env from .env.example with these local defaults:
   - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vwl
   - REDIS_URL=redis://localhost:6379
   - PORT=3000
   - BASE_URL=http://localhost:3000
   - For Twilio/SendGrid/Anthropic keys, use placeholder values for now (I'll fill real ones in later)
   - ESCALATION_PHONE=+15551234567
   - ESCALATION_EMAIL=alex@valleyweightloss.com
4. `npx prisma db push`
5. Verify with `npm run dev` that the server starts without errors

### 3. Verify the flow works

Once the server is running:
1. Use the fetch MCP to POST a test booking to http://localhost:3000/api/webhook/calcom (use the payload format from src/scripts/test-booking.ts)
2. Use the postgres MCP to query the database and confirm:
   - A Patient record was created
   - An Appointment record was created with status SCHEDULED
   - ScheduledMessage records were created for all message types
3. Use fetch MCP to GET http://localhost:3000/api/admin/dashboard and show me the stats
4. Use fetch MCP to POST to /api/admin/appointment/{id}/complete and verify no-show messages get cancelled and post-consult messages get queued

### 4. Then tell me what's next

After verifying, give me a status report:
- What's working
- What needs real API keys to test
- What's missing from the TODO list that we should build next
- Any issues you found in the code
```

---

## After Bootstrap — Useful Follow-Up Prompts

### Add webhook signature verification
```
Add Cal.com webhook signature verification to src/routes/calcom.ts. Cal.com sends an x-cal-signature-256 header with an HMAC-SHA256 of the raw body using the webhook secret. Use the CALCOM_WEBHOOK_SECRET env var. Make it skip verification if the env var is not set (for local testing).
```

### Add Twilio request validation
```
Add Twilio request validation middleware to the twilio routes. Use the twilio.validateRequest() method. It should validate the X-Twilio-Signature header against our auth token and the full request URL. Skip validation in development (when NODE_ENV !== 'production').
```

### Build Section 4 — Enrolled patient lifecycle
```
Read CLAUDE.md for context. Build Section 4 of the messaging spec:

4.1 Post-injection messaging (trigger: new endpoint POST /api/admin/appointment/:id/inject)
4.2 Weekly engagement drip (SMS + email, 8 weeks)
4.3 Review request at week 4 (link to Google reviews)
4.4 Secondary services upsell at week 5

Add new MessageTypes to the Prisma schema, templates in messages.ts, scheduling logic in scheduler.ts, and worker cases in message-worker.ts. Follow the existing patterns exactly.
```

### Build Section 5 — Broadcast messaging
```
Build a broadcast/mass messaging system:

1. New Prisma model: BroadcastMessage (id, content, channel, sentAt, recipientCount)
2. New Prisma model: BroadcastRecipient (id, broadcastId, patientId, status, sentAt)
3. POST /api/admin/broadcast — accepts { message, channel: "sms"|"email"|"both", filter?: { status } }
4. Sends to all patients (or filtered subset) via BullMQ with rate limiting (1 msg/sec to avoid Twilio throttling)
5. GET /api/admin/broadcast/:id — view send status

Must handle Twilio opt-out list (check for STOP responses).
```

### Deploy to Railway
```
Help me deploy this to Railway:

1. Create a Dockerfile for the app
2. Create a docker-compose.yml for local dev (app + postgres + redis)
3. Create a railway.toml with the right build/start commands
4. Walk me through the Railway setup steps and what env vars to configure
5. After deploy, tell me exactly what webhook URLs to set in Cal.com and Twilio
```

### Add monitoring
```
Add basic monitoring and alerting:

1. Add Sentry error tracking (or suggest a lighter alternative)
2. Add a /health endpoint that checks DB + Redis connectivity
3. Add a daily summary email to Alex: appointments today, messages sent, failures
4. Log failed messages to a separate error channel
```

### Build admin UI
```
Build a simple admin dashboard as a React page served from the Express app:

- Overview: today's appointments, message queue status, recent failures
- Appointment list with status badges and "Mark Complete" button
- Click into an appointment to see all scheduled/sent messages with timestamps
- Use Tailwind via CDN, keep it in a single HTML file served from /admin

This is internal tooling, doesn't need to be pretty — just functional.
```
