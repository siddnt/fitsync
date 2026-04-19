# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ──
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
RUN addgroup -S fitsync && adduser -S fitsync -G fitsync

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src ./src
COPY public ./public

# Create required directories
RUN mkdir -p src/storage/uploads src/logs && \
    chown -R fitsync:fitsync /app

USER fitsync

# Expose the API port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/system/health || exit 1

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "src/index.js"]
