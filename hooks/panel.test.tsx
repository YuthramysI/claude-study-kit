import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()

/** Un motor mínimo debajo del plugin: reloj, almacén y entorno en memoria. */
function motor(on: On) {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('fs.exists', () => ({ value: false }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return clock
}

const PANEL = {
  plugin: 'estudio',
  component: 'Pane',
  requestId: 'estudio',
  props: {
    title: 'Estudio',
    isFocused: true,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('el panel controla el Pomodoro y avisa si no hay cuaderno, en terminal y escritorio', async ($, on) => {
  motor(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANEL, surface })

    // terminal: reloj en dígitos grandes y fase en texto; escritorio: anillo SVG con el tiempo en su alt
    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Text', text: /┏━┓/ }))?.text).toContain('┏━┓')
      expect(await ui.find({ type: 'Text', text: /LISTO · ENFOQUE/ })).toBeDefined()
    } else {
      expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('25:00')
    }
    await ui.press({ key: 'iniciar' })
    expect(await ui.find({ key: 'pausar' })).toBeDefined()
    await ui.press({ key: 'pausar' })
    expect(await ui.find({ key: 'reanudar' })).toBeDefined()
    await ui.press({ key: 'parar' })
    expect(await ui.find({ key: 'iniciar' })).toBeDefined()

    await ui.press({ key: 'tab-repaso' })
    expect(await ui.find({ type: 'Text', text: /No hay cuaderno activo/ })).toBeDefined()
    await ui.press({ key: 'tab-pomodoro' })
    await ui.unmount()
  }
})

test('/pomodoro 1 arranca un enfoque de un minuto y /pomodoro estado lo describe', async ($, on) => {
  motor(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const inicio = await $.command.run({ command: 'pomodoro', args: '1', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  expect(inicio.text).toBe('🍅 01:00 · enfoque 1/4 · General')
  const estado = await $.command.run({ command: 'pomodoro', args: 'estado', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  expect(estado.text).toContain('enfoque')
  const nada = await $.command.run({ command: 'pomodoro', args: 'bailar', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  expect(nada.text).toContain('No entiendo')
})

test('al llegar a cero el enfoque pasa a descanso, avisa y cuenta el pomodoro', async ($, on) => {
  const clock = motor(on)
  const avisos: string[] = []
  on('ui.toast', (_, e) => {
    avisos.push(e.text)
    return { value: undefined }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pomodoro', args: 'iniciar 1', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  await clock.advance(61_000)

  const estado = await $.command.run({ command: 'pomodoro', args: 'estado', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  expect(estado.text).toContain('descanso')
  expect(avisos.some(a => a.includes('Pomodoro terminado'))).toBe(true)
  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Hoy:/ }))?.text).toContain('Hoy: 1 pomodoro')
  expect((await ui.find({ type: 'Text', text: /DESCANSO/ }))?.text).toContain('DESCANSO')
  await ui.unmount()
})

test('/pomodoro sin argumentos inicia o reanuda, pero nunca pausa', async ($, on) => {
  motor(on)
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await $.command.run({ command: 'pomodoro', args: '', ...cmd })).text).toBe('🍅 25:00 · enfoque 1/4 · General')
  expect((await $.command.run({ command: 'promodoro', args: '', ...cmd })).text).toBe('🍅 25:00 · enfoque 1/4 · General')
  await $.command.run({ command: 'pomodoro', args: 'pausar', ...cmd })
  expect((await $.command.run({ command: 'pomodoro', args: '', ...cmd })).text).not.toContain('pausa')
})

test('si Claude Code rechaza un comando al arrancar, el Pomodoro sigue avisando al terminar', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  on('command.register', (_, e) => (e.name === 'anki' ? { deny: 'choca con una skill' } : { value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('fs.exists', () => ({ value: false }))
  on('ui.status', () => ({ value: undefined }))
  const avisos: string[] = []
  on('ui.toast', (_, e) => {
    avisos.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pomodoro', args: '1', ...cmd })
  await clock.advance(62_000)

  expect(avisos.some(a => a.includes('Pomodoro terminado'))).toBe(true)
  const diag = await $.tool.call({ tool: 'mcp__estudio__diagnostico_pomodoro' })
  expect(String(diag.result)).toContain('/anki')
})

test('«/pomodoro iniciar» con el reloj en marcha no lo reinicia', async ($, on) => {
  const clock = motor(on)
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pomodoro', args: 'iniciar', ...cmd })
  await clock.advance(30_000)
  const otra = await $.command.run({ command: 'pomodoro', args: 'iniciar', ...cmd })
  expect(otra.text).toBe('🍅 24:30 · enfoque 1/4 · General')
  // con minutos explícitos sí empieza uno nuevo
  expect((await $.command.run({ command: 'pomodoro', args: 'iniciar 10', ...cmd })).text).toBe('🍅 10:00 · enfoque 1/4 · General')
})

test('si el temporizador no late, el siguiente comando detecta la fase vencida y avisa', async ($, on) => {
  // un reloj que solo avanza a mano y un motor que rechaza todo temporizador: el latido nunca llega
  let ahora = T0
  on('clock.now', () => ({ value: ahora }))
  on('clock.every', () => ({ deny: 'sin temporizadores' }))
  on('clock.after', () => ({ deny: 'sin temporizadores' }))
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('fs.exists', () => ({ value: false }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.notify', () => ({ value: { isSent: false, reason: 'no-surface' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const avisos: string[] = []
  on('ui.toast', (_, e) => {
    avisos.push(e.text)
    return { value: undefined }
  })
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pomodoro', args: '1', ...cmd })
  ahora += 70_000
  expect(avisos.some(a => a.includes('Pomodoro terminado'))).toBe(false)

  const estado = await $.command.run({ command: 'pomodoro', args: 'estado', ...cmd })
  expect(avisos.some(a => a.includes('Pomodoro terminado'))).toBe(true)
  expect(estado.text).toContain('descanso')
})

test('tareas: por defecto el cuaderno activo; /pomodoro 1 Química la fija y cuenta su tiempo', async ($, on) => {
  const clock = motor(on)
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await $.command.run({ command: 'pomodoro', args: '1', ...cmd })).text).toBe('🍅 01:00 · enfoque 1/4 · General')
  await clock.advance(61_000)
  expect((await $.command.run({ command: 'pomodoro', args: 'parar', ...cmd })).text).toContain('parado')

  expect((await $.command.run({ command: 'pomodoro', args: '1 Química Orgánica', ...cmd })).text).toBe('🍅 01:00 · enfoque 2/4 · Química Orgánica')
  await clock.advance(61_000)

  const stats = await $.command.run({ command: 'estudio', args: 'stats', ...cmd })
  expect(stats.text).toContain('Por tema (7 días): General 1 min · Química Orgánica 1 min')

  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-stats' })
  expect(await ui.find({ type: 'Text', text: /Tiempo por tema/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Química Org…/ })).toBeDefined()
  await ui.unmount()
})

test('tareas: cambiarla desde el panel y elegir una reciente', async ($, on) => {
  motor(on)
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await $.command.run({ command: 'pomodoro', args: 'tarea Inglés', ...cmd })).text).toBe('📌 Tarea: Inglés')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANEL, surface })
    // en escritorio ya vale TFG: la cambió la vuelta de la terminal
    expect(await ui.find({ type: 'Text', text: surface === 'terminal' ? /^📌 Inglés$/ : /^📌 TFG$/ })).toBeDefined()
    await ui.press({ key: 'cambiar-tarea' })
    if (surface === 'terminal') {
      await ui.input({ key: 'tarea', text: 'TFG' })
      expect(await ui.find({ type: 'Text', text: /^📌 TFG$/ })).toBeDefined()
    } else {
      // la reciente anterior aparece como atajo
      await ui.press({ key: 'tarea-1' })
      expect(await ui.find({ type: 'Text', text: /^📌 Inglés$/ })).toBeDefined()
    }
    await ui.unmount()
  }
  expect((await $.command.run({ command: 'pomodoro', args: 'tarea', ...cmd })).text).toContain('Tarea actual: Inglés')
})
