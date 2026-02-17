FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and Prisma schema
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma client + build TypeScript
RUN npx prisma generate
RUN npm run build

# --- Production image ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema + generated client from builder
COPY prisma ./prisma
RUN npx prisma generate

# Copy built JS from builder
COPY --from=builder /app/dist ./dist

EXPOSE ${PORT:-3000}

# Run migrations then start — migration is idempotent (safe to run on every deploy)
CMD npx prisma migrate deploy && node dist/index.js
