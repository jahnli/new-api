#!/bin/sh
set -eu

BUILD_VERSION=$(cat VERSION)
export GOWORK=off CGO_ENABLED=1
go mod download
PGO="$(go list -m -f '{{.Dir}}' github.com/MoeForge/moejs)/default.pgo"
mkdir -p release-assets

case "$1" in
  linux)
    GOOS=linux GOARCH=amd64 CC=gcc go build -pgo="$PGO" \
      -ldflags "-s -w -X github.com/QuantumNous/new-api/common.Version=$BUILD_VERSION -extldflags '-static'" \
      -o "release-assets/ai-gateway-linux-amd64-$BUILD_VERSION"
    GOOS=linux GOARCH=arm64 CC=aarch64-linux-gnu-gcc go build -pgo="$PGO" \
      -ldflags "-s -w -X github.com/QuantumNous/new-api/common.Version=$BUILD_VERSION -extldflags '-static'" \
      -o "release-assets/ai-gateway-linux-arm64-$BUILD_VERSION"
    cp LICENSE NOTICE THIRD-PARTY-LICENSES.md release-assets/
    (cd release-assets && sha256sum ai-gateway-linux-* > checksums-linux.txt)
    ;;
  macos)
    ARCH=$(go env GOHOSTARCH)
    GOOS=darwin GOARCH="$ARCH" go build -pgo="$PGO" \
      -ldflags "-X github.com/QuantumNous/new-api/common.Version=$BUILD_VERSION" \
      -o "release-assets/ai-gateway-macos-$ARCH-$BUILD_VERSION"
    (cd release-assets && shasum -a 256 ai-gateway-macos-* > checksums-macos.txt)
    ;;
  *)
    echo "Unsupported release target: $1" >&2
    exit 1
    ;;
esac
