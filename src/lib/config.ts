import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  TWILIO_ACCOUNT_SID: z.string(),
  TWILIO_AUTH_TOKEN: z.string(),
  TWILIO_PHONE_NUMBER: z.string(),
  SENDGRID_API_KEY: z.string(),
  SENDGRID_FROM_EMAIL: z.string().default("care@valleyweightloss.com"),
  SENDGRID_FROM_NAME: z.string().default("Valley Weight Loss"),
  ANTHROPIC_API_KEY: z.string(),
  CALCOM_WEBHOOK_SECRET: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().default("http://localhost:3000"),
  ESCALATION_PHONE: z.string(),
  ESCALATION_EMAIL: z.string(),
});

export const config = envSchema.parse(process.env);
