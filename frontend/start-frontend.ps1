# Start Frontend Server Only
Write-Host "🎨 Starting Frontend..." -ForegroundColor Green

if (-not (Test-Path "node_modules")) {
    Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "🔄 Starting frontend on http://localhost:5173" -ForegroundColor Cyan
npm run dev
























