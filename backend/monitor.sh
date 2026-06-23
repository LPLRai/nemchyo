#!/usr/bin/env bash
# Nemchyo server monitor — run from cron every 5 minutes.
#
# What it does:
#   • Disk alert  — phone push (ntfy.sh) when the data disk gets too full.
#   • Server-down — phone push when PocketBase stops responding.
#   • Uptime ping — pings a healthchecks.io check while healthy, so you get
#                   alerted if the WHOLE laptop goes offline (a dead machine
#                   can't push you itself — healthchecks notices the missing ping).
#
# Setup (see DEPLOY.md "Monitoring"):
#   1. Install the free "ntfy" app on your phone, subscribe to your NTFY_TOPIC.
#   2. (Optional, recommended) create a free check at https://healthchecks.io
#      and put its ping URL in HEALTHCHECK_URL.
#   3. Edit the values below, then add to cron:
#        */5 * * * * /home/<you>/nemchyo/backend/monitor.sh

# ---- configure these ----
NTFY_TOPIC="${NTFY_TOPIC:-nemchyo-CHANGE-ME-to-something-secret}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"                       # e.g. https://hc-ping.com/<your-uuid>
DISK_THRESHOLD="${DISK_THRESHOLD:-85}"                       # percent
PB_HEALTH="${PB_HEALTH:-http://127.0.0.1:8090/api/health}"
DATA_PATH="${DATA_PATH:-$HOME/nemchyo-server/pb_data}"
# -------------------------

notify() { # title, message, priority(optional)
  curl -fsS -m 10 \
    -H "Title: $1" \
    -H "Priority: ${3:-high}" \
    -H "Tags: warning" \
    -d "$2" "https://ntfy.sh/${NTFY_TOPIC}" >/dev/null 2>&1 || true
}

# 1) disk usage of the data partition
USE=$(df --output=pcent "$DATA_PATH" 2>/dev/null | tail -1 | tr -dc '0-9')
if [ -n "$USE" ] && [ "$USE" -ge "$DISK_THRESHOLD" ]; then
  notify "Nemchyo disk ${USE}% full" "Server disk is ${USE}% full (limit ${DISK_THRESHOLD}%). Free space soon or new media/messages will fail to save."
fi

# 2) PocketBase health  ->  3) only ping uptime when actually healthy
if ! curl -fsS -m 10 "$PB_HEALTH" >/dev/null 2>&1; then
  notify "Nemchyo is DOWN" "PocketBase isn't responding. Check: sudo systemctl status pocketbase"
else
  [ -n "$HEALTHCHECK_URL" ] && curl -fsS -m 10 "$HEALTHCHECK_URL" >/dev/null 2>&1 || true
fi
