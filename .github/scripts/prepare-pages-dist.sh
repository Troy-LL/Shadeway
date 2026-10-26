#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

pnpm --filter @shadeway/web build

rm -rf .pages-dist
mkdir -p .pages-dist/data

cp -r apps/web/dist/. .pages-dist/
cp -r data/build/pilot/. .pages-dist/data/pilot/
