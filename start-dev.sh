#!/bin/bash
# Start script for development
# This script starts both server and client in separate terminal windows
#!/usr/bin/env bash
# Start script for development (portable)
set -euo pipefail

echo "Starting AV-Work Development Environment..."

# Resolve the script directory so paths are relative to repository root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"

LOG_FILE="/tmp/avp-server.log"

cleanup() {
    echo "\nShutting down services..."
    [ -n "${CLIENT_PID:-}" ] && kill "${CLIENT_PID}" 2>/dev/null || true
    [ -n "${SERVER_PID:-}" ] && kill "${SERVER_PID}" 2>/dev/null || true
    echo "Stopped. Logs: $LOG_FILE"
    exit 0
}

trap cleanup INT TERM

echo "Using project directory: $SCRIPT_DIR"

# Ensure server directory exists
if [ ! -d "$SERVER_DIR" ]; then
    echo "Error: server directory not found at $SERVER_DIR"
    exit 1
fi

echo "Starting PostgreSQL if not running..."
if command -v systemctl >/dev/null 2>&1; then
    if ! sudo systemctl is-active --quiet postgresql; then
        echo "Starting PostgreSQL..."
        sudo systemctl start postgresql || true
    fi
fi

echo "Starting Go server on http://localhost:8000..."
cd "$SERVER_DIR"
# Run server and capture logs
nohup sh -c 'go run main.go' > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID (logs -> $LOG_FILE)"

sleep 2

# Start client (detect package manager)
if [ ! -d "$CLIENT_DIR" ]; then
    echo "Warning: client directory not found at $CLIENT_DIR — frontend won't start."
else
    echo "Starting frontend on http://localhost:5173..."
    cd "$CLIENT_DIR"

    if command -v pnpm >/dev/null 2>&1 && grep -q 'dev' package.json; then
        PNPM=true
    else
        PNPM=false
    fi

    if $PNPM; then
        (pnpm run dev) &
        CLIENT_PID=$!
    elif command -v npm >/dev/null 2>&1 && grep -q 'dev' package.json; then
        (npm run dev) &
        CLIENT_PID=$!
    else
        echo "No package manager with a 'dev' script found (pnpm/npm). Frontend not started."
    fi
    echo "Client PID: ${CLIENT_PID:-not-started}"
fi

echo ""
echo "AV-Work is running. Backend logs: $LOG_FILE"
echo "Press Ctrl+C to stop both services."

# Wait until interrupted
while true; do
    sleep 1
done
