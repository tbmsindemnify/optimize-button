# Using the packet with Claude Code

- Paste the PROMPT line (or the whole packet) into the Claude Code input. Do not send until you have read it.
- EFFORT maps to Claude's effort setting / extended thinking. Keep it low for small jobs; thinking tokens are output tokens.
- TOOLS/SKILLS names SKILL.md files under `.claude/skills/` or `~/.claude/skills/`; Claude loads a skill's body only when it is used, so naming the right one costs nothing extra.
- COMPACT: yes → run `/compact <focus>` first, with the focus text from the packet (goal, decisions, exact paths, open defects).
- AUTONOMY: read-only drafts stay read-only; the packet never adds write permission the user did not ask for.
- Sources the rules come from: `guidance/provider-guidance.md` (Claude Code best practices, costs, skills, context engineering).
