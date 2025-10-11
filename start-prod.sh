#!/bin/bash

echo "🚀 Starting CountIn Production Environment"
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
docker-compose down 2>/dev/null

# Start services in detached mode
echo ""
echo "🏗️  Building and starting services..."
docker-compose up --build -d

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📊 Access points:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📝 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
