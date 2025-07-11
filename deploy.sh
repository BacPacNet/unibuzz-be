#!/bin/bash

# Production Deployment Script for Unibuzz Backend
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
echo "🚀 Deploying to $ENVIRONMENT environment..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please copy env.production.example to .env.production and configure it."
    exit 1
fi

# Build the application
echo "📦 Building application..."
yarn compile

# Build Docker image
echo "🐳 Building Docker image..."
docker build -f Dockerfile.prod -t unibuzz-api:latest .

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down || true

# Start new containers
echo "▶️ Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 15

# Health check
echo "🏥 Performing health check..."
if curl -f http://localhost:3000/v1/health > /dev/null 2>&1; then
    echo "✅ Deployment successful! Application is healthy."
    echo "🌐 API is running at: http://localhost:3000"
    echo "📊 Health check: http://localhost:3000/v1/health"
    echo "🔴 Redis is running at: localhost:6379"
else
    echo "❌ Health check failed! Check logs with: docker-compose -f docker-compose.prod.yml logs -f"
    exit 1
fi

echo "🎉 Deployment completed successfully!" 