FROM node:23-alpine

ARG NODE_ENV=development
ARG WS_LOCAL_PORT=3005

RUN echo "TASKSERVER build args: NODE_ENV=${NODE_ENV}, WS_LOCAL_PORT=${WS_LOCAL_PORT}"

WORKDIR /app

ENV NODE_ENV=${NODE_ENV}

# Copy application sources
COPY ./.env* /
COPY ./taskserver/*.cjs /
COPY ./taskserver/*.mjs /
COPY ./taskserver/*.json /
COPY ./taskserver/src/server /src/server
COPY ./packages/shared/src/backend /packages/shared/src/backend
COPY ./packages/shared/src/common /packages/shared/src/common

RUN npm install -g pnpm

# Install dependencies
RUN pnpm install

EXPOSE ${WS_LOCAL_PORT}

ENV WS_LOCAL_PORT=${WS_LOCAL_PORT}
ENV NEXT_PUBLIC_WS_PORT=${WS_LOCAL_PORT}
ENV PORT=${WS_LOCAL_PORT}
ENV HOSTNAME=0.0.0.0

CMD NODE_ENV=${NODE_ENV} WS_LOCAL_PORT=${WS_LOCAL_PORT} node --loader ./custom-loader.mjs ./server.mjs
