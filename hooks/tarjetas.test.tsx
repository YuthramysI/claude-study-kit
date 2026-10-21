import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { ordenResumir } from './acciones'
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
      expect(await ui.find({ type: 'Text', text: /^2 para hoy/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /ATP/ })).toBeDefined()
      await ui.press({ key: 'mostrar' })
      expect(await ui.find({ type: 'Text', text: /mitocondria/ })).toBeDefined()
      await ui.press({ key: 'nota-bien' })
      expect(await ui.find({ type: 'Text', text: /^1 para hoy/ })).toBeDefined()
    } else {
      expect(await ui.find({ type: 'Text', text: /^1 para hoy/ })).toBeDefined()
    }
    await ui.unmount()
  }

  const guardadas = JSON.parse(archivos.get('/home/prueba/estudio/biología/tarjetas.json') ?? '[]') as { frente: string; vence: string }[]
  expect(guardadas.find(t => t.frente.includes('ATP'))?.vence).toBe('2026-10-24')
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
  expect(resumen.text).toContain('2 tarjetas · 2 para hoy')
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
    await ui.press({ key: 'vista-repaso' })
    expect(await ui.find({ type: 'Text', text: /Pronóstico · próximos 30 días/ })).toBeDefined()
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /1 aprendiendo/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Bien 1/ })).toBeDefined()
    } else {
      expect(await ui.find({ type: 'Text', text: /Etapas · historia/ })).toBeDefined()
      expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('Repasos previstos')
    }
    await ui.press({ key: 'vista-habitos' })
    expect(await ui.find({ type: 'Text', text: /¿Cuándo estudias\?/ })).toBeDefined()
    await ui.press({ key: 'vista-general' })
    await ui.unmount()
  }
})

test('releer un tarjetas.json dañado sin copia válida no crea copias nuevas cada vez', async ($, on) => {
  const { archivos } = motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'arte', ...CMD })
  const ruta = '/home/prueba/estudio/arte'
  archivos.set(`${ruta}/tarjetas.json`, '{roto')
  for (let i = 0; i < 3; i++) await $.command.run({ command: 'cuaderno', args: 'arte', ...CMD })
  expect([...archivos.keys()].filter(k => k.includes('tarjetas.danado-')).length).toBe(1)
})

const PANEL = {
  plugin: 'estudio', component: 'Pane', requestId: 'estudio',
  props: { title: 'Estudio', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

async function cuadernoConTarjetas($: Engine, tarjetas: { frente: string; reverso: string }[]) {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'repaso', ...CMD })
  await $.tool.call({ tool: 'mcp__estudio__guardar_tarjetas', tarjetas })
}

const leerTarjetas = (archivos: Map<string, string>) =>
  JSON.parse(archivos.get('/home/prueba/estudio/repaso/tarjetas.json') ?? '[]') as { frente: string; reverso: string; vence: string; ultimo: number }[]

test('deshacer devuelve la tarjeta a como estaba y descuenta el repaso', async ($, on) => {
  const { archivos } = motor(on)
  await cuadernoConTarjetas($, [{ frente: '¿Capital de Perú?', reverso: 'Lima' }])
  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-repaso' })
  await ui.press({ key: 'mostrar' })
  await ui.press({ key: 'nota-bien' })
  expect(leerTarjetas(archivos)[0]?.vence).toBe('2026-10-24')
  expect(await ui.find({ type: 'Text', text: /Nada pendiente/ })).toBeDefined()

  await ui.press({ key: 'deshacer' })
  expect(leerTarjetas(archivos)[0]?.ultimo).toBe(0)
  expect(await ui.find({ type: 'Text', text: /Capital de Perú/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /0 repasadas/ })).toBeDefined()
  expect(await ui.find({ key: 'deshacer' })).toBeUndefined()
  await ui.unmount()
})

test('editar y borrar la tarjeta actual desde el panel', async ($, on) => {
  const { archivos } = motor(on)
  await cuadernoConTarjetas($, [{ frente: '¿Capitl de Chile?', reverso: 'Santiago' }, { frente: '¿Capital de Cuba?', reverso: 'La Habana' }])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANEL, surface })
    await ui.press({ key: 'tab-repaso' })
    if (surface === 'terminal') {
      await ui.press({ key: 'editar' })
      await ui.input({ key: 'editar-frente', text: '¿Capital de Chile?' })
      await ui.press({ key: 'editar-listo' })
      expect(leerTarjetas(archivos)[0]?.frente).toBe('¿Capital de Chile?')
      expect(await ui.find({ type: 'Text', text: /^¿Capital de Chile\?$/ })).toBeDefined()
    } else {
      await ui.press({ key: 'borrar' })
      expect(await ui.find({ type: 'Text', text: /¿Borrar esta tarjeta\?/ })).toBeDefined()
      await ui.press({ key: 'borrar-si' })
      expect(leerTarjetas(archivos).map(t => t.frente)).toEqual(['¿Capital de Cuba?'])
    }
    await ui.unmount()
  }
})

test('modo escribir: Claude corrige la respuesta y resalta la nota sugerida', async ($, on) => {
  motor(on)
  const pedidos: string[] = []
  on('model.complete', (_, e) => {
    pedidos.push(e.prompt)
    return {
      value: {
        isAnswered: true,
        text: 'Aquí va: {"nota": "difícil", "comentario": "Falta decir que es por la membrana."}',
        usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
    }
  })
  await cuadernoConTarjetas($, [{ frente: '¿Qué es la ósmosis?', reverso: 'Paso de agua por una membrana semipermeable' }])
  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-repaso' })
  await ui.press({ key: 'modo-escribir' })
  await ui.input({ key: 'respuesta', text: 'El agua se mueve' })
  expect(pedidos[0]).toContain('Respuesta del estudiante: El agua se mueve')
  expect(await ui.find({ type: 'Text', text: /Falta decir que es por la membrana/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Paso de agua por una membrana/ })).toBeDefined()
  expect((await ui.find({ key: 'nota-dificil' }))?.props.variant).toBe('primary')
  expect((await ui.find({ key: 'nota-bien' }))?.props.variant).toBe('secondary')
  await ui.unmount()
})

test('modo escribir sin modelo: compara las palabras clave', async ($, on) => {
  motor(on)
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }))
  await cuadernoConTarjetas($, [{ frente: '¿Qué hace la mitocondria?', reverso: 'Produce energía celular' }])
  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-repaso' })
  await ui.press({ key: 'modo-escribir' })
  await ui.input({ key: 'respuesta', text: 'produce la energia de la celular' })
  expect(await ui.find({ type: 'Text', text: /Coinciden 3 de 3 palabras clave/ })).toBeDefined()
  expect((await ui.find({ key: 'nota-facil' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('límite diario: con 1 nueva por día, la segunda espera a mañana', { options: { nuevasPorDia: 1 } }, async ($, on) => {
  motor(on)
  await cuadernoConTarjetas($, [{ frente: 'Uno', reverso: '1' }, { frente: 'Dos', reverso: '2' }])
  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-repaso' })
  expect(await ui.find({ type: 'Text', text: /1 nuevas en espera/ })).toBeDefined()
  await ui.press({ key: 'mostrar' })
  await ui.press({ key: 'nota-bien' })
  expect(await ui.find({ type: 'Text', text: /Nada pendiente/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1 nuevas esperan a mañana/ })).toBeDefined()
  await ui.unmount()
})

test('fuentes nuevas: aviso a los 30 s, aviso en el panel y «Resumir» lanza la skill', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  const archivos = disco(on)
  const avisos: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    avisos.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'geo', ...CMD })
  const ruta = '/home/prueba/estudio/geo'

  archivos.set(`${ruta}/fuentes/rios.pdf`, '%PDF')
  archivos.set(`${ruta}/fuentes/montes.md`, '# Montes')
  await clock.advance(31_000)
  expect(avisos.some(a => a.includes('2 fuentes nuevas en «geo»'))).toBe(true)

  const info = await $.tool.call({ tool: 'mcp__estudio__cuaderno_activo' })
  expect(String(info.result)).toContain(`${ruta}/fuentes/rios.pdf`)
  expect(String(info.result)).toContain('fuentesNuevas')

  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-cuaderno' })
  expect(await ui.find({ type: 'Text', text: /2 fuentes nuevas/ })).toBeDefined()
  // «Resumir» envía esta orden; en el kit de pruebas un prompt espera a que la sesión quede libre, así que aquí se ignora
  expect(ordenResumir(['montes.md', 'rios.pdf'])).toBe('/estudio:resumir montes.md | rios.pdf')
  expect(await ui.find({ key: 'resumir-nuevas' })).toBeDefined()
  await ui.press({ key: 'ignorar-nuevas' })
  expect(await ui.find({ key: 'ignorar-nuevas' })).toBeUndefined()

  // otra más: avisa solo de la nueva, no repite las anteriores
  archivos.set(`${ruta}/fuentes/costas.txt`, 'costas')
  await clock.advance(31_000)
  expect(avisos.filter(a => a.includes('fuentes nuevas') || a.includes('Fuente nueva'))).toEqual([
    avisos.find(a => a.includes('2 fuentes nuevas')) ?? '',
    avisos.find(a => a.includes('Fuente nueva en «geo»: costas.txt')) ?? '',
  ])
  expect(await ui.find({ type: 'Text', text: /Una fuente nueva/ })).toBeDefined()
  await ui.unmount()
})

test('un cuaderno de antes de esta función no avisa de lo que ya tenía; la herramienta marca las resumidas', async ($, on) => {
  const { archivos, avisos } = motor(on)
  const ruta = '/home/prueba/estudio/viejo'
  archivos.set(`${ruta}/tarjetas.json`, '[]')
  archivos.set(`${ruta}/fuentes/a.md`, 'a')
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'viejo', ...CMD })
  expect(String((await $.tool.call({ tool: 'mcp__estudio__cuaderno_activo' })).result)).not.toContain('fuentesNuevas')

  archivos.set(`${ruta}/fuentes/b.md`, 'b')
  archivos.set(`${ruta}/fuentes/c.md`, 'c')
  expect(String((await $.tool.call({ tool: 'mcp__estudio__cuaderno_activo' })).result)).toContain('fuentesNuevas')
  const r = await $.tool.call({ tool: 'mcp__estudio__marcar_fuentes_resumidas', archivos: [`${ruta}/fuentes/b.md`] })
  expect(String(r.result)).toBe('Marcadas como vistas: b.md.')
  const despues = String((await $.tool.call({ tool: 'mcp__estudio__cuaderno_activo' })).result)
  expect(despues).toContain(`${ruta}/fuentes/c.md"`)
  expect(despues.split('fuentesNuevas')[1] ?? '').not.toContain('b.md')
  void avisos
})

test('la pestaña Mapa dibuja los mapas de salidas/ (árbol en la terminal, SVG en escritorio)', async ($, on) => {
  const { archivos } = motor(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'bio', ...CMD })
  const ui0 = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui0.press({ key: 'tab-mapa' })
  expect(await ui0.find({ type: 'Text', text: /Aún no hay mapas mentales/ })).toBeDefined()
  expect(await ui0.find({ key: 'nuevo-mapa' })).toBeDefined()
  await ui0.unmount()

  const salidas = '/home/prueba/estudio/bio/salidas'
  archivos.set(`${salidas}/mapa-celula.md`, '# Mapa mental: La célula\n- Tipos\n  - Procariota\n- Orgánulos')
  archivos.set(`${salidas}/mapa-agua.md`, '# Mapa mental: El agua\n- Estados')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANEL, surface })
    await ui.press({ key: 'tab-mapa' })
    if (surface === 'terminal') {
      const primero = await ui.find({ type: 'Text', text: /^🧠 / })
      expect(primero).toBeDefined()
      await ui.press({ key: 'mapa-1' })
      expect(await ui.find({ type: 'Text', text: /^🧠 / })).not.toEqual(primero)
    } else {
      const svg = await ui.find({ type: 'Svg' })
      expect(String(svg?.props.alt)).toContain('🧠')
      expect(String(svg?.props.source)).toContain('<svg')
    }
    await ui.unmount()
  }
})

test('/estudio resumen: resume la sesión, pide consejo al coach y escribe el diario', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  const archivos = disco(on)
  const pedidos: string[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('model.complete', (_, e) => {
    pedidos.push(e.prompt)
    return { value: { isAnswered: true, text: '- Buen ritmo: 1 pomodoro.\n- Mañana repasa a las 10 h.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'bio', ...CMD })
  await $.command.run({ command: 'pomodoro', args: '1 Células', ...CMD })
  await clock.advance(61_000)
  await $.tool.call({ tool: 'mcp__estudio__guardar_tarjetas', tarjetas: [{ frente: '¿ADN?', reverso: 'Ácido desoxirribonucleico' }] })

  const r = await $.command.run({ command: 'estudio', args: 'resumen', ...CMD })
  expect(r.text).toContain('📝 Sesión de 10:00 a 10:01')
  expect(r.text).toContain('🍅 1 pomodoros · 1 min de enfoque: Células 1 min')
  expect(r.text).toContain('1 creadas')
  expect(r.text).toContain('🤖 Coach:\n- Buen ritmo: 1 pomodoro.')
  expect(JSON.parse(pedidos[0] ?? '{}').temas7dias).toEqual([{ tema: 'Células', minutos: 1 }])
  const diario = archivos.get('/home/prueba/estudio/diario/2026-10-20.md') ?? ''
  expect(diario).toContain('## Sesiones')
  expect(diario).toContain('Mañana repasa a las 10 h.')

  const datos = JSON.parse(String((await $.tool.call({ tool: 'mcp__estudio__resumen_estudio' })).result)) as { racha: number; sesionActual: string }
  expect(datos.racha).toBe(1)
  expect(datos.sesionActual).toContain('1 🍅')

  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-stats' })
  await ui.press({ key: 'vista-habitos' })
  expect(await ui.find({ type: 'Text', text: /Sesiones recientes/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /10:00–10:01/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Tus mejores horas/ })).toBeDefined()
  await ui.unmount()
})

test('/examen fija el plan, sube el límite de nuevas y el panel muestra la cuenta atrás', { options: { nuevasPorDia: 1 } }, async ($, on) => {
  const { archivos } = motor(on)
  await cuadernoConTarjetas($, Array.from({ length: 9 }, (_, i) => ({ frente: `P${i}`, reverso: `R${i}` })))
  expect((await $.command.run({ command: 'examen', args: '', ...CMD })).text).toContain('Sin plan de examen')
  expect((await $.command.run({ command: 'examen', args: 'cuando sea', ...CMD })).text).toContain('No entiendo «cuando sea»')

  const r = await $.command.run({ command: 'examen', args: '15 de noviembre Final de Química', ...CMD })
  expect(r.text).toContain('🎯 Final de Química: 15 de noviembre de 2026 (en 26 días)')
  expect(JSON.parse(archivos.get('/home/prueba/estudio/repaso/plan.json') ?? '{}')).toEqual({ examen: '2026-11-15', titulo: 'Final de Química' })
  expect((await $.command.run({ command: 'examen', args: 'meta 6', ...CMD })).text).toContain('hoy 0/6 pomodoros')

  // 9 nuevas en 24 días útiles: 1/día, ya cubierto por el límite; con el examen en 3 días, sube a 9
  await $.command.run({ command: 'examen', args: 'en 3 días', ...CMD })
  const anki = await $.command.run({ command: 'anki', args: '', ...CMD })
  expect(anki.text).toContain('9 tarjetas · 9 para hoy')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANEL, surface })
    await ui.press({ key: 'tab-cuaderno' })
    expect(await ui.find({ type: 'Text', text: /🎯 Final de Química · en 3 días/ })).toBeDefined()
    if (surface === 'desktop') expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('previsión')
    await ui.press({ key: 'tab-pomodoro' })
    expect(await ui.find({ type: 'Text', text: /🎯 Final de Química en 3 días/ })).toBeDefined()
    await ui.unmount()
  }
  expect((await $.command.run({ command: 'examen', args: 'borrar', ...CMD })).text).toContain('quitado')
})

test('simulacro: cronómetro en la barra (junto al pomodoro), aviso al acabar, nota y evolución', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { HOME: '/home/prueba' })
  disco(on)
  const avisos: string[] = []
  const estados: (string | undefined)[] = []
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', (_, e) => {
    estados.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    avisos.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'cuaderno', args: 'fisica', ...CMD })
  await $.command.run({ command: 'pomodoro', args: '25 Física', ...CMD })

  const inicio = await $.tool.call({ tool: 'mcp__estudio__examen_cronometro', accion: 'iniciar', minutos: 2, preguntas: 4 })
  expect(String(inicio.result)).toContain('2 min para 4 preguntas')
  await clock.advance(1_000)
  expect(estados.at(-1)).toContain('│  📝 Simulacro 01:59')
  expect(estados.at(-1)).toContain('🍅')
  await clock.advance(121_000)
  expect(avisos.some(a => a.includes('⏰ ¡Tiempo del simulacro!'))).toBe(true)
  expect(String((await $.tool.call({ tool: 'mcp__estudio__examen_cronometro', accion: 'parar' })).result)).toContain('se pasó del tiempo')

  expect(String((await $.tool.call({ tool: 'mcp__estudio__registrar_examen', nota: 6.25, preguntas: 4, titulo: 'Cinemática' })).result))
    .toBe('📝 Nota guardada: 6.3/10. Es tu primer simulacro de este cuaderno. La evolución se ve en 📊 Stats.')
  expect(String((await $.tool.call({ tool: 'mcp__estudio__registrar_examen', nota: 8, preguntas: 4 })).result)).toContain('⬆️ +1.7 respecto al anterior (6.3)')
  expect(avisos.some(a => a.includes('📝 A prueba'))).toBe(true)

  const ui = await $.ui.mount({ ...PANEL, surface: 'terminal' })
  await ui.press({ key: 'tab-stats' })
  expect(await ui.find({ type: 'Text', text: /Exámenes simulados/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^8\.0 \/10/ })).toBeDefined()
  await ui.unmount()
})
