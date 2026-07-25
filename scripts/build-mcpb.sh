#!/usr/bin/env bash
# Build the self-contained MCPB bundle published on the releases page.
#
#   ./scripts/build-mcpb.sh          -> dist/mcp-ai-slop-checker.mcpb + its SHA-256
#
# The SHA it prints is the one that must go in server.json (`fileSha256`) and in
# the README, so an installer can verify the file it downloaded.

set -euo pipefail
cd "$(dirname "$0")/.."

OUT="dist/mcp-ai-slop-checker.mcpb"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/server" dist
cp -R src "$STAGE/server/src"
cp package.json package-lock.json README.md LICENSE "$STAGE/server/"
cp manifest.json "$STAGE/manifest.json"

npm ci --omit=dev --prefix "$STAGE/server" --silent

rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OLDPWD/$OUT" manifest.json server)

shasum -a 256 "$OUT"
ls -l "$OUT"
