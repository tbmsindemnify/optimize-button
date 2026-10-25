# Verification log

Real runs, with what failed. Dates are the day of the run.

## 2026-10-24 — every harness reachable from one Linux desktop (Omarchy/Hyprland)

| Harness | How | Result |
|---|---|---|
| Any app, highlight + hotkey (`optimize-selection.sh`) | Disposable Chromium textarea on a scratch workspace; draft typed with `wtype`, Ctrl+A, wrapper run | **Pass.** Draft replaced in place by the full packet; Shift+Enter line breaks, nothing sent. 126 s on a 14B local model. Screenshot read back and transcribed. |
| Claude Code, original plugin (`integrations/claude-code/plugin`) | `claude -p "/optimize …" --model sonnet`, twice | **Pass.** Both rewrites kept the "don't" constraint and added a verification step. |
| Herdr button (`tbmsindemnify/herdr`) | Live Herdr server; new pane running Claude Code; draft typed via `herdr pane send-text`; the exact command the button runs | **Pass after two fixes** (exo fallback; Claude Code placeholder). Editor cleared, 9-line prompt inserted unsent. Honest note: the local 30B model pulled an unrelated error line from the pane into the rewrite ("agent-recall-session-start: command not found") — the Sonnet plugin did not make that mistake. |
| Hermes skill (`integrations/hermes`) | A Hermes subagent loads `optimize-prompt` with `skill_view` and runs the script on the roofer-leads draft | **Pass.** Exit 0, 19.75 s on `qwen3-14b-local`. AUTONOMY read-only, TOOLS/SKILLS "none needed", CONTEXT asks for the missing lead list, PROMPT ends "Do not email anybody." Weak spot: the 14B model echoed the whole draft as the CONSTRAINTS KEPT line instead of extracting the two constraints. |
| Claude desktop app, ChatGPT desktop app (existing threads) | Focus the window, type, Ctrl+A, check the PRIMARY selection equals the draft **before** running | **Not run, by design.** Neither composer takes keyboard focus without a mouse click, and this machine has no synthetic mouse (no ydotool, `/dev/uinput` is root-only, Hyprland Lua exposes `cursor.move` only). The guard saw a page-wide selection instead of the draft and aborted without typing. Highlight + hotkey from a real mouse is the path there. |
| Codex `$optimize` custom prompt (`integrations/codex`) | `codex exec` (cloud) · `codex exec --oss` · the TUI driven over a pty with a local model | **Not verified.** Cloud: ChatGPT usage limit exhausted until Oct 30. `codex exec` does not expand custom prompts. In the TUI, text written to the pty did not trigger the `$` expansion (it needs the completion popup); the local model saw the literal `$optimize DRAFT=…`. Manual TUI test pending. |
| Daily guidance refresh (`scripts/refresh_guidance.py`) | Two consecutive runs | 33/33 pages fetched; second run 0 changed. |
