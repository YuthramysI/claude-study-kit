// Lo que hacen los comandos, los botones del panel y las herramientas.
import type { DiaStats, PlanExamen, Pomodoro, Sesion, Simulacro, Tarjeta, Veredicto } from '../types'
import * as anki from './anki'
import * as cuadernos from './cuadernos'
import * as informe from './informe'
import * as lg from './logros'
import { leerMapa } from './mapa'
import type { Mapa } from './mapa'
import type { Config } from './estado'
import type { Host } from './host'
import * as pdf from './pdf'
import * as plan from './plan'
import * as pomo from './pomodoro'
import * as ses from './sesiones'
import { fecha, fechaLarga, fusionar, nuevasEnEspera, pendientes, programar, pronostico, sumarDias } from './srs'
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

/** La línea de estado: el pomodoro y, si hay un simulacro en marcha, su cronómetro. */
async function lineaDeEstado(h: Host, p: Pomodoro, ahora: number): Promise<string | undefined> {
  const sim = await h.st.simulacro.leer()
  const partes = [pomo.lineaEstado(p, ahora), sim !== null ? lineaSimulacro(sim, ahora) : undefined].filter((x): x is string => x !== undefined)
  return partes.length === 0 ? undefined : partes.join('  │  ')
}

/** Un latido por segundo: mueve el reloj y cambia de fase al llegar a cero. */
async function latido(h: Host, cfg: Config) {
  const ahora = await h.now()
  pulso.latidos++
  pulso.ultimo = ahora
  await latidoSimulacro(h, cfg, ahora).catch(err => {
    pulso.ultimoError = `simulacro: ${String(err)}`
  })
  if (pulso.latidos % REVISAR_FUENTES_CADA === 0) {
    void revisarFuentes(h, cfg).catch(err => {
      pulso.ultimoError = `fuentes: ${String(err)}`
    })
  }
  const actual = await h.st.pomodoro.leer()
  if (actual.estado !== 'corriendo') {
    if ((await h.st.simulacro.leer()) !== null) h.status(await lineaDeEstado(h, actual, ahora))
    return
  }
  if (!pomo.haTerminado(actual, ahora)) {
    await h.st.ahora.cambiar(() => ahora)
    h.status(await lineaDeEstado(h, actual, ahora))
    return
  }
  let completo = false
  let cambio = false
  let minutos = 0
  let tareaHecha: string | undefined
  let horas: Record<string, number> = {}
  const p = await h.st.pomodoro.cambiar(p => {
    cambio = pomo.haTerminado(p, ahora)
    if (!cambio) return p
    minutos = p.duracionMs / 60_000
    tareaHecha = p.tarea
    horas = stats.minutosPorHora(p.terminaEn - p.duracionMs, p.terminaEn)
    const s = pomo.siguiente(p, ahora, cfg.duraciones, cfg.autoIniciar)
    completo = s.completoEnfoque
    return s.pomodoro
  })
  if (!cambio) return
  await h.storeSet(CLAVE_POMODORO, p)
  await h.st.ahora.cambiar(() => ahora)
  h.status(await lineaDeEstado(h, p, ahora))
  if (completo) await sumar(h, cfg, ahora, { pomodoros: 1, minutos, temas: { [tareaHecha ?? TAREA_GENERAL]: minutos }, horas })
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

/** Suma actividad al día y a la sesión en curso, y programa el diario. */
async function sumar(h: Host, cfg: Config, ahora: number, cambio: Partial<DiaStats>, dia = fecha(ahora)) {
  const s = await h.st.stats.cambiar(s => stats.registrar(s, dia, cambio))
  await h.storeSet(CLAVE_STATS, s)
  await apuntarSesion(h, cfg, ahora, {
    ...(cambio.pomodoros !== undefined ? { pomodoros: cambio.pomodoros } : {}),
    ...(cambio.minutos !== undefined ? { minutos: cambio.minutos } : {}),
    ...(cambio.repasos !== undefined ? { repasos: cambio.repasos } : {}),
    ...(cambio.aciertos !== undefined ? { aciertos: cambio.aciertos } : {}),
    ...(cambio.temas !== undefined ? { temas: cambio.temas } : {}),
  })
  await comprobarLogros(h).catch(() => undefined)
}

// ── Logros y niveles ────────────────────────────────────────────────────────

const CLAVE_LOGROS = 'logros'
const CLAVE_CONTADORES = 'contadores'

export async function cargarLogros(h: Host) {
  const guardados = await h.storeGet(CLAVE_LOGROS)
  const contadores = await h.storeGet(CLAVE_CONTADORES)
  const limpiar = <T>(v: unknown, ok: (x: unknown) => x is T): Record<string, T> =>
    typeof v === 'object' && v !== null ? Object.fromEntries(Object.entries(v).filter((e): e is [string, T] => ok(e[1]))) : {}
  await h.st.logros.cambiar(() => limpiar(guardados, (x): x is string => typeof x === 'string'))
  await h.st.contadores.cambiar(() => limpiar(contadores, (x): x is number => typeof x === 'number'))
  // la primera vez, los logros que ya cumplías se apuntan sin avisar
  if (guardados === undefined) await comprobarLogros(h, false)
}

/** Sube un contador de los que miran los logros (pdfs, cuadernos) o lo fija como mínimo (mapas). */
export async function contar(h: Host, clave: 'pdfs' | 'cuadernos' | 'mapas', cuanto: { sumar: number } | { minimo: number }) {
  const c = await h.st.contadores.cambiar(c => ({
    ...c, [clave]: 'sumar' in cuanto ? (c[clave] ?? 0) + cuanto.sumar : Math.max(c[clave] ?? 0, cuanto.minimo),
  }))
  await h.storeSet(CLAVE_CONTADORES, c)
  await comprobarLogros(h)
}

export async function datosLogros(h: Host): Promise<lg.DatosLogros> {
  const c = await h.st.contadores.leer()
  return {
    stats: await h.st.stats.leer(),
    maduras: stats.etapas(await h.st.tarjetas.leer()).maduras,
    mapas: c.mapas ?? 0,
    pdfs: c.pdfs ?? 0,
    cuadernos: c.cuadernos ?? 0,
  }
}

/** Apunta los logros recién conseguidos y lo celebra (también al subir de nivel). */
export async function comprobarLogros(h: Host, avisar = true) {
  const datos = await datosLogros(h)
  const resumen = lg.resumir(datos)
  const antes = await h.st.logros.leer()
  const nuevos = lg.nuevos(resumen, antes)
  if (nuevos.length === 0) return
  const dia = fecha(await h.now())
  const nivelAntes = lg.nivel(lg.experiencia(datos.stats, Object.keys(antes).length)).nivel
  const despues = await h.st.logros.cambiar(l => ({ ...l, ...Object.fromEntries(nuevos.map(x => [x.id, dia])) }))
  await h.storeSet(CLAVE_LOGROS, despues)
  if (!avisar) return
  const nivelAhora = lg.nivel(lg.experiencia(datos.stats, Object.keys(despues).length))
  const texto = nuevos.length === 1
    ? `🏆 ¡Logro desbloqueado! ${nuevos[0]?.icono} ${nuevos[0]?.nombre}: ${nuevos[0]?.descripcion}`
    : `🏆 ¡${nuevos.length} logros desbloqueados! ${nuevos.map(x => `${x.icono} ${x.nombre}`).join(' · ')}`
  const nivel = nivelAhora.nivel > nivelAntes ? ` ⬆️ Subes al nivel ${nivelAhora.nivel}: ${nivelAhora.titulo}.` : ''
  h.toast(`${texto}${nivel}`, 10_000)
  h.linea(`${texto}${nivel}`)
}

// ── Sesiones y diario ───────────────────────────────────────────────────────

const CLAVE_SESION = 'sesionActual'
const CLAVE_SESIONES = 'sesiones'
const claveCoach = (dia: string) => `coach:${dia}`

export async function cargarSesiones(h: Host) {
  const actual = ses.sanear(await h.storeGet(CLAVE_SESION))
  const guardadas = await h.storeGet(CLAVE_SESIONES)
  const lista = Array.isArray(guardadas) ? guardadas.map(ses.sanear).filter((s): s is Sesion => s !== null) : []
  await h.st.sesion.cambiar(() => actual)
  await h.st.sesiones.cambiar(() => lista.slice(0, ses.SESIONES_GUARDADAS))
}

async function apuntarSesion(h: Host, cfg: Config, ahora: number, cambio: ses.Cambio) {
  const cuaderno = (await h.st.cuaderno.leer())?.nombre
  let cerrada: Sesion | undefined
  const sesion = await h.st.sesion.cambiar(actual => {
    const r = ses.apuntar(actual, ahora, { ...cambio, ...(cuaderno !== undefined ? { cuaderno } : {}) })
    cerrada = r.cerrada
    return r.sesion
  })
  await h.storeSet(CLAVE_SESION, sesion)
  if (cerrada !== undefined && !ses.vacia(cerrada)) {
    const terminada = cerrada
    const lista = await h.st.sesiones.cambiar(ls => [terminada, ...ls.filter(s => s.id !== terminada.id)].slice(0, ses.SESIONES_GUARDADAS))
    await h.storeSet(CLAVE_SESIONES, lista)
    programarDiario(h, cfg, fecha(terminada.inicio))
  }
  programarDiario(h, cfg, fecha(ahora))
}

const diariosPendientes = new Set<string>()

/** Reescribe el diario del día unos segundos después, una vez aunque haya muchos cambios. */
function programarDiario(h: Host, cfg: Config, dia: string) {
  if (diariosPendientes.has(dia)) return
  diariosPendientes.add(dia)
  const base = hostSesion ?? h
  base.after(5000, () => {
    diariosPendientes.delete(dia)
    void escribirDiario(base, cfg, dia).catch(err => {
      pulso.ultimoError = `diario: ${String(err)}`
    })
  })
}

/** Las sesiones de un día, la en curso incluida, por orden. */
async function sesionesDe(h: Host, dia: string): Promise<Sesion[]> {
  const actual = await h.st.sesion.leer()
  const lista = await h.st.sesiones.leer()
  return [...(actual !== null ? [actual] : []), ...lista.filter(s => s.id !== actual?.id)]
    .filter(s => fecha(s.inicio) === dia && !ses.vacia(s))
    .sort((a, b) => a.inicio - b.inicio)
}

export async function escribirDiario(h: Host, cfg: Config, dia: string): Promise<string> {
  const totales = (await h.st.stats.leer())[dia] ?? stats.VACIO
  const consejo = await h.storeGet(claveCoach(dia))
  const ruta = `${cuadernos.raiz(h, cfg.carpeta)}/diario/${dia}.md`
  await h.fs.write(ruta, ses.diario(dia, totales, await sesionesDe(h, dia), typeof consejo === 'string' ? consejo : undefined))
  return ruta
}

/** Lo que el coach (y la herramienta resumen_estudio) sabe de cómo vas. */
export async function datosEstudio(h: Host, cfg: Config) {
  const ahora = await h.now()
  const hoy = fecha(ahora)
  const s = await h.st.stats.leer()
  const semana = stats.ultimosDias(s, hoy, 7)
  const info = await h.st.cuaderno.leer()
  const tarjetas = await h.st.tarjetas.leer()
  const actual = await h.st.sesion.leer()
  const aciertos = stats.aciertosPorDia(s, hoy, 14).filter((x): x is number => x !== null)
  return {
    hoy: { dia: hoy, ...(s[hoy] ?? stats.VACIO) },
    ultimos7dias: stats.totales(s, semana[0]?.dia),
    racha: stats.racha(s, hoy),
    mejorRacha: stats.mejorRacha(s),
    temas7dias: stats.temas(s, semana[0]?.dia).slice(0, 6),
    mejoresHoras: stats.mejoresHoras(s, hoy).map(x => `${x.hora}-${x.hora + 1} h`),
    aciertosUltimos14dias: aciertos.length === 0 ? null : Math.round(aciertos.reduce((a, b) => a + b, 0) / aciertos.length),
    sesionActual: ses.abierta(actual, ahora) ? ses.linea(actual) : null,
    ultimasSesiones: (await h.st.sesiones.leer()).slice(0, 5).map(x => ses.linea(x, ahora)),
    ...(info !== null
      ? {
        cuaderno: info.nombre,
        tarjetas: { total: tarjetas.length, paraHoy: pendientes(tarjetas, hoy, await limiteNuevas(h, cfg, tarjetas)).length, ...stats.etapas(tarjetas) },
        repasosPrevistos7dias: pronostico(tarjetas, hoy, 7).reduce((a, b) => a + b, 0),
      }
      : {}),
    examenes: stats.examenes(s).slice(-5).map(e => ({ dia: e.dia, nota: e.nota, cuaderno: e.cuaderno })),
    planExamen: await estadoPlan(h),
  }
}

/**
 * /estudio resumen: la sesión en curso (o la última), el día, y un consejo
 * breve del coach (el modelo pequeño) que queda en el diario.
 */
export async function resumenSesion(h: Host, cfg: Config, conCoach = true): Promise<string> {
  const ahora = await h.now()
  const hoy = fecha(ahora)
  const actual = await h.st.sesion.leer()
  const ultima = actual !== null && !ses.vacia(actual) ? actual : (await h.st.sesiones.leer())[0]
  const d = (await h.st.stats.leer())[hoy] ?? stats.VACIO
  const partes = [
    ultima === undefined ? '📝 Aún no hay sesiones de estudio registradas.' : `${ses.resumen(ultima)}${ses.abierta(actual, ahora) ? '  (en curso)' : ''}`,
    `📅 Hoy: ${d.pomodoros} 🍅 · ${stats.horas(d.minutos)} · ${d.repasos} tarjetas (${stats.porcentaje(d.aciertos, d.repasos)})`,
  ]
  if (conCoach) {
    const consejo = await h.completar({
      maxTokens: 260,
      system:
        'Eres un coach de estudio cercano y concreto. Con los datos (JSON) del estudiante, escribe en español 2 o 3 viñetas ' +
        'que empiecen por «- »: una sobre lo que hizo bien, y una o dos acciones concretas para mañana (qué repasar, cuánto, a qué hora). ' +
        'Máximo 70 palabras en total. Usa números de los datos. Nada de saludos ni despedidas.',
      prompt: JSON.stringify(await datosEstudio(h, cfg)),
    })
    if (consejo !== undefined && consejo.trim() !== '') {
      await h.storeSet(claveCoach(hoy), consejo.trim())
      partes.push(`🤖 Coach:\n${consejo.trim()}`)
    }
  }
  const ruta = await escribirDiario(h, cfg, hoy)
  partes.push(`📓 Diario: ${ruta}`)
  return partes.join('\n')
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

// ── Examen simulado ─────────────────────────────────────────────────────────

const CLAVE_SIMULACRO = 'simulacro'

export async function cargarSimulacro(h: Host) {
  const v = await h.storeGet(CLAVE_SIMULACRO)
  const ok = typeof v === 'object' && v !== null && typeof (v as { terminaEn?: unknown }).terminaEn === 'number'
  await h.st.simulacro.cambiar(() => (ok ? (v as Simulacro) : null))
}

/** Herramienta examen_cronometro: iniciar, parar o consultar el cronómetro del simulacro. */
export async function cronometroSimulacro(h: Host, accion: string, minutos?: number, preguntas?: number): Promise<string> {
  const ahora = await h.now()
  const actual = await h.st.simulacro.leer()
  if (accion === 'iniciar') {
    const min = Math.min(240, Math.max(1, Math.round(minutos ?? 20)))
    const s: Simulacro = { inicio: ahora, terminaEn: ahora + min * 60_000, minutos: min, preguntas: Math.max(1, Math.round(preguntas ?? 10)), avisado: false }
    await h.st.simulacro.cambiar(() => s)
    await h.storeSet(CLAVE_SIMULACRO, s)
    h.status(await lineaDeEstado(h, await h.st.pomodoro.leer(), ahora))
    return `Cronómetro iniciado: ${min} min para ${s.preguntas} preguntas. Se ve en la barra de estado.`
  }
  if (actual === null) return 'No hay ningún simulacro en curso.'
  const usados = Math.round((ahora - actual.inicio) / 60_000)
  if (accion === 'parar') {
    await h.st.simulacro.cambiar(() => null)
    await h.storeSet(CLAVE_SIMULACRO, null)
    h.status(pomo.lineaEstado(await h.st.pomodoro.leer(), ahora))
    return `Cronómetro parado: ${usados} de ${actual.minutos} min${ahora > actual.terminaEn ? ' (se pasó del tiempo)' : ''}.`
  }
  return lineaSimulacro(actual, ahora) ?? ''
}

export function lineaSimulacro(s: Simulacro, ahora: number): string | undefined {
  const resta = s.terminaEn - ahora
  return resta > 0 ? `📝 Simulacro ${pomo.reloj(resta)}` : '📝 Simulacro: ¡tiempo!'
}

/** Desde el latido: mueve el cronómetro y avisa una vez al acabar el tiempo. */
async function latidoSimulacro(h: Host, cfg: Config, ahora: number) {
  const s = await h.st.simulacro.leer()
  if (s === null || ahora < s.terminaEn || s.avisado) return
  const marcado = await h.st.simulacro.cambiar(x => (x === null ? x : { ...x, avisado: true }))
  await h.storeSet(CLAVE_SIMULACRO, marcado)
  const aviso = '⏰ ¡Tiempo del simulacro! Termina la pregunta en curso y pide la corrección.'
  h.toast(aviso, 10_000)
  h.linea(aviso)
  if (cfg.sonido) campana(h, cfg)
}

/** Herramienta registrar_examen: guarda la nota del simulacro y la compara con la anterior. */
export async function registrarExamen(h: Host, cfg: Config, nota: number, preguntas: number, titulo?: string): Promise<string> {
  const info = await h.st.cuaderno.leer()
  const ahora = await h.now()
  const valor = Math.round(Math.min(10, Math.max(0, nota)) * 10) / 10
  const anteriores = stats.examenes(await h.st.stats.leer()).filter(e => e.cuaderno === (info?.nombre ?? ''))
  const previa = anteriores[anteriores.length - 1]
  await sumar(h, cfg, ahora, { examenes: [{ nota: valor, preguntas: Math.max(1, Math.round(preguntas)), cuaderno: info?.nombre ?? '', ...(titulo !== undefined && titulo.trim() !== '' ? { titulo: titulo.trim().slice(0, 80) } : {}) }] })
  await h.st.simulacro.cambiar(() => null)
  await h.storeSet(CLAVE_SIMULACRO, null)
  const comparacion = previa === undefined ? 'Es tu primer simulacro de este cuaderno.' : `${valor >= previa.nota ? '⬆️' : '⬇️'} ${valor >= previa.nota ? '+' : ''}${(valor - previa.nota).toFixed(1)} respecto al anterior (${previa.nota.toFixed(1)}).`
  return `📝 Nota guardada: ${valor.toFixed(1)}/10. ${comparacion} La evolución se ve en 📊 Stats.`
}

// ── Plan de examen ──────────────────────────────────────────────────────────

/** El límite de nuevas de hoy: el de /config, o más si el plan de examen lo necesita. */
export async function limiteNuevas(h: Host, cfg: Config, tarjetas?: readonly Tarjeta[]): Promise<number> {
  return plan.limiteHoy(cfg.nuevasPorDia, await h.st.plan.leer(), tarjetas ?? (await h.st.tarjetas.leer()), await h.st.stats.leer(), fecha(await h.now()))
}

export async function estadoPlan(h: Host): Promise<(plan.EstadoPlan & PlanExamen) | null> {
  const p = await h.st.plan.leer()
  if (p === null) return null
  return { ...p, ...plan.estado(p, await h.st.tarjetas.leer(), await h.st.stats.leer(), fecha(await h.now())) }
}

export function textoPlan(e: plan.EstadoPlan & PlanExamen): string {
  const cuando = e.dias === 0 ? '¡hoy!' : e.dias === 1 ? 'mañana' : e.dias < 0 ? `hace ${-e.dias} días` : `en ${e.dias} días`
  return [
    `🎯 ${e.titulo ?? 'Examen'}: ${fechaLarga(e.examen)} (${cuando})`,
    `  📚 vistas ${e.vistas} % · ${e.nuevas} nuevas por empezar${e.nuevasPorDia > 0 ? ` (${e.nuevasPorDia}/día)` : ''}`,
    `  🧠 previsión de recuerdo el día del examen: ${e.prevision} %`,
    `  🍅 hoy ${e.pomodorosHoy}/${e.metaPomodoros} pomodoros`,
    `  ${e.ritmo === 'atrasado' ? '⚠️' : e.ritmo === 'listo' ? '✅' : '👉'} ${e.mensaje}`,
  ].join('\n')
}

/**
 * «15/11 Bioquímica», «en 20 días», «2026-12-01 Final de física», «meta 6»,
 * «borrar»: lo que escribes en /examen o en el panel.
 */
export async function fijarPlanTexto(h: Host, cfg: Config, texto: string): Promise<string> {
  const palabras = texto.trim().split(/\s+/).filter(Boolean)
  const primera = (palabras[0] ?? '').toLowerCase()
  await h.st.editandoPlan.cambiar(() => false)
  if (palabras.length === 0) {
    const e = await estadoPlan(h)
    return e === null ? 'Sin plan de examen. Fíjalo con /examen <fecha> [título]: «/examen 15/11 Bioquímica», «/examen en 20 días».' : textoPlan(e)
  }
  if (['borrar', 'quitar', 'ninguno'].includes(primera)) return fijarPlan(h, cfg, null)
  if (primera === 'meta') {
    const n = Number(palabras[1])
    if (!(n >= 1 && n <= 20)) return 'La meta va de 1 a 20 pomodoros al día: /examen meta 4'
    return fijarPlan(h, cfg, { metaPomodoros: Math.round(n) })
  }
  const hoy = fecha(await h.now())
  // la fecha puede ocupar varias palabras («15 de noviembre»): se busca la más larga que encaje
  for (let n = Math.min(4, palabras.length); n >= 1; n--) {
    const examen = plan.interpretarFecha(palabras.slice(0, n).join(' '), hoy)
    if (examen === undefined) continue
    if (examen < hoy) return `${fechaLarga(examen)} ya pasó.`
    const titulo = palabras.slice(n).join(' ')
    return fijarPlan(h, cfg, { examen, ...(titulo !== '' ? { titulo } : {}) })
  }
  return `No entiendo «${palabras.slice(0, 3).join(' ')}» como fecha. Prueba: 15/11, 2026-11-15, «15 de noviembre» o «en 20 días».`
}

export async function fijarPlan(h: Host, cfg: Config, cambio: { examen?: string; titulo?: string; metaPomodoros?: number } | null): Promise<string> {
  const info = await cuadernoActivo(h)
  if (cambio === null) {
    await cuadernos.guardarPlan(h, info.ruta, null)
    await h.st.plan.cambiar(() => null)
    return `Plan de examen de «${info.nombre}» quitado.`
  }
  const actual = await h.st.plan.leer()
  const examen = cambio.examen ?? actual?.examen
  if (examen === undefined) return 'Indica la fecha: /examen 15/11 [título], /examen en 20 días…'
  const nuevo = plan.sanear({ ...(actual ?? {}), ...cambio, examen })
  if (nuevo === null) return 'No entiendo esa fecha.'
  await cuadernos.guardarPlan(h, info.ruta, nuevo)
  await h.st.plan.cambiar(() => nuevo)
  await refrescarCuaderno(h, cfg)
  const e = await estadoPlan(h)
  return e === null ? 'Plan guardado.' : textoPlan(e)
}

// ── Cuadernos ───────────────────────────────────────────────────────────────

export async function abrirCuaderno(h: Host, cfg: Config, nombre: string) {
  const base = cuadernos.raiz(h, cfg.carpeta)
  const existia = await h.fs.exists(`${base}/${nombre}`)
  await cuadernos.crear(h, base, nombre)
  if (!existia) await contar(h, 'cuadernos', { sumar: 1 }).catch(() => undefined)
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
    await h.st.plan.cambiar(() => null)
    return null
  }
  const info = await cuadernos.info(h, base, nombre)
  const lectura = await cuadernos.leerTarjetas(h, info.ruta)
  if (lectura.aviso !== undefined) h.toast(lectura.aviso, 15_000)
  const planCuaderno = await cuadernos.leerPlan(h, info.ruta)
  await h.st.cuaderno.cambiar(() => info)
  await h.st.tarjetas.cambiar(() => lectura.tarjetas)
  await h.st.plan.cambiar(() => planCuaderno)
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
  const n = pendientes(await h.st.tarjetas.leer(), fecha(await h.now()), await limiteNuevas(h, cfg)).length
  if (n > 0) h.toast(`🃏 Tienes ${n} ${n === 1 ? 'tarjeta pendiente' : 'tarjetas pendientes'} en «${info.nombre}» · /repasar`, 10_000)
}

// ── Tarjetas ────────────────────────────────────────────────────────────────

async function cuadernoActivo(h: Host) {
  const info = await h.st.cuaderno.leer()
  if (info === null) throw new Error('No hay cuaderno activo. Crea o elige uno con /cuaderno <nombre>.')
  return info
}

export async function agregarTarjetas(h: Host, cfg: Config, nuevas: readonly anki.TarjetaSimple[]): Promise<string> {
  const info = await cuadernoActivo(h)
  const ahora = await h.now()
  const { tarjetas: existentes } = await cuadernos.leerTarjetas(h, info.ruta)
  const r = fusionar(existentes, nuevas, ahora)
  await cuadernos.guardarTarjetas(h, info.ruta, r.tarjetas, ahora)
  await h.st.tarjetas.cambiar(() => r.tarjetas)
  if (r.agregadas > 0) await apuntarSesion(h, cfg, ahora, { creadas: r.agregadas })
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
  await h.st.repaso.cambiar(r => ({ mostrarReverso: false, ...(r.escribir ? { escribir: true } : {}), ...(previa ? { deshacer: { previa, dia, acierto, nota } } : {}) }))
  await sumar(h, cfg, ahora, { repasos: 1, aciertos: acierto ? 1 : 0, notas: { [nota]: 1 } })
  await cuadernos.guardarTarjetas(h, info.ruta, tarjetas, ahora)
  if (pendientes(tarjetas, dia, await limiteNuevas(h, cfg, tarjetas)).length === 0) h.toast('¡Repaso de hoy completado! 🎉')
}

/** Deshace la última calificación: la tarjeta vuelve a como estaba y el repaso se descuenta. */
export async function deshacer(h: Host, cfg: Config): Promise<string> {
  const info = await cuadernoActivo(h)
  const repaso = await h.st.repaso.leer()
  const ultimo = repaso.deshacer
  if (ultimo === undefined) return 'No hay nada que deshacer.'
  const ahora = await h.now()
  const tarjetas = await h.st.tarjetas.cambiar(ts => ts.map(t => (t.id === ultimo.previa.id ? ultimo.previa : t)))
  await h.st.repaso.cambiar(r => ({ mostrarReverso: false, ...(r.escribir ? { escribir: true } : {}) }))
  await sumar(h, cfg, ahora, {
    repasos: -1, aciertos: ultimo.acierto ? -1 : 0, ...(ultimo.nota !== undefined ? { notas: { [ultimo.nota]: -1 } } : {}),
  }, ultimo.dia)
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

export async function importarAnki(h: Host, cfg: Config, ruta: string): Promise<string> {
  const info = await cuadernoActivo(h)
  const archivo = ruta.startsWith('~/') ? h.home + ruta.slice(1) : ruta.startsWith('/') ? ruta : `${info.ruta}/${ruta}`
  if (!(await h.fs.exists(archivo))) return `No encuentro ${archivo}.`
  const r = anki.importar(await h.fs.read(archivo))
  if (r.tarjetas.length === 0) return `No encontré tarjetas en ${archivo} (se esperan dos columnas: frente y reverso, separadas por tabulador, «;» o «,»).`
  const resumen = await agregarTarjetas(h, cfg, r.tarjetas)
  return r.ignoradas > 0 ? `${resumen}\n${r.ignoradas} líneas sin frente o reverso se ignoraron.` : resumen
}

export async function textoTarjetas(h: Host, cfg: Config): Promise<string> {
  const info = await cuadernoActivo(h)
  const tarjetas = await h.st.tarjetas.leer()
  const e = stats.etapas(tarjetas)
  const hoy = fecha(await h.now())
  const limite = await limiteNuevas(h, cfg, tarjetas)
  const n = pendientes(tarjetas, hoy, limite).length
  const espera = nuevasEnEspera(tarjetas, hoy, limite)
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
  if (mapas.length > 0 && ((await h.st.contadores.leer()).mapas ?? 0) < mapas.length) {
    await contar(h, 'mapas', { minimo: mapas.length }).catch(() => undefined)
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
  const estado = await estadoPlan(h)
  const html = pdf.documentoRepaso({
    cuaderno: info, hoy, tarjetas, stats: await h.st.stats.leer(), documentos, limiteNuevas: await limiteNuevas(h, cfg, tarjetas),
    ...(estado !== null ? { plan: estado } : {}),
  })
  const nombre = `repaso-${info.nombre.replace(/\s+/g, '-')}-${hoy}`
  const rutaHtml = `${carpeta}/${nombre}.html`
  const rutaPdf = `${carpeta}/${nombre}.pdf`
  await h.fs.write(rutaHtml, html)

  const contenido = `${tarjetas.length} tarjetas · ${documentos.length} documentos` +
    `${tarjetas.length > 0 ? ` · ${Math.ceil(tarjetas.length / 10) * 2} hojas para recortar` : ''}` +
    `${omitidos.length > 0 ? ` (omitidos por grandes: ${omitidos.join(', ')})` : ''}`

  const r = await conNavegador(h, rutaHtml, rutaPdf, ['--no-pdf-header-footer', '--print-to-pdf-no-header', `--print-to-pdf=${rutaPdf}`])
  if (r.ok) {
    await contar(h, 'pdfs', { sumar: 1 }).catch(() => undefined)
    if (abrir) abrirArchivo(h, rutaPdf)
    return `📄 PDF de repaso listo: ${rutaPdf}\n${contenido}`
  }
  if (abrir) abrirArchivo(h, rutaHtml)
  return `${r.motivo} Dejé el documento en:\n  ${rutaHtml}\n` +
    `Ábrelo en el navegador y usa Imprimir → Guardar como PDF (con «Gráficos de fondo» activado).\n${contenido}`
}

/**
 * Convierte un HTML con el primer navegador que funcione (Chrome, Chromium,
 * Edge o Brave sin ventana): a PDF o a PNG, según los `extra` que reciba.
 */
async function conNavegador(h: Host, html: string, salida: string, extra: readonly string[]): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const url = `file://${encodeURI(html)}`
  const fallos: string[] = []
  for (const nav of NAVEGADORES) {
    const r = await h
      .run([nav, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=/tmp/estudio-pdf-navegador', '--hide-scrollbars', '--virtual-time-budget=3000', ...extra, url], { timeoutMs: 120_000 })
      .catch(() => undefined)
    if (r === undefined) continue // no está instalado
    if (r.exitCode === 0 && (await h.fs.exists(salida))) return { ok: true }
    const error = r.stderr.split('\n').map(l => l.trim()).filter(l => l !== '' && !l.startsWith('Fontconfig')).pop()
    fallos.push(`${nav.split('/').pop() ?? nav} (código ${r.exitCode}${error !== undefined ? `: ${error.slice(0, 160)}` : ''})`)
  }
  return {
    ok: false,
    motivo: fallos.length > 0 ? `El navegador no pudo crear el archivo: ${fallos.join('; ')}.` : 'No encontré Chrome, Chromium, Edge ni Brave.',
  }
}

// ── Informe semanal ─────────────────────────────────────────────────────────

/** /estudio informe: la tarjeta PNG de la semana (la actual, o la pasada) en ~/estudio/informes/. */
export async function generarInforme(h: Host, cfg: Config, pasada = false, abrir = true): Promise<string> {
  const hoy = fecha(await h.now())
  const lunes = informe.lunesDe(pasada ? sumarDias(hoy, -7) : hoy)
  const carpeta = `${cuadernos.raiz(h, cfg.carpeta)}/informes`
  const base = `${carpeta}/semana-${lunes}`
  await h.fs.write(`${base}.html`, informe.htmlInforme({ lunes, hoy, stats: await h.st.stats.leer(), logros: await h.st.logros.leer() }))
  const r = await conNavegador(h, `${base}.html`, `${base}.png`, [`--window-size=${informe.ANCHO},${informe.ALTO}`, `--screenshot=${base}.png`])
  await h.storeSet(CLAVE_INFORME, lunes)
  if (!r.ok) {
    if (abrir) abrirArchivo(h, `${base}.html`)
    return `${r.motivo} Dejé el informe en ${base}.html: ábrelo y haz una captura.`
  }
  if (abrir) abrirArchivo(h, `${base}.png`)
  return `📸 Informe semanal listo: ${base}.png (1080×1350, listo para compartir)`
}

const CLAVE_INFORME = 'ultimoInforme'

/** Los lunes, si aún no generaste el informe de la semana pasada, lo recuerda. */
export async function recordarInforme(h: Host) {
  const hoy = fecha(await h.now())
  if (informe.lunesDe(hoy) !== hoy) return
  const pasada = informe.lunesDe(sumarDias(hoy, -7))
  const s = await h.st.stats.leer()
  const huboActividad = Array.from({ length: 7 }, (_, i) => s[sumarDias(pasada, i)]).some(d => d !== undefined && (d.minutos > 0 || d.repasos > 0))
  if (!huboActividad || (await h.storeGet(CLAVE_INFORME)) === pasada) return
  h.toast('📸 Tu informe de la semana pasada está listo para compartir: /estudio informe pasada', 12_000)
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
