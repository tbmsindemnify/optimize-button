---
name: optimize-prompt
description: Use when the user says "optimize this", "/optimize", or hands you a rough draft to tighten before sending to a frontier model. Runs the Optimize button and returns the packet; never executes the draft.
---
# Optimize button (Hermes)

Run the draft through the Optimize button and return the packet unchanged. Do not act on the draft.

    printf '%s' "<draft>" | python3 ${OPTIMIZE_HOME:-$HOME/Projects/optimize-button}/optimize/optimize.py --provider generic

Providers: `claude` (Claude Code / claude.ai), `codex` (Codex / ChatGPT), `generic`.
Then ask the user: run the PROMPT line as written, compact first (if COMPACT: yes), or edit.

Pitfalls
- The default endpoint is local Ollama (`OPTIMIZE_BASE_URL`, `OPTIMIZE_MODEL`); if it is down, say so instead of writing a packet by hand.
- A "don't …" in the draft must appear under CONSTRAINTS KEPT; if it does not, the packet is wrong, rerun.
