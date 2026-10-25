import type { ContextMcpTool, ContextSkill } from 'claude-code'

// Pure helpers for the credit savers a press of Optimize runs; everything that reaches `$` lives in
// register.tsx. Built from Tyler's brief (2026-10-07): deny rules for files Claude never needs, MCP
// servers and plugins nobody used, context-mode and RTK, and CLAUDE.md files over 200 lines.

export const SAVE_PANE = 'save-credits'
// Below this a thread holds too little for a summary to save much (Tyler, 2026-10-06). A big context
// window reaches 50% late, so 150k tokens re-read on every request is enough on its own (2026-10-07).
export const COMPACT_AT_PERCENT = 50
export const COMPACT_AT_TOKENS = 150_000
export const isWorthCompacting = (percent: number, tokens: number) => percent >= COMPACT_AT_PERCENT || tokens >= COMPACT_AT_TOKENS
export const CLAUDE_MD_MAX_LINES = 200
// How far back the MCP and plugin checks look for a use.
export const MCP_IDLE_DAYS = 7
export const PLUGIN_IDLE_DAYS = 14
// Roughly four characters to a token, as Claude Code's own estimates count them.
export const tokensOf = (chars: number) => Math.round(chars / 4)

export type DenyRule = { rule: string; reason: string }

// A deny rule only goes in when its probe exists in the project, so a rule never names a path the
// project doesn't have. Logs stay readable on purpose: debugging means reading them.
type Candidate = { probe: string; rules: string[]; reason: string }

const DIRS: [string, string][] = [
  ['node_modules', 'installed packages'],
  ['.next', 'Next.js build output'],
  ['dist', 'build output'],
  ['build', 'build output'],
  ['coverage', 'test coverage reports'],
  ['.venv', 'Python virtual environment'],
  ['venv', 'Python virtual environment'],
  ['supabase/.temp', 'Supabase CLI cache'],
  ['ios/Pods', 'CocoaPods packages'],
  ['ios/App/Pods', 'CocoaPods packages'],
  ['.claude/worktrees', "other worktrees' copies of this repo"],
]
const LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  'uv.lock',
  'Gemfile.lock',
  'composer.lock',
]
const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.production', '.env.test']

export const DENY_CANDIDATES: Candidate[] = [
  ...DIRS.map(([dir, reason]) => ({ probe: dir, rules: [`Read(./${dir}/**)`], reason })),
  { probe: 'graphify-out', rules: ['Read(./graphify-out/**/*.json)'], reason: 'knowledge-graph data; graphify query reads it' },
  ...LOCKFILES.map(file => ({ probe: file, rules: [`Read(./${file})`], reason: 'lockfile' })),
  { probe: 'package.json', rules: ['Read(./**/*.min.js)', 'Read(./**/*.map)'], reason: 'minified bundles and source maps' },
  { probe: 'pyproject.toml', rules: ['Read(./**/__pycache__/**)'], reason: 'Python bytecode' },
  { probe: 'requirements.txt', rules: ['Read(./**/__pycache__/**)'], reason: 'Python bytecode' },
  ...ENV_FILES.map(file => ({
    probe: file,
    rules: [`Read(./${file})`],
    reason: 'secrets file; blocks the Read tool only, not a security boundary',
  })),
]

// The rules the project's probes call for that the settings don't already deny.
export function rulesToAdd(present: ReadonlySet<string>, denied: readonly string[]): DenyRule[] {
  const seen = new Set(denied)
  const added: DenyRule[] = []
  for (const candidate of DENY_CANDIDATES) {
    if (!present.has(candidate.probe)) continue
    for (const rule of candidate.rules) {
      if (seen.has(rule)) continue
      seen.add(rule)
      added.push({ rule, reason: candidate.reason })
    }
  }
  return added
}

export function deniedRules(settings: unknown): string[] {
  const deny = (settings as { permissions?: { deny?: unknown } } | undefined)?.permissions?.deny
  return Array.isArray(deny) ? deny.filter((rule): rule is string => typeof rule === 'string') : []
}

// The settings file's text with `rules` appended to `permissions.deny`, every other key kept.
export function withDenyRules(text: string | undefined, rules: readonly string[]): string {
  const settings = text && text.trim() !== '' ? JSON.parse(text) : {}
  const permissions = settings.permissions ?? {}
  const deny = deniedRules(settings)
  settings.permissions = { ...permissions, deny: [...deny, ...rules.filter(rule => !deny.includes(rule))] }
  return `${JSON.stringify(settings, null, 2)}\n`
}

// --- MCP servers and plugins nobody used ---

// The server part of an MCP tool's wire name: `claude.ai Gmail` calls its tools `mcp__claude_ai_Gmail__…`.
export const serverSegment = (name: string) => name.replace(/[^A-Za-z0-9_-]/g, '_')

// Counts tool calls per server segment in `grep -o '"name":"mcp__…'` output, one match a line.
export function serverUses(grepOutput: string): Map<string, number> {
  const uses = new Map<string, number>()
  for (const match of grepOutput.matchAll(/mcp__([A-Za-z0-9_-]+?)__/g)) {
    const segment = match[1] ?? ''
    uses.set(segment, (uses.get(segment) ?? 0) + 1)
  }
  return uses
}

export type ConfiguredServer = { name: string; where: string }
export type IdleServer = { name: string; where: string; tools: number; tokens: number }

// Servers with no call in the window, with what their tool schemas cost each request now.
export function idleServers(
  configured: readonly ConfiguredServer[],
  tools: readonly ContextMcpTool[],
  uses: ReadonlyMap<string, number>,
): IdleServer[] {
  const servers = new Map<string, ConfiguredServer>()
  for (const server of configured) servers.set(server.name, server)
  for (const tool of tools) {
    if (!servers.has(tool.serverName)) servers.set(tool.serverName, { name: tool.serverName, where: 'connected' })
  }
  const idle: IdleServer[] = []
  for (const server of servers.values()) {
    // This mod's own tools and plugin servers are judged with their plugin.
    if (server.name.startsWith('plugin:') || (uses.get(serverSegment(server.name)) ?? 0) > 0) continue
    const own = tools.filter(tool => tool.serverName === server.name)
    const tokens = own.filter(tool => tool.isLoaded).reduce((sum, tool) => sum + tool.tokens, 0)
    idle.push({ ...server, tools: own.length, tokens })
  }
  return idle.sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name))
}

// Plugin names the transcripts show in use: a skill, a slash command, an agent or an MCP tool.
export function pluginsUsed(grepOutput: string): Set<string> {
  const used = new Set<string>()
  const patterns = [
    /"skill":"([a-z0-9-]+):/g,
    /<command-name>\/([a-z0-9-]+):/g,
    /"subagent_type":"([a-z0-9-]+):/g,
    /mcp__plugin_([a-z0-9-]+)_/g,
  ]
  for (const pattern of patterns) {
    for (const match of grepOutput.matchAll(pattern)) used.add(match[1] ?? '')
  }
  return used
}

export type IdlePlugin = { id: string; tokens: number }

// Enabled plugins with no use in the window, costliest first: their skill listings and loaded tools.
export function idlePlugins(
  enabled: Readonly<Record<string, unknown>>,
  used: ReadonlySet<string>,
  skills: readonly ContextSkill[],
  tools: readonly ContextMcpTool[],
): IdlePlugin[] {
  const idle: IdlePlugin[] = []
  for (const [id, isOn] of Object.entries(enabled)) {
    const name = id.split('@')[0] ?? id
    if (isOn !== true || used.has(name)) continue
    const skillTokens = skills.filter(skill => skill.pluginName === name).reduce((sum, skill) => sum + skill.tokens, 0)
    const toolTokens = tools
      .filter(tool => tool.isLoaded && tool.name.startsWith(`mcp__plugin_${name}_`))
      .reduce((sum, tool) => sum + tool.tokens, 0)
    idle.push({ id, tokens: skillTokens + toolTokens })
  }
  return idle.sort((a, b) => b.tokens - a.tokens || a.id.localeCompare(b.id))
}

// --- CLAUDE.md files over 200 lines ---

export type Section = {
  id: number
  heading: string
  parent: string
  // Line indexes, `end` exclusive.
  start: number
  end: number
  chars: number
  // Inside a block another tool publishes, which an edit here would not survive.
  isLocked: boolean
}

const LOCK_BEGIN = /<!--\s*[A-Z-]+:BEGIN/
const LOCK_END = /<!--\s*[A-Z-]+:END/

// The file's `##` and `###` sections, outside code fences; the text before the first stays put.
export function sections(text: string): Section[] {
  const lines = text.split('\n')
  const found: Section[] = []
  let isFenced = false
  let isLocked = false
  let parent = ''
  for (const [index, line] of lines.entries()) {
    // A lock marker ends the section before it, so only sections inside the block are locked.
    const isMarker = LOCK_BEGIN.test(line) || LOCK_END.test(line)
    if (isMarker) {
      const open = found.at(-1)
      if (open && open.end === lines.length) open.end = index
      isLocked = LOCK_BEGIN.test(line)
      continue
    }
    if (/^\s*```/.test(line)) isFenced = !isFenced
    const heading = !isFenced && /^(##|###) \S/.test(line) ? line : undefined
    if (heading === undefined) continue
    const previous = found.at(-1)
    if (previous && previous.end === lines.length) previous.end = index
    if (heading.startsWith('## ')) parent = heading.slice(3).trim()
    found.push({ id: found.length, heading: heading.replace(/^#+ /, '').trim(), parent, start: index, end: lines.length, chars: 0, isLocked })
  }
  for (const section of found) section.chars = lines.slice(section.start, section.end).join('\n').length
  return found
}

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'reference'

export const docFile = (section: Section) => `docs/agent/${slug(section.parent || section.heading)}.md`

// What the classifier reads: each movable section's heading, size and opening line.
export function classifierPrompt(file: string, all: readonly Section[]): string {
  const lines = file.split('\n')
  const rows = all
    .filter(section => !section.isLocked)
    .map(section => {
      const opening = lines
        .slice(section.start + 1, section.end)
        .find(line => line.trim() !== '')
      return `${section.id} | ${section.parent} > ${section.heading} | ${section.end - section.start} lines | ${(opening ?? '').trim().slice(0, 160)}`
    })
  return `<sections>\n${rows.join('\n')}\n</sections>`
}

export const CLASSIFIER_SYSTEM = `You sort the sections of a CLAUDE.md file, which Claude Code loads into every request. Keep in it only what an agent needs on every task: commands, hard rules and prohibitions, approval requirements, security and privacy rules, and conventions that prevent bugs in everyday edits. Move reference material that only some tasks need: architecture descriptions, inventories of modules, routes, services or files, environment variable lists and module documentation. A moved section stays one path away and Claude reads it when a task touches it. When unsure, keep.

Each line in <sections> is "id | parent > heading | size | opening line". Reply with only JSON: {"move": [ids]}.`

export function movesFrom(reply: string, all: readonly Section[]): number[] {
  const match = reply.match(/\{[\s\S]*\}/)
  if (!match) return []
  try {
    const ids = JSON.parse(match[0]).move
    const movable = new Set(all.filter(section => !section.isLocked).map(section => section.id))
    return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number' && movable.has(id)) : []
  } catch {
    return []
  }
}

export type MoveResult = { claudeMd: string; files: Map<string, string> }

// Moves the picked sections word for word into docs/agent files, leaving one pointer line per section
// where the first moved section of each file stood. Plain paths, not @imports, which would load anyway.
export function applyMoves(text: string, all: readonly Section[], ids: readonly number[], existing: ReadonlyMap<string, string>): MoveResult {
  const lines = text.split('\n')
  const picked = all.filter(section => ids.includes(section.id) && !section.isLocked)
  const files = new Map<string, string>()
  const pointers = new Map<number, string[]>()
  const removed = new Set<number>()
  const firstAt = new Map<string, number>()
  for (const section of picked) {
    const file = docFile(section)
    const body = lines.slice(section.start, section.end).join('\n').trimEnd()
    const intro =
      existing.get(file) ?? `# ${section.parent || section.heading}\n\nMoved from CLAUDE.md. Read this when a task touches these areas.\n`
    files.set(file, `${(files.get(file) ?? intro).trimEnd()}\n\n${body}\n`)
    if (!firstAt.has(file)) firstAt.set(file, section.start)
    const at = firstAt.get(file) ?? section.start
    pointers.set(at, [...(pointers.get(at) ?? []), `- ${section.heading}: see ${file}`])
    for (let index = section.start; index < section.end; index += 1) removed.add(index)
  }
  const kept: string[] = []
  for (const [index, line] of lines.entries()) {
    const notes = pointers.get(index)
    if (notes) kept.push(...notes, '')
    if (!removed.has(index)) kept.push(line)
  }
  return { claudeMd: kept.join('\n').replace(/\n{3,}/g, '\n\n'), files }
}
