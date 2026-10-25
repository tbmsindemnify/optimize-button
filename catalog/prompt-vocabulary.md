# Prompt vocabulary: the words a model needs to hear

The labs' guidance (see `guidance/provider-guidance.md`) converges on one idea: **describe the outcome, not the steps.** A model performs best when it knows what finished looks like, what it may touch, and what shape to hand back. These are the words the Optimize button reaches for.

## Outcome first
- "The result I want is …" / "Done means …" / "Success looks like …"
- "Produce a <checklist | table | diff | one-line answer | file at path>" — name the shape, the length, the format.
- "Verify by …" — an observable check (test passes, file exists, number matches).

## Scope and autonomy
- "Read-only: do not change files." / "Propose, then wait for my approval." / "Apply directly."
- "Only touch …" / "Never …" — constraints stated once, verbatim, kept verbatim.
- "Stop when …" — the stop condition, so the model does not keep going.

## Effort
- "Quick answer, no deep reasoning." / "Think carefully; this has hidden edge cases."
- Claude: effort low/medium/high, extended thinking only when the job needs it. Codex: reasoning effort minimal/low/medium/high. Thinking tokens are billed as output; match effort to the job.

## Context
- Point at the exact file, page, record, or number. "Look at X" beats "you know my project."
- Load only the skill/tool the job needs. Every tool definition left plugged in is tokens on every turn.
- When context is missing, ask the one question that unblocks the task instead of guessing.

## Compaction
- When a thread is long or stale: summarize goal, decisions, constraints, exact paths, open defects, verification evidence; drop the chatter. Claude: `/compact <focus>`. Codex: `/compact`.

## Words that cost quality
- "Make it good / better / optimize it" with no measure. "Be comprehensive." "Use your best judgment" without boundaries. "Do everything." Replace each with the outcome, the measure and the boundary.
