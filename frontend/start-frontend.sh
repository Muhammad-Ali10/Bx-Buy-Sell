#!/bin/bash

# Quick Start Script for Frontend

echo "🚀 Starting Art Nest Lab Frontend..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env template..."
    echo ""
    cat > .env << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_API_BASE_URL=http://localhost:1230
VITE_API_BEARER_TOKEN=
EOF
    echo "✅ Created .env file. Please update with your Supabase credentials!"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the dev server
echo "🎯 Starting development server..."
echo "Frontend will be available at: http://localhost:5173"
echo ""
npm run dev


























