#!/usr/bin/env bash
# Telegram setup helper for the Weekly Studio chain.
#
# Usage:
#   1. Paste your bot token into packages/dashboard/.env under TELEGRAM_BOT_TOKEN=...
#   2. Open Telegram, message your bot once (any text — say "hi")
#   3. Run: scripts/setup-telegram.sh
#
# What it does:
#   - Reads TELEGRAM_BOT_TOKEN from packages/dashboard/.env
#   - Calls Telegram's getUpdates endpoint
#   - Prints every chat ID it sees (you'll usually just see your own)
#   - Optionally patches your .env with the chat ID
#   - Sends a test message to confirm everything works

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/packages/dashboard/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ $ENV_FILE not found"
  exit 1
fi

# Pull the token from .env
BOT_TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2-)"

if [[ -z "$BOT_TOKEN" ]]; then
  echo "✗ TELEGRAM_BOT_TOKEN is empty in $ENV_FILE"
  echo "  → paste your token from @BotFather then re-run this script"
  exit 1
fi

echo "→ Reading getUpdates from Telegram..."
RESPONSE="$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates")"

# Crude JSON probe (no jq dependency)
if ! echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✗ Telegram API returned an error:"
  echo "$RESPONSE"
  echo
  echo "Common causes:"
  echo "  • Token is wrong (double-check what @BotFather gave you)"
  echo "  • Token has a trailing space or quote in .env"
  exit 1
fi

# Extract distinct chat.id values using Python (BSD-portable, available on macOS by default).
# Telegram's response has multiple "id" fields — we specifically want chat.id from each message.
CHAT_IDS="$(echo "$RESPONSE" | python3 -c '
import json, sys
data = json.load(sys.stdin)
ids = set()
for update in data.get("result", []):
    msg = update.get("message") or update.get("edited_message") or update.get("channel_post") or {}
    chat = msg.get("chat") or {}
    if "id" in chat:
        ids.add(str(chat["id"]))
for i in sorted(ids):
    print(i)
')"

if [[ -z "$CHAT_IDS" ]]; then
  echo
  echo "✗ No chat IDs found in getUpdates response."
  echo "  → Open Telegram, find your bot, send it ANY message (just say 'hi'),"
  echo "    then re-run this script."
  echo
  echo "Raw API response (for debugging):"
  echo "$RESPONSE" | head -c 500
  echo
  exit 1
fi

ID_COUNT="$(echo "$CHAT_IDS" | wc -l | tr -d ' ')"

echo
echo "✓ Found $ID_COUNT chat ID(s) where your bot has been messaged:"
echo "$CHAT_IDS" | sed 's/^/  /'
echo

if [[ "$ID_COUNT" == "1" ]]; then
  CHAT_ID="$CHAT_IDS"
else
  echo "→ Pick the one that's YOU. (If unsure, message your bot from another chat to disambiguate.)"
  read -r -p "  Chat ID to use: " CHAT_ID
fi

# Validate
if ! echo "$CHAT_ID" | grep -qE '^-?[0-9]+$'; then
  echo "✗ '$CHAT_ID' doesn't look like a chat ID"
  exit 1
fi

# Patch .env in place — replace the empty TELEGRAM_CHAT_ID= line with the value
# Uses a portable sed pattern (BSD + GNU compatible)
if grep -qE '^TELEGRAM_CHAT_ID=' "$ENV_FILE"; then
  # macOS sed needs '' after -i; Linux doesn't. Use a temp file for cross-platform safety.
  TMP="$(mktemp)"
  awk -v id="$CHAT_ID" '/^TELEGRAM_CHAT_ID=/ { print "TELEGRAM_CHAT_ID=" id; next } { print }' "$ENV_FILE" > "$TMP"
  mv "$TMP" "$ENV_FILE"
  echo "✓ Patched $ENV_FILE with TELEGRAM_CHAT_ID=$CHAT_ID"
else
  echo "TELEGRAM_CHAT_ID=$CHAT_ID" >> "$ENV_FILE"
  echo "✓ Appended TELEGRAM_CHAT_ID=$CHAT_ID to $ENV_FILE"
fi

# Send a test message
echo
echo "→ Sending a test message to confirm..."
TEST_RESULT="$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"${CHAT_ID}\",\"text\":\"✓ Content Engine Telegram setup complete. The Weekly Studio chain can now reach you.\"}" )"

if echo "$TEST_RESULT" | grep -q '"ok":true'; then
  echo "✓ Test message sent — check Telegram"
else
  echo "✗ Test message failed:"
  echo "$TEST_RESULT"
  exit 1
fi

echo
echo "Done. Restart the dashboard so it picks up the new env vars."
