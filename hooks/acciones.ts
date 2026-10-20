// Lo que hacen los comandos, los botones del panel y las herramientas.
import type { DiaStats, Pomodoro, Tarjeta, Veredicto } from '../types'
import * as anki from './anki'
import * as cuadernos from './cuadernos'
import { leerMapa } from './mapa'
import type { Mapa } from './mapa'
import type { Config } from './estado'
import type { Host } from './host'
import * as pdf from './pdf'
import * as pomo from './pomodoro'
import { fecha, fusionar, nuevasEnEspera, pendientes, programar } from './srs'
import type { Nota } from './srs'
import * as stats from './stats'

const CLAVE_STATS = 'estadisticas'
const CLAVE_HISTORIAL_ANTIGUO = 'historialPomodoros'
const CLAVE_POMODORO = 'pomodoro'
const CLAVE_TAREAS = 'tareasRecientes'
const MAX_TAREAS = 6
const TAREA_GENERAL = 'General'

// ── Pomodoro ────────────────────────────────────────────────────────────────

export type VerboPomodoro = 'iniciar' | 'pausar' | 'reanudar' | 'alternar' | 'saltar' | 'parar'

/** Cómo cambia el pomodoro con cada orden, en una función pura. */
function transicion(p: Pomodoro, verbo: VerboPomodoro, ahora: number, cfg: Config, minutos?: number): Pomodoro {
  switch (verbo) {
    case 'iniciar':
      // sin minutos, «iniciar» no reinicia lo que ya corre: reanuda o deja correr
      if (minutos === undefined && p.estado === 'pausado') return pomo.reanudar(p, ahora)
      if (minutos === undefined && p.estado === 'corriendo') return p
      return pomo.iniciar(p, ahora, cfg.duraciones, minutos)
    case 'pausar':
      return pomo.pausar(p, ahora)
    case 'reanudar':
      return pomo.reanudar(p, ahora)
    case 'alternar':
      // sin argumentos nunca pausa: inicia, reanuda o deja correr
      if (p.estado === 'corriendo') return minutos === undefined ? p : pomo.iniciar(p, ahora, cfg.duraciones, minutos)
      if (p.estado === 'pausado') return pomo.reanudar(p, ahora)
      return pomo.iniciar(p, ahora, cfg.duraciones, minutos)
    case 'saltar':
      return pomo.siguiente(p, ahora, cfg.duraciones, cfg.autoIniciar).pomodoro
    case 'parar':
      return pomo.parar(p)
  }
}

export async function pomodoro(h: Host, cfg: Config, verbo: VerboPomodoro, minutos?: number, tarea?: string): Promise<string> {
  if (tarea !== undefined && tarea.trim() !== '') await fijarTarea(h, tarea)
  const ahora = await h.now()
  // sin tarea elegida, el enfoque es del cuaderno activo
  const porDefecto = (await h.st.cuaderno.leer())?.nombre ?? TAREA_GENERAL
  const p = await h.st.pomodoro.cambiar(previo => {
    const siguiente = transicion(previo, verbo, ahora, cfg, minutos)
    return siguiente.tarea === undefined && siguiente.estado !== 'parado' ? { ...siguiente, tarea: porDefecto } : siguiente
  })
  await h.storeSet(CLAVE_POMODORO, p)
  await h.st.ahora.cambiar(() => ahora)
  h.status(pomo.lineaEstado(p, ahora))
  if (verbo === 'saltar') return `Saltado. Ahora: ${pomo.NOMBRE_FASE[p.fase]}${p.estado === 'parado' ? ' (pulsa iniciar)' : ''}.`
  return describirPomodoro(p, ahora)
}

export function describirPomodoro(p: Pomodoro, ahora: number): string {
  if (p.estado === 'parado') return `Pomodoro parado. Siguiente: ${pomo.NOMBRE_FASE[p.fase]}.`
  return pomo.lineaEstado(p, ahora) ?? ''
}

/** Recupera el pomodoro de la sesión anterior, si sigue en marcha o en pausa. */
export async function restaurarPomodoro(h: Host) {
  const ahora = await h.now()
  const p = pomo.restaurar(await h.storeGet(CLAVE_POMODORO), ahora)
  await h.st.pomodoro.cambiar(() => p)
  await h.st.ahora.cambiar(() => ahora)
  h.status(pomo.lineaEstado(p, ahora))
}

/** Lo que el diagnóstico cuenta del temporizador de este módulo. */
const pulso = { latidos: 0, ultimo: 0, fases: 0, ultimoError: '' }

/** Cómo fue el arranque de este módulo (session.start). */
export const arranque = { inicio: 0, fin: 0, latido: 'sin arrancar', errores: [] as string[] }

const SIN_LATIDO_MS = 5000
/** Cada cuántos latidos (segundos) se miran las fuentes del cuaderno activo. */
const REVISAR_FUENTES_CADA = 30

let temporizador: { cancel: () => void } | null = null
/** El Host de session.start: el único que debe sostener el temporizador. */
let hostSesion: Host | null = null

/**
 * Arranca (o rearranca) el latido de un segundo. Con el Host de session.start
 * queda como el de la sesión; cualquier rearranque posterior usa ese.
 */
export function arrancarLatido(h: Host, cfg: Config, origen: 'session.start' | 'respaldo') {
  if (origen === 'session.start') hostSesion = h
  const base = hostSesion ?? h
  temporizador?.cancel()
  temporizador = base.every(1000, () => {
    void latido(base, cfg).catch(err => {
      pulso.ultimoError = String(err)
    })
  })
  arranque.latido = origen === 'session.start' ? 'session.start' : `respaldo, ${pulso.latidos} latidos antes`
}

/**
 * Respaldo del temporizador, llamado desde cada comando y cada turno: si el
 * latido lleva más de 5 s sin llegar, hace uno a mano (así una fase vencida
 * avisa igual) y vuelve a arrancar el temporizador de la sesión.
 */
export async function vigilar(h: Host, cfg: Config) {
  const ahora = await h.now()
  // recién arrancado aún no ha latido: se cuenta desde el arranque
  const referencia = Math.max(pulso.ultimo, arranque.fin, arranque.inicio)
  if (ahora - referencia <= SIN_LATIDO_MS) return
  await latido(h, cfg)
  arrancarLatido(h, cfg, 'respaldo')
}

/** Un latido por segundo: mueve el reloj y cambia de fase al llegar a cero. */
async function latido(h: Host, cfg: Config) {
  const ahora = await h.now()
  pulso.latidos++
  pulso.ultimo = ahora
  if (pulso.latidos % REVISAR_FUENTES_CADA === 0) {
    void revisarFuentes(h, cfg).catch(err => {
      pulso.ultimoError = `fuentes: ${String(err)}`
    })
  }
  const actual = await h.st.pomodoro.leer()
  if (actual.estado !== 'corriendo') return
  if (!pomo.haTerminado(actual, ahora)) {
    await h.st.ahora.cambiar(() => ahora)
    h.status(pomo.lineaEstado(actual, ahora))
    return
  }
  let completo = false
  let cambio = false
  let minutos = 0
  let tareaHecha: string | undefined
  const p = await h.st.pomodoro.cambiar(p => {
    cambio = pomo.haTerminado(p, ahora)
    if (!cambio) return p
    minutos = p.duracionMs / 60_000
    tareaHecha = p.tarea
    const s = pomo.siguiente(p, ahora, cfg.duraciones, cfg.autoIniciar)
    completo = s.completoEnfoque
    return s.pomodoro
  })
  if (!cambio) return
  await h.storeSet(CLAVE_POMODORO, p)
  await h.st.ahora.cambiar(() => ahora)
  h.status(pomo.lineaEstado(p, ahora))
  if (completo) await sumar(h, ahora, { pomodoros: 1, minutos, temas: { [tareaHecha ?? TAREA_GENERAL]: minutos } })
  const aviso = completo
    ? `¡Pomodoro terminado${tareaHecha !== undefined ? ` (${tareaHecha})` : ''}! 🍅 Toca ${pomo.NOMBRE_FASE[p.fase]} de ${Math.round(p.duracionMs / 60_000)} min.`
    : p.estado === 'corriendo'
      ? `¡Fin del descanso! Empieza el siguiente pomodoro (${Math.round(p.duracionMs / 60_000)} min).`
      : '¡Fin del descanso! Cuando quieras, inicia el siguiente pomodoro.'
  pulso.fases++
  avisar(h, cfg, aviso)
}

/** Todas las vías a la vez: alguna llega aunque la superficie no tenga las otras. */
function avisar(h: Host, cfg: Config, aviso: string) {
  h.linea(`🔔 ${aviso}`)
  h.toast(aviso, 8000)
  void h.notify(aviso).catch(() => undefined)
  if (cfg.sonido) campana(h, cfg)
}

/** /pomodoro probar: lanza el aviso de fin de fase y cuenta qué vía funcionó. */
export async function probarAvisos(h: Host, cfg: Config): Promise<string> {
  const ahora = await h.now()
  const p = await h.st.pomodoro.leer()
  h.linea('🔔 Prueba de aviso del Pomodoro')
  h.toast('🔔 Prueba de aviso del Pomodoro', 8000)
  const notif = await h.notify('Prueba de aviso del Pomodoro').then(
    r => (r.isSent ? `enviada (${r.channel})` : `no enviada: ${r.reason}`),
    err => `error: ${String(err)}`,
  )
  const archivo = `${h.pluginRoot}/sounds/campana.wav`
  const sonido = await h.run(['paplay', `--volume=${Math.round((cfg.volumen / 100) * 65536)}`, archivo], { timeoutMs: 10_000 }).then(
    r => (r.exitCode === 0 ? 'sonó (paplay)' : `paplay falló (${r.exitCode}): ${r.stderr.trim().slice(0, 120)}`),
    err => `no se pudo ejecutar paplay: ${String(err)}`,
  )
  const hace = pulso.ultimo === 0 ? 'nunca' : `hace ${Math.max(0, Math.round((ahora - pulso.ultimo) / 1000))} s`
  const arr = arranque.inicio === 0
    ? 'session.start no se ejecutó en este módulo'
    : `session.start ${arranque.fin === 0 ? 'NO terminó' : 'terminó'}; latido: ${arranque.latido}` +
      (arranque.errores.length > 0 ? `; fallos: ${arranque.errores.join(' · ')}` : '; sin fallos')
  return [
    'Diagnóstico de avisos:',
    `  sonido: ${sonido}${cfg.sonido ? '' : ' (la alarma está desactivada en /config)'}`,
    `  notificación del sistema: ${notif}`,
    '  aviso flotante y línea en el chat: enviados (¿ves «🔔 Prueba de aviso» arriba?)',
    `  temporizador: ${pulso.latidos} latidos, último ${hace}; ${pulso.fases} cambios de fase en este módulo${pulso.ultimoError ? `; último error: ${pulso.ultimoError}` : ''}`,
    `  arranque: ${arr}`,
    `  pomodoro: ${describirPomodoro(p, ahora)}`,
  ].join('\n')
}

/** Alarma: la campana varias veces; paplay donde lo hay (Linux), si no el reproductor del motor (macOS). */
function campana(h: Host, cfg: Pick<Config, 'toquesAlarma' | 'volumen'>) {
  const archivo = `${h.pluginRoot}/sounds/campana.wav`
  const volumen = Math.round((cfg.volumen / 100) * 65536)
  const ganancia = cfg.volumen / 100
  const tocar = () =>
    h
      .run(['paplay', `--volume=${volumen}`, archivo], { timeoutMs: 10_000 })
      .then(r => (r.exitCode === 0 ? undefined : h.play('sounds/campana.wav', ganancia)))
      .catch(() => h.play('sounds/campana.wav', ganancia).catch(() => undefined))
  h.after(1, () => {
    void (async () => {
      for (let i = 0; i < cfg.toquesAlarma; i++) await tocar()
    })()
  })
}

/** Fija la tarea del pomodoro (el actual y los siguientes) y la apunta entre las recientes. */
export async function fijarTarea(h: Host, texto: string): Promise<string> {
  const tarea = texto.replace(/\s+/g, ' ').trim().slice(0, 40)
  if (tarea === '') return 'Escribe en qué vas a trabajar.'
  const ahora = await h.now()
  const p = await h.st.pomodoro.cambiar(p => ({ ...p, tarea }))
  await h.storeSet(CLAVE_POMODORO, p)
  const recientes = await h.st.tareas.cambiar(ts => [tarea, ...ts.filter(t => t.toLowerCase() !== tarea.toLowerCase())].slice(0, MAX_TAREAS))
  await h.storeSet(CLAVE_TAREAS, recientes)
  await h.st.editandoTarea.cambiar(() => false)
  h.status(pomo.lineaEstado(p, ahora))
  return `📌 Tarea: ${tarea}`
}

export async function cargarTareas(h: Host) {
  const guardadas = await h.storeGet(CLAVE_TAREAS)
  const tareas = Array.isArray(guardadas) ? guardadas.filter((t): t is string => typeof t === 'string').slice(0, MAX_TAREAS) : []
  await h.st.tareas.cambiar(() => tareas)
}

// ── Estadísticas ────────────────────────────────────────────────────────────

/** Carga las estadísticas del almacén (y convierte el historial de la versión 0.1). */
export async function cargarStats(h: Host, cfg: Config) {
  let s = stats.sanear(await h.storeGet(CLAVE_STATS))
  if (Object.keys(s).length === 0) {
    const antiguo = await h.storeGet(CLAVE_HISTORIAL_ANTIGUO)
    if (antiguo !== undefined) {
      s = stats.migrar(antiguo, cfg.duraciones.enfoque)
      await h.storeSet(CLAVE_STATS, s)
    }
  }
  await h.st.stats.cambiar(() => s)
}

async function sumar(h: Host, ahora: number, cambio: Partial<DiaStats>) {
  const s = await h.st.stats.cambiar(s => stats.registrar(s, fecha(ahora), cambio))
  await h.storeSet(CLAVE_STATS, s)
}

export async function textoStats(h: Host): Promise<string> {
  const s = await h.st.stats.leer()
  const hoy = fecha(await h.now())
  const dia = s[hoy] ?? stats.VACIO
  const semana = stats.totales(s, stats.ultimosDias(s, hoy, 7)[0]?.dia)
  const total = stats.totales(s)
  const ultimos = stats.ultimosDias(s, hoy, 28)
  const racha = stats.racha(s, hoy)
  return [
    `🔥 Racha: ${racha} ${racha === 1 ? 'día' : 'días'} (mejor: ${stats.mejorRacha(s)})`,
    `Hoy: ${dia.pomodoros} 🍅 · ${stats.horas(dia.minutos)} · ${dia.repasos} tarjetas (${stats.porcentaje(dia.aciertos, dia.repasos)} aciertos)`,
    `7 días: ${semana.pomodoros} 🍅 · ${stats.horas(semana.minutos)} · ${semana.repasos} tarjetas`,
    `Total: ${total.pomodoros} 🍅 · ${stats.horas(total.minutos)} · ${total.repasos} tarjetas`,
    `28 días: ${stats.sparkline(ultimos.map(d => d.datos.minutos + d.datos.repasos))}`,
    ...(() => {
      const top = stats.temas(s, stats.ultimosDias(s, hoy, 7)[0]?.dia).slice(0, 5)
      return top.length === 0 ? [] : [`Por tema (7 días): ${top.map(t => `${t.tema} ${stats.horas(t.minutos)}`).join(' · ')}`]
    })(),
  ].join('\n')
}

// ── Cuadernos ───────────────────────────────────────────────────────────────

export async function abrirCuaderno(h: Host, cfg: Config, nombre: string) {
  await cuadernos.crear(h, cuadernos.raiz(h, cfg.carpeta), nombre)
  await cuadernos.fijarActivo(h, nombre)
  return refrescarCuaderno(h, cfg)
}

/** Vuelve a leer el cuaderno activo del disco (fuentes y tarjetas). */
export async function refrescarCuaderno(h: Host, cfg: Config) {
  const nombre = await cuadernos.activo(h)
  const base = cuadernos.raiz(h, cfg.carpeta)
  if (nombre === undefined || !(await h.fs.exists(`${base}/${nombre}`))) {
    await h.st.cuaderno.cambiar(() => null)
    await h.st.tarjetas.cambiar(() => [])
    return null
  }
  const info = await cuadernos.info(h, base, nombre)
  const lectura = await cuadernos.leerTarjetas(h, info.ruta)
  if (lectura.aviso !== undefined) h.toast(lectura.aviso, 15_000)
  await h.st.cuaderno.cambiar(() => info)
  await h.st.tarjetas.cambiar(() => lectura.tarjetas)
  return info
}

export async function textoCuadernos(h: Host, cfg: Config): Promise<string> {
  const base = cuadernos.raiz(h, cfg.carpeta)
  const lista = await cuadernos.listar(h, base)
  const activo = await cuadernos.activo(h)
  if (lista.length === 0) return `Aún no hay cuadernos en ${base}. Crea uno con /cuaderno <nombre>.`
  const filas = lista.map(n => `${n === activo ? '▶' : ' '} ${n}`).join('\n')
  return `Cuadernos en ${base}:\n${filas}\n\nCambia con /cuaderno <nombre>.`
}

const anunciadas = new Set<string>()

/**
 * Cada medio minuto: si aparecieron fuentes nuevas en el cuaderno activo,
 * actualiza el panel y avisa una vez por archivo.
 */
export async function revisarFuentes(h: Host, cfg: Config) {
  const actual = await h.st.cuaderno.leer()
  if (actual === null) return
  const info = await cuadernos.info(h, cuadernos.raiz(h, cfg.carpeta), actual.nombre)
  const igual = info.fuentes.join('\n') === actual.fuentes.join('\n') && info.nuevas.join('\n') === actual.nuevas.join('\n')
  if (!igual) await h.st.cuaderno.cambiar(() => info)
  const porAvisar = info.nuevas.filter(f => !anunciadas.has(`${info.ruta}/${f}`))
  if (porAvisar.length === 0) return
  for (const f of porAvisar) anunciadas.add(`${info.ruta}/${f}`)
  const lista = porAvisar.slice(0, 3).join(', ') + (porAvisar.length > 3 ? '…' : '')
  const aviso = `📥 ${porAvisar.length === 1 ? 'Fuente nueva' : `${porAvisar.length} fuentes nuevas`} en «${info.nombre}»: ${lista}. Resúmelas desde el panel (📚 Cuaderno) o con /estudio:resumir.`
  h.toast(aviso, 12_000)
  h.linea(aviso)
}

/** Da por vistas las fuentes nuevas (todas, o las indicadas) del cuaderno activo. */
export async function marcarFuentesVistas(h: Host, cfg: Config, archivos?: readonly string[]): Promise<string> {
  const info = await cuadernoActivo(h)
  const lista = archivos ?? info.nuevas
  await cuadernos.marcarVistas(h, info.ruta, lista)
  await refrescarCuaderno(h, cfg)
  return lista.length === 0 ? 'No había fuentes nuevas.' : `Marcadas como vistas: ${lista.join(', ')}.`
}

/** La orden que lanza la skill de resumen para estas fuentes. */
export const ordenResumir = (archivos: readonly string[]) => `/estudio:resumir ${archivos.join(' | ')}`

/** Botón «Resumir»: pide a Claude que resuma las nuevas y las da por vistas. */
export async function resumirNuevas(h: Host, cfg: Config) {
  const info = await cuadernoActivo(h)
  if (info.nuevas.length === 0) return
  const lista = info.nuevas
  await cuadernos.marcarVistas(h, info.ruta, lista)
  await refrescarCuaderno(h, cfg)
  await h.submitPrompt(ordenResumir(lista))
}

/** Al abrir sesión: cuántas tarjetas tocan hoy. */
export async function recordatorio(h: Host, cfg: Config) {
  const info = await h.st.cuaderno.leer()
  if (info === null) return
  const n = pendientes(await h.st.tarjetas.leer(), fecha(await h.now()), cfg.nuevasPorDia).length
  if (n > 0) h.toast(`🃏 Tienes ${n} ${n === 1 ? 'tarjeta pendiente' : 'tarjetas pendientes'} en «${info.nombre}» · /repasar`, 10_000)
}

// ── Tarjetas ────────────────────────────────────────────────────────────────

async function cuadernoActivo(h: Host) {
  const info = await h.st.cuaderno.leer()
  if (info === null) throw new Error('No hay cuaderno activo. Crea o elige uno con /cuaderno <nombre>.')
  return info
}

export async function agregarTarjetas(h: Host, nuevas: readonly anki.TarjetaSimple[]): Promise<string> {
  const info = await cuadernoActivo(h)
  const ahora = await h.now()
  const { tarjetas: existentes } = await cuadernos.leerTarjetas(h, info.ruta)
  const r = fusionar(existentes, nuevas, ahora)
  await cuadernos.guardarTarjetas(h, info.ruta, r.tarjetas, ahora)
  await h.st.tarjetas.cambiar(() => r.tarjetas)
  return `Guardadas ${r.agregadas} tarjetas en «${info.nombre}» (${r.tarjetas.length} en total` +
    `${r.repetidas > 0 ? `, ${r.repetidas} repetidas o vacías omitidas` : ''}). Se repasan con /repasar.`
}

export async function calificar(h: Host, cfg: Config, id: string, nota: Nota) {
  const info = await h.st.cuaderno.leer()
  if (info === null) return
  const ahora = await h.now()
  let previa: Tarjeta | undefined
  const tarjetas: Tarjeta[] = await h.st.tarjetas.cambiar(ts =>
    ts.map(t => {
      if (t.id !== id) return t
      previa = t
      return programar(t, nota, ahora, cfg.retencion)
    }),
  )
  if (previa === undefined) return
  const acierto = nota !== 'otra'
  const dia = fecha(ahora)
  await h.st.repaso.cambiar(r => ({ mostrarReverso: false, ...(r.escribir ? { escribir: true } : {}), ...(previa ? { deshacer: { previa, dia, acierto } } : {}) }))
  await sumar(h, ahora, { repasos: 1, aciertos: acierto ? 1 : 0 })
  await cuadernos.guardarTarjetas(h, info.ruta, tarjetas, ahora)
  if (pendientes(tarjetas, dia, cfg.nuevasPorDia).length === 0) h.toast('¡Repaso de hoy completado! 🎉')
}

/** Deshace la última calificación: la tarjeta vuelve a como estaba y el repaso se descuenta. */
export async function deshacer(h: Host): Promise<string> {
  const info = await cuadernoActivo(h)
  const repaso = await h.st.repaso.leer()
  const ultimo = repaso.deshacer
  if (ultimo === undefined) return 'No hay nada que deshacer.'
  const ahora = await h.now()
  const tarjetas = await h.st.tarjetas.cambiar(ts => ts.map(t => (t.id === ultimo.previa.id ? ultimo.previa : t)))
  await h.st.repaso.cambiar(r => ({ mostrarReverso: false, ...(r.escribir ? { escribir: true } : {}) }))
  const s = await h.st.stats.cambiar(s => stats.registrar(s, ultimo.dia, { repasos: -1, aciertos: ultimo.acierto ? -1 : 0 }))
  await h.storeSet(CLAVE_STATS, s)
  await cuadernos.guardarTarjetas(h, info.ruta, tarjetas, ahora)
  return `Deshecho: «${ultimo.previa.frente}» vuelve a la cola.`
}

/** Corrige el frente o el reverso de una tarjeta (su programación no cambia). */
export async function editarTarjeta(h: Host, id: string, cambio: { frente?: string; reverso?: string }): Promise<string> {
  const info = await cuadernoActivo(h)
  const frente = cambio.frente?.trim()
  const reverso = cambio.reverso?.trim()
  if (frente === '' || reverso === '') return 'La pregunta y la respuesta no pueden quedar vacías.'
  const ahora = await h.now()
  const tarjetas = await h.st.tarjetas.cambiar(ts =>
    ts.map(t => (t.id === id ? { ...t, ...(frente !== undefined ? { frente } : {}), ...(reverso !== undefined ? { reverso } : {}) } : t)),
  )
  await cuadernos.guardarTarjetas(h, info.ruta, tarjetas, ahora)
  return 'Tarjeta guardada.'
}

export async function borrarTarjeta(h: Host, id: string): Promise<string> {
  const info = await cuadernoActivo(h)
  const ahora = await h.now()
  let borrada: Tarjeta | undefined
  const tarjetas = await h.st.tarjetas.cambiar(ts =>
    ts.filter(t => {
      if (t.id !== id) return true
      borrada = t
      return false
    }),
  )
  await h.st.repaso.cambiar(r => ({ mostrarReverso: false, ...(r.escribir ? { escribir: true } : {}), ...(r.deshacer && r.deshacer.previa.id !== id ? { deshacer: r.deshacer } : {}) }))
  await cuadernos.guardarTarjetas(h, info.ruta, tarjetas, ahora)
  return borrada === undefined ? 'Esa tarjeta ya no existe.' : `Borrada: «${borrada.frente}» (queda en tarjetas.bak.json por si acaso).`
}

/**
 * Modo escribir: Claude (el modelo pequeño) compara tu respuesta con la
 * correcta y sugiere una nota; sin modelo, una comparación de palabras.
 */
export async function corregirRespuesta(h: Host, tarjeta: Tarjeta, texto: string) {
  const escrita = texto.trim()
  if (escrita === '') return
  await h.st.repaso.cambiar(r => ({ ...r, respuesta: { id: tarjeta.id, texto: escrita, pensando: true } }))
  const veredicto = (await corregirConClaude(h, tarjeta, escrita)) ?? corregirLocal(tarjeta.reverso, escrita)
  await h.st.repaso.cambiar(r =>
    r.respuesta?.id === tarjeta.id ? { ...r, mostrarReverso: true, respuesta: { id: tarjeta.id, texto: escrita, pensando: false, veredicto } } : r,
  )
}

async function corregirConClaude(h: Host, t: Tarjeta, escrita: string): Promise<Veredicto | undefined> {
  const texto = await h.completar({
    maxTokens: 200,
    system:
      'Eres un tutor que corrige tarjetas de estudio. Compara la respuesta del estudiante con la correcta por su significado, ' +
      'no por las palabras exactas. Contesta SOLO con JSON: {"nota":"otra|dificil|bien|facil","comentario":"..."}. ' +
      'otra = incorrecta o vacía; dificil = parcialmente correcta o le falta algo importante; bien = correcta; facil = correcta, completa y precisa. ' +
      'El comentario, en español, en menos de 25 palabras: qué acertó o qué le faltó.',
    prompt: `Pregunta: ${t.frente}
Respuesta correcta: ${t.reverso}
Respuesta del estudiante: ${escrita}`,
  })
  return texto === undefined ? undefined : interpretarVeredicto(texto)
}

const NOTAS_VALIDAS: readonly Nota[] = ['otra', 'dificil', 'bien', 'facil']

/** Lee el JSON del modelo aunque venga con texto alrededor. */
export function interpretarVeredicto(texto: string): Veredicto | undefined {
  const json = /\{[\s\S]*\}/.exec(texto)?.[0]
  if (json === undefined) return undefined
  try {
    const v = JSON.parse(json) as { nota?: unknown; comentario?: unknown }
    const nota = typeof v.nota === 'string' ? v.nota.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''
    if (!(NOTAS_VALIDAS as readonly string[]).includes(nota)) return undefined
    return { nota: nota as Nota, comentario: typeof v.comentario === 'string' ? v.comentario.slice(0, 300) : '', origen: 'claude' }
  } catch {
    return undefined
  }
}

const palabras = (s: string) =>
  new Set(s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9ñ]+/).filter(p => p.length > 2))

/** Sin modelo: cuántas palabras de la respuesta correcta aparecen en la tuya. */
export function corregirLocal(correcta: string, escrita: string): Veredicto {
  const objetivo = palabras(correcta)
  const tuyas = palabras(escrita)
  if (objetivo.size === 0) return { nota: 'bien', comentario: 'Compárala tú con la respuesta.', origen: 'local' }
  const comunes = [...objetivo].filter(p => tuyas.has(p)).length
  const parecido = comunes / objetivo.size
  const nota: Nota = parecido >= 0.9 ? 'facil' : parecido >= 0.6 ? 'bien' : parecido >= 0.3 ? 'dificil' : 'otra'
  return { nota, comentario: `Coinciden ${comunes} de ${objetivo.size} palabras clave.`, origen: 'local' }
}

export async function exportarAnki(h: Host): Promise<string> {
  const info = await cuadernoActivo(h)
  const tarjetas = await h.st.tarjetas.leer()
  if (tarjetas.length === 0) return `«${info.nombre}» aún no tiene tarjetas que exportar.`
  const destino = `${info.ruta}/salidas/anki-${info.nombre.replace(/\s+/g, '-')}.txt`
  await h.fs.write(destino, anki.exportar(tarjetas, info.nombre))
  return `Exportadas ${tarjetas.length} tarjetas a:\n  ${destino}\nEn Anki: Archivo → Importar → elige ese archivo (el mazo se llama «${info.nombre}»).`
}

export async function importarAnki(h: Host, ruta: string): Promise<string> {
  const info = await cuadernoActivo(h)
  const archivo = ruta.startsWith('~/') ? h.home + ruta.slice(1) : ruta.startsWith('/') ? ruta : `${info.ruta}/${ruta}`
  if (!(await h.fs.exists(archivo))) return `No encuentro ${archivo}.`
  const r = anki.importar(await h.fs.read(archivo))
  if (r.tarjetas.length === 0) return `No encontré tarjetas en ${archivo} (se esperan dos columnas: frente y reverso, separadas por tabulador, «;» o «,»).`
  const resumen = await agregarTarjetas(h, r.tarjetas)
  return r.ignoradas > 0 ? `${resumen}\n${r.ignoradas} líneas sin frente o reverso se ignoraron.` : resumen
}

export async function textoTarjetas(h: Host, cfg: Config): Promise<string> {
  const info = await cuadernoActivo(h)
  const tarjetas = await h.st.tarjetas.leer()
  const e = stats.etapas(tarjetas)
  const hoy = fecha(await h.now())
  const n = pendientes(tarjetas, hoy, cfg.nuevasPorDia).length
  const espera = nuevasEnEspera(tarjetas, hoy, cfg.nuevasPorDia)
  return `«${info.nombre}»: ${tarjetas.length} tarjetas · ${n} para hoy${espera > 0 ? ` (+${espera} nuevas esperan turno)` : ''}\n` +
    `  nuevas ${e.nuevas} · aprendiendo ${e.aprendiendo} · maduras ${e.maduras}\n` +
    'Más: /anki exportar · /anki importar <archivo>'
}

// ── Mapas mentales ──────────────────────────────────────────────────────────

/** Los mapas mentales de salidas/ (mapa-*.md), del más reciente al más antiguo. */
export async function leerMapas(h: Host): Promise<{ archivo: string; mapa: Mapa }[]> {
  const info = await h.st.cuaderno.leer()
  if (info === null) return []
  const carpeta = `${info.ruta}/salidas`
  if (!(await h.fs.exists(carpeta))) return []
  const entradas = (await h.fs.list(carpeta))
    .filter(e => e.kind === 'file' && /^mapa.*\.(md|markdown)$/i.test(e.name) && e.size <= LIMITE_DOCUMENTO)
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name))
  const mapas: { archivo: string; mapa: Mapa }[] = []
  for (const e of entradas) {
    const mapa = leerMapa(await h.fs.read(`${carpeta}/${e.name}`))
    if (mapa !== undefined) mapas.push({ archivo: e.name, mapa })
  }
  return mapas
}

// ── PDF de repaso ───────────────────────────────────────────────────────────

/** Navegadores que saben imprimir a PDF sin ventana, en el orden en que se prueban. */
const NAVEGADORES = [
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
]

const LIMITE_DOCUMENTO = 1_000_000

/**
 * Genera salidas/repaso-<cuaderno>-<fecha>.pdf: portada con estadísticas,
 * tarjetas, todo lo de salidas/ (guías, quizzes, guiones) y tarjetas para
 * recortar. Sin navegador, deja el HTML para imprimirlo a mano.
 */
export async function generarPdf(h: Host, cfg: Config, abrir = true): Promise<string> {
  await refrescarCuaderno(h, cfg)
  const info = await cuadernoActivo(h)
  const ahora = await h.now()
  const hoy = fecha(ahora)
  const carpeta = `${info.ruta}/salidas`

  const documentos: { archivo: string; markdown: string }[] = []
  const omitidos: string[] = []
  if (await h.fs.exists(carpeta)) {
    const entradas = (await h.fs.list(carpeta))
      .filter(e => e.kind === 'file' && /\.(md|markdown)$/i.test(e.name) && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entradas) {
      if (e.size > LIMITE_DOCUMENTO) {
        omitidos.push(e.name)
        continue
      }
      documentos.push({ archivo: e.name, markdown: await h.fs.read(`${carpeta}/${e.name}`) })
    }
  }

  const tarjetas = await h.st.tarjetas.leer()
  const html = pdf.documentoRepaso({ cuaderno: info, hoy, tarjetas, stats: await h.st.stats.leer(), documentos, limiteNuevas: cfg.nuevasPorDia })
  const nombre = `repaso-${info.nombre.replace(/\s+/g, '-')}-${hoy}`
  const rutaHtml = `${carpeta}/${nombre}.html`
  const rutaPdf = `${carpeta}/${nombre}.pdf`
  await h.fs.write(rutaHtml, html)

  const contenido = `${tarjetas.length} tarjetas · ${documentos.length} documentos` +
    `${tarjetas.length > 0 ? ` · ${Math.ceil(tarjetas.length / 10) * 2} hojas para recortar` : ''}` +
    `${omitidos.length > 0 ? ` (omitidos por grandes: ${omitidos.join(', ')})` : ''}`

  const perfil = '/tmp/estudio-pdf-navegador'
  const url = `file://${encodeURI(rutaHtml)}`
  const fallos: string[] = []
  for (const nav of NAVEGADORES) {
    const r = await h
      .run([nav, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--user-data-dir=${perfil}`, '--no-pdf-header-footer', '--print-to-pdf-no-header',
        '--virtual-time-budget=3000', `--print-to-pdf=${rutaPdf}`, url], { timeoutMs: 120_000 })
      .catch(() => undefined)
    if (r === undefined) continue // no está instalado
    if (r.exitCode === 0 && (await h.fs.exists(rutaPdf))) {
      if (abrir) abrirArchivo(h, rutaPdf)
      return `📄 PDF de repaso listo: ${rutaPdf}\n${contenido}`
    }
    const error = r.stderr.split('\n').map(l => l.trim()).filter(l => l !== '' && !l.startsWith('Fontconfig')).pop()
    fallos.push(`${nav.split('/').pop() ?? nav} (código ${r.exitCode}${error !== undefined ? `: ${error.slice(0, 160)}` : ''})`)
  }
  if (abrir) abrirArchivo(h, rutaHtml)
  const motivo = fallos.length > 0
    ? `El navegador no pudo crear el PDF: ${fallos.join('; ')}.`
    : 'No encontré Chrome, Chromium, Edge ni Brave para crear el PDF.'
  return `${motivo} Dejé el documento en:\n  ${rutaHtml}\n` +
    `Ábrelo en el navegador y usa Imprimir → Guardar como PDF (con «Gráficos de fondo» activado).\n${contenido}`
}

/** Abre un archivo con la aplicación del sistema, sin esperar. */
function abrirArchivo(h: Host, ruta: string) {
  h.after(1, () => {
    void h.run(['xdg-open', ruta], { timeoutMs: 10_000 })
      .catch(() => h.run(['open', ruta], { timeoutMs: 10_000 }))
      .catch(() => undefined)
  })
}

// ── Voz ─────────────────────────────────────────────────────────────────────

let turnoVoz = 0

/** Trozos de menos de `max` caracteres, cortados en fin de frase. */
export function trozos(texto: string, max = 3500): string[] {
  const salida: string[] = []
  let actual = ''
  for (const frase of texto.replace(/\s+/g, ' ').split(/(?<=[.!?…:;])\s+/)) {
    if ((actual + ' ' + frase).length > max && actual !== '') {
      salida.push(actual)
      actual = ''
    }
    actual = actual === '' ? frase : `${actual} ${frase}`
    while (actual.length > max) {
      salida.push(actual.slice(0, max))
      actual = actual.slice(max)
    }
  }
  if (actual.trim() !== '') salida.push(actual)
  return salida
}

/** Lee en voz alta sin bloquear: spd-say en Linux, o el sintetizador del sistema. */
export function hablar(h: Host, texto: string) {
  const mio = ++turnoVoz
  h.after(1, () => {
    void (async () => {
      for (const t of trozos(texto)) {
        if (mio !== turnoVoz) return
        const r = await h.run(['spd-say', '-w', '-l', 'es', t], { timeoutMs: 600_000 }).catch(() => undefined)
        if (r?.exitCode === 0) continue
        const ok = await h.speak(t).then(() => true, () => false)
        if (!ok) {
          h.toast('No encontré un sintetizador de voz (instala speech-dispatcher o espeak-ng).')
          return
        }
      }
    })()
  })
}

export async function callar(h: Host) {
  turnoVoz++
  await h.run(['spd-say', '-C'], { timeoutMs: 5000 }).catch(() => undefined)
}
