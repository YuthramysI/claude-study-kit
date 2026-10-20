// Lo que hacen los comandos, los botones del panel y las herramientas.
import type { DiaStats, Pomodoro, Tarjeta } from '../types'
import * as anki from './anki'
import * as cuadernos from './cuadernos'
import type { Config } from './estado'
import type { Host } from './host'
import * as pdf from './pdf'
import * as pomo from './pomodoro'
import { fecha, fusionar, pendientes, programar } from './srs'
import type { Nota } from './srs'
import * as stats from './stats'

const CLAVE_STATS = 'estadisticas'
const CLAVE_HISTORIAL_ANTIGUO = 'historialPomodoros'
const CLAVE_POMODORO = 'pomodoro'

// ── Pomodoro ────────────────────────────────────────────────────────────────

export type VerboPomodoro = 'iniciar' | 'pausar' | 'reanudar' | 'alternar' | 'saltar' | 'parar'

export async function pomodoro(h: Host, cfg: Config, verbo: VerboPomodoro, minutos?: number): Promise<string> {
  const ahora = await h.now()
  const p = await h.st.pomodoro.cambiar(p => {
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
  const p = await h.st.pomodoro.cambiar(p => {
    cambio = pomo.haTerminado(p, ahora)
    if (!cambio) return p
    minutos = p.duracionMs / 60_000
    const s = pomo.siguiente(p, ahora, cfg.duraciones, cfg.autoIniciar)
    completo = s.completoEnfoque
    return s.pomodoro
  })
  if (!cambio) return
  await h.storeSet(CLAVE_POMODORO, p)
  await h.st.ahora.cambiar(() => ahora)
  h.status(pomo.lineaEstado(p, ahora))
  if (completo) await sumar(h, ahora, { pomodoros: 1, minutos })
  const aviso = completo
    ? `¡Pomodoro terminado! 🍅 Toca ${pomo.NOMBRE_FASE[p.fase]} de ${Math.round(p.duracionMs / 60_000)} min.`
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

/** Al abrir sesión: cuántas tarjetas tocan hoy. */
export async function recordatorio(h: Host) {
  const info = await h.st.cuaderno.leer()
  if (info === null) return
  const n = pendientes(await h.st.tarjetas.leer(), fecha(await h.now())).length
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

export async function calificar(h: Host, id: string, nota: Nota) {
  const info = await h.st.cuaderno.leer()
  if (info === null) return
  const ahora = await h.now()
  const tarjetas: Tarjeta[] = await h.st.tarjetas.cambiar(ts =>
    ts.map(t => (t.id === id ? programar(t, nota, ahora) : t)),
  )
  await h.st.repaso.cambiar(() => ({ mostrarReverso: false }))
  await sumar(h, ahora, { repasos: 1, aciertos: nota === 'otra' ? 0 : 1 })
  await cuadernos.guardarTarjetas(h, info.ruta, tarjetas, ahora)
  if (pendientes(tarjetas, fecha(ahora)).length === 0) h.toast('¡Repaso de hoy completado! 🎉')
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

export async function textoTarjetas(h: Host): Promise<string> {
  const info = await cuadernoActivo(h)
  const tarjetas = await h.st.tarjetas.leer()
  const e = stats.etapas(tarjetas)
  const n = pendientes(tarjetas, fecha(await h.now())).length
  return `«${info.nombre}»: ${tarjetas.length} tarjetas · ${n} pendientes hoy\n` +
    `  nuevas ${e.nuevas} · aprendiendo ${e.aprendiendo} · maduras ${e.maduras}\n` +
    'Más: /anki exportar · /anki importar <archivo>'
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
  const html = pdf.documentoRepaso({ cuaderno: info, hoy, tarjetas, stats: await h.st.stats.leer(), documentos })
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
