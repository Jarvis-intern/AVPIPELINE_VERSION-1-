#!/bin/bash

# Change to the project root directory
cd $HOME/av-pipeline

# Start Python backend (adjust path to main server file if needed)
echo "Starting Go backend on port 8000..."
./server/server &

# Move to frontend directory
cd client

# Start React frontend (pnpm or npm as appropriate)
echo "Starting React frontend on port 4173..."
pnpm preview &

# Wait for all background processes to finish
wait