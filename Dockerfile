# Multi-stage Dockerfile for IPFS Pay-to-Pin Gateway

# Step 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY src ./src
COPY sdk ./sdk

RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Step 2: Production runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/queue

EXPOSE 4021

CMD ["node", "dist/index.js"]
