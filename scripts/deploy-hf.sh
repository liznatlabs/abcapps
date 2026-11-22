#!/bin/bash
# Publish the processing server to a Hugging Face Space (free CPU hardware).
#
#   ./scripts/deploy-hf.sh <username>/<space-name>
#
# Before the first run: create the Space at https://huggingface.co/new-space (SDK: Docker, blank),
# and sign in to git for huggingface.co with an access token that has write permission.
# Run it again whenever the server code changes.
set -euo pipefail
SPACE="${1:?Usage: ./scripts/deploy-hf.sh <username>/<space-name>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --depth 1 "https://huggingface.co/spaces/$SPACE" "$WORK/space"
cd "$WORK/space"
# replace the Space's contents with the server, keeping its git history
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r "$ROOT/server" "$ROOT/shared" "$ROOT/public" "$ROOT/package.json" "$ROOT/package-lock.json" "$ROOT/Dockerfile" .
cp "$ROOT/deploy/huggingface/README.md" README.md
# Spaces only allow writing under /tmp and the home folder
sed -i 's#FILEKIT_DATA_DIR=/data#FILEKIT_DATA_DIR=/tmp/filekit#; /^VOLUME \/data$/d; /mkdir -p \/data/d' Dockerfile
git add -A
git commit -q -m "Deploy The File Kit processing server" || { echo "Nothing changed."; exit 0; }
git push
echo "Pushed. The Space builds for a few minutes, then serves at: https://${SPACE/\//-}.hf.space"
