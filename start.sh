#!/bin/bash

# Script to start both backend and frontend services

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    if [[ -n $BACKEND_PID ]]; then
        kill $BACKEND_PID 2>/dev/null || true
        echo -e "${GREEN}Backend stopped${NC}"
    fi
    if [[ -n $FRONTEND_PID ]]; then
        kill $FRONTEND_PID 2>/dev/null || true
        echo -e "${GREEN}Frontend stopped${NC}"
    fi
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

echo -e "${GREEN}Starting ACF Demo...${NC}"

# Start backend
echo -e "${YELLOW}Starting backend...${NC}"
cd backend
fastapi run main.py --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 4

# Start frontend
echo -e "${YELLOW}Starting frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}Services started successfully!${NC}"
echo -e "${GREEN}Backend running at: http://localhost:8000${NC}"
echo -e "${GREEN}Frontend running at: http://localhost:5173${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for background processes
wait
