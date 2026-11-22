#!/bin/bash
# Deploy the website to Vercel from this machine.
#
#   ./scripts/deploy.sh            deploy once
#   ./scripts/deploy.sh --watch    deploy now, then again whenever a file changes
#
# First run `npx vercel login` and `npx vercel link` once. Set SITE_URL and API_URL in the Vercel
# project's Environment Variables (or export them before running this).
set -euo pipefail
cd "$(dirname "$0")/.."

deploy() {
  for f in server/*.js shared/*.js public/*.js scripts/*.mjs; do node --check "$f"; done
  npx --yes vercel@latest deploy --prod --yes
}

deploy
[ "${1:-}" = "--watch" ] || exit 0

echo "Watching for changes (Ctrl+C to stop)…"
stamp() { find public shared server scripts vercel.json -type f -printf '%T@ %p\n' | sort | md5sum; }
last=$(stamp)
while sleep 3; do
  now=$(stamp)
  if [ "$now" != "$last" ]; then
    last=$now
    echo "Change detected at $(date +%H:%M:%S) — deploying"
    deploy || echo "Deploy failed; waiting for the next change."
  fi
done
