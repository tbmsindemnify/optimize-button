import { expect, mock, test } from 'claude-code/testing'

import { prettyModel, productivity } from './usage'

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

test('the usage row shows productivity, the 5-hour and weekly limits, the model and Fable left', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-20T15:00:00') })
  on('session.model', () => ({ value: 'claude-fable-5-1' }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await $.session.measure({
    context: { percent: 10 } as never,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-20T18:40:00' },
      { kind: 'seven_day', percentUsed: 61, resetsAt: '2026-10-23T09:00:00' },
    ],
    changed: ['rateLimits'],
  })
  await $.prompt.submit({ text: 'hello' } as never).catch(() => {})

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const drawn = JSON.stringify(await ui.drawn())
    await ui.unmount()

    for (const part of ['optimize-chip.tsx', 'Productivity', '/100', 'Session (5h)', '42%', 'resets 6:40p', 'Week', '61%', 'resets Fri 9a', 'Fable 5.1', '39% (shared weekly)']) {
      expect(drawn).toContain(part)
    }
  }
})

test('model ids read as names and the score is capped at 100', () => {
  expect(prettyModel('claude-fable-5-1')).toBe('Fable 5.1')
  expect(prettyModel('claude-sonnet-5-5[1m]')).toBe('Sonnet 5.5')
  expect(productivity({ date: 'x', prompts: 99, edits: 99, commits: 99, activeMs: 99 * 3_600_000, lastAt: 0 })).toBe(100)
  expect(productivity(null)).toBe(0)
})
