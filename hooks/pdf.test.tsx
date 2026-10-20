import { describe, expect, mock, test } from 'claude-code/testing'
import type { FsEntry } from 'claude-code'

import { aHtml, enLinea } from './markdown'
import { documentoRepaso, grupos, recortables, tituloDocumento } from './pdf'
import { nueva } from './srs'

const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()
const tarjeta = (id: string, frente: string, extra: object = {}) => ({ ...nueva({ frente, reverso: `R-${frente}` }, '2026-10-20', id), ...extra })

describe('Markdown', () => {
  test('títulos, listas anidadas, tablas, citas y código', async () => {
    const html = aHtml('# Título\n\nTexto **fuerte** y *suave*.\n\n- uno\n  - dos\n- tres\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> cita\n\n```\nx < y\n```')
    expect(html).toContain('<h1>Título</h1>')
    expect(html).toContain('<strong>fuerte</strong>')
    expect(html).toContain('<em>suave</em>')
    expect(html.replace(/\n/g, '')).toContain('<ul><li>uno<ul><li>dos</li></ul></li><li>tres</li></ul>')
    expect(html).toContain('<th>a</th>')
    expect(html).toContain('<blockquote><p>cita</p></blockquote>')
    expect(html).toContain('<pre><code>x &lt; y</code></pre>')
  })

  test('escapa HTML y solo enlaza http(s)', async () => {
    expect(enLinea('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(enLinea('[ok](https://a.es) [mal](javascript:alert(1))')).toBe('<a href="https://a.es">ok</a> [mal](javascript:alert(1))')
  })
})

describe('documento de repaso', () => {
  test('títulos de los documentos de salidas/', async () => {
    expect(tituloDocumento('guia.md')).toBe('Guía de estudio')
    expect(tituloDocumento('guia-celula-animal.md')).toBe('Guía de estudio · celula animal')
    expect(tituloDocumento('quiz-2026-10-20.md')).toBe('Quiz · 20 de octubre de 2026')
    expect(tituloDocumento('mis-notas.md')).toBe('mis-notas')
    expect(tituloDocumento('quiz-2026-10-20-2.md')).toBe('Quiz · 20 de octubre de 2026 (2)')
  })

  test('agrupa: hoy primero, después aprendiendo y maduras', async () => {
    const ts = [
      tarjeta('a', 'A', { vence: '2026-11-30', intervalo: 40, ultimo: 1 }),
      tarjeta('b', 'B'),
      tarjeta('c', 'C', { vence: '2026-10-25', intervalo: 5, ultimo: 1 }),
    ]
    expect(grupos(ts, '2026-10-20').map(g => [g.titulo, g.tarjetas.map(t => t.id).join('')])).toEqual([
      ['Para repasar hoy', 'b'], ['Aprendiendo', 'c'], ['Maduras', 'a'],
    ])
  })

  test('recortables: el reverso de cada fila va en espejo para imprimir a doble cara', async () => {
    const html = recortables([tarjeta('1', 'P1'), tarjeta('2', 'P2'), tarjeta('3', 'P3')])
    const reverso = html.split('<section class="hoja-corte">')[2] ?? ''
    expect(reverso.indexOf('R-P2')).toBeLessThan(reverso.indexOf('R-P1'))
    expect((html.match(/hoja-corte/g) ?? []).length).toBe(2)
  })

  test('el documento escapa el contenido y lleva todas las secciones', async () => {
    const html = documentoRepaso({
      cuaderno: { nombre: 'bio <x>', ruta: '/r', fuentes: ['tema1.pdf'], nuevas: [] },
      hoy: '2026-10-20',
      tarjetas: [tarjeta('1', '¿<b>ATP</b>?')],
      stats: { '2026-10-20': { pomodoros: 2, minutos: 50, repasos: 4, aciertos: 3 } },
      documentos: [{ archivo: 'guia.md', markdown: '# Guía\n\nHola' }],
    })
    expect(html).toContain('bio &lt;x&gt;')
    expect(html).toContain('¿&lt;b&gt;ATP&lt;/b&gt;?')
    expect(html).not.toContain('<b>ATP</b>')
    for (const parte of ['id="tarjetas"', 'id="doc-0"', 'id="recortar"', '🔥 1 día', '75 %', '<svg']) expect(html).toContain(parte)
  })
})

test('/estudio pdf escribe el HTML, llama al navegador y abre el PDF', async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  const archivos = new Map<string, string>()
  const hijos = (dir: string): FsEntry[] => {
    const vistos = new Map<string, FsEntry>()
    for (const [ruta, texto] of archivos) {
      if (!ruta.startsWith(dir + '/')) continue
      const [nombre = '', ...resto] = ruta.slice(dir.length + 1).split('/')
      vistos.set(nombre, { name: nombre, kind: resto.length > 0 ? 'dir' : 'file', size: texto.length, mtimeMs: 0, isLink: false })
    }
    return [...vistos.values()]
  }
  on('fs.write', (_, e) => {
    archivos.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: archivos.get(e.path) ?? '' }))
  on('fs.exists', (_, e) => ({ value: archivos.has(e.path) || hijos(e.path).length > 0 }))
  on('fs.list', (_, e) => ({ value: hijos(e.path) }))
  const ejecutados: string[][] = []
  on('process.run', (_, e) => {
    ejecutados.push([...e.argv])
    if (e.argv[0] === 'google-chrome') {
      const destino = e.argv.find(a => a.startsWith('--print-to-pdf='))?.slice('--print-to-pdf='.length) ?? ''
      archivos.set(destino, '%PDF-1.4')
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'química orgánica', ...cmd })
  await $.tool.call({ tool: 'mcp__estudio__guardar_tarjetas', tarjetas: [{ frente: '¿Qué es un alcano?', reverso: 'Un hidrocarburo saturado' }] })
  archivos.set('/home/prueba/estudio/química orgánica/salidas/guia.md', '# Guía\n\n- alcanos')

  const r = await $.command.run({ command: 'estudio', args: 'pdf', ...cmd })
  const carpeta = '/home/prueba/estudio/química orgánica/salidas'
  expect(r.text).toContain(`${carpeta}/repaso-química-orgánica-2026-10-20.pdf`)
  expect(r.text).toContain('1 tarjetas · 1 documentos')
  expect(archivos.get(`${carpeta}/repaso-química-orgánica-2026-10-20.html`)).toContain('¿Qué es un alcano?')
  const chrome = ejecutados.find(a => a[0] === 'google-chrome') ?? []
  expect(chrome).toContain('--headless=new')
  expect(chrome.at(-1)).toBe(`file://${encodeURI(`${carpeta}/repaso-química-orgánica-2026-10-20.html`)}`)
})

test('si el navegador falla, el mensaje dice por qué y deja el HTML', async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/h' })
  const archivos = new Map<string, string>()
  on('fs.write', (_, e) => {
    archivos.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: archivos.get(e.path) ?? '' }))
  on('fs.exists', (_, e) => ({ value: archivos.has(e.path) || [...archivos.keys()].some(k => k.startsWith(e.path + '/')) }))
  on('fs.list', () => ({ value: [] }))
  on('process.run', (_, e) => {
    if (e.argv[0] === 'google-chrome') {
      return { value: { exitCode: 1, stdout: '', stderr: 'Fontconfig error: x\nERROR: sandbox roto\n', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    throw new Error('no instalado')
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'física', ...cmd })

  const r = await $.command.run({ command: 'estudio', args: 'pdf', ...cmd })
  expect(r.text).toContain('google-chrome (código 1: ERROR: sandbox roto)')
  expect(r.text).toContain('/h/estudio/física/salidas/repaso-física-2026-10-20.html')
})
