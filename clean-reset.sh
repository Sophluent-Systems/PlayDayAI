#!/bin/bash

# This script is used to reset the environment to a clean state. It is useful when you want to start over with a fresh installation.

# Core services that are always installed
CORE_SERVICES="frontend taskserver"
# Combine core and optional services
ALL_SERVICES="rabbitmq mongodb certbot nginx $CORE_SERVICES"

# Check twice before running this script. It will remove all data and configurations.
echo
echo
echo "********************************************"
echo "WARNING: This script will remove all data and configurations!!!!"
echo "********************************************"
echo
echo
read -p "This script will remove all data and configurations. Are you sure you want to continue? (Y/N) " -n 1 -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Exiting..."
    exit 1
fi

# Ask again to confirm and require the user to type "yes" to proceed
echo
echo "********************************************"
echo "FINAL WARNING: This script will remove ALL:"
echo "- Docker containers"
echo "- MongoDB data"
echo "- Account data"
echo "- SSL Certificates"
echo "- Nginx configurations"
echo "- All the playday apps and services that have been created"
echo "********************************************"
echo
echo "This operation CANNOT be undone!!!"
echo "If you're ABSOLUTELY sure, type 'yes' then hit RETURN to proceed."
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Exiting..."
    exit 1
fi

# Stop and remove all running containers
docker-compose down

# Function to remove all docker containers/volumes/etc for one service
function remove_service {
    docker-compose rm -f -v $1

    # get all images for this service
    images=$(docker images | grep $1 | awk '{print $3}')

    # loop through all images and remove them
    for image in $images; do
        docker rmi -f $image
    done
}

# Remove all services
for service in $ALL_SERVICES; do
    remove_service $service
done

# Remove all data and configurations
echo "Removing data directory ~/.playday, sudo password may be required..."
sudo rm -rf ~/.playday

echo "Environment has been reset to a clean state."

# End of script