# =========================================================
# Multi-Stage Dockerfile for Luxury Home (منزل الفخامة)
# Node.js 20 Alpine Base + Precompiled Express Server & Vite SPA
# =========================================================

# Stage 1: Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies including dev dependencies needed for build
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source files & prisma schema
COPY . .

# Generate Prisma Client & compile both frontend and backend
RUN npx prisma generate
RUN npm run build

# Stage 2: Production Runtime Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production runtime tools
RUN apk add --no-cache curl

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

# Copy generated Prisma Client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built frontend assets and bundled backend server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/uploads ./uploads

# Expose internal app port
EXPOSE 3000

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start precompiled Node.js server (zero npx download at runtime)
CMD ["node", "dist-server/server.js"]
