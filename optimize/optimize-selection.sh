#!/usr/bin/env bash
# Optimize the highlighted text in ANY app, then put the rewrite back in its place. Nothing is sent.
#
#   1. highlight a draft in any text box (terminal, browser, chat app, editor)
#   2. press your hotkey (example Hyprland bind below) or click a launcher button
#   3. the highlighted text is replaced by the optimized packet; the cursor sits at the end; YOU press Enter
#
# Hyprland (Omarchy) example, in hyprland.lua / hyprland.conf:
#   bind = SUPER, O, exec, ~/Projects/optimize-button/optimize/optimize-selection.sh
# GNOME/KDE: bind the same command to a custom shortcut. macOS: a Shortcuts "Run Shell Script" action.
#
# Flags:  --copy-only   put the packet on the clipboard and notify instead of typing it
#         --prompt-only type only the rewritten PROMPT line (shortest replacement)
#         --provider claude|codex|generic   (default: $OPTIMIZE_PROVIDER or generic)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COPY_ONLY=0; EXTRA=()
for arg in "$@"; do
  case "$arg" in
    --copy-only) COPY_ONLY=1 ;;
    *) EXTRA+=("$arg") ;;
  esac
done

notify() { command -v notify-send >/dev/null && notify-send -a Optimize "$1" "${2:-}" || echo "$1 ${2:-}" >&2; }

# --- read the highlighted text (primary selection), fall back to the clipboard -------------------
read_selection() {
  if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wl-paste >/dev/null; then
    wl-paste --primary --no-newline 2>/dev/null || wl-paste --no-newline 2>/dev/null || true
  elif command -v xclip >/dev/null; then
    xclip -o -selection primary 2>/dev/null || xclip -o -selection clipboard 2>/dev/null || true
  elif command -v pbpaste >/dev/null; then
    pbpaste
  fi
}

# --- put text back: type it over the selection, or copy it -----------------------------------------
# Newlines are typed as Shift+Enter so a chat box gets a line break, never a send.
type_text() {
  local text="$1"
  if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wtype >/dev/null; then
    local first=1
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ $first -eq 0 ]]; then wtype -M shift -k Return -m shift; fi
      first=0
      [[ -n "$line" ]] && wtype -s 14 -- "$line"
    done <<< "$text"
  elif command -v xdotool >/dev/null; then
    local first=1
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ $first -eq 0 ]]; then xdotool key shift+Return; fi
      first=0
      [[ -n "$line" ]] && xdotool type --delay 6 -- "$line"
    done <<< "$text"
  elif command -v osascript >/dev/null; then
    printf '%s' "$text" | pbcopy && osascript -e 'tell application "System Events" to keystroke "v" using command down'
  else
    return 1
  fi
}
copy_text() {
  local text="$1"
  if command -v wl-copy >/dev/null; then printf '%s' "$text" | wl-copy
  elif command -v xclip >/dev/null; then printf '%s' "$text" | xclip -selection clipboard
  elif command -v pbcopy >/dev/null; then printf '%s' "$text" | pbcopy
  fi
}

DRAFT="$(read_selection)"
if [[ -z "${DRAFT//[[:space:]]/}" ]]; then notify "Optimize" "Highlight a draft first."; exit 1; fi
if [[ "$(printf '%s' "$DRAFT" | wc -c)" -gt 8000 ]]; then notify "Optimize" "That's a document, not a request. Highlight the request."; exit 1; fi

notify "Optimize" "Rewriting…"
if ! PACKET="$(printf '%s' "$DRAFT" | python3 "$HERE/optimize.py" "${EXTRA[@]}")"; then
  notify "Optimize failed" "Is your model endpoint up? (OPTIMIZE_ENDPOINT / OPTIMIZE_MODEL)"; exit 2
fi

copy_text "$PACKET"   # always on the clipboard too, as the rollback
if [[ $COPY_ONLY -eq 1 ]] || ! type_text "$PACKET"; then
  notify "Optimize" "Packet copied to clipboard. Paste it where you want it. Not sent."
else
  notify "Optimize" "Rewritten in place. Read it, then press Enter."
fi
