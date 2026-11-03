#!/bin/sh
# Builds a new Android APK on EAS and publishes it as a GitHub release.
# The download button on the website always points at the latest release.
#
# Usage (Git Bash, from the project folder):  sh scripts/release-apk.sh v1.1.0
# Needs: `eas login` and `gh auth login` done once on this machine.
set -e
TAG="$1"
[ -n "$TAG" ] || { echo "usage: sh scripts/release-apk.sh vX.Y.Z"; exit 1; }

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

mkdir -p .release && curl -sSL -o .release/EPG-OG.apk "$URL"
gh release create "$TAG" .release/EPG-OG.apk --title "EPG OG $TAG" --generate-notes
gh release view "$TAG" --json url --jq .url
