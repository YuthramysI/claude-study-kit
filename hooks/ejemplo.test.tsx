import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { ejemplo } from './ejemplo'
import { fijarIdioma } from './i18n'
import { leerMapa } from './mapa'

const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()
const CMD = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
const PANEL = {
  plugin: 'estudio', component: 'Pane', requestId: 'estudio',
  props: { title: 'Estudio', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const
const RUTA = '/home/test/estudio/demo'

/** Motor con un sistema de archivos en memoria que también lista carpetas. */
function motor(on: On) {
  mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/test' })
  const archivos = new Map<string, string>()
  const hijos = (dir: string) => {
    const vistos = new Map<string, 'file' | 'dir'>()
    for (const k of archivos.keys()) {
      if (!k.startsWith(dir + '/')) continue
      const [primero, ...resto] = k.slice(dir.length + 1).split('/')
      if (primero !== undefined) vistos.set(primero, resto.length > 0 ? 'dir' : 'file')
    }
    return [...vistos].map(([name, kind]) => ({ name, kind, isLink: false, size: (archivos.get(`${dir}/${name}`) ?? '').length, mtimeMs: T0 }))
  }
  on('fs.write', (_, e) => {
    archivos.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: archivos.get(e.path) ?? '' }))
  on('fs.exists', (_, e) => ({ value: archivos.has(e.path) || [...archivos.keys()].some(k => k.startsWith(e.path + '/')) }))
  on('fs.list', (_, e) => ({ value: hijos(e.path) }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return { archivos }
}

test('el contenido del ejemplo es coherente en los dos idiomas', async () => {
  for (const i of ['es', 'en'] as const) {
    fijarIdioma(i)
    try {
      const e = ejemplo()
      expect(Object.keys(e.fuentes)).toHaveLength(2)
      expect(e.tarjetas).toHaveLength(10)
      // cada tarjeta cita una de las fuentes del ejemplo
      for (const t of e.tarjetas) expect(Object.keys(e.fuentes).some(f => t.fuente?.startsWith(f))).toBe(true)
      const mapa = leerMapa(e.mapa)
      expect(mapa?.raiz.hijos.length).toBe(4)
    } finally {
      fijarIdioma('es')
    }
  }
})

test('/cuaderno demo crea fuentes, tarjetas y mapa, y no pisa un cuaderno que ya existe', async ($, on) => {
  const { archivos } = motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await $.command.run({ command: 'cuaderno', args: '', ...CMD })).text).toContain('/cuaderno demo')
  const r = (await $.command.run({ command: 'cuaderno', args: 'demo', ...CMD })).text
  expect(r).toContain('Cuaderno de ejemplo «demo» listo: 2 fuentes')
  expect(r).toContain('10 tarjetas')
  expect(archivos.get(`${RUTA}/fuentes/la-celula.md`)).toContain('# La célula')
  expect(archivos.get(`${RUTA}/salidas/mapa.md`)).toContain('# Mapa mental: La célula')
  expect(JSON.parse(archivos.get(`${RUTA}/tarjetas.json`) ?? '[]')).toHaveLength(10)

  // las tarjetas están listas para repasar y las fuentes no salen como nuevas
  expect((await $.command.run({ command: 'repasar', args: '', ...CMD })).text).toContain('10 tarjetas pendientes hoy')
  const ui = await $.ui.mount({ ...PANEL, surface: 'desktop' })
  await ui.press({ key: 'tab-mapa' })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await ui.unmount()

  // otra vez: solo lo activa, sin tocar lo que haya dentro
  archivos.set(`${RUTA}/tarjetas.json`, '[{"frente":"mía","reverso":"mía"}]\n')
  expect((await $.command.run({ command: 'cuaderno', args: 'ejemplo', ...CMD })).text).toContain('ya existía')
  expect(archivos.get(`${RUTA}/tarjetas.json`)).toBe('[{"frente":"mía","reverso":"mía"}]\n')
})

test('con idioma en, el ejemplo sale en inglés', { options: { idioma: 'en' } }, async ($, on) => {
  const { archivos } = motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await $.command.run({ command: 'cuaderno', args: 'example', ...CMD })).text).toContain('Sample notebook «demo» ready: 2 sources')
  expect(archivos.get(`${RUTA}/fuentes/the-cell.md`)).toContain('# The cell')
  const tarjetas = JSON.parse(archivos.get(`${RUTA}/tarjetas.json`) ?? '[]') as { frente: string }[]
  expect(tarjetas.some(t => t.frente === 'Which organelle makes most of the ATP?')).toBe(true)
})
