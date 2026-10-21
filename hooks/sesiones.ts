// Sesiones de estudio: tramos de actividad seguida, y el diario de cada día.
import type { DiaStats, Sesion } from '../types'
import { fecha } from './srs'
import * as stats from './stats'

/** Tras esta pausa sin actividad, lo siguiente abre una sesión nueva. */
export const PAUSA_MAX_MS = 30 * 60_000
export const SESIONES_GUARDADAS = 120

export type Cambio = {
  pomodoros?: number
  minutos?: number
  repasos?: number
  aciertos?: number
  creadas?: number
  temas?: Record<string, number>
  cuaderno?: string
}

const sumarMapa = (a: Record<string, number>, b: Record<string, number> = {}) => {
  const r = { ...a }
  for (const [k, v] of Object.entries(b)) r[k] = Math.max(0, (r[k] ?? 0) + v)
  return r
}

/**
 * Apunta actividad en la sesión en curso. Si no hay sesión o la última
 * actividad fue hace más de PAUSA_MAX_MS, la cierra y abre otra; un pomodoro
 * empieza la sesión donde empezó él, no cuando terminó.
 */
export function apuntar(actual: Sesion | null, ahora: number, cambio: Cambio): { sesion: Sesion; cerrada?: Sesion } {
  const empieza = ahora - (cambio.minutos ?? 0) * 60_000
  const sigue = actual !== null && empieza - actual.fin <= PAUSA_MAX_MS
  const base: Sesion = sigue && actual !== null
    ? actual
    : { id: ahora.toString(36), inicio: empieza, fin: empieza, pomodoros: 0, minutos: 0, repasos: 0, aciertos: 0, creadas: 0, temas: {}, cuadernos: [] }
  const cuadernos = cambio.cuaderno !== undefined && !base.cuadernos.includes(cambio.cuaderno) ? [...base.cuadernos, cambio.cuaderno] : base.cuadernos
  const sesion: Sesion = {
    ...base,
    fin: Math.max(base.fin, ahora),
    pomodoros: Math.max(0, base.pomodoros + (cambio.pomodoros ?? 0)),
    minutos: Math.max(0, base.minutos + (cambio.minutos ?? 0)),
    repasos: Math.max(0, base.repasos + (cambio.repasos ?? 0)),
    aciertos: Math.max(0, base.aciertos + (cambio.aciertos ?? 0)),
    creadas: Math.max(0, base.creadas + (cambio.creadas ?? 0)),
    temas: sumarMapa(base.temas, cambio.temas),
    cuadernos,
  }
  return sigue || actual === null ? { sesion } : { sesion, cerrada: actual }
}

/** La sesión sigue abierta si su última actividad fue hace poco. */
export const abierta = (s: Sesion | null, ahora: number): s is Sesion => s !== null && ahora - s.fin <= PAUSA_MAX_MS

export const vacia = (s: Sesion) => s.pomodoros === 0 && s.repasos === 0 && s.creadas === 0

const hora = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const duracion = (s: Sesion) => Math.max(1, Math.round((s.fin - s.inicio) / 60_000))

/** Una línea: «10:05–11:40 · 1 h 35 min · 3 🍅 · 40 tarjetas (85 %) · Química». */
export function linea(s: Sesion, ahora?: number): string {
  const dia = ahora !== undefined && fecha(s.inicio) !== fecha(ahora) ? `${fecha(s.inicio).slice(5).split('-').reverse().join('/')} ` : ''
  const partes = [
    `${dia}${hora(s.inicio)}–${hora(s.fin)}`,
    stats.horas(duracion(s)),
    ...(s.pomodoros > 0 ? [`${s.pomodoros} 🍅`] : []),
    ...(s.repasos > 0 ? [`${s.repasos} tarjetas (${stats.porcentaje(s.aciertos, s.repasos)})`] : []),
    ...(s.creadas > 0 ? [`${s.creadas} nuevas`] : []),
  ]
  const tema = Object.entries(s.temas).sort((a, b) => b[1] - a[1])[0]?.[0]
  return [...partes, ...(tema !== undefined ? [tema] : [])].join(' · ')
}

/** Resumen de varias líneas para el chat. */
export function resumen(s: Sesion): string {
  const temas = Object.entries(s.temas).sort((a, b) => b[1] - a[1])
  return [
    `📝 Sesión de ${hora(s.inicio)} a ${hora(s.fin)} (${stats.horas(duracion(s))})`,
    `  🍅 ${s.pomodoros} pomodoros · ${stats.horas(s.minutos)} de enfoque${temas.length > 0 ? `: ${temas.map(([t, m]) => `${t} ${stats.horas(m)}`).join(', ')}` : ''}`,
    `  🃏 ${s.repasos} tarjetas repasadas · ${stats.porcentaje(s.aciertos, s.repasos)} de aciertos${s.creadas > 0 ? ` · ${s.creadas} creadas` : ''}`,
    ...(s.cuadernos.length > 0 ? [`  📚 ${s.cuadernos.join(', ')}`] : []),
  ].join('\n')
}

/** El diario de un día en Markdown: totales, sesiones y el consejo del coach. */
export function diario(dia: string, totales: DiaStats, sesiones: readonly Sesion[], consejo?: string): string {
  const temas = Object.entries(totales.temas ?? {}).sort((a, b) => b[1] - a[1])
  return [
    `# Diario de estudio · ${dia}`,
    '',
    `- 🍅 **${totales.pomodoros} pomodoros** · ${stats.horas(totales.minutos)} de enfoque`,
    `- 🃏 **${totales.repasos} tarjetas** repasadas · ${stats.porcentaje(totales.aciertos, totales.repasos)} de aciertos`,
    ...(temas.length > 0 ? [`- 📌 Temas: ${temas.map(([t, m]) => `${t} (${stats.horas(m)})`).join(', ')}`] : []),
    ...((totales.examenes ?? []).map(e => `- 📝 Examen simulado${e.titulo !== undefined ? ` «${e.titulo}»` : ''}: **${e.nota.toFixed(1)}/10** (${e.preguntas} preguntas)`)),
    '',
    '## Sesiones',
    '',
    ...(sesiones.length === 0 ? ['_Sin sesiones registradas._'] : sesiones.map(s => `- ${linea(s)}`)),
    ...(consejo !== undefined && consejo.trim() !== '' ? ['', '## 🤖 Consejo del coach', '', consejo.trim()] : []),
    '',
  ].join('\n')
}

/** Valida lo leído del almacén. */
export function sanear(v: unknown): Sesion | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0)
  if (typeof o.id !== 'string' || num(o.inicio) === 0) return null
  const temas: Record<string, number> = {}
  if (typeof o.temas === 'object' && o.temas !== null) for (const [k, n] of Object.entries(o.temas)) if (num(n) > 0) temas[k] = num(n)
  return {
    id: o.id, inicio: num(o.inicio), fin: Math.max(num(o.inicio), num(o.fin)),
    pomodoros: num(o.pomodoros), minutos: num(o.minutos), repasos: num(o.repasos), aciertos: num(o.aciertos), creadas: num(o.creadas),
    temas, cuadernos: Array.isArray(o.cuadernos) ? o.cuadernos.filter((c): c is string => typeof c === 'string') : [],
  }
}
