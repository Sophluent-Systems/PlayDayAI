#!/bin/bash
set -euo pipefail

# References:
#   - Let's Encrypt staging environment guidance: https://letsencrypt.org/docs/staging-environment/
#   - Certbot user guide: https://eff-certbot.readthedocs.io/en/stable/using.html

usage() {
    echo "Usage: $0 <test|production>" >&2
}

MODE=${1:-}
if [[ -z "${MODE}" ]]; then
    usage
    exit 1
fi

case "${MODE}" in
    test|staging)
        CERTBOT_MODE_LABEL="staging (test)"
        CERTBOT_SERVER_FLAG="--staging"
        ;;
    production|prod)
        CERTBOT_MODE_LABEL="production"
        CERTBOT_SERVER_FLAG=""
        ;;
    *)
        usage
        exit 1
        ;;
esac

if [[ ! -f .env ]]; then
    echo "Error: .env file not found. Please create one based on .env.TEMPLATE" >&2
    exit 1
fi

# shellcheck disable=SC1091
source .env

if ! command -v docker-compose >/dev/null 2>&1 && ! (command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1); then
    echo 'Error: docker compose tooling is not installed or not accessible.' >&2
    exit 1
fi

if [[ -z "${NEXT_PUBLIC_BASE_URL:-}" ]]; then
    echo 'Error: NEXT_PUBLIC_BASE_URL is not set. Please update your .env file.' >&2
    exit 1
fi

if [[ "${NEXT_PUBLIC_BASE_URL}" == "localhost" ]]; then
    echo 'Error: NEXT_PUBLIC_BASE_URL cannot be localhost. Please update your .env file.' >&2
    exit 1
fi

if [[ -z "${SSL_CERT_EMAIL:-}" ]]; then
    echo 'Error: SSL_CERT_EMAIL is not set. Please update your .env file.' >&2
    exit 1
fi

PRIMARY_DOMAIN="${NEXT_PUBLIC_BASE_URL}"
DOMAINS=("${PRIMARY_DOMAIN}")

if [[ "${PRIMARY_DOMAIN}" != "www."* ]] && [[ "${PRIMARY_DOMAIN}" =~ ^[^.]+\.[^.]+$ ]]; then
    DOMAINS+=("www.${PRIMARY_DOMAIN}")
fi

if [[ -n "${NEXT_PUBLIC_WS_HOST:-}" && "${NEXT_PUBLIC_WS_HOST}" != "${PRIMARY_DOMAIN}" ]]; then
    DOMAINS+=("${NEXT_PUBLIC_WS_HOST}")
fi

deduped=()
for domain in "${DOMAINS[@]}"; do
    [[ -z "${domain}" ]] && continue
    found=0
    for existing in "${deduped[@]}"; do
        if [[ "${existing}" == "${domain}" ]]; then
            found=1
            break
        fi
    done
    if (( found == 0 )); then
        deduped+=("${domain}")
    fi
done
DOMAINS=("${deduped[@]}")

cat <<INFO
Using Let's Encrypt ${CERTBOT_MODE_LABEL} environment
Domains to include: ${DOMAINS[*]}
INFO

cat <<'DNS'
Confirm DNS records are in place:
  - Each domain resolves to this server's public IP (A/AAAA record or CNAME).
  - Port 80 is reachable from the internet (required for the HTTP-01 challenge).
DNS

read -rp "Press Enter to continue once DNS is ready..."

docker_compose() {
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose "$@"
    else
        docker compose "$@"
    fi
}

data_path="${HOME}/.playday/ssldata/certbot"
email="${SSL_CERT_EMAIL}"

if [[ -d "${data_path}" ]]; then
    read -rp "Existing certificate data detected at ${data_path}. Overwrite? (y/N) " decision
    if [[ ! "${decision}" =~ ^[Yy]$ ]]; then
        echo "Aborting."
        exit 0
    fi
fi

if [[ ! -e "${data_path}/conf/options-ssl-nginx.conf" || ! -e "${data_path}/conf/ssl-dhparams.pem" ]]; then
    echo "### Downloading recommended TLS parameters ..."
    mkdir -p "${data_path}/conf"
    curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "${data_path}/conf/options-ssl-nginx.conf"
    curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "${data_path}/conf/ssl-dhparams.pem"
    echo
fi

mkdir -p "${data_path}/conf/live/${PRIMARY_DOMAIN}"

echo "### Creating temporary self-signed certificate for nginx startup ..."
docker_compose run --rm --entrypoint "  openssl req -x509 -nodes -newkey rsa:2048 -days 1    -keyout '/etc/letsencrypt/live/${PRIMARY_DOMAIN}/privkey.pem'     -out '/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem'     -subj '/CN=localhost'" certbot >/dev/null

echo "### Starting nginx container ..."
docker_compose up -d nginx

echo "### Removing temporary certificate files ..."
docker_compose run --rm --entrypoint "  rm -Rf /etc/letsencrypt/live/${PRIMARY_DOMAIN} &&   rm -Rf /etc/letsencrypt/archive/${PRIMARY_DOMAIN} &&   rm -Rf /etc/letsencrypt/renewal/${PRIMARY_DOMAIN}.conf" certbot >/dev/null

certbot_args=(
    certbot certonly
    --webroot -w /var/www/certbot
    --non-interactive
    --agree-tos
    --keep-until-expiring
    --no-eff-email
    --key-type ecdsa
)

if [[ -n "${CERTBOT_SERVER_FLAG}" ]]; then
    certbot_args+=("${CERTBOT_SERVER_FLAG}")
fi

if [[ -n "${email}" ]]; then
    certbot_args+=(--email "${email}")
else
    certbot_args+=(--register-unsafely-without-email)
fi

for domain in "${DOMAINS[@]}"; do
    certbot_args+=(-d "${domain}")
done

echo "### Requesting ${CERTBOT_MODE_LABEL} certificate ..."
docker_compose run --rm certbot "${certbot_args[@]}"

echo "### Reloading nginx to serve the new certificate ..."
docker_compose exec nginx nginx -s reload

echo "### Performing renewal dry run (recommended by Certbot documentation) ..."
docker_compose run --rm certbot certbot renew --dry-run

echo
echo "Recommended next steps:"
echo "  - Schedule 'docker compose run --rm certbot certbot renew' via cron/systemd (runs idempotently)."
echo "  - After each successful renewal, reload nginx: 'docker compose exec nginx nginx -s reload'."
echo "  - Monitor ${data_path}/logs/ for renewal activity."
echo

echo "Certificate provisioning complete."
if [[ "${MODE}" =~ ^prod ]]; then
    echo "Production certificates are now installed for: ${DOMAINS[*]}"
else
    echo "Staging certificates were issued. Run the script again with 'production' before going live."
fi
