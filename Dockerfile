# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The app has no public/ assets today, but Next standalone expects it to exist.
RUN mkdir -p public && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HANRE_DB_PATH=/app/data/hanre.db

RUN groupadd --system --gid 1001 hanre \
    && useradd --system --uid 1001 --gid hanre --create-home hanre \
    && mkdir -p /app/data /app/.next/cache \
    && chown -R hanre:hanre /app

COPY --from=builder --chown=hanre:hanre /app/.next/standalone ./
COPY --from=builder --chown=hanre:hanre /app/.next/static ./.next/static
COPY --from=builder --chown=hanre:hanre /app/public ./public

USER hanre
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
