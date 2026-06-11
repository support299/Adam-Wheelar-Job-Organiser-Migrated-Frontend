#!/bin/bash
set -e

EC2_HOST="ec2-54-241-171-151.us-west-1.compute.amazonaws.com"
EC2_USER="ubuntu"
EC2_KEY="$HOME/Downloads/adam_service_instance.pem"
REMOTE_DIR="/var/www/rdp-frontend"

echo "▶ Building frontend..."
npm run build

echo "▶ Creating remote directory..."
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" \
  "sudo mkdir -p $REMOTE_DIR && sudo chown $EC2_USER:$EC2_USER $REMOTE_DIR"

echo "▶ Uploading dist/..."
rsync -avz --delete \
  -e "ssh -i $EC2_KEY" \
  dist/ \
  "$EC2_USER@$EC2_HOST:$REMOTE_DIR"

echo "▶ Reloading nginx..."
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" "sudo systemctl reload nginx"

echo "✓ Done → https://go.performservice.net"
