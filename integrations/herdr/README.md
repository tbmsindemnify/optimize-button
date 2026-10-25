# Herdr: the button on every agent pane

The Herdr version is published as a fork with the button built in:
**https://github.com/tbmsindemnify/herdr** (branch `optimize-button`, Apache-2.0, fork of herdrdev/herdr v0.9.1).

- `✦ Optimize` in the chrome of every Claude Code / Codex / Antigravity / Hermes pane. Click → a local model (Ollama, or exo)
  rewrites the pane's unsent draft and types it back, unsent. `CHANGES.md` there lists everything the fork changes.
- Helpers live in that repo's `optimize/` directory (`workspace_optimize.py`, `optimizer_providers.py`, `optimizer_session.py`,
  `optimizer_backend.py`, `usage.py`, `tile.py`); build with `ZIG=... ./install.sh`.

Verified 2026-10-24 against a live Herdr session: Claude Code pane, draft "fix the login bug, don't touch the database" →
editor cleared, prepared prompt inserted, not sent; constraint re-appended ("Constraints kept: don't touch the database").
Two bugs found and fixed on the way: an unreachable exo host now falls through to Ollama, and Claude Code 2.1's rotating
placeholder tips (`Try "how does <filepath> work?"`) are read as an empty editor.
