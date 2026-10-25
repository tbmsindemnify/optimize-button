# Codex CLI: `$optimize`

Install:

    mkdir -p ~/.codex/prompts && cp integrations/codex/optimize.md ~/.codex/prompts/optimize.md

Use, inside Codex:

    $optimize DRAFT="go through the roofer leads from last week and tell me which to call first"

Codex runs `optimize/optimize.py`, prints the packet, waits for your go. Custom prompts live in `~/.codex/prompts/` (Codex docs: "Custom prompts").

## Packet fields in this harness

- Paste the PROMPT line (or the whole packet) into the Codex input. Do not send until you have read it.
- EFFORT maps to Codex reasoning effort (minimal/low/medium/high).
- TOOLS/SKILLS names installed Codex skills; Codex guidance favours lean, non-overlapping skill instructions, so the packet also says what to drop.
- COMPACT: yes → `/compact` (Codex takes no focus argument), then paste the packet.
- Sources the rules come from: `guidance/provider-guidance.md` (Codex best practices, prompting, build-skills, the GPT-6 Astra skills article).
