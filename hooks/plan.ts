// Plan de examen: cuenta atrás, meta diaria y previsión de lo que recordarás ese día.
import type { PlanExamen, Stats, Tarjeta } from '../types'
import { diasEntre, esNueva, fecha, MESES, memoria, retencionTras, sumarDias } from './srs'

export const META_POMODOROS = 4
/** Días antes del examen en que ya deberías haber visto todas las tarjetas. */
const COLCHON = 2


const valida = (y: number, m: number, d: number) => {
  const f = new Date(y, m - 1, d)
  return f.getFullYear() === y && f.getMonth() === m - 1 && f.getDate() === d ? fecha(f.getTime()) : undefined
}

/**
 * Lee una fecha escrita a mano: «2026-11-15», «15/11», «15/11/2026», «15-11»,
 * «15 de noviembre», «en 20 días», «mañana». Sin año, la próxima vez que llegue.
 */
export function interpretarFecha(texto: string, hoy: string): string | undefined {
  const t = texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const anio = Number(hoy.slice(0, 4))
  const futura = (m: number, d: number) => {
    const este = valida(anio, m, d)
    return este !== undefined && este >= hoy ? este : valida(anio + 1, m, d)
  }
  if (t === 'hoy') return hoy
  if (t === 'manana') return sumarDias(hoy, 1)
  let x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (x) return valida(Number(x[1]), Number(x[2]), Number(x[3]))
  x = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(t)
  if (x) {
    const y = x[3] === undefined ? undefined : Number(x[3].length === 2 ? `20${x[3]}` : x[3])
    return y === undefined ? futura(Number(x[2]), Number(x[1])) : valida(y, Number(x[2]), Number(x[1]))
  }
  x = /^en\s+(\d{1,3})\s+(dias?|semanas?)$/.exec(t)
  if (x) return sumarDias(hoy, Number(x[1]) * (x[2]?.startsWith('semana') ? 7 : 1))
  x = /^(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?$/.exec(t)
  if (x) {
    const m = MESES.findIndex(n => n.startsWith(x?.[2]?.slice(0, 3) ?? '-')) + 1
    if (m === 0) return undefined
    return x[3] === undefined ? futura(m, Number(x[1])) : valida(Number(x[3]), m, Number(x[1]))
  }
  return undefined
}

export type EstadoPlan = {
  dias: number
  nuevas: number
  /** nuevas que tendrías que empezar cada día para verlas todas a tiempo */
  nuevasPorDia: number
  empezadasHoy: number
  /** % de tarjetas ya empezadas */
  vistas: number
  /** % medio previsto de recordar cada tarjeta el día del examen (FSRS) */
  prevision: number
  pomodorosHoy: number
  metaPomodoros: number
  ritmo: 'pasado' | 'listo' | 'bien' | 'atrasado'
  mensaje: string
}

export function estado(plan: PlanExamen, tarjetas: readonly Tarjeta[], stats: Stats, hoy: string): EstadoPlan {
  const dias = diasEntre(hoy, plan.examen)
  const nuevas = tarjetas.filter(esNueva).length
  const empezadasHoy = tarjetas.filter(t => t.primera === hoy).length
  const diasUtiles = Math.max(1, dias - Math.min(COLCHON, Math.max(0, dias - 1)))
  // las de hoy cuentan como hechas para la cuenta de lo que falta
  const nuevasPorDia = nuevas === 0 ? 0 : Math.ceil((nuevas + empezadasHoy) / diasUtiles)
  const total = tarjetas.length
  const vistas = total === 0 ? 0 : Math.round(((total - nuevas) / total) * 100)
  const recuerdo = tarjetas.map(t => {
    const m = memoria(t)
    if (m === undefined) return 0
    return retencionTras(Math.max(0, diasEntre(fecha(t.ultimo), plan.examen)), m.estabilidad)
  })
  const prevision = total === 0 ? 0 : Math.round((recuerdo.reduce((a, b) => a + b, 0) / total) * 100)
  const pomodorosHoy = stats[hoy]?.pomodoros ?? 0
  const metaPomodoros = plan.metaPomodoros ?? META_POMODOROS
  const faltanHoy = Math.max(0, nuevasPorDia - empezadasHoy)
  let ritmo: EstadoPlan['ritmo']
  let mensaje: string
  if (dias < 0) {
    ritmo = 'pasado'
    mensaje = 'El examen ya pasó. Fija el siguiente con /examen <fecha>.'
  } else if (total > 0 && nuevas === 0 && prevision >= 85) {
    ritmo = 'listo'
    mensaje = `Lo tienes: previsión del ${prevision} %. Mantén los repasos diarios.`
  } else if (faltanHoy > 0 || pomodorosHoy < metaPomodoros) {
    ritmo = dias <= 3 && (nuevas > 0 || prevision < 70) ? 'atrasado' : 'bien'
    const partes = [
      ...(faltanHoy > 0 ? [`${faltanHoy} ${faltanHoy === 1 ? 'tarjeta nueva' : 'tarjetas nuevas'}`] : []),
      ...(pomodorosHoy < metaPomodoros ? [`${metaPomodoros - pomodorosHoy} 🍅`] : []),
    ]
    mensaje = `Hoy te faltan ${partes.join(' y ')}.`
  } else {
    ritmo = 'bien'
    mensaje = '¡Meta de hoy cumplida! 🎉'
  }
  return { dias, nuevas, nuevasPorDia, empezadasHoy, vistas, prevision, pomodorosHoy, metaPomodoros, ritmo, mensaje }
}

/**
 * Límite de nuevas de hoy: el tuyo, o más si el plan necesita más para que
 * veas todas las tarjetas antes del examen.
 */
export function limiteHoy(limite: number, plan: PlanExamen | null, tarjetas: readonly Tarjeta[], stats: Stats, hoy: string): number {
  if (plan === null) return limite
  const e = estado(plan, tarjetas, stats, hoy)
  return e.dias < 0 ? limite : Math.max(limite, e.nuevasPorDia)
}

/** Valida un plan.json. */
export function sanear(v: unknown): PlanExamen | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  if (typeof o.examen !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.examen)) return null
  return {
    examen: o.examen,
    ...(typeof o.titulo === 'string' && o.titulo.trim() !== '' ? { titulo: o.titulo.trim().slice(0, 80) } : {}),
    ...(typeof o.metaPomodoros === 'number' && o.metaPomodoros > 0 ? { metaPomodoros: Math.min(20, Math.round(o.metaPomodoros)) } : {}),
  }
}
