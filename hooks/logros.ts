// Logros, experiencia y niveles, en funciones puras: todo sale de los datos guardados.
import type { Stats } from '../types'
import * as stats from './stats'

/** Lo que miran los logros. */
export type DatosLogros = {
  stats: Stats
  /** tarjetas maduras del cuaderno activo */
  maduras: number
  mapas: number
  pdfs: number
  cuadernos: number
}

export type Logro = {
  id: string
  icono: string
  nombre: string
  descripcion: string
  /** progreso actual y meta */
  progreso: (d: Resumen) => [number, number]
}

/** Los números que usan los logros, calculados una vez. */
export type Resumen = {
  pomodoros: number
  horas: number
  repasos: number
  mejorRacha: number
  maduras: number
  diaPerfecto: number
  maraton: number
  nocturno: number
  madrugador: number
  examenes: number
  mejorNota: number
  mapas: number
  pdfs: number
  cuadernos: number
  temas: number
}

export function resumir(d: DatosLogros): Resumen {
  const total = stats.totales(d.stats)
  let diaPerfecto = 0
  let maraton = 0
  let nocturno = 0
  let madrugador = 0
  const temas = new Set<string>()
  for (const dia of Object.values(d.stats)) {
    if (dia.repasos >= 20 && dia.aciertos / dia.repasos >= 0.9) diaPerfecto = 1
    maraton = Math.max(maraton, dia.minutos)
    for (const [h, min] of Object.entries(dia.horas ?? {})) {
      const hora = Number(h)
      if (hora >= 22 || hora < 5) nocturno += min
      if (hora >= 5 && hora < 8) madrugador += min
    }
    for (const t of Object.keys(dia.temas ?? {})) temas.add(t)
  }
  const exs = stats.examenes(d.stats)
  return {
    pomodoros: total.pomodoros,
    horas: total.minutos / 60,
    repasos: total.repasos,
    mejorRacha: stats.mejorRacha(d.stats),
    maduras: d.maduras,
    diaPerfecto,
    maraton,
    nocturno,
    madrugador,
    examenes: exs.length,
    mejorNota: Math.max(0, ...exs.map(e => e.nota)),
    mapas: d.mapas,
    pdfs: d.pdfs,
    cuadernos: d.cuadernos,
    temas: temas.size,
  }
}

const meta = (campo: keyof Resumen, n: number) => (r: Resumen): [number, number] => [Math.min(n, Math.floor(r[campo] * 10) / 10), n]

export const LOGROS: readonly Logro[] = [
  { id: 'pomodoro-1', icono: '🍅', nombre: 'Primer tomate', descripcion: 'Completa tu primer pomodoro', progreso: meta('pomodoros', 1) },
  { id: 'pomodoro-10', icono: '🧺', nombre: 'Constancia', descripcion: '10 pomodoros', progreso: meta('pomodoros', 10) },
  { id: 'pomodoro-100', icono: '💯', nombre: 'Centurión', descripcion: '100 pomodoros', progreso: meta('pomodoros', 100) },
  { id: 'pomodoro-500', icono: '👑', nombre: 'Rey del tomate', descripcion: '500 pomodoros', progreso: meta('pomodoros', 500) },
  { id: 'horas-10', icono: '⏱️', nombre: '10 horas de foco', descripcion: '10 h de enfoque en total', progreso: meta('horas', 10) },
  { id: 'horas-50', icono: '⌛', nombre: 'Medio centenar', descripcion: '50 h de enfoque', progreso: meta('horas', 50) },
  { id: 'horas-100', icono: '🏛️', nombre: 'Cien horas', descripcion: '100 h de enfoque', progreso: meta('horas', 100) },
  { id: 'racha-3', icono: '🔥', nombre: 'Calentando', descripcion: '3 días seguidos estudiando', progreso: meta('mejorRacha', 3) },
  { id: 'racha-7', icono: '📅', nombre: 'Semana perfecta', descripcion: '7 días seguidos', progreso: meta('mejorRacha', 7) },
  { id: 'racha-30', icono: '🚀', nombre: 'Imparable', descripcion: '30 días seguidos', progreso: meta('mejorRacha', 30) },
  { id: 'racha-100', icono: '🌋', nombre: 'Volcán', descripcion: '100 días seguidos', progreso: meta('mejorRacha', 100) },
  { id: 'repasos-100', icono: '🧠', nombre: 'Memoria en marcha', descripcion: '100 tarjetas repasadas', progreso: meta('repasos', 100) },
  { id: 'repasos-1000', icono: '🐘', nombre: 'Memoria de elefante', descripcion: '1000 tarjetas repasadas', progreso: meta('repasos', 1000) },
  { id: 'maduras-25', icono: '🌱', nombre: 'Raíces', descripcion: '25 tarjetas maduras en un cuaderno', progreso: meta('maduras', 25) },
  { id: 'maduras-100', icono: '🌳', nombre: 'Bosque', descripcion: '100 tarjetas maduras en un cuaderno', progreso: meta('maduras', 100) },
  { id: 'dia-perfecto', icono: '🎯', nombre: 'Día perfecto', descripcion: '20+ tarjetas en un día con ≥ 90 % de aciertos', progreso: meta('diaPerfecto', 1) },
  { id: 'maraton', icono: '🏃', nombre: 'Maratón', descripcion: '4 h de enfoque en un mismo día', progreso: meta('maraton', 240) },
  { id: 'buho', icono: '🦉', nombre: 'Búho', descripcion: '1 h de enfoque entre las 22 y las 5 h', progreso: meta('nocturno', 60) },
  { id: 'madrugador', icono: '🌅', nombre: 'Madrugador', descripcion: '1 h de enfoque entre las 5 y las 8 h', progreso: meta('madrugador', 60) },
  { id: 'examen-1', icono: '📝', nombre: 'A prueba', descripcion: 'Haz tu primer examen simulado', progreso: meta('examenes', 1) },
  { id: 'examen-9', icono: '🏅', nombre: 'Sobresaliente', descripcion: 'Saca un 9 o más en un examen simulado', progreso: meta('mejorNota', 9) },
  { id: 'mapa-1', icono: '🗺️', nombre: 'Cartógrafo', descripcion: 'Crea un mapa mental', progreso: meta('mapas', 1) },
  { id: 'pdf-1', icono: '🖨️', nombre: 'A papel', descripcion: 'Genera tu primer PDF de repaso', progreso: meta('pdfs', 1) },
  { id: 'temas-5', icono: '🧩', nombre: 'Polímata', descripcion: 'Estudia 5 temas distintos', progreso: meta('temas', 5) },
]

export const conseguido = (l: Logro, r: Resumen) => {
  const [actual, objetivo] = l.progreso(r)
  return actual >= objetivo
}

/** Experiencia: 1 por minuto de enfoque, 2 por repaso (+1 si acertado), 5 por pomodoro, 50 por examen y 100 por logro. */
export function experiencia(s: Stats, logros: number): number {
  const t = stats.totales(s)
  return Math.round(t.minutos + t.repasos * 2 + t.aciertos + t.pomodoros * 5 + stats.examenes(s).length * 50 + logros * 100)
}

/** XP acumulada para llegar al nivel n: 50·n·(n+1) → 100, 300, 600, 1000… */
export const xpDeNivel = (n: number) => 50 * n * (n + 1)

export function nivel(xp: number): { nivel: number; titulo: string; desde: number; hasta: number } {
  let n = 0
  while (xpDeNivel(n + 1) <= xp) n++
  return { nivel: n, titulo: titulo(n), desde: xpDeNivel(n), hasta: xpDeNivel(n + 1) }
}

const TITULOS: readonly [number, string][] = [
  [25, 'Leyenda'], [20, 'Maestro'], [16, 'Sabio'], [12, 'Erudito'], [8, 'Avanzado'], [5, 'Estudiante'], [3, 'Aprendiz'], [0, 'Novato'],
]

export function titulo(n: number): string {
  return TITULOS.find(([desde]) => n >= desde)?.[1] ?? 'Novato'
}

/** Logros recién conseguidos: los que se cumplen y no estaban apuntados. */
export function nuevos(r: Resumen, apuntados: Readonly<Record<string, string>>): Logro[] {
  return LOGROS.filter(l => apuntados[l.id] === undefined && conseguido(l, r))
}
