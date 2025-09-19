FROM node:21.6.2-alpine

ARG NODE_ENV
ARG LOCALHOST_WEBSOCKET_PORT

RUN echo "TASKSERVER: Building for $NODE_ENV environment on port $LOCALHOST_WEBSOCKET_PORT"

WORKDIR /app

ENV NODE_ENV=${NODE_ENV}


# Now copy the rest of the application
COPY ./.env ./
COPY ./taskserver/*.cjs ./
COPY ./taskserver/*.mjs ./
COPY ./taskserver/*.json ./
COPY ./src/backend ./src/backend
COPY ./src/common ./src/common
COPY ./src/taskserver ./src/taskserver

# Install dependencies
RUN yarn install

# Install PM2 globally
RUN npm install --global pm2

EXPOSE ${LOCALHOST_WEBSOCKET_PORT}

ENV LOCALHOST_WEBSOCKET_PORT ${LOCALHOST_WEBSOCKET_PORT}
ENV PORT ${LOCALHOST_WEBSOCKET_PORT}
ENV HOSTNAME "0.0.0.0"

CMD NODE_ENV=${NODE_ENV} pm2-runtime ecosystem.config.cjs