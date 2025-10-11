#!/bin/bash

echo "🚀 Starting CountIn Development Environment"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker and try again"
    exit 1
fi

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.dev.yml down 2>/dev/null

# Start services
echo ""
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.dev.yml up --build

# This will run until Ctrl+C is pressed
echo ""
echo "✅ Services stopped"
