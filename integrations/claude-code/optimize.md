---
description: Rewrite a draft into the shape Claude wants (goal, done-when, constraints, effort, skills, compact) before you send it. Nothing is sent; you read the packet first.
argument-hint: <your rough draft>
allowed-tools: Bash(python3 *optimize.py*)
---
Run the Optimize button on the draft below and show me the packet. Do not act on the draft itself.

Draft:
$ARGUMENTS

Steps:
1. Run: `printf '%s' "$ARGUMENTS" | python3 ${OPTIMIZE_HOME:-$HOME/Projects/optimize-button}/optimize/optimize.py --provider claude`
2. Print the packet exactly as returned (GOAL / DONE WHEN / CONSTRAINTS KEPT / EFFORT / TOOLS/SKILLS / COMPACT / AUTONOMY / PROMPT).
3. Stop. Ask me whether to run the PROMPT line, run `/compact` first (if COMPACT: yes), or edit it. Do not start the task until I say so.
