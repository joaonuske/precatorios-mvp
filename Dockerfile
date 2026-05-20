# syntax=docker/dockerfile:1

# ---- Builder ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Dependências necessárias pra prisma generate (openssl)
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx next build

# ---- Runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx next start"]
