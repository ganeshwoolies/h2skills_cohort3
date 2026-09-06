# Multi-stage Dockerfile for Personal Gemini Journal
# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package.json package-lock.json* bun.lock* ./
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend and bundle backend server
RUN npm run build

# Production runtime stage
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json* ./
COPY --from=builder /app/firestore.rules ./

# Non-root security posture for Cloud Run
USER node

EXPOSE 3000

# Cloud Run entrypoint
CMD ["node", "dist/server.cjs"]
