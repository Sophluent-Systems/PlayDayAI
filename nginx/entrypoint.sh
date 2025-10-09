#!/bin/sh
set -e

# Log configuration for easier troubleshooting
echo "PROTOCOL: ${PROTOCOL}"
echo "SERVER_NAME: ${SERVER_NAME}"
echo "WS_LOCAL_PORT: ${WS_LOCAL_PORT}"
echo "EXTERNAL_HTTP_PORT: ${EXTERNAL_HTTP_PORT}"
echo "EXTERNAL_HTTPS_PORT: ${EXTERNAL_HTTPS_PORT}"
echo "BASE_URL: ${BASE_URL}"

PROTOCOL=$(echo "${PROTOCOL}" | tr '[:lower:]' '[:upper:]')

if [ "${PROTOCOL}" = "HTTPS" ]; then
    cp /etc/nginx/nginx.conf.HTTPS /etc/nginx/nginx.conf.template
else
    cp /etc/nginx/nginx.conf.HTTP /etc/nginx/nginx.conf.template
fi

envsubst '${SERVER_NAME} ${WS_LOCAL_PORT} ${EXTERNAL_HTTP_PORT} ${EXTERNAL_HTTPS_PORT} ${BASE_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
