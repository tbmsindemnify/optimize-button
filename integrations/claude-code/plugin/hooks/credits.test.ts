import { expect, mock, test } from 'claude-code/testing'

import {
  applyMoves,
  idlePlugins,
  idleServers,
  isWorthCompacting,
  movesFrom,
  pluginsUsed,
  rulesToAdd,
  sections,
  serverUses,
  withDenyRules,
} from './credits-lib'

const BAND = {
  plugin: 'prompt-transform',
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
}

const USAGE = {
  input_tokens: 10,
  output_tokens: 10,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

test('a thread is worth compacting at half its window or 150k tokens, whichever comes first', () => {
  expect(isWorthCompacting(50, 100_000)).toBe(true)
  expect(isWorthCompacting(16, 160_000)).toBe(true)
  expect(isWorthCompacting(30, 60_000)).toBe(false)
})

test('deny rules cover only what the project has, and skip rules already denied', () => {
  const present = new Set(['node_modules', 'dist', 'package.json', 'package-lock.json', '.env', '.claude/worktrees'])

  const added = rulesToAdd(present, ['Read(./dist/**)'])

  expect(added.map(rule => rule.rule)).toEqual([
    'Read(./node_modules/**)',
    'Read(./.claude/worktrees/**)',
    'Read(./package-lock.json)',
    'Read(./**/*.min.js)',
    'Read(./**/*.map)',
    'Read(./.env)',
  ])
  // Logs stay readable: debugging needs them.
  expect(added.some(rule => rule.rule.includes('.log'))).toBe(false)
})

test('deny rules merge into the settings file and keep every other key', () => {
  const before = JSON.stringify({ fastMode: true, permissions: { allow: ['Bash(npm test)'], deny: ['Read(./a)'] } })

  const after = JSON.parse(withDenyRules(before, ['Read(./a)', 'Read(./b)']))

  expect(after).toEqual({ fastMode: true, permissions: { allow: ['Bash(npm test)'], deny: ['Read(./a)', 'Read(./b)'] } })
  expect(JSON.parse(withDenyRules(undefined, ['Read(./b)']))).toEqual({ permissions: { deny: ['Read(./b)'] } })
})

test('an MCP server with no call in the window is idle, with what its loaded tools cost', () => {
  const uses = serverUses('"name":"mcp__claude_ai_Gmail__\n"name":"mcp__claude_ai_Gmail__\n"name":"mcp__gsc__')
  const tools = [
    { name: 'mcp__claude_ai_Gmail__search', serverName: 'claude.ai Gmail', tokens: 300, isLoaded: true },
    { name: 'mcp__jax__chat', serverName: 'jax', tokens: 500, isLoaded: true },
    { name: 'mcp__jax__status', serverName: 'jax', tokens: 200, isLoaded: false },
  ]

  const idle = idleServers(
    [
      { name: 'gsc', where: 'Claude Code (user)' },
      { name: 'jax', where: 'Claude Code (user)' },
    ],
    tools,
    uses,
  )

  expect(uses.get('claude_ai_Gmail')).toBe(2)
  expect(idle).toEqual([{ name: 'jax', where: 'Claude Code (user)', tools: 2, tokens: 500 }])
})

test("a plugin nobody used here is idle, costliest first; one in use isn't", () => {
  const used = pluginsUsed('"skill":"engineering:debug"\n<command-name>/sales:forecast\nmcp__plugin_figma_figma__')
  const skills = [
    { name: 'a', source: 'plugin', pluginName: 'twilio-developer-kit', tokens: 900 },
    { name: 'b', source: 'plugin', pluginName: 'render', tokens: 300 },
    { name: 'c', source: 'plugin', pluginName: 'engineering', tokens: 400 },
  ]

  const idle = idlePlugins(
    { 'engineering@m': true, 'sales@m': true, 'figma@m': true, 'render@m': true, 'twilio-developer-kit@m': true, 'off@m': false },
    used,
    skills,
    [],
  )

  expect([...used].sort()).toEqual(['engineering', 'figma', 'sales'])
  expect(idle).toEqual([
    { id: 'twilio-developer-kit@m', tokens: 900 },
    { id: 'render@m', tokens: 300 },
  ])
})

const CLAUDE_MD = `# Project

Intro line.

## Commands
npm test

## Architecture
Overview.

### Routing
Routes live in src/App.tsx.
\`\`\`
## not a heading inside a fence
\`\`\`

### Services
Service list.

## Rules
Never push.

<!-- SHARED:BEGIN -->
## Published
Do not edit here.
<!-- SHARED:END -->
`

test('sections skip fenced lines and lock a published block', () => {
  const found = sections(CLAUDE_MD)

  expect(found.map(section => section.heading)).toEqual(['Commands', 'Architecture', 'Routing', 'Services', 'Rules', 'Published'])
  expect(found.find(section => section.heading === 'Routing')?.parent).toBe('Architecture')
  expect(found.filter(section => section.isLocked).map(section => section.heading)).toEqual(['Published'])
  // The classifier can't pick a locked section.
  expect(movesFrom('{"move": [2, 5, 99]}', found)).toEqual([2])
})

test('moving sections leaves plain-path pointers and carries the text word for word', () => {
  const found = sections(CLAUDE_MD)

  const { claudeMd, files } = applyMoves(CLAUDE_MD, found, [2, 3], new Map())

  const doc = files.get('docs/agent/architecture.md') ?? ''
  expect([...files.keys()]).toEqual(['docs/agent/architecture.md'])
  expect(doc).toContain('### Routing\nRoutes live in src/App.tsx.')
  expect(doc).toContain('## not a heading inside a fence')
  expect(doc).toContain('### Services\nService list.')
  expect(claudeMd).toContain('- Routing: see docs/agent/architecture.md\n- Services: see docs/agent/architecture.md')
  expect(claudeMd).not.toContain('Routes live in')
  expect(claudeMd).not.toContain('@docs')
  expect(claudeMd).toContain('## Commands\nnpm test')
  expect(claudeMd).toContain('<!-- SHARED:BEGIN -->\n## Published')
})

test('one press with a draft and a thread over half full rewrites, compacts, then fills the box', async ($, on) => {
  const order: string[] = []
  const toasts: string[] = []
  mock.clock(on)
  on('prompt.read', () => ({ value: { text: 'make the claim page faster', cursor: 26 } }))
  on('session.messages', () => ({ value: [] }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 150_000, percent: 75 }, rateLimits: [] } }))
  on('model.complete', () => {
    order.push('rewrite')
    return { value: { isAnswered: true as const, text: 'Speed up the claim page.', usage: USAGE } }
  })
  on('session.compact', () => {
    order.push('compact')
    return { skip: 'the kit has no transcript to summarize' }
  })
  on('prompt.fill', (_, e) => {
    order.push(`fill:${e.text}`)
    return { isFilled: true }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.post({ press: true }, { in: 'optimize' })

  // The kit can't finish a compaction through this mod's own compact hook (it has no transcript), so
  // this checks the order; the compaction's tokens are checked over a stand-in in transform.test.ts.
  expect(order[0]).toBe('rewrite')
  expect(order.indexOf('compact')).toBeGreaterThan(0)
  expect(order.at(-1)).toBe('fill:Speed up the claim page.')
  expect(toasts[0]).toContain('Prompt optimized')
  await ui.unmount()
})

test('a press adds the missing deny rules to the personal settings file, keeping its keys', async ($, on) => {
  const writes: { path: string; text: string }[] = []
  const toasts: string[] = []
  const has = new Set(['/repo/node_modules', '/repo/dist', '/repo/package.json'])
  mock.clock(on)
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 20_000, percent: 10 }, rateLimits: [] } }))
  on('session.cwd', () => ({ value: '/repo' }))
  const store: Record<string, unknown> = {}
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    delete store[e.key]
    return { value: undefined }
  })
  on('env.get', () => ({ value: '/home/me' }))
  on('fs.exists', (_, e) => ({ value: has.has(e.path) }))
  on('settings.read', () => ({ value: { permissions: { deny: ['Read(./dist/**)'] } } }))
  on('fs.read', (_, e) => ({ value: e.path === '/repo/.claude/settings.local.json' ? '{"fastMode":true}' : '' }))
  on('fs.write', (_, e) => {
    writes.push({ path: e.path, text: e.text })
    return { value: undefined }
  })
  const panes: string[] = []
  on('ui.open', (_, e) => {
    panes.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.post({ press: true }, { in: 'optimize' })

  const settings = writes.find(write => write.path === '/repo/.claude/settings.local.json')
  expect(JSON.parse(settings?.text ?? '{}')).toEqual({
    fastMode: true,
    permissions: { deny: ['Read(./node_modules/**)', 'Read(./**/*.min.js)', 'Read(./**/*.map)'] },
  })
  expect(toasts[0]).toContain('Added 3 deny rules')
  // The Save credits pane opens to show them, and the file as it was is kept for Undo.
  expect(panes).toContain('save-credits')
  expect(store['undo.rules./repo']).toEqual({ text: '{"fastMode":true}' })
  await ui.unmount()
})
