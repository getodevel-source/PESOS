FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ gcc

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Remove development dependencies to keep the image small
RUN npm prune --production

# ── Production Image ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install sqlite runtime libs just in case
RUN apk add --no-cache sqlite-libs

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/sqlite-db.ts ./src/lib/sqlite-db.ts

# Set default env variables
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Create starting script
RUN echo -e '#!/bin/sh\nnode scripts/bot-daemon.js &\nexec npm run start' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
