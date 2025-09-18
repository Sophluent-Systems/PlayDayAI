#!/bin/bash
# Check if .env exists
if [ ! -f .env ]; then
    echo ".env file not found!  Please create one based on .env.TEMPLATE"
    exit 1
fi

# Load environment variables from .env
source .env
echo "Deploying PlayDay.ai..."

# If NODE_ENV is not set, default to production
if [ -z "$NODE_ENV" ]; then
    NODE_ENV="production"
fi

# Set up prerequisite data directories
DATA_DIR="$HOME/.playday"
if [ ! -d "$DATA_DIR" ]; then
    echo "Creating data directory $DATA_DIR..."
    mkdir -p $DATA_DIR
fi

# Warn that if $NODE_ENV is not set to production
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
        docker-compose "$@"
    elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose "$@"
    else
        echo "Error: docker-compose is not installed."
        exit 1
    fi
}

# Stop execution if any command fails
set -e

NEW_TAG="v$(date +%s)"

# Function to get Docker image name for a service
get_image_name() {
    service=$1
    # Extract the image name from docker-compose.yaml and strip the tag if present
    image_name=$(grep -A 10 "^  $service:" docker-compose.yaml | grep "^    image:" | head -n 1 | awk '{print $2}' | cut -d: -f1)
    echo $image_name
}

# Function to check if service uses DockerHub image
is_dockerhub_image() {
    service=$1
    # Parse docker-compose.yaml to check if the service has an explicit image defined
    # and doesn't have a build context
    if grep -A 10 "^  $service:" docker-compose.yaml | grep -q "^    image:" && \
       ! grep -A 10 "^  $service:" docker-compose.yaml | grep -q "^    build:"; then
        return 0  # True, it's a DockerHub image
    else
        return 1  # False, it's not a DockerHub image
    fi
}

# Function to install a service
install_service() {
    service=$1
    echo "Installing $service..."
    # Bring up the service in detached mode
    docker_compose up -d --build $service
    
    if is_dockerhub_image $service; then
        # For DockerHub images, get the base image name (without tag) and tag it
        image_name=$(get_image_name $service)
        if [ ! -z "$image_name" ]; then
            # Get the actual running container ID for this service
            container_id=$(docker_compose ps -q $service)
            if [ ! -z "$container_id" ]; then
                # Get the actual image ID being used
                image_id=$(docker inspect --format='{{.Image}}' $container_id)
                echo "Tagging running image $image_id for $service with $NEW_TAG..."
                docker tag $image_id $image_name:$NEW_TAG
            fi
        fi
    else
        # For local builds
        if [ -f $service/Dockerfile ]; then
            echo "Tagging locally built image for $service..."
            docker tag $service:latest $service:$NEW_TAG
        fi
    fi
}

cleanup_service() {
    service=$1
    if is_dockerhub_image $service; then
        image_name=$(get_image_name $service)
        if [ ! -z "$image_name" ]; then
            echo "Cleaning up old images for $image_name..."
            
            # Get all tags for this image, excluding <none>
            ALL_TAGS=$(docker images --format "{{.Tag}}" "$image_name" | grep -v "^$" | grep -v "<none>")
            
            if [ ! -z "$ALL_TAGS" ]; then
                echo "$ALL_TAGS" | while read -r tag; do
                    # Skip if it's a protected tag or our new tag
                    if [[ "$tag" == "latest" ]] || \
                       [[ "$tag" == "3-management-alpine" ]] || \
                       [[ "$tag" == "$NEW_TAG" ]]; then
                        continue
                    fi
                    
                    # Construct full image reference
                    full_image="$image_name:$tag"
                    
                    # Get creation date of this image
                    if docker inspect "$full_image" >/dev/null 2>&1; then
                        IMAGE_DATE=$(docker inspect --format='{{.Created}}' "$full_image")
                        NEW_IMAGE_DATE=$(docker inspect --format='{{.Created}}' "$image_name:$NEW_TAG")
                        
                        # If this image is older than our new image, remove it
                        if [[ "$IMAGE_DATE" < "$NEW_IMAGE_DATE" ]]; then
                            echo "Removing old image: $full_image"
                            docker rmi "$full_image" --force || true
                        fi
                    fi
                done
            fi
        fi
    else
        if [ -f $service/Dockerfile ]; then
            echo "Cleaning up old locally built images for $service..."
            # Get all tags for this service, excluding <none>
            OLD_TAGS=$(docker images --format "{{.Tag}}" "$service" | grep -v "^$" | grep -v "<none>")
            
            if [ ! -z "$OLD_TAGS" ]; then
                echo "$OLD_TAGS" | while read -r tag; do
                    if [[ "$tag" != "latest" ]] && [[ "$tag" != "$NEW_TAG" ]]; then
                        full_image="$service:$tag"
                        echo "Removing old image: $full_image"
                        docker rmi "$full_image" --force || true
                    fi
                done
            fi
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