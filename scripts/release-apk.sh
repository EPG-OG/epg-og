#!/bin/sh
# Builds a new Android APK on EAS and publishes it as a GitHub release via the
# "Publish release" workflow (.github/workflows/release.yml), so the release is
# created by github-actions[bot]. The website's download button always points at
# the latest release, and the in-app banner announces it.
#
# Usage (Git Bash, from the project folder):
#   sh scripts/release-apk.sh v1.1.0 "Release notes in Markdown"
# Bump "version" in app.json first. Needs `eas login` and `gh auth login` done once.
set -e
TAG="$1"
NOTES="$2"
[ -n "$TAG" ] || { echo "usage: sh scripts/release-apk.sh vX.Y.Z \"notes\""; exit 1; }

echo "Starting EAS build (profile: apk)..."
ID=$(npx eas-cli@latest build --platform android --profile apk --non-interactive --no-wait --json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
echo "Build $ID queued. Waiting for it to finish (free-tier builds can take 15-40 minutes)..."

while :; do
  set -- $(npx eas-cli@latest build:view "$ID" --json 2>/dev/null \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s);console.log(b.status,(b.artifacts&&b.artifacts.buildUrl)||'')})")
  case "$1" in
    FINISHED) URL="$2"; break ;;
    ERRORED|CANCELED) echo "Build $1 - see https://expo.dev for logs"; exit 1 ;;
  esac
  sleep 60
done

echo "Build finished. Publishing $TAG on GitHub..."
gh workflow run release.yml -f tag="$TAG" -f apk_url="$URL" -f notes="$NOTES"
echo "Release workflow started: https://github.com/EPG-OG/epg-og/actions/workflows/release.yml"
