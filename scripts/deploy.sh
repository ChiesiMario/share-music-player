#!/bin/bash
set -e

mkdir -p /docker/share-music-player
cd /docker/share-music-player

cat << 'EOF' > docker-compose.yaml
version: '3.8'

services:
  app:
    build: .
    container_name: share-music-player
    ports:
      - "29099:8000"
    volumes:
      - uploads_data:/usr/src/app/uploads
      - cache_data:/usr/src/app/.cache
    environment:
      - UPLOAD_PASSWORD=MBrr8pmz8qptGkjSYxEe
    restart: unless-stopped

volumes:
  uploads_data:
  cache_data:
EOF

if [ ! -d ".git" ]; then
  git init
  git remote add origin https://github.com/ChiesiMario/share-music-player.git
fi
git fetch --all
git reset --hard origin/main

docker-compose up -d --build
