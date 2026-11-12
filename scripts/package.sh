#!/usr/bin/env bash
# Gera o .zip para enviar à Chrome Web Store: dist/refine-for-github-<versão>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
out="dist/refine-for-github-${version}.zip"
mkdir -p dist
rm -f "$out"
(cd extension && zip -qr -X "../$out" manifest.json icons popup src -x '*.DS_Store')
echo "$out"
unzip -l "$out"
