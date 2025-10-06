# Base on official NGINX Alpine image
FROM nginx:alpine

ARG PROTOCOL=HTTP
ARG EXTERNAL_HTTP_PORT=80
ARG EXTERNAL_HTTPS_PORT=443
ARG WS_LOCAL_PORT=3005
ARG SERVER_NAME=localhost

RUN echo "NGINX build args: PROTOCOL=${PROTOCOL}, EXTERNAL_HTTP_PORT=${EXTERNAL_HTTP_PORT}, EXTERNAL_HTTPS_PORT=${EXTERNAL_HTTPS_PORT}, WS_LOCAL_PORT=${WS_LOCAL_PORT}, SERVER_NAME=${SERVER_NAME}"

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove any default config files
RUN rm -f /etc/nginx/conf.d/* /etc/nginx/default.conf

# Copy config files and entrypoint
COPY ./nginx.conf.* /etc/nginx/
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose listening ports (HTTP/HTTPS handled by nginx.conf)
EXPOSE ${EXTERNAL_HTTP_PORT}
EXPOSE ${EXTERNAL_HTTPS_PORT}

# Provide runtime environment defaults
ENV PROTOCOL=${PROTOCOL}
ENV EXTERNAL_HTTP_PORT=${EXTERNAL_HTTP_PORT}
ENV EXTERNAL_HTTPS_PORT=${EXTERNAL_HTTPS_PORT}
ENV WS_LOCAL_PORT=${WS_LOCAL_PORT}
ENV SERVER_NAME=${SERVER_NAME}

ENTRYPOINT ["/entrypoint.sh"]
