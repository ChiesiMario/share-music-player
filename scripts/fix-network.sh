#!/bin/bash
set -e

cd /docker/share-music-player

# Remove the ambiguous networks
docker network ls --filter name=share-music-player_default -q | xargs -r docker network rm || true

# Prune unused networks just in case
docker network prune -f

# Start the container
docker-compose up -d
