# Provider guidance — the rules the Optimize button applies

These rules come from the labs' own published pages (sources listed under each section). They are refreshed from the daily snapshots in `snapshots/` by a reviewed pull request; the date in the first line below is the last human review. Originally written for Tyler's Herdr fork, which is why some lines reference installed Codex/Claude Code versions; the generic rules are the same.

---

# Provider guidance reviewed 2026-11-20

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

### OpenAI voice prompting

- 2026-11-20: For GPT-Live voice agents, specify language-switching, regional speaking style and register explicitly, and test pronunciation, amounts and identifiers in context; accent adherence is not guaranteed. Source: https://developers.openai.com/blog/prompting-multilingual-voice-agents

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

- 2026-11-20: `--bare` skips hooks, skills, plugins, MCP servers and repo/home `CLAUDE.md` files, and uses API-key, configured `apiKeyHelper` or cloud-provider authentication rather than claude.ai login. Source: https://code.claude.com/docs/en/best-practices
- 2026-11-20: For enforceable Claude Code hooks, use a command, HTTP or `mcp_tool` hook rather than a nondeterministic prompt or agent hook; use `onFailure: "block"` when a crashed or timed-out hook must stop the action. Source: https://code.claude.com/docs/en/best-practices
- 2026-11-20: In the main conversation, path-scoped skill patterns remain relative to the primary working directory after `cd` into a subdirectory of the same worktree; sibling worktrees do not match even if added with `/add-dir`. If a new skill is missing, run `/reload-skills`. Source: https://code.claude.com/docs/en/skills
- 2026-11-20: If plugin dependencies install but a reload is not applied, run `/reload-plugins --force`; `--plugin-dir` also accepts a ZIP archive. Source: https://code.claude.com/docs/en/plugins/cli-reference
- 2026-11-20: In Claude Code 2.1.328+, plugin validation can report `hosts`, but this is not an exhaustive network allowlist; a plugin can reach unlisted hosts. Source: https://code.claude.com/docs/en/plugins/cli-reference
- 2026-11-20: Claude Code saves the Output style setting in project-local `.claude/settings.local.json`, not the user settings file. Source: https://code.claude.com/docs/en/settings
- 2026-11-20: For MCP schema troubleshooting, Claude Code 2.1.328 changes behavior when feature-flag fetching is off: root-combinator tools are no longer skipped solely for that reason and invalid-schema checks no longer bypass exclusion solely for that reason; when fetching is on but flags have not arrived, the two cases behave differently. Check the server log and validate arguments server-side. Source: https://code.claude.com/docs/en/mcp

## Web tools

- 2026-11-20: Firecrawl Local runs scrape, crawl, map and batch scrape on the machine and exposes an MCP server; search and other Cloud tools still send requests to Firecrawl Cloud, so choose the route deliberately for sensitive work. Source: https://github.com/firecrawl/firecrawl

## Observable implementation limits

The user's Optimize click is an explicit compaction milestone. The optional 70 percent gate is Herdr policy and needs a provider-reported context limit. Last-request input tokens are not a full live context accounting. Claude's window remains unknown when it is not reported. Native compaction receipts and plugin/skill runtime status are recorded independently. Full transcripts and recovery drafts are retained; rewritten text stays unsent. The source review date is shown in profiles; guidance is not silently or automatically fetched on every click.
