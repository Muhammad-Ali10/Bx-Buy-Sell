@echo off
REM Quick Start Script for Frontend (Windows)

echo 🚀 Starting Art Nest Lab Frontend...
echo.

REM Check if .env exists
if not exist .env (
    echo ⚠️  .env file not found!
    echo Creating .env template...
    echo.
    (
        echo VITE_SUPABASE_URL=https://your-project.supabase.co
        echo VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
        echo VITE_API_BASE_URL=http://localhost:1230
        echo VITE_API_BEARER_TOKEN=
    ) > .env
    echo ✅ Created .env file. Please update with your Supabase credentials!
    echo.
)

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Start the dev server
echo 🎯 Starting development server...
echo Frontend will be available at: http://localhost:5173
echo.
call npm run dev


























