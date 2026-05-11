#!/bin/bash
# Deploy Hotel OTA to Render

cd "$(dirname "$0")"

echo "🏨 Deploying Hotel OTA to Render..."

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "Installing Render CLI..."
    npm install -g render-cli
fi

# Login check
echo "Please ensure you're logged in: render login"

# Deploy
echo "Deploying hotel-ota-api..."
render deploy --service=hotel-ota-api --yes

echo ""
echo "✅ Hotel OTA deployed!"
echo "Check: https://dashboard.render.com"
