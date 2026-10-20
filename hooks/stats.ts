// Estadísticas de estudio, en funciones puras.
import type { DiaStats, Stats, Tarjeta } from '../types'
import { sumarDias } from './srs'

export const DIAS_GUARDADOS = 400

export const VACIO: DiaStats = { pomodoros: 0, minutos: 0, repasos: 0, aciertos: 0 }

const activo = (d: DiaStats | undefined) => d !== undefined && (d.pomodoros > 0 || d.repasos > 0)

/** Suma `cambio` al día `dia` y recorta a los últimos DIAS_GUARDADOS días. */
export function registrar(stats: Stats, dia: string, cambio: Partial<DiaStats>): Stats {
  const previo = stats[dia] ?? VACIO
  // un cambio negativo (deshacer) nunca deja un contador por debajo de cero
  const nuevo: DiaStats = {
    pomodoros: Math.max(0, previo.pomodoros + (cambio.pomodoros ?? 0)),
    minutos: Math.max(0, previo.minutos + (cambio.minutos ?? 0)),
    repasos: Math.max(0, previo.repasos + (cambio.repasos ?? 0)),
    aciertos: Math.max(0, previo.aciertos + (cambio.aciertos ?? 0)),
    ...sumarTemas(previo.temas, cambio.temas),
  }
  const dias = Object.keys({ ...stats, [dia]: nuevo }).sort().slice(-DIAS_GUARDADOS)
  return Object.fromEntries(dias.map(d => [d, d === dia ? nuevo : (stats[d] ?? VACIO)]))
}

function sumarTemas(a: Record<string, number> | undefined, b: Record<string, number> | undefined): { temas?: Record<string, number> } {
  if (a === undefined && b === undefined) return {}
  const temas: Record<string, number> = { ...(a ?? {}) }
  for (const [tema, min] of Object.entries(b ?? {})) temas[tema] = Math.max(0, (temas[tema] ?? 0) + min)
  return { temas }
}

/** Minutos de enfoque por tema desde `desde` (incluido), de más a menos. */
export function temas(stats: Stats, desde?: string): { tema: string; minutos: number }[] {
  const suma: Record<string, number> = {}
  for (const [dia, d] of Object.entries(stats)) {
    if (desde !== undefined && dia < desde) continue
    for (const [tema, min] of Object.entries(d.temas ?? {})) suma[tema] = (suma[tema] ?? 0) + min
  }
  return Object.entries(suma)
    .filter(([, min]) => min > 0)
    .map(([tema, minutos]) => ({ tema, minutos }))
    .sort((x, y) => y.minutos - x.minutos || x.tema.localeCompare(y.tema))
}

/** Días seguidos con actividad, contando hacia atrás desde hoy (o desde ayer si hoy aún no hay nada). */
export function racha(stats: Stats, hoy: string): number {
  let dia = activo(stats[hoy]) ? hoy : sumarDias(hoy, -1)
  let n = 0
  while (activo(stats[dia])) {
    n++
    dia = sumarDias(dia, -1)
  }
  return n
}

export function mejorRacha(stats: Stats): number {
  let mejor = 0
  let actual = 0
  let anterior: string | undefined
  for (const dia of Object.keys(stats).sort()) {
    if (!activo(stats[dia])) continue
    actual = anterior !== undefined && sumarDias(anterior, 1) === dia ? actual + 1 : 1
    mejor = Math.max(mejor, actual)
    anterior = dia
  }
  return mejor
}

/** Los últimos `n` días hasta hoy, del más antiguo al más reciente. */
export function ultimosDias(stats: Stats, hoy: string, n: number): { dia: string; datos: DiaStats }[] {
  return Array.from({ length: n }, (_, i) => {
    const dia = sumarDias(hoy, i - n + 1)
    return { dia, datos: stats[dia] ?? VACIO }
  })
}

export function totales(stats: Stats, desde?: string): DiaStats {
  let t = VACIO
  for (const [dia, d] of Object.entries(stats)) {
    if (desde !== undefined && dia < desde) continue
    t = { pomodoros: t.pomodoros + d.pomodoros, minutos: t.minutos + d.minutos, repasos: t.repasos + d.repasos, aciertos: t.aciertos + d.aciertos }
  }
  return t
}

const BLOQUES = '▁▂▃▄▅▆▇█'

/** Una línea de barras para `valores`; los ceros se dibujan como «·». */
export function sparkline(valores: readonly number[]): string {
  const max = Math.max(...valores, 0)
  return valores
    .map(v => (v <= 0 || max === 0 ? '·' : BLOQUES[Math.min(BLOQUES.length - 1, Math.ceil((v / max) * BLOQUES.length) - 1)]))
    .join('')
}

export function porcentaje(parte: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((parte / total) * 100)} %`
}

export function horas(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, '0')} min`
}

/** Tarjetas por etapa: nuevas (nunca repasadas), aprendiendo (< 21 d) y maduras. */
export function etapas(tarjetas: readonly Tarjeta[]): { nuevas: number; aprendiendo: number; maduras: number } {
  let nuevas = 0
  let aprendiendo = 0
  let maduras = 0
  for (const t of tarjetas) {
    if (t.ultimo === 0) nuevas++
    else if (t.intervalo >= 21) maduras++
    else aprendiendo++
  }
  return { nuevas, aprendiendo, maduras }
}

/** Convierte el historial antiguo (solo pomodoros por día) al formato actual. */
export function migrar(historial: unknown, minutosPorPomodoro: number): Stats {
  if (typeof historial !== 'object' || historial === null) return {}
  const stats: Stats = {}
  for (const [dia, n] of Object.entries(historial as Record<string, unknown>)) {
    if (typeof n === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      stats[dia] = { ...VACIO, pomodoros: n, minutos: n * minutosPorPomodoro }
    }
  }
  return stats
}

/** Valida lo leído del almacén: descarta días mal formados. */
export function sanear(v: unknown): Stats {
  if (typeof v !== 'object' || v === null) return {}
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0)
  const stats: Stats = {}
  for (const [dia, d] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || typeof d !== 'object' || d === null) continue
    const o = d as Record<string, unknown>
    const temas: Record<string, number> = {}
    if (typeof o.temas === 'object' && o.temas !== null) {
      for (const [tema, min] of Object.entries(o.temas as Record<string, unknown>)) if (num(min) > 0) temas[tema.slice(0, 60)] = num(min)
    }
    stats[dia] = {
      pomodoros: num(o.pomodoros), minutos: num(o.minutos), repasos: num(o.repasos), aciertos: num(o.aciertos),
      ...(Object.keys(temas).length > 0 ? { temas } : {}),
    }
  }
  return stats
}
