export type Busy = boolean

// How long the prompt cache lives after a request.
export type CacheTtl = '5m' | '1h'

// The main conversation's prompt cache, as its last model request left it.
export type Cache = {
  // When that request finished, in `$.clock.now()` milliseconds; null while nothing is cached.
  lastRequestAt: number | null
  // Tokens the request read from or wrote to the cache.
  cachedTokens: number
  ttl: CacheTtl
}

// A skill in Anthropic's skills repo that you don't have yet, offered for you to download or leave out.
export type SkillOffer = { name: string; description: string }

// One `##` or `###` section of a CLAUDE.md over 200 lines, and whether the proposal moves it out.
export type ClaudeMdSection = { id: number; heading: string; parent: string; lines: number; chars: number; isMoving: boolean }

// A CLAUDE.md over 200 lines: its size now, the proposed move, and whether a move can be undone.
export type ClaudeMdProposal = {
  path: string
  lines: number
  chars: number
  sections: ClaudeMdSection[]
  canUndo: boolean
}

// What the Save credits pane shows for the session's project.
export type CreditReport = {
  project: string
  // The last press: the compaction's tokens, and the deny rules it added.
  compacted: { before: number; after: number } | null
  rulesAdded: { rule: string; reason: string }[]
  rulesPath: string
  canUndoRules: boolean
  // The daily checks.
  checkedAt: number
  servers: { name: string; where: string; tools: number; tokens: number }[]
  plugins: { id: string; tokens: number }[]
  hasRtk: boolean
  hasContextMode: boolean
  claudeMd: ClaudeMdProposal[]
}

// A rate-limit window the last API response reported (five_hour, seven_day, ...).
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

// Today's activity, kept across sessions in the store, for the productivity score.
export type DayStats = { date: string; prompts: number; edits: number; commits: number; activeMs: number; lastAt: number }

declare module 'claude-code' {
  interface PluginState {
    'prompt-transform': { isBusy: Busy; cache: Cache; skillOffer: SkillOffer[]; isStale: boolean; report: CreditReport; limits: Limit[]; model: string; day: DayStats | null }
  }
}
