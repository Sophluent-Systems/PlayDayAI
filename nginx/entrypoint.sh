#!/bin/sh

# Print the environment variables to confirm they are set
echo "PROTOCOL: ${PROTOCOL}"
echo "EXTERNAL_HTTP_PORT: ${EXTERNAL_HTTP_PORT}"
echo "EXTERNAL_HTTPS_PORT: ${EXTERNAL_HTTPS_PORT}"
echo "NEXT_PUBLIC_FRONTEND_PORT: ${NEXT_PUBLIC_FRONTEND_PORT}"
echo "NEXT_PUBLIC_WS_PORT: ${NEXT_PUBLIC_WS_PORT}"
echo "SERVER_NAME: ${SERVER_NAME}"

PROTOCOL=$(echo "$PROTOCOL" | tr '[:lower:]' '[:upper:]')

if [ "$PROTOCOL" = "HTTPS" ]; then
    cp /etc/nginx/nginx.conf.HTTPS /etc/nginx/nginx.conf.template
else
    cp /etc/nginx/nginx.conf.HTTP /etc/nginx/nginx.conf.template
fi

envsubst '${SERVER_NAME} ${EXTERNAL_HTTP_PORT} ${EXTERNAL_HTTPS_PORT} ${NEXT_PUBLIC_FRONTEND_PORT} ${NEXT_PUBLIC_WS_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
exec nginx -g 'daemon off;'
