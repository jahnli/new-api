#!/bin/sh
set -eu

BUILD_VERSION=$(cat VERSION)
IMAGE="$DOCKER_USERNAME/ai-gateway"
docker buildx build \
  --platform "$BUILD_PLATFORMS" \
  --push \
  --tag "$IMAGE:latest" \
  --tag "$IMAGE:$BUILD_VERSION" \
  --build-arg "MODEL_SQUARE_AES_KEY=${MODEL_SQUARE_AES_KEY:-}" \
  --provenance=false \
  --cache-from "type=registry,ref=$IMAGE:latest" \
  --cache-to type=inline \
  .
docker buildx imagetools inspect "$IMAGE:$BUILD_VERSION"
printf 'Published: %s:latest and %s:%s\n' "$IMAGE" "$IMAGE" "$BUILD_VERSION"
