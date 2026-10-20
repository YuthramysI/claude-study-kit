import type { EngineInterface, Register } from 'claude-code'

import type { Pestana } from '../types'
import * as acc from './acciones'
import * as cuadernos from './cuadernos'
import { config, PANEL } from './estado'
import type { Config } from './estado'
import type { Host } from './host'
import { hostOf } from './motor'
import { registrarPanel } from './panel'
import { fecha, pendientes } from './srs'

const PESTANAS: readonly Pestana[] = ['pomodoro', 'repaso', 'cuaderno', 'stats']

const AYUDA = `Comandos de estudio:
  /estudio [pomodoro|repaso|cuaderno|stats|callar]   panel de estudio
  /pomodoro [iniciar [min]|pausar|reanudar|saltar|parar|estado]
  /cuaderno [nombre]                                 crear o elegir cuaderno
  /repasar                                           repasar tarjetas pendientes
  /tarjetas [exportar|importar <archivo>]            resumen, exportar a Anki, importar
Con Claude: /estudio:preguntar · /estudio:tarjetas · /estudio:guia · /estudio:quiz · /estudio:audio`

const VERBOS: Record<string, acc.VerboPomodoro> = {
  iniciar: 'iniciar', empezar: 'iniciar', start: 'iniciar',
  pausar: 'pausar', pausa: 'pausar', pause: 'pausar',
  reanudar: 'reanudar', seguir: 'reanudar', resume: 'reanudar',
  saltar: 'saltar', skip: 'saltar',
  parar: 'parar', detener: 'parar', stop: 'parar',
  alternar: 'alternar',
}

const ARG_POMODORO = '[iniciar [min]|pausar|reanudar|saltar|parar|estado|probar]'

export const register: Register = (on, options) => {
  const cfg = config(options)
  let host: Host | null = null
  let home = ''

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    home = (await $.env.get('HOME')) ?? ''
    const h = hostOf($, home)
    host = h
    await Promise.all([
      $.command.register({ name: 'estudio', description: 'Abre el panel de estudio (Pomodoro, repaso, cuaderno, estadísticas)', argumentHint: '[pomodoro|repaso|cuaderno|stats|callar|ayuda]' }),
      $.command.register({ name: 'pomodoro', description: 'Controla el Pomodoro', argumentHint: ARG_POMODORO, immediate: true }),
      $.command.register({ name: 'promodoro', description: 'Igual que /pomodoro', argumentHint: ARG_POMODORO, immediate: true }),
      $.command.register({ name: 'cuaderno', description: 'Crea o elige el cuaderno de estudio activo', argumentHint: '[nombre]' }),
      $.command.register({ name: 'repasar', description: 'Repasa las tarjetas pendientes de hoy' }),
      $.command.register({ name: 'tarjetas', description: 'Resumen de tarjetas; exportar a Anki o importar desde Anki/CSV', argumentHint: '[exportar|importar <archivo>]' }),
      $.tool.register({
        name: 'cuaderno_activo',
        isDeferred: false,
        description:
          'Devuelve el cuaderno de estudio activo del plugin estudio: su nombre, su carpeta, las rutas absolutas de sus fuentes ' +
          '(PDF, notas...) y la carpeta salidas/ donde guardar guías, quizzes y guiones. Úsala antes de leer las fuentes.',
        inputSchema: { type: 'object', properties: {} },
      }),
      $.tool.register({
        name: 'guardar_tarjetas',
        isDeferred: false,
        description:
          'Guarda tarjetas (flashcards) en el cuaderno activo para repasarlas con repaso espaciado. ' +
          'Cada tarjeta: frente (pregunta concreta), reverso (respuesta breve) y fuente (archivo y página/sección). ' +
          'Omite las que repiten un frente existente.',
        inputSchema: {
          type: 'object',
          properties: {
            tarjetas: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  frente: { type: 'string' },
                  reverso: { type: 'string' },
                  fuente: { type: 'string' },
                },
                required: ['frente', 'reverso'],
              },
            },
          },
          required: ['tarjetas'],
        },
      }),
      $.tool.register({
        name: 'diagnostico_pomodoro',
        description: 'Prueba los avisos del Pomodoro del plugin estudio (sonido, notificación, línea en el chat) y devuelve qué funcionó y el estado del temporizador. Úsala cuando el usuario diga que no le llegan los avisos.',
        inputSchema: { type: 'object', properties: {} },
      }),
      $.tool.register({
        name: 'leer_en_voz_alta',
        isDeferred: false,
        description:
          'Lee un texto en voz alta con el sintetizador de voz del sistema, en segundo plano. ' +
          'Texto plano en español, sin markdown. El usuario lo detiene con /estudio callar.',
        inputSchema: {
          type: 'object',
          properties: { texto: { type: 'string' } },
          required: ['texto'],
        },
      }),
    ])
    const fallo = (que: string) => (err: unknown) => h.log(`estudio: ${que}: ${String(err)}`)
    await acc.cargarStats(h, cfg).catch(fallo('estadísticas'))
    await acc.restaurarPomodoro(h).catch(fallo('pomodoro'))
    await acc.refrescarCuaderno(h, cfg).catch(fallo('cuaderno'))
    if (cfg.recordatorio) h.after(3000, () => void acc.recordatorio(h).catch(fallo('recordatorio')))
    $.clock.every(1000, () => void acc.latido(h, cfg).catch(err => {
      acc.pulso.ultimoError = String(err)
      fallo('latido')(err)
    }))
    return started
  })

  // ── Comandos ──────────────────────────────────────────────────────────────

  on('command.run', { command: 'estudio' }, ($, e) => seguro(() => comandoEstudio($, e.args, cfg, home)))
  on('command.run', { command: 'pomodoro' }, ($, e) => seguro(() => comandoPomodoro($, e.args, cfg, home)))
  // alias para la errata más común
  on('command.run', { command: 'promodoro' }, ($, e) => seguro(() => comandoPomodoro($, e.args, cfg, home)))
  on('command.run', { command: 'cuaderno' }, ($, e) => seguro(() => comandoCuaderno($, e.args, cfg, home)))
  on('command.run', { command: 'repasar' }, $ => seguro(() => comandoRepasar($, cfg, home)))
  on('command.run', { command: 'tarjetas' }, ($, e) => seguro(() => comandoTarjetas($, e.args, home)))

  // ── Herramientas para Claude ─────────────────────────────────────────────

  on('tool.call', { tool: 'mcp__estudio__cuaderno_activo' }, async $ => {
    const h = hostOf($, home)
    const info = await acc.refrescarCuaderno(h, cfg)
    if (info === null) {
      return { result: `No hay cuaderno activo. ${await acc.textoCuadernos(h, cfg)} Pide al usuario que elija o cree uno con /cuaderno <nombre>.` }
    }
    const tarjetas = await h.st.tarjetas.leer()
    return {
      result: JSON.stringify({
        nombre: info.nombre,
        carpeta: info.ruta,
        salidas: `${info.ruta}/salidas`,
        fuentes: info.fuentes.map(f => `${info.ruta}/fuentes/${f}`),
        tarjetas: tarjetas.length,
        ...(info.fuentes.length === 0 ? { aviso: `La carpeta de fuentes está vacía: el usuario debe copiar sus materiales a ${info.ruta}/fuentes/` } : {}),
      }, null, 2),
    }
  }).catch(() => ({ result: 'Error interno del plugin estudio al leer el cuaderno.' }))

  on('tool.call', { tool: 'mcp__estudio__guardar_tarjetas' }, async ($, e) => {
    const h = hostOf($, home)
    const lista: unknown = (e as { tarjetas?: unknown }).tarjetas
    if (!Array.isArray(lista)) return { result: 'Falta `tarjetas`: una lista de { frente, reverso, fuente }.' }
    const nuevas = lista.flatMap((t: unknown) => {
      if (typeof t !== 'object' || t === null) return []
      const { frente, reverso, fuente } = t as Record<string, unknown>
      if (typeof frente !== 'string' || typeof reverso !== 'string') return []
      return [{ frente, reverso, ...(typeof fuente === 'string' ? { fuente } : {}) }]
    })
    try {
      return { result: await acc.agregarTarjetas(h, nuevas) }
    } catch (err) {
      return { result: mensaje(err) }
    }
  }).catch(() => ({ result: 'Error interno del plugin estudio al guardar las tarjetas.' }))

  on('tool.call', { tool: 'mcp__estudio__diagnostico_pomodoro' }, async $ => ({
    result: await acc.probarAvisos(hostOf($, home), cfg),
  })).catch(() => ({ result: 'Error interno del plugin estudio en el diagnóstico.' }))

  on('tool.call', { tool: 'mcp__estudio__leer_en_voz_alta' }, async ($, e) => {
    const texto: unknown = (e as { texto?: unknown }).texto
    if (typeof texto !== 'string' || texto.trim() === '') return { result: 'Falta `texto`.' }
    acc.hablar(host ?? hostOf($, home), texto)
    return { result: `Leyendo en voz alta (${texto.length} caracteres). El usuario puede detenerlo con /estudio callar.` }
  }).catch(() => ({ result: 'Error interno del plugin estudio al leer en voz alta.' }))

  registrarPanel(on, cfg, () => home)
}

const mensaje = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Un comando que falla responde con el error en vez de quedarse mudo. */
async function seguro(fn: () => Promise<{ text: string }>): Promise<{ text: string }> {
  try {
    return await fn()
  } catch (err) {
    return { text: `⚠️ ${mensaje(err)}` }
  }
}

async function comandoEstudio($: EngineInterface, args: string, cfg: Config, home: string) {
  const h = hostOf($, home)
  const arg = args.trim().toLowerCase()
  if (arg === 'callar') {
    await acc.callar(h)
    return { text: 'Voz detenida.' }
  }
  if (arg === 'ayuda' || arg === 'help') return { text: AYUDA }
  const pestana = arg === '' ? undefined : PESTANAS.find(p => p.startsWith(arg))
  if (arg !== '' && pestana === undefined) return { text: `No conozco «${arg}».\n${AYUDA}` }
  const abierto = await abrirPanel(h, cfg, pestana)
  return { text: pestana === 'stats' ? `${abierto}\n${await acc.textoStats(h)}` : abierto }
}

async function comandoPomodoro($: EngineInterface, args: string, cfg: Config, home: string) {
  const h = hostOf($, home)
  const [verbo = 'alternar', mins] = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (verbo === 'estado' || verbo === 'status') {
    return { text: acc.describirPomodoro(await h.st.pomodoro.leer(), await $.clock.now()) }
  }
  if (verbo === 'probar' || verbo === 'test') return { text: await acc.probarAvisos(h, cfg) }
  const soloNumero = /^\d/.test(verbo)
  const minutos = mins !== undefined ? Number(mins.replace(',', '.')) : soloNumero ? Number(verbo.replace(',', '.')) : undefined
  if (minutos !== undefined && !(minutos > 0 && minutos <= 240)) return { text: 'Los minutos van de 1 a 240.' }
  const accion = soloNumero ? 'iniciar' : VERBOS[verbo]
  if (accion === undefined) return { text: `No entiendo «${verbo}». Usa: /pomodoro ${ARG_POMODORO}` }
  return { text: await acc.pomodoro(h, cfg, accion, minutos) }
}

async function comandoCuaderno($: EngineInterface, args: string, cfg: Config, home: string) {
  const h = hostOf($, home)
  const arg = args.trim()
  if (arg === '') return { text: await acc.textoCuadernos(h, cfg) }
  const nombre = cuadernos.nombreValido(arg)
  if (nombre === undefined) return { text: 'Nombre no válido: usa letras, números, espacios, - o _ (máximo 64).' }
  try {
    const info = await acc.abrirCuaderno(h, cfg, nombre)
    if (info === null) return { text: `No pude abrir «${nombre}».` }
    const fuentes = info.fuentes.length === 0
      ? `Copia tus PDFs o apuntes a:\n  ${info.ruta}/fuentes/`
      : `${info.fuentes.length} fuentes: ${info.fuentes.slice(0, 8).join(', ')}${info.fuentes.length > 8 ? '…' : ''}`
    return { text: `Cuaderno activo: «${info.nombre}».\n${fuentes}` }
  } catch (err) {
    return { text: `No pude crear el cuaderno en ${cuadernos.raiz(h, cfg.carpeta)}: ${mensaje(err)}` }
  }
}

async function comandoRepasar($: EngineInterface, cfg: Config, home: string) {
  const h = hostOf($, home)
  await acc.refrescarCuaderno(h, cfg)
  const n = pendientes(await h.st.tarjetas.leer(), fecha(await $.clock.now())).length
  const abierto = await abrirPanel(h, cfg, 'repaso')
  return { text: `${abierto} ${n} tarjetas pendientes hoy. Pulsa m para ver la respuesta y 1-4 para calificar.` }
}

async function comandoTarjetas($: EngineInterface, args: string, home: string) {
  const h = hostOf($, home)
  const [sub = '', ...resto] = args.trim().split(/\s+/)
  switch (sub.toLowerCase()) {
    case '':
    case 'estado':
      return { text: await acc.textoTarjetas(h) }
    case 'exportar':
    case 'export':
      return { text: await acc.exportarAnki(h) }
    case 'importar':
    case 'import': {
      const ruta = resto.join(' ').replace(/^["']|["']$/g, '')
      if (ruta === '') return { text: 'Indica el archivo: /tarjetas importar <archivo.txt|.csv>' }
      return { text: await acc.importarAnki(h, ruta) }
    }
    default:
      return { text: 'Usa: /tarjetas · /tarjetas exportar · /tarjetas importar <archivo>' }
  }
}

async function abrirPanel(h: Host, cfg: Config, pestana?: Pestana): Promise<string> {
  if (pestana !== undefined) await h.st.pestana.cambiar(() => pestana)
  if ((await h.st.cuaderno.leer()) === null) await acc.refrescarCuaderno(h, cfg)
  const r = await h.openPane({ id: PANEL, title: 'Estudio', focus: true })
  return r.isPlaced ? 'Panel de estudio abierto.' : `El panel se abrirá cuando haya sitio (${r.reason}).`
}
