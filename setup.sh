#!/bin/bash
# Quick setup script for AV-Work project
set -e

echo "=========================================="
echo "AV-Work Quick Setup Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

command -v go >/dev/null 2>&1 || { echo -e "${RED}Go is not installed. Please install Go 1.24+${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is not installed. Please install Node 18+${NC}"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${YELLOW}pnpm not found. Install with: npm install -g pnpm${NC}"; }
command -v docker >/dev/null 2>&1 || { echo -e "${YELLOW}Docker not found (optional, but recommended for PostgreSQL)${NC}"; }

echo -e "${GREEN}✓ Prerequisites check complete${NC}"
echo ""

# PostgreSQL Setup
echo "=========================================="
echo "Step 1: PostgreSQL Setup"
echo "=========================================="
if command -v docker >/dev/null 2>&1; then
    read -p "Start PostgreSQL with Docker? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting PostgreSQL container..."
        docker run --rm \
          -e POSTGRES_USER=postgres \
          -e POSTGRES_PASSWORD=postgres \
          -e POSTGRES_DB=av_pipeline \
          -p 5432:5432 \
          --name avpg \
          -d postgres:15
        echo -e "${GREEN}✓ PostgreSQL started on localhost:5432${NC}"
        sleep 2
    fi
else
    echo -e "${YELLOW}Please ensure PostgreSQL is running and av_pipeline database exists${NC}"
    read -p "Press enter to continue..."
fi
echo ""

# Server Setup
echo "=========================================="
echo "Step 2: Server Setup"
echo "=========================================="
cd "$(dirname "$0")/server"

if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✓ Created server/.env${NC}"
    echo -e "${YELLOW}Review server/.env and update if needed${NC}"
else
    echo -e "${GREEN}✓ server/.env already exists${NC}"
fi

echo "Downloading Go modules..."
go mod download
echo -e "${GREEN}✓ Go modules downloaded${NC}"

echo "Running database migrations..."
go run main.go migrate
echo -e "${GREEN}✓ Database migrations complete${NC}"
echo ""

# Client Setup
echo "=========================================="
echo "Step 3: Client Setup"
echo "=========================================="
cd ../client

if command -v pnpm >/dev/null 2>&1; then
    echo "Installing client dependencies with pnpm..."
    pnpm install
else
    echo "Installing client dependencies with npm..."
    npm install
fi
echo -e "${GREEN}✓ Client dependencies installed${NC}"
echo ""

# Final Instructions
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To start the application:"
echo ""
echo -e "${GREEN}Terminal 1 - Start Server:${NC}"
echo "  cd $(dirname "$0")/server"
echo "  go run main.go"
echo ""
echo -e "${GREEN}Terminal 2 - Start Client:${NC}"
echo "  cd $(dirname "$0")/client"
if command -v pnpm >/dev/null 2>&1; then
    echo "  pnpm run dev"
else
    echo "  npm run dev"
fi
echo ""
echo -e "Server will run on: ${GREEN}http://localhost:8000${NC}"
echo -e "Client will run on: ${GREEN}http://localhost:5173${NC}"
echo ""
echo "For more details, see SETUP.md"
echo ""
