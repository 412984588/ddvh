#!/bin/bash
# Pack OpenClaw plugin for distribution

set -e

echo "📦 Packing Voice Hub OpenClaw plugin..."

VERSION=$(node -p "require('./packages/openclaw-plugin/package.json').version")
OUTPUT_DIR="dist/openclaw-plugin"
mkdir -p "$OUTPUT_DIR"

# Build plugin
echo "🔨 Building plugin..."
pnpm --filter @voice-hub/openclaw-plugin build

# Create package
echo "📁 Creating package..."
PKG_NAME="voice-hub-openclaw-v${VERSION}.tar.gz"
tar -czf "$OUTPUT_DIR/$PKG_NAME" \
  -C packages/openclaw-plugin \
  openclaw.plugin.json \
  dist/ \
  README.md 2>/dev/null || echo "No README found, skipping..."

echo "✅ Package created: $OUTPUT_DIR/$PKG_NAME"
echo ""
echo "To install:"
echo "  tar -xzf $OUTPUT_DIR/$PKG_NAME -C ~/.openclaw/plugins/"
