FROM node:21.6.2-alpine

ARG NODE_ENV
ARG LOCALHOST_WEBSOCKET_PORT

RUN echo "TASKSERVER: Building for  environment on port "

WORKDIR /app

ENV NODE_ENV=

# Now copy the rest of the application
COPY ./.env ./
COPY ./taskserver/*.cjs ./
COPY ./taskserver/*.mjs ./
COPY ./taskserver/*.json ./
COPY ./src/server ./src/server
COPY ./packages/shared ./packages/shared

# Install dependencies
RUN yarn install

# Install PM2 globally
RUN npm install --global pm2

EXPOSE 

ENV LOCALHOST_WEBSOCKET_PORT 
ENV PORT 
ENV HOSTNAME "0.0.0.0"

CMD NODE_ENV= pm2-runtime ecosystem.config.cjs
