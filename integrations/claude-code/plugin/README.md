# The Optimize button for Claude Code (`prompt-transform`)

This is the original button: a Claude Code *function-hooks* plugin (the early-access plugin API, Claude Code ≥ 2.1.300).
It draws an **Optimize** chip above the prompt box with a one-bar meter of how warm the prompt cache is, and registers `/optimize`.

What a press does
- Rewrites the draft in the box with **Sonnet**, using a system prompt built from Claude Code's own docs (Best practices,
  Common workflows, the Prompt library's "What makes these prompts work") and Anthropic's prompting guidance. The rewrite
  goes back into the box; you read it, then you send it. Pressed with an empty box, it compacts the thread and audits
  settings instead ("save credits").
- Names at most two installed skills, only ones whose description matches the draft; most drafts get none.
- Once a day: flags idle MCP servers and plugins, CLAUDE.md files over 200 lines (offers to move sections to `docs/agent/`),
  proposes deny rules for files Claude never needs, and offers new skills from Anthropic's skills repo (`/new-skills`).
- From the phone (Remote Control), `/optimize <draft>` returns the rewrite as a reply instead of filling a box it cannot see.

Install
    mkdir -p ~/.claude/mods && cp -r integrations/claude-code/plugin ~/.claude/mods/prompt-transform
    # then in Claude Code: /plugin  →  add a local mod from ~/.claude/mods/prompt-transform   (or add it to settings.json "mods")

Claude Code writes `.claude-plugin/types/` (the engine's TypeScript declarations) when it loads the mod; they are not committed.
Tests (`hooks/*.test.ts`) run with the engine's `claude-code/testing` module, available only inside Claude Code's test runner.

Do not also install the plain `/optimize` slash command from `../optimize.md`: the plugin owns that name, and a user command with
the same name makes the plugin's session-start hook fail.

Verified 2026-10-24, headless: `claude -p "/optimize fix the login bug, don't touch the database" --model sonnet` →
"Fix the login bug without touching the database: no schema changes, migrations or data edits. Find the root cause rather than
silencing the error. First reproduce the failure, ideally with a test, then show me it passing along with the existing auth tests.
If the fix seems to require a database change, stop and ask me."
