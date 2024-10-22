FROM node:21.6.2-alpine

ARG NODE_ENV
ARG LOCALHOST_WEBSOCKET_PORT

RUN echo "TASKSERVER: Building for $NODE_ENV environment on port $LOCALHOST_WEBSOCKET_PORT"

WORKDIR /app

ENV NODE_ENV=${NODE_ENV}
ENV NODE_OPTIONS="--max_old_space_size=4096"

# Copy package.json first to leverage Docker cache
COPY /taskserver/package*.json ./

# Now copy the rest of the application
COPY ./.env ./
COPY ./taskserver ./
COPY ./src/backend ./src/backend
COPY ./src/common ./src/common
COPY ./taskserver/ecosystem.config.cjs ./ecosystem.config.cjs

# Install dependencies
RUN npm ci --no-audit --maxsockets 1 --fetch-timeout=600000

# Install PM2 globally
RUN npm install --global pm2

EXPOSE ${LOCALHOST_WEBSOCKET_PORT}

ENV LOCALHOST_WEBSOCKET_PORT ${LOCALHOST_WEBSOCKET_PORT}
ENV PORT ${LOCALHOST_WEBSOCKET_PORT}
ENV HOSTNAME "0.0.0.0"

CMD NODE_ENV=${NODE_ENV} pm2-runtime ecosystem.config.cjs