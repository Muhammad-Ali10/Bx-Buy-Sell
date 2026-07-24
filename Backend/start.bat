@echo off
REM Quick Start Script for Backend API (Windows)

echo 🚀 Starting Art Nest Lab Backend API...
echo.

REM Check if .env exists
if not exist .env (
    echo ⚠️  .env file not found!
    echo Creating .env from defaults...
    echo.
    (
        echo DATABASE_URL=mongodb://localhost:27017/ex-buy-sell-db
        echo PORT=1230
        echo JWT_SECRET=ThisIsTheSecretThatisUseForJWT
        echo JWT_REFRESH_SECRET=ThisIsTheSecretThatisUseForJWTRefresh
        echo REDIS_HOST=localhost:6379
        echo RABBIT_MQ=localhost:5672
        echo SENDGRID_API_KEY=
        echo EMAIL_SERVICE_FROM=
        echo AGORA_APP_ID=
        echo AGORA_APP_CERTIFICATE=
    ) > .env
    echo ✅ Created .env file. Please update with your values!
    echo.
)

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Generate Prisma client
echo 🔧 Generating Prisma client...
call npx prisma generate
echo.

REM Start the server
echo 🎯 Starting development server...
echo Backend will be available at: http://localhost:1230
echo API docs will be available at: http://localhost:1230/api
echo.
call npm run start:dev


























