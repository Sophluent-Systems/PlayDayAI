#!/bin/bash

echo "init.sh: Initializing MongoDB..."

MONGO_INITDB_ROOT_USERNAME=playday
MONGO_INITDB_ROOT_PASSWORD=asdf1234

echo "Checking if databases exist already..."

# Array of databases to restore
databases=("pd" "pd_acls")

NEED_TO_RESTORE=false

# Use username and password with admin auth
mongosh --quiet --eval "db.getSiblingDB('admin').auth('$MONGO_INITDB_ROOT_USERNAME', '$MONGO_INITDB_ROOT_PASSWORD')"

for db in "${databases[@]}"; do
    # Check if the database exists
    db_exists=$(mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase "admin" --eval "db.getMongo().getDBNames().includes('$db')")

    if [ "$db_exists" = true ]; then
        echo "Database $db already exists."
    else
        echo "Database $db does not exist. Flagging for restore..."
        NEED_TO_RESTORE=true
    fi
done

# Restore the databases

if [ "$NEED_TO_RESTORE" = true ]; then
    echo "Restoring databases..."
    mongorestore  --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase "admin" /dump
else
    echo "Databases already exist. Skipping restore."
fi
