import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'prisme',
  component: 'Pane',
  requestId: 'prisme',
  props: {
    title: 'Prisme',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the pane draws an idle state on every surface', async $ => {
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /pas un capteur/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a tool call lands in the activity ribbon', async ($, on) => {
  on('command.register', () => ({ value: { command: 'prisme' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm run build' })

  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props?.source)).toContain('Exécute (Bash)')
  expect(String(svg?.props?.source)).toContain('npm run build')
  await ui.unmount()
})
