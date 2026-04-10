#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_PORT=3001
FRONTEND_PORT=5173

stop_process() {
  local name="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$name is not running from this repo."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" 2>/dev/null; then
    local child_pids
    child_pids="$(pgrep -P "$pid" || true)"

    if [[ -n "$child_pids" ]]; then
      kill $child_pids 2>/dev/null || true
    fi

    kill "$pid"

    for _ in {1..20}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.25
    done

    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi

    if [[ -n "${child_pids:-}" ]]; then
      kill -9 $child_pids 2>/dev/null || true
    fi

    echo "Stopped $name (PID $pid)."
  else
    echo "$name process $pid was not running."
  fi

  rm -f "$pid_file"
}

stop_port_listener() {
  local name="$1"
  local port="$2"
  local pids

  pids="$(ss -ltnp "sport = :$port" 2>/dev/null | awk -F 'pid=' 'NF > 1 {split($2, a, ","); print a[1]}' | sort -u)"

  if [[ -z "$pids" ]]; then
    return
  fi

  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.5

      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi

      echo "Stopped $name listener on port $port (PID $pid)."
    fi
  done
}

stop_process "frontend" "$FRONTEND_PID_FILE"
stop_process "backend" "$BACKEND_PID_FILE"
stop_port_listener "frontend" "$FRONTEND_PORT"
stop_port_listener "backend" "$BACKEND_PORT"
