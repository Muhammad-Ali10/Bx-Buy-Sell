# Start Backend Server Only
Write-Host "🚀 Starting Backend API..." -ForegroundColor Green
Set-Location "ex-buy-sell-apis"

if (-not (Test-Path "node_modules")) {
    Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "🔄 Starting backend on http://localhost:1230" -ForegroundColor Cyan
npm run start:dev
























