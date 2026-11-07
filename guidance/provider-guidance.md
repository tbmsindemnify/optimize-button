# Provider guidance — the rules the Optimize button applies

These rules come from the labs' own published pages (sources listed under each section). They are refreshed from the daily snapshots in `snapshots/` by a reviewed pull request; the date in the first line below is the last human review. Originally written for Tyler's Herdr fork, which is why some lines reference installed Codex/Claude Code versions; the generic rules are the same.

---

# Provider guidance reviewed 2026-11-07

These are dated implementation principles, not a promise that every installed model or extension is available. The Optimize button loads separate policy records from `optimizer_providers.py` and passes them to BOTH Ollama and EXO. Model-specific effort defaults are not guessed.

## OpenAI Codex

Write direct outcome-oriented tasks with relevant repository context, exact constraints and completion checks. Audit stale/overlapping skill instructions; use progressive discovery. Preserve ongoing work and use native compaction. The September 11 article evaluates leaner skills/prompts for newer models; its benchmark numbers are not a guaranteed saving for this installation.

Sources:
- https://learn.chatgpt.com/docs/learn/best-practices
- https://learn.chatgpt.com/docs/prompting
- https://learn.chatgpt.com/docs/build-skills
- https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra
- https://learn.chatgpt.com/docs/app-server
- https://learn.chatgpt.com/docs/extend/mcp?surface=cli

Installed Codex 0.164.0 and local source `970111f6cb` support bare `/compact`; inline focus arguments are not accepted. `thread/settings/update` can change per-thread disabledPluginIds in a daemon-owned session, but existing embedded TUI sessions expose no external socket. Starting another server against a live rollout is not an attachment strategy. `skills/config/write` and native plugin menu toggles write global configuration. Launch `-c` overrides are prepared separately and marked pending resume.

- 2026-11-07: For app-server integrations, check that `turn/completed` has status `completed`, report its error otherwise, and propagate unsuccessful process exits; receiving the event alone is not proof of success. Source: https://learn.chatgpt.com/docs/app-server

## Claude Code

Provide clear scope and an observable verification method. Keep context relevant, load skills progressively, retain useful deferred tool search, and use independent subagents where context isolation or parallel work helps. Compaction should retain current goal, corrections, constraints, decisions, exact paths, unresolved defects and verification evidence. Avoid overlapping specialist scaffolding solely for domain labels; October 22's architecture article emphasizes end-to-end task evaluations.

Sources:
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/costs
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/commands
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/plugins/cli-reference
- https://code.claude.com/docs/en/mcp
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop

Installed Claude Code 2.1.309 supports `/compact [instructions]`. Project-local skill/plugin changes affect other panes in that project; MCP toggles are also project scoped. `--settings` is session-scoped at launch; `--plugin-dir` adds a plugin for one launch. `/reload-plugins` does not turn shared settings into pane-only settings. Prepared overrides use `skillOverrides` and `enabledPlugins`, without changing provider files or permissions. Plugin-provided skills cannot independently be switched off through the standalone skill override.

- 2026-11-07: When MCP tools are unavailable in a cloud session, inspect repository deny rules, full tool names over 128 characters, server connection state, and whether the server exposes the tool to the model; do not assume a listed tool is usable. Source: https://code.claude.com/docs/en/mcp
- 2026-11-07: Claude Code can skip negotiating the newer MCP protocol with a stdio server for seven days after a failure; to ask an upgraded server sooner, set `MCP_PROTOCOL_NEGOTIATION=auto`. Source: https://code.claude.com/docs/en/mcp
- 2026-11-07: When validating a plugin or marketplace manifest, use the corresponding `plugin.json` or `marketplace.json` name to select the intended checks rather than relying on field-based inference. Source: https://code.claude.com/docs/en/plugins/cli-reference

## Observable implementation limits

The user's Optimize click is an explicit compaction milestone. The optional 70 percent gate is Herdr policy and needs a provider-reported context limit. Last-request input tokens are not a full live context accounting. Claude's window remains unknown when it is not reported. Native compaction receipts and plugin/skill runtime status are recorded independently. Full transcripts and recovery drafts are retained; rewritten text stays unsent. The source review date is shown in profiles; guidance is not silently or automatically fetched on every click.
