import { expect, mock, test } from 'claude-code/testing'
import type { FsEntry, On } from 'claude-code'

const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()

/** Un disco en memoria: archivos por ruta absoluta; las carpetas se deducen. */
function disco(on: On) {
  const archivos = new Map<string, string>()
  const hijos = (dir: string): FsEntry[] => {
    const vistos = new Map<string, FsEntry>()
    for (const ruta of archivos.keys()) {
      if (!ruta.startsWith(dir + '/')) continue
      const [nombre = '', ...resto] = ruta.slice(dir.length + 1).split('/')
      vistos.set(nombre, { name: nombre, kind: resto.length > 0 ? 'dir' : 'file', size: 0, mtimeMs: 0, isLink: false })
    }
    return [...vistos.values()]
  }
  on('fs.write', (_, e) => {
    archivos.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => {
    const texto = archivos.get(e.path)
    if (texto === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: texto }
  })
  on('fs.exists', (_, e) => ({ value: archivos.has(e.path) || hijos(e.path).length > 0 }))
  on('fs.list', (_, e) => ({ value: hijos(e.path) }))
  return archivos
}

test('crear cuaderno, guardar tarjetas con la herramienta y repasarlas en el panel', async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  const archivos = disco(on)
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const creado = await $.command.run({ command: 'cuaderno', args: 'biología', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  expect(creado.text).toContain('Cuaderno activo: «biología»')
  expect(archivos.get('/home/prueba/estudio/biología/tarjetas.json')).toBe('[]\n')

  archivos.set('/home/prueba/estudio/biología/fuentes/celula.md', '# La célula')
  const info = await $.tool.call({ tool: 'mcp__estudio__cuaderno_activo' })
  expect(String(info.result)).toContain('/home/prueba/estudio/biología/fuentes/celula.md')

  const guardado = await $.tool.call({
    tool: 'mcp__estudio__guardar_tarjetas',
    tarjetas: [
      { frente: '¿Qué orgánulo produce ATP?', reverso: 'La mitocondria', fuente: 'celula.md' },
      { frente: '¿Qué contiene el núcleo?', reverso: 'El ADN' },
      { frente: '¿qué orgánulo produce atp', reverso: 'repetida' },
    ],
  })
  expect(String(guardado.result)).toContain('Guardadas 2 tarjetas')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'estudio',
      component: 'Pane',
      requestId: 'estudio',
      surface,
      props: { title: 'Estudio', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })
    await ui.press({ key: 'tab-repaso' })
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /2 pendientes/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /ATP/ })).toBeDefined()
      await ui.press({ key: 'mostrar' })
      expect(await ui.find({ type: 'Text', text: /mitocondria/ })).toBeDefined()
      await ui.press({ key: 'nota-bien' })
      expect(await ui.find({ type: 'Text', text: /1 pendientes/ })).toBeDefined()
    } else {
      expect(await ui.find({ type: 'Text', text: /1 pendientes/ })).toBeDefined()
    }
    await ui.unmount()
  }

  const guardadas = JSON.parse(archivos.get('/home/prueba/estudio/biología/tarjetas.json') ?? '[]') as { frente: string; vence: string }[]
  expect(guardadas.find(t => t.frente.includes('ATP'))?.vence).toBe('2026-10-21')
})

const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

function motor(on: On) {
  mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  const archivos = disco(on)
  const avisos: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    avisos.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return { archivos, avisos }
}

test('un tarjetas.json dañado se recupera de la copia de seguridad', async ($, on) => {
  const { archivos, avisos } = motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'mates', ...CMD })
  await $.tool.call({ tool: 'mcp__estudio__guardar_tarjetas', tarjetas: [{ frente: '¿2+2?', reverso: '4' }] })
  await $.tool.call({ tool: 'mcp__estudio__guardar_tarjetas', tarjetas: [{ frente: '¿3+3?', reverso: '6' }] })
  const ruta = '/home/prueba/estudio/mates'
  expect(JSON.parse(archivos.get(`${ruta}/tarjetas.bak.json`) ?? '[]').length).toBe(1)
  expect(JSON.parse(archivos.get(`${ruta}/.respaldos/tarjetas-mar.json`) ?? '[]').length).toBe(2)

  archivos.set(`${ruta}/tarjetas.json`, '[{"frente": "roto"')
  await $.command.run({ command: 'cuaderno', args: 'mates', ...CMD })
  expect(avisos.some(a => a.includes('estaba dañado'))).toBe(true)
  expect(JSON.parse(archivos.get(`${ruta}/tarjetas.json`) ?? '[]').length).toBeGreaterThan(0)
  expect([...archivos.keys()].some(k => k.includes('tarjetas.danado-'))).toBe(true)
})

test('/anki exportar e importar', async ($, on) => {
  const { archivos } = motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'idiomas', ...CMD })
  const ruta = '/home/prueba/estudio/idiomas'
  archivos.set('/home/prueba/Descargas/mazo.txt', '#separator:tab\nhello\thola\ncat\tgato\n')
  const imp = await $.command.run({ command: 'anki', args: 'importar ~/Descargas/mazo.txt', ...CMD })
  expect(imp.text).toContain('Guardadas 2 tarjetas')
  const exp = await $.command.run({ command: 'anki', args: 'exportar', ...CMD })
  expect(exp.text).toContain('Exportadas 2 tarjetas')
  expect(archivos.get(`${ruta}/salidas/anki-idiomas.txt`)).toContain('hello\thola')
  const resumen = await $.command.run({ command: 'anki', args: '', ...CMD })
  expect(resumen.text).toContain('2 tarjetas · 2 pendientes hoy')
})

test('la pestaña Stats muestra racha y totales, en terminal y escritorio', async ($, on) => {
  motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'historia', ...CMD })
  await $.tool.call({ tool: 'mcp__estudio__guardar_tarjetas', tarjetas: [{ frente: '¿1492?', reverso: 'Colón' }] })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'estudio', component: 'Pane', requestId: 'estudio', surface,
      props: { title: 'Estudio', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    })
    if (surface === 'terminal') {
      await ui.press({ key: 'tab-repaso' })
      await ui.press({ key: 'mostrar' })
      await ui.press({ key: 'nota-bien' })
    }
    await ui.press({ key: 'tab-stats' })
    expect(await ui.find({ type: 'Text', text: /🔥 1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^100 %$/ })).toBeDefined()
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /1 aprendiendo/ })).toBeDefined()
    } else {
      expect(await ui.find({ type: 'Text', text: /Tarjetas de «historia»/ })).toBeDefined()
    }
    await ui.unmount()
  }
})
