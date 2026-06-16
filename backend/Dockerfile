# ── Stage 1: install deps ────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: build ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl → required by the Prisma query engine (libssl) at runtime
RUN apk add --no-cache wget openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 appuser

# Only copy what the server needs at runtime
COPY --from=builder /app/dist             ./dist
COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/prisma           ./prisma
COPY                package.json          ./

USER appuser
EXPOSE 5000
CMD ["node", "dist/index.js"]
