#!/bin/bash
# install-skills.sh - Symlink skills from this repo to ~/.claude/skills/
# Usage: bash scripts/install-skills.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_DIR/skills"
TARGET_DIR="$HOME/.claude/skills"

# Ensure target directory exists
mkdir -p "$TARGET_DIR"

echo "Installing content-engine skills..."
echo "Source: $SKILLS_DIR"
echo "Target: $TARGET_DIR"
echo ""

# Skills to install (directories containing SKILL.md)
for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")

    # Skip if no SKILL.md (not a skill directory)
    if [ ! -f "$skill_dir/SKILL.md" ]; then
        continue
    fi

    target_path="$TARGET_DIR/$skill_name"

    if [ -L "$target_path" ]; then
        # Already a symlink - update it
        current_target=$(readlink "$target_path")
        if [ "$current_target" = "$skill_dir" ] || [ "$current_target" = "${skill_dir%/}" ]; then
            echo "  [skip] $skill_name (already linked)"
        else
            echo "  [update] $skill_name"
            echo "    Previous: $current_target"
            echo "    New: $skill_dir"
            rm "$target_path"
            ln -s "${skill_dir%/}" "$target_path"
        fi
    elif [ -d "$target_path" ]; then
        # Real directory exists - back it up
        backup_path="${target_path}.backup.$(date +%Y%m%d%H%M%S)"
        echo "  [backup] $skill_name -> $(basename "$backup_path")"
        mv "$target_path" "$backup_path"
        ln -s "${skill_dir%/}" "$target_path"
        echo "  [link] $skill_name"
    else
        # Nothing exists - create symlink
        ln -s "${skill_dir%/}" "$target_path"
        echo "  [link] $skill_name"
    fi
done

echo ""
echo "Done. Skills installed:"
for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    if [ -f "$skill_dir/SKILL.md" ]; then
        if [ -L "$TARGET_DIR/$skill_name" ]; then
            echo "  ~/.claude/skills/$skill_name -> $(readlink "$TARGET_DIR/$skill_name")"
        fi
    fi
done
