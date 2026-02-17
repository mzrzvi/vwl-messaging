import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config";

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

// Single queue for all message types — BullMQ handles scheduling via delayed jobs
export const messageQueue = new Queue("messages", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 }, // Retry after 1m, 2m, 4m
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});
