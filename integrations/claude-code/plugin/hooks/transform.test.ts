import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { shadeOf } from './cache-meter'
import { compactThread } from './register'

const RUN = {
  command: 'optimize',
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 100 },
}

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

test('/optimize sends the draft in tags and fills the box with the tagged rewrite', async ($, on) => {
  const asked: string[] = []
  const filled: string[] = []
  on('model.complete', (_, e) => {
    asked.push(e.prompt)
    const text = 'Here is the rewrite:\n<optimized_prompt>\nFix the login bug in src/auth.ts.\n</optimized_prompt>'
    return { value: { isAnswered: true as const, text, usage: USAGE } }
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })

  const result = await $.command.run({ ...RUN, args: 'fix login thing auth.ts' })

  expect(asked).toEqual(['<draft>\nfix login thing auth.ts\n</draft>'])
  expect(filled).toEqual(['Fix the login bug in src/auth.ts.'])
  expect(result.text).toContain('in the prompt box')
})

test('/optimize falls back to the whole reply when the tags are missing', async ($, on) => {
  const filled: string[] = []
  on('model.complete', () => ({
    value: { isAnswered: true as const, text: '  Fix the login bug in src/auth.ts.  ', usage: USAGE },
  }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })

  await $.command.run({ ...RUN, args: 'fix login thing' })

  expect(filled).toEqual(['Fix the login bug in src/auth.ts.'])
})

test('/optimize: a failed model call puts the original back', async ($, on) => {
  const filled: string[] = []
  on('model.complete', () => ({
    value: { isAnswered: false as const, reason: 'empty-reply' as const, usage: USAGE },
  }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })

  const result = await $.command.run({ ...RUN, args: 'fix login thing' })

  expect(filled).toEqual(['fix login thing'])
  expect(result.text).toContain("Couldn't optimize it")
})

test('/optimize with no box shows the result and copies it', async ($, on) => {
  on('model.complete', () => ({ value: { isAnswered: true as const, text: 'Clear prompt.', usage: USAGE } }))
  on('prompt.fill', () => ({ isFilled: false, refusal: 'no_composer' as const }))
  on('ui.copy', () => ({ value: { isCopied: true as const } }))

  const result = await $.command.run({ ...RUN, args: 'rough' })

  expect(result.text).toContain('Clear prompt.')
  expect(result.text).toContain('clipboard')
})

test('bare /optimize optimizes the thread and settings, and says when there is nothing to do', async ($, on) => {
  let modelCalls = 0
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: 40_000, percent: 20 }, rateLimits: [] } }))
  on('model.complete', () => {
    modelCalls += 1
    return { value: { isAnswered: true as const, text: 'x', usage: USAGE } }
  })

  const result = await $.command.run({ ...RUN, args: '' })

  expect(modelCalls).toBe(0)
  expect(result.text).toContain('Nothing to optimize: this thread is 20% full')
})

test('the Optimize button rewrites the draft in the box', async ($, on) => {
  let filled: string[] = []
  let toasts: string[] = []
  mock.clock(on)
  on('prompt.read', () => ({ value: { text: 'make the claim page faster', cursor: 26 } }))
  on('model.complete', () => ({ value: { isAnswered: true as const, text: 'Speed up the claim page.', usage: USAGE } }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    filled = []
    toasts = []
    const ui = await $.ui.mount({ ...BAND, surface })
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).toContain('optimize-chip.tsx')

    await ui.post({ press: true }, { in: 'optimize' })

    expect(filled).toEqual(['Speed up the claim page.'])
    expect(toasts[0]).toContain('Prompt optimized')
    await ui.unmount()
  }
})

// An empty box with the thread `percent` full of its context window; records what happened.
function emptyBox(on: On, percent: number) {
  const seen = { toasts: [] as string[], compactions: [] as (string | undefined)[], modelCalls: 0 }
  mock.clock(on)
  on('prompt.read', () => ({ value: { text: '   ', cursor: 0 } }))
  on('session.messages', () => ({ value: [] }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000, tokens: percent * 2000, percent }, rateLimits: [] } }))
  on('session.compact', (_, e) => {
    seen.compactions.push(e.instructions)
    return { messages: [], tokensBefore: percent * 2000, tokensAfter: 9000 }
  })
  on('model.complete', () => {
    seen.modelCalls += 1
    return { value: { isAnswered: true as const, text: 'x', usage: USAGE } }
  })
  on('ui.toast', (_, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  return seen
}

test('the Optimize button with an empty box leaves a short thread alone', async ($, on) => {
  const seen = emptyBox(on, 30)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.post({ press: true }, { in: 'optimize' })

  expect(seen.compactions).toEqual([])
  expect(seen.modelCalls).toBe(0)
  expect(seen.toasts[0]).toContain('30% full')
  expect(seen.toasts[0]).toContain('Type a prompt')
  await ui.unmount()
})

// The kit raises a plugin's compaction without the transcript a session supplies, so this drives the
// empty-box compaction step directly, over a stand-in for the engine.
function fakeEngine(percent: number) {
  const seen = { toasts: [] as string[], compactions: [] as (string | undefined)[], state: new Map<string, unknown>() }
  const engine = {
    session: {
      usage: async () => ({ startedAt: 0, context: { window: 200_000, tokens: percent * 2000, percent }, rateLimits: [] }),
      compact: async (input?: { instructions?: string }) => {
        seen.compactions.push(input?.instructions)
        return { messages: [] }
      },
    },
    ui: { toast: (text: string) => void seen.toasts.push(text) },
    state: {
      get: async ({ key }: { key: string }) => ({ isSet: seen.state.has(key), value: seen.state.get(key), version: 1 }),
      set: async ({ key, value }: { key: string; value: unknown }) => {
        seen.state.set(key, value)
        return { isSet: true, version: 1 }
      },
    },
  }
  return { engine: engine as unknown as Parameters<typeof compactThread>[0], seen }
}

test('compacting keeps what matters and reports the tokens before and after', async () => {
  const { engine, seen } = fakeEngine(72)

  const result = await compactThread(engine, 144_000)

  expect(seen.compactions.length).toBe(1)
  expect(seen.compactions[0]).toContain('decision')
  expect(seen.compactions[0]).toContain('open task')
  expect(seen.compactions[0]).toContain('file paths')
  expect(seen.compactions[0]).toContain('test results')
  expect(result).toEqual({ before: 144_000, after: 0 })
})

test('the Optimize button is a white chip with a light-grey rounded border', async ($, on) => {
  mock.clock(on)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const chip = await ui.find({ in: 'optimize', type: 'Box' })
    expect(chip?.props).toMatchObject({ borderStyle: 'round', borderColor: '#D3D1CB', backgroundColor: '#FFFFFF' })
    expect(chip?.text).toBe('Optimize')
    await ui.unmount()
  }
})

test('/optimize from the phone replies with the rewrite and leaves the prompt box alone', async ($, on) => {
  let fills = 0
  let copies = 0
  on('model.complete', () => ({
    value: { isAnswered: true as const, text: '<optimized_prompt>Speed up the claim page.</optimized_prompt>', usage: USAGE },
  }))
  on('prompt.fill', () => {
    fills += 1
    return { isFilled: true }
  })
  on('ui.copy', () => {
    copies += 1
    return { value: { isCopied: true as const } }
  })

  const result = await $.command.run({ ...RUN, origin: { kind: 'bridge' as const }, args: 'make the claim page faster' })

  expect(result.text).toContain('Speed up the claim page.')
  expect(fills).toBe(0)
  expect(copies).toBe(0)
})

const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Answers the session's model requests, reading and writing the cache as `cached` says.
function answerRequests(on: On) {
  const cached = { read: 0, written: 0 }
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'Done.',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: {
        input_tokens: 10,
        output_tokens: 10,
        cache_read_input_tokens: cached.read,
        cache_creation_input_tokens: cached.written,
        model: 'claude-opus-5-5',
      },
    }
  })

  return cached
}

async function request($: Engine, agentId?: string) {
  const step = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 2, ...(agentId ? { agentId } : {}) })
  for await (const _ of step) {
  }
  await step.result
}

// What the band hands the cache scale about the cache.
async function scale($: Engine) {
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const found = await ui.find({ type: 'Client', key: 'cache' })
  await ui.unmount()
  const { columns, ...cache } = found?.props.props as Record<string, unknown>

  return cache
}

test('the cache scale fills on a request and cools to cold over the hour', async ($, on) => {
  const clock = mock.clock(on, { now: 5 * HOUR })
  const cached = answerRequests(on)
  expect(await scale($)).toEqual({ msLeft: 0, ttlMs: HOUR, cachedTokens: 0 })

  cached.written = 40_000
  await request($)
  expect(await scale($)).toEqual({ msLeft: HOUR, ttlMs: HOUR, cachedTokens: 40_000 })

  await clock.advance(45 * MINUTE)
  expect(await scale($)).toEqual({ msLeft: 15 * MINUTE, ttlMs: HOUR, cachedTokens: 40_000 })

  await clock.advance(20 * MINUTE)
  expect(await scale($)).toEqual({ msLeft: 0, ttlMs: HOUR, cachedTokens: 40_000 })
})

test("a subagent's requests leave the cache scale alone", async ($, on) => {
  mock.clock(on, { now: 5 * HOUR })
  const cached = answerRequests(on)
  cached.written = 40_000

  await request($, 'agent-1')

  expect(await scale($)).toEqual({ msLeft: 0, ttlMs: HOUR, cachedTokens: 0 })
})

test('a request after ten minutes shows which cache lifetime the session has', async ($, on) => {
  const clock = mock.clock(on, { now: 5 * HOUR })
  const cached = answerRequests(on)
  cached.written = 40_000
  await request($)

  // Mostly read after ten minutes: the cache outlived the gap, so it lives an hour.
  await clock.advance(10 * MINUTE)
  cached.read = 39_000
  cached.written = 1_000
  await request($)
  expect(await scale($)).toEqual({ msLeft: HOUR, ttlMs: HOUR, cachedTokens: 40_000 })

  // Mostly written again after ten minutes: it had expired, so it lives five.
  await clock.advance(10 * MINUTE)
  cached.read = 0
  cached.written = 40_000
  await request($)
  expect(await scale($)).toEqual({ msLeft: 5 * MINUTE, ttlMs: 5 * MINUTE, cachedTokens: 40_000 })
})

test('a model switch reports the cache lifetime and leaves the new model cold', async ($, on) => {
  mock.clock(on, { now: 5 * HOUR })
  on('classic.PostModelSwitch', () => ({}))
  const cached = answerRequests(on)
  cached.written = 40_000
  await request($)

  await $.classic.PostModelSwitch({
    from_model: 'claude-opus-5-5',
    to_model: 'claude-sonnet-5-5',
    requested_model: 'sonnet',
    source: 'command',
    context_tokens: 40_000,
    prompt_cache_warm: false,
    cache_ttl: '5m',
    estimated_cache_write_usd: 0.2,
    pricing: 'catalog',
  })

  expect(await scale($)).toEqual({ msLeft: 0, ttlMs: 5 * MINUTE, cachedTokens: 0 })
})

test('a resumed conversation is cached from its last response', async ($, on) => {
  mock.clock(on, { now: 5 * HOUR })
  on('classic.SessionStart', () => ({}))

  await $.classic.SessionStart({
    source: 'resume',
    seconds_since_last_response: 600,
    context_tokens: 80_000,
    prompt_cache_likely_expired: false,
  })

  expect(await scale($)).toEqual({ msLeft: 50 * MINUTE, ttlMs: HOUR, cachedTokens: 80_000 })
})

test('the shade runs from dark red when warm to dark navy when cold', () => {
  expect(shadeOf(1)).toBe('#8b1a1a')
  expect(shadeOf(0)).toBe('#1b2f5e')
  expect(shadeOf(0.5)).not.toBe(shadeOf(0.6))
})

test('the cache meter is one still bar in a dark shade that cools from red to navy, beside its label', async ($, on) => {
  const clock = mock.clock(on, { now: 5 * HOUR })
  const cached = answerRequests(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  cached.written = 118_000
  await request($)
  await clock.advance(18 * MINUTE)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    // The band's 100 columns less the 12-column button and the gap.
    const region = await ui.find({ type: 'Client', key: 'cache' })
    expect(region?.props).toMatchObject({ width: 87, props: { columns: 87 } })
    const label = '42m left · 118k cached'
    expect((await ui.find({ in: 'cache', type: 'Text', text: /left/ }))?.text).toBe(label)

    // One bar of at most 28 cells, so a desktop can't wrap it: 70% warm fills 20 of them in one shade.
    const runs = await ui.findAll({ in: 'cache', type: 'Text', text: /^[█░]+$/ })
    expect(runs.map(run => run.text).join('')).toBe('█'.repeat(20) + '░'.repeat(8))
    const fill = runs.find(run => run.text.startsWith('█'))
    expect(fill?.props.color).toBe(shadeOf(42 / 60))

    // No animation: the bar holds still between redraws.
    const frame = JSON.stringify(await ui.drawn({ in: 'cache' }))
    await ui.advance(1000)
    expect(JSON.stringify(await ui.drawn({ in: 'cache' }))).toBe(frame)

    await ui.unmount()
  }

  // Nothing asks for a redraw: the session's own timer redraws the band as the time runs out.
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await clock.advance(43 * MINUTE)
  expect((await ui.find({ in: 'cache', type: 'Text', text: /cold/ }))?.text).toBe('cold · 118k to re-cache')
  expect(JSON.stringify(await ui.drawn({ in: 'cache' }))).not.toContain('█')
  await ui.unmount()
})
