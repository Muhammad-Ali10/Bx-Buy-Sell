# PowerShell script to restart the entire project
# This will stop existing servers and start fresh backend and frontend

Write-Host "🔄 Restarting Art Nest Lab Project..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js found: $(node --version)" -ForegroundColor Green
Write-Host ""

# Stop existing Node.js processes (optional - uncomment if you want to kill all node processes)
# Write-Host "🛑 Stopping existing Node.js processes..." -ForegroundColor Yellow
# Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
# Start-Sleep -Seconds 2
# Write-Host "✅ Existing processes stopped" -ForegroundColor Green
# Write-Host ""

# Function to start backend
function Start-Backend {
    Write-Host "📦 Starting Backend API..." -ForegroundColor Cyan
    Set-Location "ex-buy-sell-apis"
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "📥 Installing backend dependencies..." -ForegroundColor Yellow
        npm install
    }
    
    Write-Host "🔄 Starting backend server on http://localhost:1230" -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run start:dev"
    Set-Location ..
}

# Function to start frontend
function Start-Frontend {
    Write-Host "🎨 Starting Frontend..." -ForegroundColor Cyan
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "📥 Installing frontend dependencies..." -ForegroundColor Yellow
        npm install
    }
    
    Write-Host "🔄 Starting frontend server on http://localhost:5173" -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"
}

# Start both servers
Start-Backend
Start-Sleep -Seconds 3
Start-Frontend

Write-Host ""
Write-Host "✅ Project started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Backend API: http://localhost:1230" -ForegroundColor Cyan
Write-Host "📍 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "📍 API Docs: http://localhost:1230/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Two PowerShell windows have been opened:" -ForegroundColor Yellow
Write-Host "   1. Backend server (ex-buy-sell-apis)" -ForegroundColor White
Write-Host "   2. Frontend server (root directory)" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this script (servers will continue running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

