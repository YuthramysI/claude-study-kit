// Repaso espaciado con FSRS-4.5 (Free Spaced Repetition Scheduler), en funciones puras.
// https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
import type { Tarjeta } from '../types'

export type Nota = 'otra' | 'dificil' | 'bien' | 'facil'

export const NOTAS: readonly Nota[] = ['otra', 'dificil', 'bien', 'facil']

export const ETIQUETAS: Record<Nota, string> = {
  otra: 'Otra vez',
  dificil: 'Difícil',
  bien: 'Bien',
  facil: 'Fácil',
}

/** La nota en la escala de FSRS: 1 otra vez · 2 difícil · 3 bien · 4 fácil. */
const GRADO: Record<Nota, 1 | 2 | 3 | 4> = { otra: 1, dificil: 2, bien: 3, facil: 4 }

/** Los 17 parámetros por defecto de FSRS-4.5. */
export const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const

const DECAY = -0.5
const FACTOR = 19 / 81
const MAX_INTERVALO = 36_500

/** Retención deseada por defecto: el 90 % de las tarjetas se recuerdan el día que vencen. */
export const RETENCION = 0.9

const w = (i: number) => W[i] ?? 0
const acotar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

/** Fecha local YYYY-MM-DD de un instante en ms. */
export function fecha(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function sumarDias(dia: string, dias: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  return fecha(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + dias).getTime())
}

/** Días naturales entre dos fechas YYYY-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  const ms = (dia: string) => {
    const [y, m, d] = dia.split('-').map(Number)
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

export function nueva(
  datos: { frente: string; reverso: string; fuente?: string },
  hoy: string,
  id: string,
): Tarjeta {
  return {
    id,
    frente: datos.frente.trim(),
    reverso: datos.reverso.trim(),
    ...(datos.fuente ? { fuente: datos.fuente.trim() } : {}),
    intervalo: 0,
    facilidad: 2.5,
    repeticiones: 0,
    vence: hoy,
    ultimo: 0,
  }
}

// ── FSRS ────────────────────────────────────────────────────────────────────

/** Probabilidad de recordar tras `dias` con estabilidad `s`. */
export function retencionTras(dias: number, s: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, dias)) / s, DECAY)
}

/** Días hasta que la probabilidad de recordar baja a `retencion`. */
export function intervaloDe(s: number, retencion = RETENCION): number {
  const dias = (s / FACTOR) * (Math.pow(retencion, 1 / DECAY) - 1)
  return acotar(Math.round(dias), 1, MAX_INTERVALO)
}

const dificultadInicial = (g: number) => acotar(w(4) - (g - 3) * w(5), 1, 10)

/**
 * Estado de memoria de una tarjeta: el suyo si ya lo tiene; para una tarjeta
 * que viene de SM-2, una estimación a partir de su intervalo y su facilidad.
 */
export function memoria(t: Tarjeta): { estabilidad: number; dificultad: number } | undefined {
  if (t.ultimo === 0) return undefined
  if (t.estabilidad !== undefined && t.dificultad !== undefined) return { estabilidad: t.estabilidad, dificultad: t.dificultad }
  // SM-2: facilidad 2.5 ≈ dificultad media; 1.3 (la mínima) ≈ muy difícil
  return { estabilidad: Math.max(0.5, t.intervalo), dificultad: acotar(10 - (t.facilidad - 1.3) * 4, 1, 10) }
}

/** Aplica una calificación: devuelve la tarjeta con su nuevo estado y su próximo repaso. */
export function programar(t: Tarjeta, nota: Nota, ahora: number, retencion = RETENCION): Tarjeta {
  const g = GRADO[nota]
  const hoy = fecha(ahora)
  const previa = memoria(t)
  let s: number
  let d: number
  if (previa === undefined) {
    s = w(g - 1)
    d = dificultadInicial(g)
  } else {
    const dias = Math.max(0, diasEntre(fecha(t.ultimo), hoy))
    const r = retencionTras(dias, previa.estabilidad)
    d = acotar(w(7) * dificultadInicial(3) + (1 - w(7)) * (previa.dificultad - w(6) * (g - 3)), 1, 10)
    if (g === 1) {
      const olvido = w(11) * Math.pow(previa.dificultad, -w(12)) * (Math.pow(previa.estabilidad + 1, w(13)) - 1) * Math.exp(w(14) * (1 - r))
      s = Math.min(previa.estabilidad, olvido)
    } else {
      const penalizacion = g === 2 ? w(15) : 1
      const bonus = g === 4 ? w(16) : 1
      s = previa.estabilidad * (Math.exp(w(8)) * (11 - previa.dificultad) * Math.pow(previa.estabilidad, -w(9)) *
        (Math.exp(w(10) * (1 - r)) - 1) * penalizacion * bonus + 1)
    }
  }
  s = Math.max(0.1, s)
  // «otra vez» vuelve hoy mismo, al final de la cola
  const intervalo = g === 1 ? 0 : intervaloDe(s, retencion)
  return {
    ...t,
    estabilidad: Math.round(s * 1000) / 1000,
    dificultad: Math.round(d * 1000) / 1000,
    intervalo,
    repeticiones: g === 1 ? 0 : t.repeticiones + 1,
    vence: sumarDias(hoy, intervalo),
    ultimo: ahora,
    primera: t.primera ?? hoy,
  }
}

/** Días hasta el próximo repaso si se califica con `nota` (sin cambiar la tarjeta). */
export function intervaloPara(t: Tarjeta, nota: Nota, ahora: number, retencion = RETENCION): number {
  return programar(t, nota, ahora, retencion).intervalo
}

// ── Cola del día ────────────────────────────────────────────────────────────

/** Nunca repasada: aún no ha entrado en el repaso espaciado. */
export const esNueva = (t: Tarjeta) => t.ultimo === 0

/**
 * La cola de hoy: primero los repasos vencidos (los repasados hace menos, al
 * final), después las nuevas, como mucho `limiteNuevas` al día contando las que
 * ya empezaste hoy.
 */
export function pendientes(tarjetas: readonly Tarjeta[], hoy: string, limiteNuevas = Infinity): Tarjeta[] {
  const repasos = tarjetas.filter(t => !esNueva(t) && t.vence <= hoy).sort((a, b) => a.ultimo - b.ultimo)
  const empezadasHoy = tarjetas.filter(t => t.primera === hoy).length
  const cupo = Math.max(0, limiteNuevas - empezadasHoy)
  const nuevas = tarjetas.filter(t => esNueva(t) && t.vence <= hoy).slice(0, cupo)
  return [...repasos, ...nuevas]
}

/** Nuevas que esperan su turno por el límite diario. */
export function nuevasEnEspera(tarjetas: readonly Tarjeta[], hoy: string, limiteNuevas = Infinity): number {
  const nuevas = tarjetas.filter(t => esNueva(t) && t.vence <= hoy).length
  const cola = pendientes(tarjetas, hoy, limiteNuevas).filter(esNueva).length
  return nuevas - cola
}

/** Texto corto para un intervalo: "hoy", "1 d", "3 sem", "2 m", "1,5 a". */
export function describirIntervalo(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias < 14) return `${dias} d`
  if (dias < 60) return `${Math.round(dias / 7)} sem`
  if (dias < 365) return `${Math.round(dias / 30)} m`
  return `${(Math.round(dias / 36.5) / 10).toString().replace('.', ',')} a`
}

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, ' ').trim()

/** Añade tarjetas nuevas saltando las que repiten un frente ya existente. */
export function fusionar(
  existentes: readonly Tarjeta[],
  nuevas: readonly { frente: string; reverso: string; fuente?: string }[],
  ahora: number,
): { tarjetas: Tarjeta[]; agregadas: number; repetidas: number } {
  const vistos = new Set(existentes.map(t => normalizar(t.frente)))
  const hoy = fecha(ahora)
  const tarjetas = [...existentes]
  let repetidas = 0
  // ids únicos aunque dos tandas compartan milisegundo: se numeran tras las existentes
  for (const [i, n] of nuevas.entries()) {
    const clave = normalizar(n.frente)
    if (clave === '' || n.reverso.trim() === '' || vistos.has(clave)) {
      repetidas++
      continue
    }
    vistos.add(clave)
    tarjetas.push(nueva(n, hoy, `${ahora.toString(36)}-${existentes.length + i}`))
  }
  return { tarjetas, agregadas: tarjetas.length - existentes.length, repetidas }
}
