#!/usr/bin/env bash
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.0.0
#
# Updates version in all 3 files, commits, tags with v<version>, and pushes.

set -euo pipefail

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "❌  Usage: $0 <version>   (e.g. $0 1.0.0)"
  exit 1
fi

# Strip leading 'v' if user accidentally includes it
VERSION="${VERSION#v}"

TAG="v${VERSION}"

# ── Sanity checks ───────────────────────────────────────────────────────────
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌  Version must be semver (e.g. 1.0.0), got: $VERSION"
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌  Tag $TAG already exists. Delete it first: git tag -d $TAG && git push origin :$TAG"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌  Working tree has uncommitted changes. Commit or stash them first."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "🔖  Bumping to $TAG …"

# ── package.json ────────────────────────────────────────────────────────────
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/package.json"
echo "   ✅  package.json"

# ── src-tauri/tauri.conf.json ───────────────────────────────────────────────
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/src-tauri/tauri.conf.json"
echo "   ✅  src-tauri/tauri.conf.json"

# ── src-tauri/Cargo.toml (first occurrence = [package] version) ─────────────
# Use awk to only replace the first `version = "..."` line
awk -v ver="$VERSION" '
  !done && /^version = "[^"]*"/ { print "version = \"" ver "\""; done=1; next }
  { print }
' "$ROOT/src-tauri/Cargo.toml" > /tmp/Cargo.toml.tmp
mv /tmp/Cargo.toml.tmp "$ROOT/src-tauri/Cargo.toml"
echo "   ✅  src-tauri/Cargo.toml"

# ── Regenerate Cargo.lock (keeps it consistent) ─────────────────────────────
(cd "$ROOT/src-tauri" && cargo generate-lockfile --quiet 2>/dev/null || true)

# ── Commit & tag ────────────────────────────────────────────────────────────
git -C "$ROOT" add \
  package.json \
  src-tauri/tauri.conf.json \
  src-tauri/Cargo.toml \
  src-tauri/Cargo.lock

git -C "$ROOT" commit -m "chore: bump version to $VERSION"
git -C "$ROOT" tag -a "$TAG" -m "Release $TAG"

echo ""
echo "✅  Committed and tagged $TAG locally."
echo ""
echo "Push to trigger the release workflow:"
echo "   git push && git push origin $TAG"
echo ""
read -rp "Push now? [y/N] " PUSH
if [[ "$PUSH" =~ ^[Yy]$ ]]; then
  git -C "$ROOT" push
  git -C "$ROOT" push origin "$TAG"
  echo "🚀  Pushed — GitHub Actions will build and release $TAG"
fi
