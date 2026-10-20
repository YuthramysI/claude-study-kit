// Repaso espaciado SM-2 (SuperMemo 2), en funciones puras.
import type { Tarjeta } from '../types'

export type Nota = 'otra' | 'dificil' | 'bien' | 'facil'

export const NOTAS: readonly Nota[] = ['otra', 'dificil', 'bien', 'facil']

export const ETIQUETAS: Record<Nota, string> = {
  otra: 'Otra vez',
  dificil: 'Difícil',
  bien: 'Bien',
  facil: 'Fácil',
}

/** Calidad de la respuesta en la escala 0-5 de SM-2. */
const CALIDAD: Record<Nota, number> = { otra: 1, dificil: 3, bien: 4, facil: 5 }

const FACILIDAD_MIN = 1.3

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

/** Días hasta el próximo repaso si se califica con `nota` (sin cambiar la tarjeta). */
export function intervaloPara(t: Tarjeta, nota: Nota): number {
  if (nota === 'otra') return 0
  const q = CALIDAD[nota]
  let dias: number
  if (t.repeticiones === 0) dias = nota === 'facil' ? 4 : 1
  else if (t.repeticiones === 1) dias = nota === 'dificil' ? 3 : 6
  else dias = Math.round(t.intervalo * nuevaFacilidad(t.facilidad, q))
  if (nota === 'dificil' && t.repeticiones > 1) dias = Math.max(1, Math.round(t.intervalo * 1.2))
  if (nota === 'facil' && t.repeticiones > 0) dias = Math.round(dias * 1.3)
  return Math.max(1, dias)
}

function nuevaFacilidad(ef: number, q: number): number {
  return Math.max(FACILIDAD_MIN, ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
}

/** Aplica una calificación: devuelve la tarjeta con su nuevo intervalo y vencimiento. */
export function programar(t: Tarjeta, nota: Nota, ahora: number): Tarjeta {
  const hoy = fecha(ahora)
  const intervalo = intervaloPara(t, nota)
  return {
    ...t,
    intervalo,
    facilidad: nuevaFacilidad(t.facilidad, CALIDAD[nota]),
    repeticiones: nota === 'otra' ? 0 : t.repeticiones + 1,
    vence: sumarDias(hoy, intervalo),
    ultimo: ahora,
  }
}

/** Tarjetas que vencen hoy o antes; las repasadas hace menos van al final. */
export function pendientes(tarjetas: readonly Tarjeta[], hoy: string): Tarjeta[] {
  return tarjetas.filter(t => t.vence <= hoy).sort((a, b) => a.ultimo - b.ultimo)
}

/** Texto corto para un intervalo: "hoy", "1 d", "3 sem", "2 m". */
export function describirIntervalo(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias < 14) return `${dias} d`
  if (dias < 60) return `${Math.round(dias / 7)} sem`
  return `${Math.round(dias / 30)} m`
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
  for (const [i, n] of nuevas.entries()) {
    const clave = normalizar(n.frente)
    if (clave === '' || n.reverso.trim() === '' || vistos.has(clave)) {
      repetidas++
      continue
    }
    vistos.add(clave)
    tarjetas.push(nueva(n, hoy, `${ahora.toString(36)}-${i}`))
  }
  return { tarjetas, agregadas: tarjetas.length - existentes.length, repetidas }
}
