#!/bin/bash
# Stop any running copy (found by its port) and start the app again.
cd "$(dirname "$0")"
PORT="${PORT:-5123}"
PID=$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | head -1)
[ -n "$PID" ] && kill "$PID" && sleep 0.5
PORT="$PORT" nohup node server/index.js > data/server.log 2>&1 &
sleep 1.2; tail -1 data/server.log
