#!/bin/bash
set -e

cat << 'EOF' > /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://dockerpull.com",
    "https://docker.m.daocloud.io",
    "https://mirror.baidubce.com",
    "https://hub-mirror.c.163.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF

systemctl daemon-reload
systemctl restart docker

cd /docker/share-music-player
docker-compose up -d --build
