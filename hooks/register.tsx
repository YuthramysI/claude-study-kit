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
import { detectarIdioma, fijarIdioma, idioma, L } from './i18n'

const ayuda = () => L(`Comandos de estudio:
  /estudio [pomodoro|repaso|cuaderno|mapa|stats|logros]  panel de estudio
  /estudio pdf                                       PDF de repaso del cuaderno activo
  /estudio resumen                                   resumen de tu sesión y consejo del coach
  /estudio informe [pasada]                          tarjeta PNG de tu semana para compartir
  /pomodoro [iniciar [min] [tarea]|tarea <texto>|pausar|reanudar|saltar|parar|estado]
  /cuaderno [nombre]                                 crear o elegir cuaderno
  /repasar                                           repasar tarjetas pendientes
  /anki [exportar|importar <archivo>]                tarjetas: resumen, exportar a Anki, importar
  /examen [<fecha> [título]|meta <n>|borrar]         plan de examen: cuenta atrás y meta diaria
Con Claude: /estudio:preguntar · /estudio:resumir · /estudio:tarjetas · /estudio:guia · /estudio:mapa · /estudio:quiz · /estudio:simulacro · /estudio:audio`,
`Study commands:
  /estudio [pomodoro|review|notebook|map|stats|achievements]  study pane
  /estudio pdf                                       review PDF of the active notebook
  /estudio summary                                   your session summary and coach tips
  /estudio report [last]                             PNG card of your week to share
  /pomodoro [start [min] [task]|task <text>|pause|resume|skip|stop|status]
  /cuaderno [name]                                   create or pick a notebook
  /repasar                                           review the cards due today
  /anki [export|import <file>]                       cards: summary, export to Anki, import
  /examen [<date> [title]|goal <n>|clear]            exam plan: countdown and daily goal
With Claude: /estudio:preguntar (ask) · /estudio:resumir (summarize) · /estudio:tarjetas (cards) · /estudio:guia (guide) · /estudio:mapa (mind map) · /estudio:quiz · /estudio:simulacro (mock exam) · /estudio:audio`)

/** Nombres de pestaña que entiende /estudio, en los dos idiomas. */
const ALIAS_PESTANA: Record<string, Pestana> = {
  pomodoro: 'pomodoro', repaso: 'repaso', review: 'repaso', cuaderno: 'cuaderno', notebook: 'cuaderno',
  mapa: 'mapa', map: 'mapa', stats: 'stats', estadisticas: 'stats', logros: 'logros', achievements: 'logros',
}

const VERBOS: Record<string, acc.VerboPomodoro> = {
  iniciar: 'iniciar', empezar: 'iniciar', start: 'iniciar',
  pausar: 'pausar', pausa: 'pausar', pause: 'pausar',
  reanudar: 'reanudar', seguir: 'reanudar', resume: 'reanudar',
  saltar: 'saltar', skip: 'saltar',
  parar: 'parar', detener: 'parar', stop: 'parar',
  alternar: 'alternar',
}

const argPomodoro = () => L('[iniciar [min] [tarea]|tarea <texto>|pausar|reanudar|saltar|parar|estado|probar]', '[start [min] [task]|task <text>|pause|resume|skip|stop|status|test]')

export const register: Register = (on, options) => {
  const cfg = config(options)
  let host: Host | null = null
  let home = ''

  // con «es» o «en» fijados en /config el idioma se sabe ya; con «auto», al arrancar
  fijarIdioma(detectarIdioma(cfg.idioma, []))

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    fijarIdioma(detectarIdioma(cfg.idioma, [await $.env.get('LANGUAGE'), await $.env.get('LC_ALL'), await $.env.get('LANG')]))
    // HOME en Linux y macOS; USERPROFILE en Windows
    home = ((await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? '').replace(/\\/g, '/')
    const h = hostOf($, home)
    host = h
    acc.arranque.inicio = await $.clock.now()
    // lo primero: el temporizador, para que nada de lo de abajo pueda impedirlo
    try {
      acc.arrancarLatido(h, cfg, 'session.start')
    } catch (err) {
      acc.arranque.errores.push(`latido: ${mensaje(err)}`)
    }
    // cada registro por separado: si uno es rechazado, los demás siguen y el fallo queda anotado
    const registrar = (nombre: string, registro: Promise<unknown>) =>
      registro.catch(err => {
        acc.arranque.errores.push(`${nombre}: ${mensaje(err)}`)
      })
    await Promise.all([
      registrar('/estudio', $.command.register({ name: 'estudio', description: L('Abre el panel de estudio (Pomodoro, repaso, cuaderno, estadísticas)', 'Open the study pane (Pomodoro, review, notebook, stats)'), argumentHint: L('[pomodoro|repaso|cuaderno|mapa|stats|logros|pdf|resumen|informe|callar|ayuda]', '[pomodoro|review|notebook|map|stats|achievements|pdf|summary|report|mute|help]') })),
      registrar('/pomodoro', $.command.register({ name: 'pomodoro', description: L('Controla el Pomodoro', 'Control the Pomodoro timer'), argumentHint: argPomodoro(), immediate: true })),
      registrar('/promodoro', $.command.register({ name: 'promodoro', description: L('Igual que /pomodoro', 'Same as /pomodoro'), argumentHint: argPomodoro(), immediate: true })),
      registrar('/cuaderno', $.command.register({ name: 'cuaderno', description: L('Crea o elige el cuaderno de estudio activo', 'Create or pick the active study notebook'), argumentHint: L('[nombre]', '[name]') })),
      registrar('/repasar', $.command.register({ name: 'repasar', description: L('Repasa las tarjetas pendientes de hoy', 'Review the cards due today') })),
      registrar('/examen', $.command.register({ name: 'examen', description: L('Plan de examen del cuaderno activo: fecha, meta diaria y previsión', 'Exam plan for the active notebook: date, daily goal and forecast'), argumentHint: L('[<fecha> [título]|meta <n>|borrar]', '[<date> [title]|goal <n>|clear]') })),
      registrar('/anki', $.command.register({ name: 'anki', description: L('Resumen de tarjetas; exportarlas a Anki o importarlas desde Anki/CSV', 'Card summary; export them to Anki or import from Anki/CSV'), argumentHint: L('[exportar|importar <archivo>]', '[export|import <file>]') })),
      registrar('cuaderno_activo', $.tool.register({
        name: 'cuaderno_activo',
        isDeferred: false,
        description:
          'Devuelve el cuaderno de estudio activo del plugin estudio: su nombre, su carpeta, las rutas absolutas de sus fuentes ' +
          '(PDF, notas...) y la carpeta salidas/ donde guardar guías, quizzes y guiones. Úsala antes de leer las fuentes.',
        inputSchema: { type: 'object', properties: {} },
      })),
      registrar('guardar_tarjetas', $.tool.register({
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
      })),
      registrar('marcar_fuentes_resumidas', $.tool.register({
        name: 'marcar_fuentes_resumidas',
        isDeferred: false,
        description:
          'Marca como ya resumidas fuentes del cuaderno activo del plugin estudio, para que dejen de avisarse como nuevas. ' +
          'Llámala al terminar de resumir. Sin `archivos`, marca todas las nuevas. Los nombres son relativos a fuentes/.',
        inputSchema: {
          type: 'object',
          properties: { archivos: { type: 'array', items: { type: 'string' } } },
        },
      })),
      registrar('resumen_estudio', $.tool.register({
        name: 'resumen_estudio',
        isDeferred: false,
        description:
          'Devuelve en JSON cómo va el estudio del usuario según el plugin estudio: hoy, últimos 7 días, racha, tiempo por tema, ' +
          'mejores horas, aciertos, sesión en curso y últimas, tarjetas del cuaderno activo, repasos previstos y exámenes. ' +
          'Úsala cuando pregunte cómo va, cuánto ha estudiado o qué debería repasar.',
        inputSchema: { type: 'object', properties: {} },
      })),
      registrar('examen_cronometro', $.tool.register({
        name: 'examen_cronometro',
        isDeferred: false,
        description:
          'Cronómetro del examen simulado del plugin estudio. accion "iniciar" (con minutos y preguntas) lo pone en la barra de estado ' +
          'y avisa al usuario cuando se acaba el tiempo; "parar" lo detiene y dice cuánto se usó; "estado" dice cuánto queda.',
        inputSchema: {
          type: 'object',
          properties: {
            accion: { type: 'string', enum: ['iniciar', 'parar', 'estado'] },
            minutos: { type: 'number' },
            preguntas: { type: 'number' },
          },
          required: ['accion'],
        },
      })),
      registrar('registrar_examen', $.tool.register({
        name: 'registrar_examen',
        isDeferred: false,
        description:
          'Guarda la nota (0 a 10) de un examen simulado del cuaderno activo del plugin estudio, para su evolución en las estadísticas ' +
          'y los logros; la compara con la anterior. Llámala una vez al terminar de corregir.',
        inputSchema: {
          type: 'object',
          properties: {
            nota: { type: 'number', minimum: 0, maximum: 10 },
            preguntas: { type: 'number' },
            titulo: { type: 'string' },
          },
          required: ['nota', 'preguntas'],
        },
      })),
      registrar('generar_informe_semanal', $.tool.register({
        name: 'generar_informe_semanal',
        isDeferred: false,
        description:
          'Genera y abre la tarjeta PNG (1080×1350) del informe semanal de estudio del plugin estudio: horas, pomodoros, tarjetas, ' +
          'aciertos, racha, nivel, temas y logros. semana "actual" o "pasada". Úsala cuando el usuario quiera su resumen semanal para compartir.',
        inputSchema: { type: 'object', properties: { semana: { type: 'string', enum: ['actual', 'pasada'] } } },
      })),
      registrar('diagnostico_pomodoro', $.tool.register({
        name: 'diagnostico_pomodoro',
        description: 'Prueba los avisos del Pomodoro del plugin estudio (sonido, notificación, línea en el chat) y devuelve qué funcionó y el estado del temporizador. Úsala cuando el usuario diga que no le llegan los avisos.',
        inputSchema: { type: 'object', properties: {} },
      })),
      registrar('generar_pdf_repaso', $.tool.register({
        name: 'generar_pdf_repaso',
        isDeferred: false,
        description:
          'Genera el PDF de repaso del cuaderno activo del plugin estudio (portada con estadísticas, todas las tarjetas, ' +
          'las guías/quizzes/guiones de salidas/ y tarjetas para recortar) y lo abre. Devuelve la ruta. ' +
          'Úsala cuando el usuario pida su repaso, apuntes o tarjetas en PDF o para imprimir.',
        inputSchema: { type: 'object', properties: {} },
      })),
      registrar('leer_en_voz_alta', $.tool.register({
        name: 'leer_en_voz_alta',
        isDeferred: false,
        description:
          'Lee un texto en voz alta con el sintetizador de voz del sistema, en segundo plano. ' +
          'Texto plano en el idioma del usuario (el campo idioma de cuaderno_activo), sin markdown. El usuario lo detiene con /estudio callar.',
        inputSchema: {
          type: 'object',
          properties: { texto: { type: 'string' } },
          required: ['texto'],
        },
      })),
    ])
    const fallo = (que: string) => (err: unknown) => {
      acc.arranque.errores.push(`${que}: ${mensaje(err)}`)
      h.log(`estudio: ${que}: ${String(err)}`)
    }
    await acc.cargarStats(h, cfg).catch(fallo('estadísticas'))
    await acc.cargarTareas(h).catch(fallo('tareas'))
    await acc.cargarSesiones(h).catch(fallo('sesiones'))
    await acc.cargarLogros(h).catch(fallo('logros'))
    await acc.cargarSimulacro(h).catch(fallo('simulacro'))
    await acc.restaurarPomodoro(h).catch(fallo('pomodoro'))
    await acc.refrescarCuaderno(h, cfg).catch(fallo('cuaderno'))
    if (cfg.recordatorio) {
      h.after(3000, () => void acc.recordatorio(h, cfg).catch(fallo('recordatorio')))
      h.after(6000, () => void acc.recordarInforme(h).catch(fallo('informe')))
    }
    acc.arranque.fin = await $.clock.now()
    return started
  })

  // al cerrar Claude Code, el diario del día queda al día
  on('session.end', async ($, e, next) => {
    const h = hostOf($, home)
    await acc.escribirDiario(h, cfg, fecha(await $.clock.now())).catch(() => undefined)
    return next(e)
  })

  // respaldo del temporizador en cada turno
  on('turn.complete', ($, e, next) => {
    void acc.vigilar(hostOf($, home), cfg).catch(() => undefined)
    return next(e)
  })

  // ── Comandos ──────────────────────────────────────────────────────────────

  on('command.run', { command: 'estudio' }, ($, e) => conVigilancia($, cfg, home, () => seguro(() => comandoEstudio($, e.args, cfg, home))))
  on('command.run', { command: 'pomodoro' }, ($, e) => conVigilancia($, cfg, home, () => seguro(() => comandoPomodoro($, e.args, cfg, home))))
  // alias para la errata más común
  on('command.run', { command: 'promodoro' }, ($, e) => conVigilancia($, cfg, home, () => seguro(() => comandoPomodoro($, e.args, cfg, home))))
  on('command.run', { command: 'cuaderno' }, ($, e) => conVigilancia($, cfg, home, () => seguro(() => comandoCuaderno($, e.args, cfg, home))))
  on('command.run', { command: 'repasar' }, $ => conVigilancia($, cfg, home, () => seguro(() => comandoRepasar($, cfg, home))))
  on('command.run', { command: 'examen' }, ($, e) => conVigilancia($, cfg, home, () => seguro(async () => ({ text: await acc.fijarPlanTexto(hostOf($, home), cfg, e.args) }))))
  on('command.run', { command: 'anki' }, ($, e) => conVigilancia($, cfg, home, () => seguro(() => comandoAnki($, e.args, cfg, home))))

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
        // las skills escriben en el idioma de la interfaz
        idioma: idioma() === 'en' ? 'en (English: reply and write every file in English)' : 'es (español)',
        nombre: info.nombre,
        carpeta: info.ruta,
        salidas: `${info.ruta}/salidas`,
        fuentes: info.fuentes.map(f => `${info.ruta}/fuentes/${f}`),
        tarjetas: tarjetas.length,
        ...(info.nuevas.length > 0 ? { fuentesNuevas: info.nuevas.map(f => `${info.ruta}/fuentes/${f}`) } : {}),
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
      return { result: await acc.agregarTarjetas(h, cfg, nuevas) }
    } catch (err) {
      return { result: mensaje(err) }
    }
  }).catch(() => ({ result: 'Error interno del plugin estudio al guardar las tarjetas.' }))

  on('tool.call', { tool: 'mcp__estudio__marcar_fuentes_resumidas' }, async ($, e) => {
    const lista: unknown = (e as { archivos?: unknown }).archivos
    const archivos = Array.isArray(lista)
      ? lista.filter((a): a is string => typeof a === 'string').map(a => a.replace(/^.*\/fuentes\//, ''))
      : undefined
    try {
      return { result: await acc.marcarFuentesVistas(hostOf($, home), cfg, archivos) }
    } catch (err) {
      return { result: mensaje(err) }
    }
  }).catch(() => ({ result: 'Error interno del plugin estudio al marcar las fuentes.' }))

  on('tool.call', { tool: 'mcp__estudio__resumen_estudio' }, async $ => ({
    result: JSON.stringify(await acc.datosEstudio(hostOf($, home), cfg), null, 2),
  })).catch(() => ({ result: 'Error interno del plugin estudio al resumir el estudio.' }))

  on('tool.call', { tool: 'mcp__estudio__examen_cronometro' }, async ($, e) => {
    const { accion, minutos, preguntas } = e as { accion?: unknown; minutos?: unknown; preguntas?: unknown }
    if (accion !== 'iniciar' && accion !== 'parar' && accion !== 'estado') return { result: 'accion debe ser iniciar, parar o estado.' }
    return {
      result: await acc.cronometroSimulacro(hostOf($, home), accion, typeof minutos === 'number' ? minutos : undefined, typeof preguntas === 'number' ? preguntas : undefined),
    }
  }).catch(() => ({ result: 'Error interno del plugin estudio en el cronómetro.' }))

  on('tool.call', { tool: 'mcp__estudio__registrar_examen' }, async ($, e) => {
    const { nota, preguntas, titulo } = e as { nota?: unknown; preguntas?: unknown; titulo?: unknown }
    if (typeof nota !== 'number' || !Number.isFinite(nota)) return { result: 'Falta `nota` (de 0 a 10).' }
    return {
      result: await acc.registrarExamen(hostOf($, home), cfg, nota, typeof preguntas === 'number' ? preguntas : 1, typeof titulo === 'string' ? titulo : undefined),
    }
  }).catch(() => ({ result: 'Error interno del plugin estudio al guardar el examen.' }))

  on('tool.call', { tool: 'mcp__estudio__generar_informe_semanal' }, async ($, e) => ({
    result: await acc.generarInforme(hostOf($, home), cfg, (e as { semana?: unknown }).semana === 'pasada'),
  })).catch(() => ({ result: 'Error interno del plugin estudio al generar el informe.' }))

  on('tool.call', { tool: 'mcp__estudio__diagnostico_pomodoro' }, async $ => ({
    result: await acc.probarAvisos(hostOf($, home), cfg),
  })).catch(() => ({ result: 'Error interno del plugin estudio en el diagnóstico.' }))

  on('tool.call', { tool: 'mcp__estudio__generar_pdf_repaso' }, async $ => {
    try {
      return { result: await acc.generarPdf(hostOf($, home), cfg) }
    } catch (err) {
      return { result: mensaje(err) }
    }
  }).catch(() => ({ result: 'Error interno del plugin estudio al generar el PDF.' }))

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
  if (arg === 'callar' || arg === 'mute') {
    await acc.callar(h)
    return { text: L('Voz detenida.', 'Voice stopped.') }
  }
  if (arg === 'ayuda' || arg === 'help') return { text: ayuda() }
  if (arg === 'pdf') return { text: await acc.generarPdf(h, cfg) }
  if (['resumen', 'sesion', 'sesión', 'summary', 'session'].includes(arg)) return { text: await acc.resumenSesion(h, cfg) }
  const informe = /^(informe|report)(?:\s+(pasada|last))?$/.exec(arg)
  if (informe) return { text: await acc.generarInforme(h, cfg, informe[2] !== undefined) }
  // la pestaña por su nombre en cualquiera de los dos idiomas, o por su comienzo
  const alias = arg === '' ? undefined : Object.keys(ALIAS_PESTANA).find(nombre => nombre.startsWith(arg))
  const pestana = alias === undefined ? undefined : ALIAS_PESTANA[alias]
  if (arg !== '' && pestana === undefined) return { text: `${L(`No conozco «${arg}».`, `Unknown «${arg}».`)}\n${ayuda()}` }
  const abierto = await abrirPanel(h, cfg, pestana)
  return { text: pestana === 'stats' ? `${abierto}\n${await acc.textoStats(h)}` : abierto }
}

async function comandoPomodoro($: EngineInterface, args: string, cfg: Config, home: string) {
  const h = hostOf($, home)
  // la tarea conserva sus mayúsculas: solo el verbo se compara en minúsculas
  const palabras = args.trim().split(/\s+/).filter(Boolean)
  const verbo = (palabras[0] ?? 'alternar').toLowerCase()
  if (verbo === 'estado' || verbo === 'status') {
    return { text: acc.describirPomodoro(await h.st.pomodoro.leer(), await $.clock.now()) }
  }
  if (verbo === 'probar' || verbo === 'test') return { text: await acc.probarAvisos(h, cfg) }
  if (verbo === 'tarea' || verbo === 'task') {
    const tarea = palabras.slice(1).join(' ')
    if (tarea === '') return { text: L(`Tarea actual: ${(await h.st.pomodoro.leer()).tarea ?? 'ninguna'}. Cámbiala con /pomodoro tarea <texto>.`, `Current task: ${(await h.st.pomodoro.leer()).tarea ?? 'none'}. Change it with /pomodoro task <text>.`) }
    return { text: await acc.fijarTarea(h, tarea) }
  }
  const esNumero = (p: string | undefined) => p !== undefined && /^\d+([.,]\d+)?$/.test(p)
  const soloNumero = esNumero(palabras[0])
  const accion = soloNumero ? 'iniciar' : palabras.length === 0 ? 'alternar' : VERBOS[verbo]
  if (accion === undefined) return { text: L(`No entiendo «${palabras[0] ?? ''}». Usa: /pomodoro ${argPomodoro()}`, `I don't understand «${palabras[0] ?? ''}». Use: /pomodoro ${argPomodoro()}`) }
  const conMinutos = soloNumero ? palabras[0] : esNumero(palabras[1]) ? palabras[1] : undefined
  const minutos = conMinutos !== undefined ? Number(conMinutos.replace(',', '.')) : undefined
  if (minutos !== undefined && !(minutos > 0 && minutos <= 240)) return { text: L('Los minutos van de 1 a 240.', 'Minutes go from 1 to 240.') }
  const resto = palabras.slice(soloNumero ? 1 : conMinutos !== undefined ? 2 : 1).join(' ')
  // solo al iniciar se puede nombrar la tarea en la misma orden
  const tarea = accion === 'iniciar' || accion === 'alternar' ? resto : ''
  return { text: await acc.pomodoro(h, cfg, accion, minutos, tarea === '' ? undefined : tarea) }
}

async function comandoCuaderno($: EngineInterface, args: string, cfg: Config, home: string) {
  const h = hostOf($, home)
  const arg = args.trim()
  if (arg === '') return { text: await acc.textoCuadernos(h, cfg) }
  const nombre = cuadernos.nombreValido(arg)
  if (nombre === undefined) return { text: L('Nombre no válido: usa letras, números, espacios, - o _ (máximo 64).', 'Invalid name: use letters, digits, spaces, - or _ (64 max).') }
  try {
    const info = await acc.abrirCuaderno(h, cfg, nombre)
    if (info === null) return { text: L(`No pude abrir «${nombre}».`, `Could not open «${nombre}».`) }
    const fuentes = info.fuentes.length === 0
      ? L(`Copia tus PDFs o apuntes a:\n  ${info.ruta}/fuentes/`, `Copy your PDFs or notes to:\n  ${info.ruta}/fuentes/`)
      : `${info.fuentes.length} ${L('fuentes', 'sources')}: ${info.fuentes.slice(0, 8).join(', ')}${info.fuentes.length > 8 ? '…' : ''}`
    return { text: `${L(`Cuaderno activo: «${info.nombre}».`, `Active notebook: «${info.nombre}».`)}\n${fuentes}` }
  } catch (err) {
    return { text: L(`No pude crear el cuaderno en ${cuadernos.raiz(h, cfg.carpeta)}: ${mensaje(err)}`, `Could not create the notebook in ${cuadernos.raiz(h, cfg.carpeta)}: ${mensaje(err)}`) }
  }
}

async function comandoRepasar($: EngineInterface, cfg: Config, home: string) {
  const h = hostOf($, home)
  await acc.refrescarCuaderno(h, cfg)
  const n = pendientes(await h.st.tarjetas.leer(), fecha(await $.clock.now()), await acc.limiteNuevas(h, cfg)).length
  const abierto = await abrirPanel(h, cfg, 'repaso')
  if (n === 0) return { text: `${abierto} ${L('No tienes tarjetas pendientes hoy. 🎉', 'No cards due today. 🎉')}` }
  return { text: `${abierto} ${L(`${n} ${n === 1 ? 'tarjeta pendiente' : 'tarjetas pendientes'} hoy: pulsa m para ver la respuesta y 1-4 para calificar.`, `${n} ${n === 1 ? 'card' : 'cards'} due today: press m to show the answer and 1-4 to grade.`)}` }
}

async function comandoAnki($: EngineInterface, args: string, cfg: Config, home: string) {
  const h = hostOf($, home)
  const [sub = '', ...resto] = args.trim().split(/\s+/)
  switch (sub.toLowerCase()) {
    case '':
    case 'estado':
      return { text: await acc.textoTarjetas(h, cfg) }
    case 'exportar':
    case 'export':
      return { text: await acc.exportarAnki(h) }
    case 'importar':
    case 'import': {
      const ruta = resto.join(' ').replace(/^["']|["']$/g, '')
      if (ruta === '') return { text: L('Indica el archivo: /anki importar <archivo.txt|.csv>', 'Give the file: /anki import <file.txt|.csv>') }
      return { text: await acc.importarAnki(h, cfg, ruta) }
    }
    default:
      return { text: L('Usa: /anki · /anki exportar · /anki importar <archivo>', 'Use: /anki · /anki export · /anki import <file>') }
  }
}

async function abrirPanel(h: Host, cfg: Config, pestana?: Pestana): Promise<string> {
  if (pestana !== undefined) await h.st.pestana.cambiar(() => pestana)
  if ((await h.st.cuaderno.leer()) === null) await acc.refrescarCuaderno(h, cfg)
  const r = await h.openPane({ id: PANEL, title: 'Estudio', focus: true })
  return r.isPlaced ? L('Panel de estudio abierto.', 'Study pane opened.') : L(`El panel se abrirá cuando haya sitio (${r.reason}).`, `The pane will open when there is room (${r.reason}).`)
}

/** Antes de cada comando: respaldo del temporizador, por si no está latiendo. */
async function conVigilancia<T>($: EngineInterface, cfg: Config, home: string, fn: () => Promise<T>): Promise<T> {
  await acc.vigilar(hostOf($, home), cfg).catch(() => undefined)
  return fn()
}
