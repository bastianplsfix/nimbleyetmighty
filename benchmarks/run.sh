#!/bin/bash

set -e

PORT=${PORT:-8000}
DURATION=${DURATION:-10s}
THREADS=${THREADS:-2}
CONNECTIONS=${CONNECTIONS:-10}

echo "=== Nimble Benchmark ==="
echo ""

# Check if wrk is installed
if ! command -v wrk &> /dev/null; then
    echo "Error: wrk is not installed"
    echo "Install with: brew install wrk (macOS) or apt-get install wrk (Linux)"
    exit 1
fi

# Start server in background
echo "Starting server on port $PORT..."
deno run --allow-net --allow-env server.ts &
SERVER_PID=$!

# Wait for server to start
sleep 1

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

echo ""
echo "=== Testing GET / ==="
wrk -t$THREADS -c$CONNECTIONS -d$DURATION http://localhost:$PORT/

echo ""
echo "=== Testing GET /json ==="
wrk -t$THREADS -c$CONNECTIONS -d$DURATION http://localhost:$PORT/json

echo ""
echo "Benchmark complete!"
