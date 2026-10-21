// Estadísticas de estudio, en funciones puras.
import type { DiaStats, ResultadoExamen, Stats, Tarjeta } from '../types'
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
    ...sumarMapa('temas', previo.temas, cambio.temas),
    ...sumarMapa('horas', previo.horas, cambio.horas),
    ...sumarMapa('notas', previo.notas, cambio.notas),
    ...(previo.examenes !== undefined || cambio.examenes !== undefined
      ? { examenes: [...(previo.examenes ?? []), ...(cambio.examenes ?? [])].slice(-20) }
      : {}),
  }
  const dias = Object.keys({ ...stats, [dia]: nuevo }).sort().slice(-DIAS_GUARDADOS)
  return Object.fromEntries(dias.map(d => [d, d === dia ? nuevo : (stats[d] ?? VACIO)]))
}

function sumarMapa<K extends 'temas' | 'horas' | 'notas'>(
  campo: K, a: Record<string, number> | undefined, b: Record<string, number> | undefined,
): Partial<Record<K, Record<string, number>>> {
  if (a === undefined && b === undefined) return {}
  const suma: Record<string, number> = { ...(a ?? {}) }
  for (const [clave, n] of Object.entries(b ?? {})) suma[clave] = Math.max(0, (suma[clave] ?? 0) + n)
  return { [campo]: suma } as Partial<Record<K, Record<string, number>>>
}

/**
 * Reparte un intervalo de enfoque por horas del día: un pomodoro de 10:50 a
 * 11:15 suma 10 min a las 10 y 15 a las 11.
 */
export function minutosPorHora(inicio: number, fin: number): Record<string, number> {
  const horas: Record<string, number> = {}
  let t = inicio
  while (t < fin) {
    const d = new Date(t)
    const siguiente = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime()
    const tramo = Math.min(fin, siguiente) - t
    const clave = String(d.getHours())
    horas[clave] = Math.round(((horas[clave] ?? 0) + tramo / 60_000) * 10) / 10
    t = Math.min(fin, siguiente)
  }
  return horas
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

/** Minutos por día de la semana (0 = lunes) y hora, en los últimos `dias` días. */
export function horario(stats: Stats, hoy: string, dias = 56): number[][] {
  const matriz = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const { dia, datos } of ultimosDias(stats, hoy, dias)) {
    const fila = (new Date(`${dia}T12:00:00`).getDay() + 6) % 7
    for (const [hora, min] of Object.entries(datos.horas ?? {})) {
      const h = Number(hora)
      const celdas = matriz[fila]
      if (celdas !== undefined && h >= 0 && h < 24) celdas[h] = (celdas[h] ?? 0) + min
    }
  }
  return matriz
}

/** Las horas del día con más enfoque, de más a menos (solo las que tienen algo). */
export function mejoresHoras(stats: Stats, hoy: string, dias = 56, cuantas = 3): { hora: number; minutos: number }[] {
  const suma = Array.from({ length: 24 }, () => 0)
  for (const fila of horario(stats, hoy, dias)) fila.forEach((m, h) => (suma[h] = (suma[h] ?? 0) + m))
  return suma
    .map((minutos, hora) => ({ hora, minutos }))
    .filter(x => x.minutos > 0)
    .sort((a, b) => b.minutos - a.minutos || a.hora - b.hora)
    .slice(0, cuantas)
}

/** % de aciertos por día (null si ese día no hubo repasos). */
export function aciertosPorDia(stats: Stats, hoy: string, dias: number): (number | null)[] {
  return ultimosDias(stats, hoy, dias).map(({ datos }) => (datos.repasos === 0 ? null : Math.round((datos.aciertos / datos.repasos) * 100)))
}

/** Todos los exámenes simulados, del más antiguo al más reciente. */
export function examenes(stats: Stats): (ResultadoExamen & { dia: string })[] {
  return Object.keys(stats).sort().flatMap(dia => (stats[dia]?.examenes ?? []).map(e => ({ ...e, dia })))
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
    const mapa = (v: unknown, claves?: RegExp): Record<string, number> | undefined => {
      if (typeof v !== 'object' || v === null) return undefined
      const salida: Record<string, number> = {}
      for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
        if (num(n) > 0 && (claves === undefined || claves.test(k))) salida[k.slice(0, 60)] = num(n)
      }
      return Object.keys(salida).length > 0 ? salida : undefined
    }
    const temas = mapa(o.temas)
    const horas = mapa(o.horas, /^(1?\d|2[0-3])$/)
    const notas = mapa(o.notas, /^(otra|dificil|bien|facil)$/)
    const examenes = Array.isArray(o.examenes)
      ? o.examenes.flatMap((x: unknown) => {
        if (typeof x !== 'object' || x === null) return []
        const e = x as Record<string, unknown>
        if (typeof e.nota !== 'number' || !Number.isFinite(e.nota)) return []
        return [{
          nota: Math.min(10, Math.max(0, e.nota)), preguntas: num(e.preguntas),
          cuaderno: typeof e.cuaderno === 'string' ? e.cuaderno : '',
          ...(typeof e.titulo === 'string' ? { titulo: e.titulo.slice(0, 80) } : {}),
        }]
      })
      : []
    stats[dia] = {
      pomodoros: num(o.pomodoros), minutos: num(o.minutos), repasos: num(o.repasos), aciertos: num(o.aciertos),
      ...(temas !== undefined ? { temas } : {}),
      ...(horas !== undefined ? { horas } : {}),
      ...(notas !== undefined ? { notas } : {}),
      ...(examenes.length > 0 ? { examenes } : {}),
    }
  }
  return stats
}
