#!/bin/bash
# uninstall-skills.sh - Remove symlinks created by install-skills.sh
# Only removes symlinks that point back to this repo. Does not delete real directories.
# Usage: bash scripts/uninstall-skills.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_DIR/skills"
TARGET_DIR="$HOME/.claude/skills"

echo "Uninstalling content-engine skills..."
echo ""

for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")

    if [ ! -f "$skill_dir/SKILL.md" ]; then
        continue
    fi

    target_path="$TARGET_DIR/$skill_name"

    if [ -L "$target_path" ]; then
        current_target=$(readlink "$target_path")
        if [[ "$current_target" == "$REPO_DIR"* ]]; then
            rm "$target_path"
            echo "  [removed] $skill_name"

            # Restore backup if one exists
            latest_backup=$(ls -d "${target_path}.backup."* 2>/dev/null | sort -r | head -1)
            if [ -n "$latest_backup" ]; then
                mv "$latest_backup" "$target_path"
                echo "  [restored] $skill_name from backup"
            fi
        else
            echo "  [skip] $skill_name (symlink points elsewhere: $current_target)"
        fi
    else
        echo "  [skip] $skill_name (not a symlink from this repo)"
    fi
done

echo ""
echo "Done."
