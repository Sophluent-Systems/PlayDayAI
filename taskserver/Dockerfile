FROM node:23-alpine

ARG NODE_ENV
ARG NEXT_PUBLIC_WS_PORT

RUN echo "TASKSERVER: Building for  environment on port "

WORKDIR /app

ENV NODE_ENV=${NODE_ENV}

# Now copy the rest of the application
COPY ./.env ./
COPY ./taskserver/*.cjs ./
COPY ./taskserver/*.mjs ./
COPY ./taskserver/*.json ./
COPY ./src/server ./src/server
COPY ./packages/shared ./packages/shared

# Install dependencies
RUN yarn install

EXPOSE ${NEXT_PUBLIC_WS_PORT}

ENV NEXT_PUBLIC_WS_PORT ${NEXT_PUBLIC_WS_PORT}
ENV PORT ${NEXT_PUBLIC_WS_PORT}
ENV HOSTNAME "0.0.0.0"

CMD NODE_ENV=${NODE_ENV} node --loader ./custom-loader.mjs ./server.mjs
