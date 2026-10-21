import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { detectarIdioma, fijarIdioma } from './i18n'
import { htmlInforme } from './informe'
import { documentoRepaso } from './pdf'
import { interpretarFecha } from './plan'
import { describirIntervalo, fechaLarga } from './srs'

const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
const PANEL = {
  plugin: 'estudio', component: 'Pane', requestId: 'estudio',
  props: { title: 'Estudio', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

function motor(on: On, env: Record<string, string> = { HOME: '/home/test' }) {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, env)
  const archivos = new Map<string, string>()
  on('fs.write', (_, e) => {
    archivos.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: archivos.get(e.path) ?? '' }))
  on('fs.exists', (_, e) => ({ value: archivos.has(e.path) || [...archivos.keys()].some(k => k.startsWith(e.path + '/')) }))
  on('fs.list', () => ({ value: [] }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return { clock, archivos }
}

describe('idioma', () => {
  test('detectarIdioma: la opción manda; con auto, LANG/LC_ALL/LANGUAGE; sin nada, español', async () => {
    expect(detectarIdioma('en', ['es_ES.UTF-8'])).toBe('en')
    expect(detectarIdioma('es', ['en_US.UTF-8'])).toBe('es')
    expect(detectarIdioma('auto', [undefined, 'en_GB.UTF-8'])).toBe('en')
    expect(detectarIdioma('auto', ['es_MX.UTF-8'])).toBe('es')
    expect(detectarIdioma('auto', ['C', 'POSIX'])).toBe('es')
    expect(detectarIdioma('auto', [])).toBe('es')
  })

  test('fechas, intervalos y documentos en inglés', async () => {
    fijarIdioma('en')
    try {
      expect(fechaLarga('2026-10-20')).toBe('October 20, 2026')
      expect([0, 21, 500].map(describirIntervalo)).toEqual(['today', '3 wk', '1.4 y'])
      const pdf = documentoRepaso({ cuaderno: { nombre: 'bio', ruta: '/r', fuentes: [], nuevas: [] }, hoy: '2026-10-20', tarjetas: [], stats: {}, documentos: [] })
      expect(pdf).toContain('lang="en"')
      expect(pdf).toContain('No sources yet')
      expect(pdf).not.toContain('Fuentes')
      const png = htmlInforme({ lunes: '2026-10-19', hoy: '2026-10-20', stats: {}, logros: {} })
      expect(png).toContain('My study week')
      expect(png).toContain('October 19–25, 2026')
    } finally {
      fijarIdioma('es')
    }
  })

  test('fechas de examen escritas en inglés', async () => {
    const hoy = '2026-10-20'
    expect(interpretarFecha('November 15', hoy)).toBe('2026-11-15')
    expect(interpretarFecha('Nov 15, 2027', hoy)).toBe('2027-11-15')
    expect(interpretarFecha('in 2 weeks', hoy)).toBe('2026-11-03')
    expect(interpretarFecha('tomorrow', hoy)).toBe('2026-10-21')
    // mes/día solo cuando no puede ser día/mes
    expect(interpretarFecha('11/15', hoy)).toBe('2026-11-15')
    expect(interpretarFecha('15/11', hoy)).toBe('2026-11-15')
    expect(interpretarFecha('3/11', hoy)).toBe('2026-11-03')
    expect(interpretarFecha('13/13', hoy)).toBeUndefined()
  })
})

test('con idioma en: comandos, avisos y panel en inglés', { options: { idioma: 'en' } }, async ($, on) => {
  const { clock } = motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await $.command.run({ command: 'estudio', args: 'help', ...CMD })).text).toContain('Study commands:')
  expect((await $.command.run({ command: 'cuaderno', args: 'biology', ...CMD })).text).toContain('Active notebook: «biology».')
  expect((await $.command.run({ command: 'pomodoro', args: 'start 1 Cells', ...CMD })).text).toBe('🍅 01:00 · focus 1/4 · Cells')
  await clock.advance(61_000)
  expect((await $.command.run({ command: 'pomodoro', args: 'status', ...CMD })).text).toContain('break')
  expect((await $.command.run({ command: 'examen', args: 'in 20 days Final', ...CMD })).text).toContain('🎯 Final: November 9, 2026 (in 20 days)')
  expect((await $.command.run({ command: 'anki', args: '', ...CMD })).text).toContain('0 cards · 0 for today')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANEL, surface })
    expect((await ui.find({ key: 'tab-repaso' }))?.props.label).toBe('🃏 Review')
    await ui.press({ key: 'tab-logros' })
    expect(await ui.find({ type: 'Text', text: /🍅 First tomato/ })).toBeDefined()
    await ui.press({ key: 'tab-stats' })
    expect(await ui.find({ type: 'Text', text: /^Streak$/ })).toBeDefined()
    await ui.press({ key: 'tab-cuaderno' })
    expect(await ui.find({ type: 'Text', text: /🎯 Final · in 20 days/ })).toBeDefined()
    expect((await ui.find({ key: 'pdf' }))?.props.label).toBe('📄 PDF')
    await ui.unmount()
  }
})

test('con idioma auto y LANG en inglés, la interfaz sale en inglés', async ($, on) => {
  motor(on, { HOME: '/home/test', LANG: 'en_US.UTF-8' })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await $.command.run({ command: 'pomodoro', args: '', ...CMD })).text).toBe('🍅 25:00 · focus 1/4 · General')
})
