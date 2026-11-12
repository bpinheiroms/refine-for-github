#!/usr/bin/env bash
# Builds the store packages from extension/:
#   dist/refine-for-github-<version>-chrome.zip   → Chrome Web Store
#   dist/refine-for-github-<version>-firefox.zip  → addons.mozilla.org
#   dist/firefox/                                 → unpacked, for about:debugging
# The Firefox build is the same code with a Firefox manifest (the Python block below).
# On main, the Release workflow runs this and attaches both zips to release v<version>.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
files=(manifest.json icons popup src)
mkdir -p dist
rm -rf dist/firefox "dist/refine-for-github-${version}-"*.zip

chrome="dist/refine-for-github-${version}-chrome.zip"
(cd extension && zip -qr -X "../$chrome" "${files[@]}" -x '*.DS_Store')

# Firefox: no Chrome-only keys; add the add-on id and the data-collection
# declaration AMO requires (the extension collects nothing).
mkdir -p dist/firefox
(cd extension && cp -R "${files[@]}" ../dist/firefox/)
find dist/firefox -name .DS_Store -delete
python3 - <<'PY'
import json
p = "dist/firefox/manifest.json"
m = json.load(open(p))
m.pop("minimum_chrome_version", None)
m["browser_specific_settings"] = {"gecko": {
    "id": "refine-for-github@bpinheiroms",
    "strict_min_version": "142.0",
    "data_collection_permissions": {"required": ["none"]},
}}
json.dump(m, open(p, "w"), indent=2)
open(p, "a").write("\n")
PY
firefox="dist/refine-for-github-${version}-firefox.zip"
(cd dist/firefox && zip -qr -X "../$(basename "$firefox")" "${files[@]}")

echo "$chrome"
echo "$firefox"
