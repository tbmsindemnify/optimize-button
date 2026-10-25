# Claude Code

Two options. **`plugin/`** is the real button (chip above the prompt box, Sonnet rewrite, cache meter, daily hygiene) — use it if your Claude Code has function hooks. **`optimize.md`** below is a plain slash command for older versions or for people who want the local-model packet instead. Install one, not both (same name).

## Plain slash command: `/optimize`

Install (one line):

    mkdir -p ~/.claude/commands && cp integrations/claude-code/optimize.md ~/.claude/commands/optimize.md

Use, inside any Claude Code session:

    /optimize go through the roofer leads from last week and tell me which to call first, don't email anybody

Claude runs `optimize/optimize.py` on your draft, prints the packet, and waits. Nothing runs until you say so.
Set `OPTIMIZE_HOME` if the repo is not at `~/Projects/optimize-button`.
Model: whatever `OPTIMIZE_BASE_URL` / `OPTIMIZE_MODEL` point at (local Ollama by default); the packet is reviewed by you, not auto-sent.

## Packet fields in this harness

- Paste the PROMPT line (or the whole packet) into the Claude Code input. Do not send until you have read it.
- EFFORT maps to Claude's effort setting / extended thinking. Keep it low for small jobs; thinking tokens are output tokens.
- TOOLS/SKILLS names SKILL.md files under `.claude/skills/` or `~/.claude/skills/`; Claude loads a skill's body only when it is used, so naming the right one costs nothing extra.
- COMPACT: yes → run `/compact <focus>` first, with the focus text from the packet (goal, decisions, exact paths, open defects).
- AUTONOMY: read-only drafts stay read-only; the packet never adds write permission the user did not ask for.
- Sources the rules come from: `guidance/provider-guidance.md` (Claude Code best practices, costs, skills, context engineering).
