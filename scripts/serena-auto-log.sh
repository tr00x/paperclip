#!/bin/bash
# Auto-log Claude Code actions to Serena memory
# Called by Claude Code hook on significant tool calls

SERENA_MEM="/Users/timur/paperclip/.serena/memories/project"
LOG_FILE="$SERENA_MEM/session_log.md"
DATE=$(date '+%Y-%m-%d %H:%M')

# Ensure directory exists
mkdir -p "$SERENA_MEM"

# Read tool name and input from environment (Claude Code hook vars)
TOOL="$CLAUDE_TOOL_NAME"
INPUT="$CLAUDE_TOOL_INPUT"

# Only log significant actions
case "$TOOL" in
  Write|Edit)
    # Extract file path from JSON input
    FILE=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('file_path','?'))" 2>/dev/null)
    echo "- $DATE — **$TOOL** \`$FILE\`" >> "$LOG_FILE"
    ;;
  Bash)
    CMD=$(echo "$INPUT" | python3 -c "import json,sys; c=json.load(sys.stdin).get('command',''); print(c[:120])" 2>/dev/null)
    # Only log git commits, pnpm commands, curl mutations — skip reads
    case "$CMD" in
      git\ commit*|git\ push*|pnpm\ *|curl\ *POST*|curl\ *PATCH*|curl\ *DELETE*)
        echo "- $DATE — **Bash** \`$CMD\`" >> "$LOG_FILE"
        ;;
    esac
    ;;
  mcp__serena__write_memory)
    NAME=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('memory_name','?'))" 2>/dev/null)
    echo "- $DATE — **Serena memory** \`$NAME\`" >> "$LOG_FILE"
    ;;
esac

# Keep log file under 200 lines
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 200 ]; then
  tail -100 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
