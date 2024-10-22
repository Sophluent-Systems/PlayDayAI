#!/bin/bash

# Require a parameter: "test" or "production"
if [ -z "$1" ]; then
    echo "Usage: $0 <test|production>"
    exit 1
fi

# Ensure the parameter is either "test" or "production"
if [ "$1" != "test" ] && [ "$1" != "production" ]; then
    echo "Usage: $0 <test|production>"
    exit 1
fi

# set the "staging" variable based on the parameter
if [ "$1" = "test" ]; then
    staging="--staging"
else
    staging=""
fi

# Load environment variables from .env file
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found. Please create one based on .env.TEMPLATE" >&2
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null && ! (command -v docker &> /dev/null && docker compose version &> /dev/null); then
    echo 'Error: docker command line tools are not installed or not accessible.' >&2
    exit 1
fi

# BASE_URL is required and must not be localhost
if [ -z "$BASE_URL" ]; then
    echo 'Error: BASE_URL is not set. Please update your .env file.' >&2
    exit 1
fi

if [ "$BASE_URL" = "localhost" ]; then
    echo 'Error: BASE_URL cannot be localhost. Please update your .env file.' >&2
    exit 1
fi

# SSL_CERT_EMAIL is required
if [ -z "$SSL_CERT_EMAIL" ]; then
    echo 'Error: SSL_CERT_EMAIL is not set. Please update your .env file.' >&2
    exit 1
fi

echo ""
echo "Configure your DNS settings:"
echo "   - Add an A record for your domain (${BASE_URL}) pointing to your server's IP address"
echo "   - Add a CNAME record for www.${BASE_URL} pointing to ${BASE_URL}"
echo ""

# Wait for the user to confirm that the DNS settings have been configured
read -p "Press Enter to continue after configuring your DNS settings..."


# Define a function to handle docker-compose
docker_compose() {
    if command -v docker-compose &> /dev/null; then
        # If docker-compose exists, use it
        docker-compose "$@"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        # If docker exists and has the compose subcommand, use it
        docker compose "$@"
    else
        echo "Error: docker-compose is not installed."
        exit 1
    fi
}

data_path="$HOME/.playday/ssldata/certbot"
email="${SSL_CERT_EMAIL}" 
key_type="ecdsa"
rsa_key_size=4096


if [ -d "$data_path" ]; then
    read -p "Existing data found for $BASE_URL. Continue and replace existing certificate? (y/N) " decision
    if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
        exit
    fi
fi

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
    echo "### Downloading recommended TLS parameters ..."
    mkdir -p "$data_path/conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
    echo
fi

echo "### Creating folder $data_path/conf/live/$BASE_URL ..."

echo "### Creating dummy certificate for $BASE_URL ..."
docker_compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '/etc/letsencrypt/live/$BASE_URL/privkey.pem' \
    -out '/etc/letsencrypt/live/$BASE_URL/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Starting nginx ..."
docker_compose up -d nginx
echo

echo "### Deleting dummy certificate for $BASE_URL ..."
docker_compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$BASE_URL && \
  rm -Rf /etc/letsencrypt/archive/$BASE_URL && \
  rm -Rf /etc/letsencrypt/renewal/$BASE_URL.conf" certbot
echo

# if staging, print that we're requesting a staging cert otherwise print that we're requesting a production cert
if [ "$staging" = "--staging" ]; then
    echo "### Requesting staging Let's Encrypt certificate for $BASE_URL ..."
else
    echo "### Requesting production Let's Encrypt certificate for $BASE_URL ..."
fi
domains=(${BASE_URL} www.${BASE_URL})
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
    "") email_arg="--register-unsafely-without-email" ;;
    *) email_arg="--email $email" ;;
esac

docker_compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --rsa-key-size $rsa_key_size \
    $email_arg \
    $domain_args \
    $staging \
    --agree-tos" certbot
echo

echo "### Reloading nginx ..."
docker_compose exec nginx nginx -s reload
echo

echo ""
echo "Recommended: Set up automatic renewal"
echo ""
echo "   To set up a cron job for automatic renewal, follow these steps:"
echo ""
echo "   a. Open the crontab editor for the current user:"
echo "      crontab -e"
echo ""
echo "   b. Add the following line to the crontab (adjust the path as needed):"
echo "      0 0,12 * * * cd $(pwd) && docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload"
echo ""
echo "   c. Save and exit the editor"
echo ""
echo "   Alternatively, you can use these commands to add the cron job without opening the editor:"
echo ""
echo "   (crontab -l 2>/dev/null; echo \"0 0,12 * * * cd $(pwd) && docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload\") | crontab -"
echo ""
echo "   This command will add the cron job to your current user's crontab without opening an editor."
echo ""
echo ""
echo "Installation complete. Your site should now be accessible via https://$BASE_URL and https://www.$BASE_URL"
echo ""