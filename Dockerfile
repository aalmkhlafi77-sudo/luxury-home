# =========================================================
# Multi-Stage Dockerfile for Real Estate Platform
# Node.js 20 Alpine Base + Vite Static & Express Backend
# =========================================================

# Stage 1: Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build Vite frontend assets
RUN npm run build

# Stage 2: Production Runtime Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production runtime tools
RUN apk add --no-cache curl

# Copy dependencies and built code
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose backend port
EXPOSE 3000

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start full-stack Node.js server with tsx
CMD ["npx", "tsx", "server.ts"]
