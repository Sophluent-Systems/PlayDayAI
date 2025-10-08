# syntax=docker/dockerfile:1.7
FROM node:23-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Useful utils for HEALTHCHECKs
RUN apk add --no-cache curl

# Copy only what you need first for caching
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm fetch

# Copy source
# (do NOT copy any .env files)
COPY ./taskserver/*.cjs ./taskserver/*.mjs ./taskserver/*.json ./
COPY ./taskserver/src/server ./src/server
COPY ./packages/shared/src/backend /packages/shared/src/backend
COPY ./packages/shared/src/common /packages/shared/src/common

# Install deps
RUN pnpm install --prod

# Default port, but can be overridden via compose env
EXPOSE 3005

# Provide sane non-secret defaults; override at runtime via compose env
ENV HOSTNAME=0.0.0.0

CMD ["node", "--loader", "./custom-loader.mjs", "./server.mjs"]
