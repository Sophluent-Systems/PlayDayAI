FROM node:20-alpine3.19 AS base

# Install dependencies
FROM base AS builder

ARG LOCALHOST_FRONTEND_PORT

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=4096"

RUN echo "FRONTEND: Building for production environment on port $LOCALHOST_FRONTEND_PORT"

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY . .
COPY ./.env ./.env

RUN npm ci --no-audit --maxsockets 1 --fetch-timeout=600000

# Build the application
RUN npm run build

# Production image
FROM base AS runner

ARG LOCALHOST_FRONTEND_PORT

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=4096"

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/frontend/ecosystem.config.cjs ./ecosystem.config.cjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY ./.env ./

# Set up user and permissions
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

# Install PM2 and set up log directory
RUN npm install --global pm2 && \
    mkdir -p /var/log/next && \
    chown nextjs:nodejs /var/log/next && \
    chmod 755 /var/log/next

USER nextjs

EXPOSE ${LOCALHOST_FRONTEND_PORT}

ENV PORT ${LOCALHOST_FRONTEND_PORT}
ENV LOCALHOST_FRONTEND_PORT ${LOCALHOST_FRONTEND_PORT}
ENV HOSTNAME "0.0.0.0"

CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--name", "frontend"]