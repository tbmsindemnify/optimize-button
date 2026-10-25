---
description: Rewrite a draft into a reviewed packet (goal, done-when, constraints, effort, skills, compact) before acting on it
argument-hint: DRAFT=<your rough draft>
---
Run the Optimize button on this draft and show me the packet. Do not act on the draft itself.

Draft: $DRAFT

1. Run `printf '%s' "$DRAFT" | python3 ${OPTIMIZE_HOME:-$HOME/Projects/optimize-button}/optimize/optimize.py --provider codex`
2. Print the packet exactly as returned.
3. Stop and ask whether to run the PROMPT line, `/compact` first (if COMPACT: yes), or edit. Do not start the task until told.
