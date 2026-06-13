# FishingLog.ai — Jetson Orin Nano Deployment
# Multi-stage build: build TypeScript, run on Jetson with TensorRT

FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Runtime stage — Jetson with Node.js
FROM node:20-slim AS runtime
WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    alsa-utils \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy static files
COPY public/ ./public/
COPY cocapn/ ./cocapn/

# Environment
ENV NODE_ENV=production
ENV VESSEL_ID=vessel-default
ENV REGION=pacific-nw
ENV INFERENCE_PORT=8080
ENV LOG_LEVEL=info

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/worker.js"]
