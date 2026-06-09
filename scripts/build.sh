#!/usr/bin/env bash
# Reproducible build script — see docs/REPRODUCIBLE_BUILDS.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
TAG="securemail-enterprise:${COMMIT:0:8}"

echo "Building $TAG ..."
docker build --no-cache -t "$TAG" .

echo "$COMMIT" > BUILD_COMMIT
docker inspect --format='{{.Id}}' "$TAG" > BUILD_IMAGE_ID

echo "Done."
echo "  Commit:  $COMMIT"
echo "  Image:   $TAG"
echo "  Image ID: $(cat BUILD_IMAGE_ID)"
