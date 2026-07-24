#!/bin/bash

# Quick Start Script for Backend API

echo "🚀 Starting Art Nest Lab Backend API..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from docker-compose.yml defaults..."
    echo ""
    cat > .env << EOF
DATABASE_URL=mongodb://localhost:27017/ex-buy-sell-db
PORT=1230
JWT_SECRET=ThisIsTheSecretThatisUseForJWT
JWT_REFRESH_SECRET=ThisIsTheSecretThatisUseForJWTRefresh
REDIS_HOST=localhost:6379
RABBIT_MQ=localhost:5672
SENDGRID_API_KEY=
EMAIL_SERVICE_FROM=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
EOF
    echo "✅ Created .env file. Please update with your values!"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
echo ""

# Start the server
echo "🎯 Starting development server..."
echo "Backend will be available at: http://localhost:1230"
echo "API docs will be available at: http://localhost:1230/api"
echo ""
npm run start:dev


























