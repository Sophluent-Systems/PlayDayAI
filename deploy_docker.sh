#!/bin/bash

# Check if .env.docker exists
if [ ! -f .env ]; then
    echo ".env file not found!  Please create one based on .env.TEMPLATE"
    exit 1
fi

# Load environment variables from .env.docker
source .env

echo "Deploying PlayDay.ai..."

# If NODE_ENV is not set, default to production
if [ -z "$NODE_ENV" ]; then
    NODE_ENV="production"
fi

#
# Set up prerequisite data directories
#

# Create the data directory if it doesn't exist ($HOME/.playday)
DATA_DIR="$HOME/.playday"
if [ ! -d "$DATA_DIR" ]; then
    echo "Creating data directory $DATA_DIR..."
    mkdir -p $DATA_DIR
fi

# Warn that if $NODE_ENV is not production, we will override as "production"
# for the frontend because this is required by NextJS and we will
# ask for user input to continue

if [ "$NODE_ENV" != "production" ]; then
    echo "Warning: NODE_ENV is not set to 'production'."
    echo "This will be overridden to 'production' for the frontend service."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 1
    fi
fi

NODE_ENV="production"

# Core services that are always installed
CORE_SERVICES="frontend taskserver"

# Combine core and optional services
ALL_SERVICES="rabbitmq mongodb certbot nginx $CORE_SERVICES"

SERVICES_TO_INSTALL="$OPTIONAL_SERVICES $CORE_SERVICES"

echo "Installing services: $SERVICES_TO_INSTALL"

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


# Stop execution if any command fails
set -e

NEW_TAG="v$(date +%s)" # Using a timestamp as the version tag for simplicity

# Function to install a service
install_service() {
    service=$1
    echo "Installing $service..."
    
    # Bring up the service in detached mode
    docker_compose up -d --build $service

    # If there's a Dockerfile for this image, tag it
    if [ -f $service/Dockerfile ]; then
        # Tag the new image
        docker tag $service:latest $service:$NEW_TAG
    fi
}

cleanup_service() {
    service=$1

    if [ -f $service/Dockerfile ]; then
        # Find old containers for this service
        OLD_CONTAINERS=$(docker images --filter "reference=$service" --filter "before=$service:$NEW_TAG" --format "{{.Repository}}:{{.Tag}}")

        # Remove the old containers
        if [ -n "$OLD_CONTAINERS" ]; then
            echo "Removing old $service containers..."
            docker rmi $OLD_CONTAINERS --force
        fi
    fi
}

# Install all services
for service in $SERVICES_TO_INSTALL; do
    install_service $service
done

for service in $SERVICES_TO_INSTALL; do
    cleanup_service $service
done

echo "Deployment completed successfully."
