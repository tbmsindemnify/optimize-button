import type { ClientModule } from 'claude-code'

type Props = { isBusy: boolean }

// Deep, dark rainbow: red, orange, gold, green, teal, blue, indigo, violet.
const DARK_RAINBOW = ['#9B1B30', '#B5470F', '#9A7D0A', '#1E7B34', '#0E6655', '#1A4F8B', '#4A235A', '#7D3C98']
// A white chip with a thin light-grey rounded border, as the desktop draws the buttons beside the prompt box.
const CHIP = '#FFFFFF'
const CHIP_BORDER = '#D3D1CB'

// A clickable "Optimize" label, one dark rainbow colour per letter; a click (or Return once focused) posts a press.
const OptimizeButton: ClientModule<Props> = (props, surface) => {
  const { Box, Text } = surface.elements

  surface.onPointer(event => {
    if (event.type === 'up' && event.button === 'left') surface.post({ press: true })
  })
  surface.onKey(event => {
    if (event.key === 'return' || event.key === ' ') surface.post({ press: true })
  })

  const label = props.isBusy ? 'Optimizing…' : 'Optimize'

  return (
    <Box borderStyle="round" borderColor={CHIP_BORDER} backgroundColor={CHIP} paddingX={1}>
      {[...label].map((letter, i) => (
        <Text bold color={DARK_RAINBOW[i % DARK_RAINBOW.length]} backgroundColor={CHIP}>
          {letter}
        </Text>
      ))}
    </Box>
  )
}

export default OptimizeButton
