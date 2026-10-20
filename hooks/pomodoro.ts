// Máquina de estados del Pomodoro, en funciones puras.
import type { Fase, Pomodoro } from '../types'

export type Duraciones = { enfoque: number; descanso: number; descansoLargo: number }

export const RONDAS_POR_CICLO = 4

export const NOMBRE_FASE: Record<Fase, string> = {
  enfoque: 'enfoque',
  descanso: 'descanso',
  descansoLargo: 'descanso largo',
}

export const INICIAL: Pomodoro = {
  fase: 'enfoque',
  estado: 'parado',
  terminaEn: 0,
  restanteMs: 0,
  duracionMs: 0,
  ronda: 0,
}

const minutos = (m: number) => Math.round(m * 60_000)

export function duracionDe(fase: Fase, d: Duraciones): number {
  return minutos(d[fase])
}

/** Empieza la fase actual (o un enfoque de `minutosForzados` si se indican). */
export function iniciar(p: Pomodoro, ahora: number, d: Duraciones, minutosForzados?: number): Pomodoro {
  const fase = minutosForzados === undefined ? p.fase : 'enfoque'
  const duracionMs = minutosForzados === undefined ? duracionDe(fase, d) : minutos(minutosForzados)
  return { ...p, fase, estado: 'corriendo', duracionMs, terminaEn: ahora + duracionMs, restanteMs: duracionMs }
}

export function pausar(p: Pomodoro, ahora: number): Pomodoro {
  if (p.estado !== 'corriendo') return p
  return { ...p, estado: 'pausado', restanteMs: Math.max(0, p.terminaEn - ahora) }
}

export function reanudar(p: Pomodoro, ahora: number): Pomodoro {
  if (p.estado !== 'pausado') return p
  return { ...p, estado: 'corriendo', terminaEn: ahora + p.restanteMs }
}

export function parar(p: Pomodoro): Pomodoro {
  return { ...INICIAL, ronda: p.ronda }
}

export function restante(p: Pomodoro, ahora: number): number {
  if (p.estado === 'corriendo') return Math.max(0, p.terminaEn - ahora)
  if (p.estado === 'pausado') return p.restanteMs
  return 0
}

export function haTerminado(p: Pomodoro, ahora: number): boolean {
  return p.estado === 'corriendo' && ahora >= p.terminaEn
}

/**
 * Pasa a la fase siguiente. Tras un enfoque el descanso arranca solo; tras un
 * descanso el siguiente enfoque espera a que lo inicies, salvo con `autoIniciar`.
 */
export function siguiente(
  p: Pomodoro,
  ahora: number,
  d: Duraciones,
  autoIniciar = false,
): { pomodoro: Pomodoro; completoEnfoque: boolean } {
  if (p.fase === 'enfoque') {
    const ronda = p.ronda + 1
    const fase: Fase = ronda % RONDAS_POR_CICLO === 0 ? 'descansoLargo' : 'descanso'
    return { pomodoro: iniciar({ ...p, fase, ronda }, ahora, d), completoEnfoque: true }
  }
  const ronda = p.fase === 'descansoLargo' ? 0 : p.ronda
  const listo: Pomodoro = { ...INICIAL, ronda }
  return { pomodoro: autoIniciar ? iniciar(listo, ahora, d) : listo, completoEnfoque: false }
}

/**
 * Un pomodoro guardado en otra sesión: sigue si aún corre o está en pausa;
 * si terminó mientras no estabas, se descarta (sin contarlo).
 */
export function restaurar(guardado: unknown, ahora: number): Pomodoro {
  if (typeof guardado !== 'object' || guardado === null) return INICIAL
  const p = guardado as Partial<Pomodoro>
  const fases: readonly Fase[] = ['enfoque', 'descanso', 'descansoLargo']
  const valido =
    fases.includes(p.fase as Fase) && ['parado', 'corriendo', 'pausado'].includes(p.estado as string) &&
    typeof p.terminaEn === 'number' && typeof p.restanteMs === 'number' &&
    typeof p.duracionMs === 'number' && typeof p.ronda === 'number'
  if (!valido) return INICIAL
  const r = p as Pomodoro
  if (r.estado === 'corriendo' && ahora >= r.terminaEn) return { ...INICIAL, ronda: r.fase === 'enfoque' ? r.ronda : 0 }
  return r
}

export function reloj(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function lineaEstado(p: Pomodoro, ahora: number): string | undefined {
  if (p.estado === 'parado') return undefined
  const icono = p.fase === 'enfoque' ? '🍅' : '☕'
  const pausa = p.estado === 'pausado' ? ' (pausa)' : ''
  const ronda = p.fase === 'enfoque' ? ` ${(p.ronda % RONDAS_POR_CICLO) + 1}/${RONDAS_POR_CICLO}` : ''
  return `${icono} ${reloj(restante(p, ahora))} · ${NOMBRE_FASE[p.fase]}${ronda}${pausa}`
}
