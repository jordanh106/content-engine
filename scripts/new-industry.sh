#!/bin/bash
# new-industry.sh - Scaffold a new industry content pack
# Usage: bash scripts/new-industry.sh <industry-slug>
# Example: bash scripts/new-industry.sh dental

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_DIR="$REPO_DIR/industries/_template"
INDUSTRIES_DIR="$REPO_DIR/industries"

if [ -z "$1" ]; then
    echo "Usage: bash scripts/new-industry.sh <industry-slug>"
    echo "Example: bash scripts/new-industry.sh dental"
    exit 1
fi

SLUG="$1"
TARGET="$INDUSTRIES_DIR/$SLUG"

if [ -d "$TARGET" ]; then
    echo "Error: Industry '$SLUG' already exists at $TARGET"
    exit 1
fi

echo "Creating new industry pack: $SLUG"
cp -r "$TEMPLATE_DIR" "$TARGET"

# Replace placeholder text in config.json
if [ -f "$TARGET/config.json" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/INDUSTRY_NAME/$SLUG/g" "$TARGET/config.json"
    else
        sed -i "s/INDUSTRY_NAME/$SLUG/g" "$TARGET/config.json"
    fi
fi

echo ""
echo "Created: $TARGET/"
echo ""
ls -la "$TARGET/"
echo ""
echo "Next steps:"
echo "  1. Edit $TARGET/config.json with your industry's audiences and conditions"
echo "  2. Edit $TARGET/brand.md with brand colors, typography, and voice"
echo "  3. Start building your content library in $TARGET/content-library.md"
echo "  4. Optionally add a brand preset: cp skills/brand-factory/presets/_template.md skills/brand-factory/presets/$SLUG.md"
