# Base on offical NGINX Alpine image
FROM nginx:alpine

ARG PROTOCOL
ARG EXTERNAL_HTTP_PORT
ARG EXTERNAL_HTTPS_PORT
ARG LOCALHOST_FRONTEND_PORT
ARG LOCALHOST_WEBSOCKET_PORT
ARG SERVER_NAME

RUN echo "NGINX: Building with PROTOCOL=$PROTOCOL, EXTERNAL_HTTP_PORT=$EXTERNAL_HTTP_PORT, EXTERNAL_HTTPS_PORT=$EXTERNAL_HTTPS_PORT"
RUN echo "       LOCALHOST_FRONTEND_PORT=$LOCALHOST_FRONTEND_PORT, LOCALHOST_WEBSOCKET_PORT=$LOCALHOST_WEBSOCKET_PORT, SERVER_NAME=$SERVER_NAME"

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove any existing config files
RUN rm -f /etc/nginx/conf.d/*
RUN rm -f /etc/nginx/default.conf

# Copy config files
# *.conf files in conf.d/ dir get included in main config
COPY ./nginx.conf.* /etc/nginx/
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose the listening port
EXPOSE ${EXTERNAL_HTTP_PORT}
EXPOSE ${EXTERNAL_HTTPS_PORT}

# Set up the environment variables
ENV PROTOCOL=${PROTOCOL}
ENV EXTERNAL_HTTP_PORT=${EXTERNAL_HTTP_PORT}
ENV EXTERNAL_HTTPS_PORT=${EXTERNAL_HTTPS_PORT}
ENV LOCALHOST_FRONTEND_PORT=${LOCALHOST_FRONTEND_PORT}
ENV LOCALHOST_WEBSOCKET_PORT=${LOCALHOST_WEBSOCKET_PORT}
ENV SERVER_NAME=${SERVER_NAME}

ENTRYPOINT ["/entrypoint.sh"]

