#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_PORT=3001
FRONTEND_PORT=5173

port_in_use() {
  local port="$1"
  ss -ltn "sport = :$port" | tail -n +2 | grep -q .
}

mkdir -p "$RUN_DIR"

cd "$ROOT_DIR"

if port_in_use "$BACKEND_PORT"; then
  echo "Backend port $BACKEND_PORT is already in use. Run ./stop_server.sh first."
  exit 1
fi

if port_in_use "$FRONTEND_PORT"; then
  echo "Frontend port $FRONTEND_PORT is already in use. Run ./stop_server.sh first."
  exit 1
fi

echo "Running validation checks..."
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build

echo "Starting backend on http://127.0.0.1:${BACKEND_PORT} ..."
(
  cd "$ROOT_DIR"
  exec env PORT="$BACKEND_PORT" node "$ROOT_DIR/backend/dist/main.js"
) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$BACKEND_PID_FILE"

sleep 2

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Backend failed to start. Check $BACKEND_LOG"
  rm -f "$BACKEND_PID_FILE"
  exit 1
fi

echo "Starting frontend on http://127.0.0.1:${FRONTEND_PORT} ..."
(
  cd "$ROOT_DIR"
  exec corepack pnpm --filter @open-deck/frontend exec vite --host 0.0.0.0
) >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >"$FRONTEND_PID_FILE"

sleep 2

if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo "Frontend failed to start. Check $FRONTEND_LOG"
  kill "$BACKEND_PID" 2>/dev/null || true
  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
  exit 1
fi

cat <<EOF
Open Deck is running.

Backend: http://127.0.0.1:3001
Frontend: http://127.0.0.1:5173

Logs:
  Backend:  $BACKEND_LOG
  Frontend: $FRONTEND_LOG

To stop both services, run:
  ./stop_server.sh
EOF
