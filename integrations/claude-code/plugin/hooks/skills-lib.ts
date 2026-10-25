import type { CommandInfo, SessionMessage } from 'claude-code'

// Pure helpers for the skills features; everything that reaches `$` lives in register.tsx.

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

// Anthropic's official Claude Code plugin marketplace.
export const MARKETPLACE = 'claude-plugins-official'
export const MARKETPLACE_SOURCE = 'anthropics/claude-plugins-official'
// Anthropic's public skills repo: its skills are offered once a day, each downloaded only if picked.
export const REPO_SKILLS_URL = 'https://api.github.com/repos/anthropics/skills/contents/skills'
export const REPO_TARBALL_URL = 'https://codeload.github.com/anthropics/skills/tar.gz/refs/heads/main'
export const repoSkillUrl = (name: string) => `https://raw.githubusercontent.com/anthropics/skills/main/skills/${name}/SKILL.md`
export const OFFER_PANE = 'new-skills'

// A name that is safe to put in a path or a command's arguments.
export const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/
// Plugin parts that change how every session behaves; a plugin with none only adds skills, commands or agents.
const SESSION_WIDE_FIELDS = ['hooks', 'mcpServers', 'lspServers', 'outputStyles']
const SESSION_WIDE_FILES = ['hooks', 'output-styles', '.mcp.json', '.lsp.json']
const OWN_COMMANDS = new Set(['optimize', 'new-skills'])

// How much of the conversation and the skill list the optimizer reads.
const MAX_MESSAGES = 12
const MESSAGE_CHARS = 1200
const CONVERSATION_CHARS = 8000
const MAX_SKILLS = 200

export type Skill = { name: string; description: string }
export type Json = Record<string, any>

export function oneLine(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

export function numberOf(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

export function namesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : []
}

// The skills and commands a session can use, for the optimizer to choose from: the user's and the
// plugins', not the built-in ones, MCP prompts or this mod's own commands.
export function skillCatalogue(commands: readonly CommandInfo[]): Skill[] {
  const seen = new Set<string>()
  const skills: Skill[] = []
  for (const command of commands) {
    const isOffered = command.source === 'user' || command.source === 'plugin'
    if (!isOffered || OWN_COMMANDS.has(command.name) || seen.has(command.name)) continue
    seen.add(command.name)
    skills.push({ name: command.name, description: oneLine(command.description, 200) })
  }

  return skills.slice(0, MAX_SKILLS)
}

// The latest messages with text, oldest first, within the optimizer's budget.
export function conversationExcerpt(messages: readonly SessionMessage[]): string {
  const lines: string[] = []
  let size = 0
  for (const message of [...messages].reverse()) {
    const text = message.text.trim()
    if (text === '') continue
    const line = `${message.role}: ${text.length > MESSAGE_CHARS ? `${text.slice(0, MESSAGE_CHARS)}…` : text}`
    if (lines.length === MAX_MESSAGES || size + line.length > CONVERSATION_CHARS) break
    lines.unshift(line)
    size += line.length
  }

  return lines.join('\n\n')
}

// What the optimizer reads: the draft, after the conversation and the skills to read it against.
export function optimizerPrompt(draft: string, conversation: string, skills: readonly Skill[]): string {
  const parts: string[] = []
  if (conversation !== '') {
    parts.push(`<conversation>\n${conversation}\n</conversation>`)
  }
  if (skills.length > 0) {
    parts.push(`<skills>\n${skills.map(skill => `- ${skill.name}: ${skill.description}`).join('\n')}\n</skills>`)
  }
  parts.push(`<draft>\n${draft}\n</draft>`)

  return parts.join('\n\n')
}

// Anthropic's own plugins in a marketplace manifest, each with its folder in the marketplace's copy;
// those that declare something session-wide are left out here, the rest checked by `addsOnlySkills`.
export function anthropicPlugins(manifest: Json | undefined): { name: string; dir: string }[] {
  const plugins: { name: string; dir: string }[] = []
  for (const entry of manifest?.plugins ?? []) {
    const author = typeof entry.author === 'object' ? entry.author?.name : entry.author
    const isAnthropics = typeof author === 'string' && /^anthropic\b/i.test(author)
    if (!isAnthropics || typeof entry.source !== 'string' || !SAFE_NAME.test(entry.name ?? '')) continue
    if (SESSION_WIDE_FIELDS.some(field => entry[field])) continue
    plugins.push({ name: entry.name, dir: entry.source.replace(/^\.\//, '').replace(/\/$/, '') })
  }

  return plugins
}

// A plugin folder, by the names in it and its manifest, that adds skills, commands or agents and
// nothing that runs in every session.
export function addsOnlySkills(names: ReadonlySet<string>, manifest: Json | undefined): boolean {
  if (SESSION_WIDE_FILES.some(name => names.has(name))) return false
  if (manifest && SESSION_WIDE_FIELDS.some(field => manifest[field])) return false

  return ['skills', 'commands', 'agents'].some(name => names.has(name))
}

// The repo's skills (its listing from the GitHub contents API) you neither have nor decided on.
export function freshRepoSkills(entries: unknown, have: ReadonlySet<string>, decided: ReadonlySet<string>): string[] {
  if (!Array.isArray(entries)) return []

  return entries
    .filter(entry => entry?.type === 'dir' && SAFE_NAME.test(entry.name) && !have.has(entry.name) && !decided.has(entry.name))
    .map(entry => entry.name as string)
}

// The `description` from a SKILL.md's front matter, on one line or as a YAML block (`>`, `|-`, ...)
// whose indented lines follow it.
export function skillDescription(skillMd: string): string {
  const lines = skillMd.split('\n')
  const at = lines.findIndex(line => /^description:/.test(line))
  if (at === -1) return ''

  const value = lines[at]!.replace(/^description:\s*/, '')
  if (!/^[>|][+-]?\s*$/.test(value)) {
    return oneLine(value.replace(/^["']|["']$/g, ''), 220)
  }
  const block: string[] = []
  for (const line of lines.slice(at + 1)) {
    if (!/^\s+\S/.test(line)) break
    block.push(line.trim())
  }

  return oneLine(block.join(' '), 220)
}

// The archive's top folder (the repo and branch, e.g. skills-main), from `tar -tz`'s listing.
export function archiveRoot(listing: string): string | undefined {
  const root = listing.split('\n')[0]?.split('/')[0] ?? ''
  return /^[A-Za-z0-9._-]+$/.test(root) ? root : undefined
}
