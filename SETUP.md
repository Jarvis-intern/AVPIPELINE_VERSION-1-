# AV-Work Setup Guide

Complete setup instructions for running the AV-Work project locally.

## Prerequisites

Install these tools before proceeding:

- **Go** 1.24+ - [Download](https://go.dev/dl/)
- **Node.js** 18+ - [Download](https://nodejs.org/)
- **pnpm** (recommended) or npm/yarn - Install: `npm install -g pnpm`
- **PostgreSQL** 12+ - Install locally or use Docker (recommended)
- **Python** 3.10+ (for email conversion features) - [Download](https://www.python.org/downloads/)
- **Docker** (optional, for easy PostgreSQL setup)

## Quick Start

### 1. Start PostgreSQL Database

**Option A: Using Docker (Recommended)**
```bash
docker run --rm \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=av_pipeline \
  -p 5432:5432 \
  --name avpg \
  -d postgres:15
```

**Option B: Using Local PostgreSQL**
```bash
# Create database
createdb av_pipeline

# Or via psql
psql -U postgres -c "CREATE DATABASE av_pipeline;"
```

### 2. Configure Server Environment

```bash
# Copy example environment file
cp server/.env.example server/.env

# Edit server/.env with your database credentials if needed
nano server/.env
```

### 3. Install Server Dependencies & Run Migrations

```bash
cd server

# Download Go modules
go mod download

# Run database migrations and seed data
go run main.go migrate

# Or just start the server (migrations run automatically)
go run main.go
```

The server will start on **http://localhost:8000**

### 4. Install and Run Client

Open a new terminal:

```bash
cd client

# Install dependencies
pnpm install
# Or: npm install

# Start development server
pnpm run dev
# Or: npm run dev
```

The client will start on **http://localhost:5173**

## Detailed Commands

### Server Commands

```bash
# Navigate to server directory
cd /home/vortex/Downloads/newav/server

# Download dependencies
go mod download

# Run migrations only (then exit)
go run main.go migrate

# Start development server
go run main.go

# Build production binary
go build -o server .

# Run production binary
./server
```

### Client Commands

```bash
# Navigate to client directory
cd /home/vortex/Downloads/newav/client

# Install dependencies
pnpm install

# Start development server (hot reload)
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Lint code
pnpm run lint
```

### Python Email Conversion Setup (Optional)

For advanced email conversions (PST/MSG files):

```bash
cd /home/vortex/Downloads/newav

# Create Python virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # Linux/Mac
# Or: .venv\Scripts\activate  # Windows

# Install Python dependencies
pip install -r server/lib/requirements.txt

# Test Python dependencies
python server/lib/test.py
```

**Note:** `pypff` and `libpff-python` require system libraries and can be challenging to install. The server will work without them, but PST file conversions may fail.

## Using the Convenience Script

The repository includes a `run.sh` script for production deployment:

```bash
# Make executable
chmod +x run.sh

# Edit paths in run.sh to match your setup
nano run.sh

# Run both server and client
./run.sh
```

**Note:** This script expects a pre-built server binary at `./server/server` and runs `pnpm preview` (production build preview).

## Environment Variables

### Server (.env in server/)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DB_HOST | Yes | - | PostgreSQL host (e.g., localhost) |
| DB_PORT | Yes | - | PostgreSQL port (e.g., 5432) |
| DB_USER | Yes | - | Database user |
| DB_PASS | Yes | - | Database password |
| DB_NAME | Yes | - | Database name (e.g., av_pipeline) |
| GIN_MODE | No | debug | Set to "release" for production |
| CORS_ALLOWED_ORIGINS | No | * | Comma-separated allowed origins |
| WEBSOCKET_ALLOWED_ORIGINS | No | * | Comma-separated WS origins |

### Client (.env.local in client/ - optional)

```bash
# API endpoint
VITE_API_URL=http://localhost:8000/api
```

## Verification

### Check Server
```bash
# Server health (check logs)
curl http://localhost:8000/

# WebSocket endpoint
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:8000/ws
```

### Check Client
Open browser: http://localhost:5173

## Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker ps | grep avpg
# Or for local install:
pg_isready -h localhost -p 5432

# Verify credentials in server/.env
cat server/.env

# Check PostgreSQL logs
docker logs avpg
```

### Port Already in Use
```bash
# Server (port 8000)
lsof -i :8000
# Kill process if needed
kill -9 <PID>

# Client (port 5173)
lsof -i :5173
# Or change port in vite.config.ts
```

### Go Module Issues
```bash
# Clear module cache
go clean -modcache

# Re-download modules
cd server
go mod download
go mod verify
```

### pnpm Not Found
```bash
# Install pnpm globally
npm install -g pnpm

# Or use npm instead
cd client
npm install
npm run dev
```

### Python Conversion Errors
```bash
# Check Python is available
python3 --version

# Test Python dependencies
python3 server/lib/test.py

# If pypff/libpff fails, install system dependencies (Ubuntu/Debian)
sudo apt-get install -y build-essential python3-dev libpff-dev

# Or skip Python features (server will still run)
```

### CORS Errors
Update `server/.env`:
```bash
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
WEBSOCKET_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

## Production Deployment

### Build Server
```bash
cd server
CGO_ENABLED=0 go build -ldflags="-s -w" -o server .
```

### Build Client
```bash
cd client
pnpm run build
# Output in: client/dist/
```

### Run Production
```bash
# Start server (from project root)
./server/server

# Serve client with nginx, Apache, or:
cd client
pnpm run preview
```

## Default Ports

- **Server (Go/Gin):** 8000
- **Client (Vite dev):** 5173
- **Client (Vite preview):** 4173
- **PostgreSQL:** 5432
- **WebSocket:** 8000/ws

## Next Steps

1. Access the client UI at http://localhost:5173
2. Check server logs for any startup errors
3. Test file upload and conversion features
4. Review API routes in `server/routes/` for available endpoints
5. Check WebSocket integration in `server/handlers/ws_handler.go`

## Development Tips

```bash
# Watch server logs
cd server
go run main.go 2>&1 | tee server.log

# Hot reload client (automatic with vite)
cd client
pnpm run dev

# Run database migrations only
cd server
go run main.go migrate

# Reset database (caution!)
psql -U postgres av_pipeline -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
go run main.go migrate
```

## Support

For issues:
1. Check server logs in `server/logs/`
2. Verify all environment variables are set correctly
3. Ensure all prerequisites are installed
4. Check that ports 5173, 8000, and 5432 are available
