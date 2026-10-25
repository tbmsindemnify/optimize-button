import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderInput, SessionRateLimit } from 'claude-code'

import type { DayStats, Limit } from '../types'

// The usage row under the Optimize band (Tyler, 2026-10-19): today's productivity score, the 5-hour
// and weekly limits with when each resets, the model, and what's left of Fable 5.1.

const limits = atom({ plugin: 'prompt-transform', key: 'limits' } as const, [] as Limit[])
const model = atom({ plugin: 'prompt-transform', key: 'model' } as const, '')
const day = atom({ plugin: 'prompt-transform', key: 'day' } as const, null as DayStats | null)

// Gaps longer than this between events don't count as active time.
const IDLE_MS = 15 * 60_000
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dateKey(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function clockLabel(d: Date) {
  const h = d.getHours() % 12 || 12
  const m = d.getMinutes()
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''}${d.getHours() < 12 ? 'a' : 'p'}`
}

export function resetLabel(iso: string | undefined, now: number) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const isToday = dateKey(d.getTime()) === dateKey(now)
  return `resets ${isToday ? '' : `${DAYS[d.getDay()]} `}${clockLabel(d)}`
}

// claude-fable-5-1 → Fable 5.1; claude-sonnet-5-5[1m] → Sonnet 5.5.
export function prettyModel(id: string) {
  const base = id.replace(/\[.*\]$/, '').replace(/^claude-/, '')
  const [, name = '', major = '', minor] = base.match(/^([a-z]+)-(\d+)(?:-(\d+))?/) ?? []
  if (!name) return id || '—'
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${major}${minor && minor.length <= 2 ? `.${minor}` : ''}`
}

// 0–100: active time 40 (full at 6h), file edits 30 (40), commits 20 (5), prompts 10 (30).
export function productivity(s: DayStats | null) {
  if (!s) return 0
  const part = (v: number, target: number, weight: number) => Math.min(v / target, 1) * weight
  return Math.round(
    part(s.activeMs / 60_000, 360, 40) + part(s.edits, 40, 30) + part(s.commits, 5, 20) + part(s.prompts, 30, 10),
  )
}

const usageColor = (pct: number) => (pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success')

async function record($: EngineInterface, field: 'prompts' | 'edits' | 'commits' | null) {
  const now = await $.clock.now()
  const today = dateKey(now)
  const stored = (await $.store.get('day')) as DayStats | undefined
  const s: DayStats =
    stored && stored.date === today
      ? { ...stored }
      : { date: today, prompts: 0, edits: 0, commits: 0, activeMs: 0, lastAt: now }
  const gap = now - s.lastAt
  if (gap > 0 && gap < IDLE_MS) s.activeMs += gap
  s.lastAt = now
  if (field) s[field] += 1
  await $.store.set('day', s)
  await update($, day, () => s)
}

// Stats are best effort: a failure here never blocks a tool call or a prompt.
const bump = ($: EngineInterface, field: 'prompts' | 'edits' | 'commits' | null) => record($, field).catch(() => {})

async function refresh($: EngineInterface, rateLimits?: SessionRateLimit[]) {
  const rl = rateLimits ?? (await $.session.usage()).rateLimits
  await update($, limits, () => rl.map((l: SessionRateLimit) => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })))
  const m = await $.session.model()
  await update($, model, () => m)
}

// Called from the module's session.start: the limits and model now, and today's stats so far.
export async function startUsage($: EngineInterface) {
  await refresh($).catch(() => {})
  const stored = (await $.store.get('day').catch(() => undefined)) as DayStats | undefined
  if (stored && stored.date === dateKey(await $.clock.now())) await update($, day, () => stored)
}

export function registerUsage(on: On) {
  on('session.measure', async ($, e, next) => {
    await refresh($, e.rateLimits).catch(() => {})
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await bump($, null)
    await refresh($).catch(() => {})
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit') await bump($, 'edits')
    else if (e.tool === 'Bash' && /\bgit\b[^|;&]*\bcommit\b/.test(e.command)) await bump($, 'commits')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    await bump($, 'prompts')
    return next(e)
  }).catch(($, e, next) => next(e))
}

// The row itself, drawn under the Optimize button and cache bar.
export async function usageRow($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const { Box, Text } = $.ui.resolve(e)
  const ls = await read($, limits)
  const modelId = await read($, model)
  const stats = await read($, day)
  const now = await $.clock.now()

  const five = ls.find(l => l.kind === 'five_hour')
  const week = ls.find(l => l.kind === 'seven_day')
  const fable = ls.find(l => /fable/i.test(l.kind))
  const others = ls.filter(l => l !== five && l !== week && l !== fable)
  const today = stats && stats.date === dateKey(now) ? stats : null
  const score = productivity(today)

  const window = (label: string, l: Limit | undefined) =>
    l ? (
      <Text key={label}>
        <Text dimColor>{label} </Text>
        <Text color={usageColor(l.percentUsed)}>{`${Math.round(l.percentUsed)}%`}</Text>
        <Text dimColor> {resetLabel(l.resetsAt, now)}</Text>
      </Text>
    ) : (
      <Text key={label} dimColor>
        {label} —
      </Text>
    )

  return (
    <Box key="usage" columnGap={2} flexWrap="wrap">
      <Text key="score">
        <Text dimColor>Productivity </Text>
        <Text color={score >= 70 ? 'success' : score >= 40 ? 'warning' : 'subtle'} weight="semibold">
          {score}
        </Text>
        <Text dimColor>
          /100
          {today ? ` · ${Math.round(today.activeMs / 60_000)}m active · ${today.edits} edits · ${today.commits} commits` : ''}
        </Text>
      </Text>
      {window('Session (5h)', five)}
      {window('Week', week)}
      <Text key="model">
        <Text dimColor>Model </Text>
        <Text>{prettyModel(modelId)}</Text>
      </Text>
      <Text key="fable">
        <Text dimColor>Fable 5.1 left </Text>
        {fable ? (
          <Text>
            <Text color={usageColor(fable.percentUsed)}>{`${Math.max(0, Math.round(100 - fable.percentUsed))}%`}</Text>
            <Text dimColor> {resetLabel(fable.resetsAt, now)}</Text>
          </Text>
        ) : (
          <Text dimColor>{week ? `${Math.max(0, Math.round(100 - week.percentUsed))}% (shared weekly)` : '—'}</Text>
        )}
      </Text>
      {others.map(l => window(l.kind.replace(/_/g, ' '), l))}
    </Box>
  )
}
