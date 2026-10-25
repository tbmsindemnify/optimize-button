# Where the button was born: Herdr

[Herdr](https://github.com/herdrdev/herdr) is a terminal workspace manager for AI coding agents (Claude Code, Codex and others side by side). Tyler runs a personal fork with an **Optimize** button on every pane. The Python helpers in this folder are that implementation, published as reference:

- `workspace_optimize.py` — the button's entry point: reads the pane's one-line draft, measures real context use from the agent's session file (`usage.py`), builds the packet, inserts it **unsent**, and on a second click can run the provider's native compaction.
- `optimizer_providers.py` — separate Claude and Codex policies; discovers installed skills/plugins so the packet never invents one.
- `optimizer_backend.py` — talks to a local model (exo on a Mac mini, or a guarded Ollama) through the OpenAI-compatible API.
- `optimizer_session.py` — binding to one server/terminal/provider/session, cross-client locking, atomic recovery files.
- `tile.py` — the Herdr pane API shim.

These files depend on Herdr's internal pane API and on a local model endpoint, so they are not a drop-in for other harnesses. The harness-agnostic version is `optimize/optimize.py` + `optimize/optimize-selection.sh` at the repo root.
