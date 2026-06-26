#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Building…"
npm run build

echo "→ Installing globally…"
npm install -g .

echo "✓ Done — omm $(omm --version 2>/dev/null || echo 'installed')"
