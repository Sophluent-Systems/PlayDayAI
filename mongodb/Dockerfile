# Base on offical mongo image
FROM mongo

# Install wget and gnupg for adding the MongoDB repository
RUN apt-get update && apt-get install -y wget gnupg

# Add MongoDB public GPG Key
RUN wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -

# Add the MongoDB repository
RUN echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package list and install mongosh and database tools
RUN apt-get update && apt-get install -y mongodb-mongosh mongodb-database-tools

# Clean up APT when done
RUN rm -rf /var/lib/apt/lists/*

COPY ./init-mongo.sh /docker-entrypoint-initdb.d/init-mongo.sh
COPY ./mongod.conf /etc/mongod.conf
COPY ./dump /dump

# ensure init.sh is executable
RUN chmod +x /docker-entrypoint-initdb.d/init-mongo.sh

EXPOSE 27017


