import type { ClientModule } from 'claude-code'

// `columns`: the band's width beside the button, which the bar and its label share.
type Props = { msLeft: number; ttlMs: number; cachedTokens: number; columns: number }

// Dark shades from warm to cold: the cache just written, then cooling towards expiry (Tyler, 2026-10-07).
const SHADES: [number, number, number][] = [
  [0x8b, 0x1a, 0x1a], // dark red
  [0x8a, 0x3b, 0x12], // dark orange
  [0x6e, 0x5a, 0x12], // dark gold
  [0x1f, 0x5a, 0x3a], // dark green
  [0x16, 0x4e, 0x63], // dark teal
  [0x1b, 0x2f, 0x5e], // dark navy
]
// One bar, never wider than this, so a desktop's wider block glyphs can't wrap it onto a second line.
const MAX_BAR = 28
const MIN_BAR = 8

function formatTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)}m`
}

function formatTokens(tokens: number): string {
  return tokens < 1000 ? `${tokens}` : `${Math.round(tokens / 1000)}k`
}

const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0')

// The shade for `warmth` (1 just written, 0 expired), blended between the two nearest dark shades.
export function shadeOf(warmth: number): string {
  const position = (1 - Math.min(1, Math.max(0, warmth))) * (SHADES.length - 1)
  const low = Math.floor(position)
  const high = Math.min(SHADES.length - 1, low + 1)
  const mix = position - low
  const [a, b] = [SHADES[low] ?? SHADES[0]!, SHADES[high] ?? SHADES[0]!]
  return `#${hex(a[0] + (b[0] - a[0]) * mix)}${hex(a[1] + (b[1] - a[1]) * mix)}${hex(a[2] + (b[2] - a[2]) * mix)}`
}

// A single bar of the prompt cache's warmth on the button's middle row: filled to the share of the
// cache's lifetime left, in one dark shade that runs from red when warm to navy when nearly cold.
const CacheMeter: ClientModule<Props> = (props, surface) => {
  const { Box, Text } = surface.elements

  const warmth = props.ttlMs > 0 ? Math.min(1, Math.max(0, props.msLeft / props.ttlMs)) : 0
  const shade = shadeOf(warmth)
  const tokens = formatTokens(props.cachedTokens)
  const time = props.msLeft > 0 ? `${formatTime(props.msLeft)} left` : ''
  const detail =
    props.msLeft > 0 ? ` · ${tokens} cached` : props.cachedTokens > 0 ? `cold · ${tokens} to re-cache` : 'cache cold'

  const width = Math.max(MIN_BAR, Math.min(MAX_BAR, props.columns - time.length - detail.length - 1))
  const full = props.msLeft > 0 ? Math.max(1, Math.round(warmth * width)) : 0

  return (
    <Box flexDirection="column">
      <Text> </Text>
      <Box>
        {full > 0 ? <Text color={shade}>{'█'.repeat(full)}</Text> : null}
        {width - full > 0 ? <Text color="inactive">{'░'.repeat(width - full)}</Text> : null}
        <Text> </Text>
        {time ? (
          <Text>
            <Text bold color={shade}>
              {time}
            </Text>
            <Text dimColor>{detail}</Text>
          </Text>
        ) : (
          <Text dimColor>{detail}</Text>
        )}
      </Box>
      <Text> </Text>
    </Box>
  )
}

export default CacheMeter
