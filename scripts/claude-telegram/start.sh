#!/usr/bin/env bash
# Each bot MUST use a separate tmux socket (-L) to prevent env var contamination.
# Never pkill bun globally — it kills other bots' plugin processes.

BOT_NAME="addressline1"
SESSION_NAME="claude-telegram-address"
TMUX_SOCKET="claude-services-address"
WORKDIR="$HOME/code/english_location"
HEALTH_INTERVAL=30
STARTUP_GRACE=30
CLAUDE_SESSION="__SESSION_ID__"

tmux -L "$TMUX_SOCKET" kill-session -t "$SESSION_NAME" 2>/dev/null || true
sleep 2

tmux -L "$TMUX_SOCKET" new-session -d -s "$SESSION_NAME" -c "$WORKDIR" \
  "claude --resume $CLAUDE_SESSION --name $BOT_NAME --model opus --effort high --dangerously-skip-permissions --channels plugin:telegram@claude-plugins-official"

sleep "$STARTUP_GRACE"

while tmux -L "$TMUX_SOCKET" has-session -t "$SESSION_NAME" 2>/dev/null; do
  CLAUDE_PID=$(pgrep -x claude -u "$(id -u)" | while read pid; do
    grep -q "$BOT_NAME" /proc/$pid/cmdline 2>/dev/null && echo "$pid" && break
  done)
  if [ -z "$CLAUDE_PID" ]; then
    tmux -L "$TMUX_SOCKET" kill-session -t "$SESSION_NAME" 2>/dev/null || true
    exit 1
  fi
  OUR_BUN=$(pgrep -P "$CLAUDE_PID" bun 2>/dev/null | head -1)
  if [ -z "$OUR_BUN" ]; then
    tmux -L "$TMUX_SOCKET" kill-session -t "$SESSION_NAME" 2>/dev/null || true
    exit 1
  fi
  sleep "$HEALTH_INTERVAL"
done
