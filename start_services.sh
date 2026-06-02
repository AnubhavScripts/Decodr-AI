#!/bin/bash

echo "🚀 Starting HookIQ Services..."

# 1. Start Database
echo "📦 Starting PostgreSQL database..."
docker-compose up -d

# 2. Start Backend
echo "⚙️  Starting FastAPI Backend on port 8023..."
cd backend
./venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8023 &
BACKEND_PID=$!
cd ..

# Wait a couple of seconds for backend to initialize
sleep 2

# 3. Start Frontend
echo "🎨 Starting Next.js Frontend on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ All services are up and running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8023"
echo ""
echo "Press Ctrl+C to shut down both services gracefully."

# 4. Handle Shutdown (Trap Ctrl+C)
trap "echo 'Shutting down services...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# Wait forever until interrupted
wait
