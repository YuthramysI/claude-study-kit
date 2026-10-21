// Logros, experiencia y niveles, en funciones puras: todo sale de los datos guardados.
import type { Stats } from '../types'
import { L } from './i18n'
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
  { id: 'pomodoro-1', icono: '🍅', get nombre() { return L('Primer tomate', 'First tomato') }, get descripcion() { return L('Completa tu primer pomodoro', 'Complete your first pomodoro') }, progreso: meta('pomodoros', 1) },
  { id: 'pomodoro-10', icono: '🧺', get nombre() { return L('Constancia', 'Consistency') }, get descripcion() { return L('10 pomodoros', '10 pomodoros') }, progreso: meta('pomodoros', 10) },
  { id: 'pomodoro-100', icono: '💯', get nombre() { return L('Centurión', 'Centurion') }, get descripcion() { return L('100 pomodoros', '100 pomodoros') }, progreso: meta('pomodoros', 100) },
  { id: 'pomodoro-500', icono: '👑', get nombre() { return L('Rey del tomate', 'Tomato king') }, get descripcion() { return L('500 pomodoros', '500 pomodoros') }, progreso: meta('pomodoros', 500) },
  { id: 'horas-10', icono: '⏱️', get nombre() { return L('10 horas de foco', '10 hours of focus') }, get descripcion() { return L('10 h de enfoque en total', '10 h of focus in total') }, progreso: meta('horas', 10) },
  { id: 'horas-50', icono: '⌛', get nombre() { return L('Medio centenar', 'Half a hundred') }, get descripcion() { return L('50 h de enfoque', '50 h of focus') }, progreso: meta('horas', 50) },
  { id: 'horas-100', icono: '🏛️', get nombre() { return L('Cien horas', 'A hundred hours') }, get descripcion() { return L('100 h de enfoque', '100 h of focus') }, progreso: meta('horas', 100) },
  { id: 'racha-3', icono: '🔥', get nombre() { return L('Calentando', 'Warming up') }, get descripcion() { return L('3 días seguidos estudiando', '3 days in a row studying') }, progreso: meta('mejorRacha', 3) },
  { id: 'racha-7', icono: '📅', get nombre() { return L('Semana perfecta', 'Perfect week') }, get descripcion() { return L('7 días seguidos', '7 days in a row') }, progreso: meta('mejorRacha', 7) },
  { id: 'racha-30', icono: '🚀', get nombre() { return L('Imparable', 'Unstoppable') }, get descripcion() { return L('30 días seguidos', '30 days in a row') }, progreso: meta('mejorRacha', 30) },
  { id: 'racha-100', icono: '🌋', get nombre() { return L('Volcán', 'Volcano') }, get descripcion() { return L('100 días seguidos', '100 days in a row') }, progreso: meta('mejorRacha', 100) },
  { id: 'repasos-100', icono: '🧠', get nombre() { return L('Memoria en marcha', 'Memory in motion') }, get descripcion() { return L('100 tarjetas repasadas', '100 cards reviewed') }, progreso: meta('repasos', 100) },
  { id: 'repasos-1000', icono: '🐘', get nombre() { return L('Memoria de elefante', 'Elephant memory') }, get descripcion() { return L('1000 tarjetas repasadas', '1000 cards reviewed') }, progreso: meta('repasos', 1000) },
  { id: 'maduras-25', icono: '🌱', get nombre() { return L('Raíces', 'Roots') }, get descripcion() { return L('25 tarjetas maduras en un cuaderno', '25 mature cards in a notebook') }, progreso: meta('maduras', 25) },
  { id: 'maduras-100', icono: '🌳', get nombre() { return L('Bosque', 'Forest') }, get descripcion() { return L('100 tarjetas maduras en un cuaderno', '100 mature cards in a notebook') }, progreso: meta('maduras', 100) },
  { id: 'dia-perfecto', icono: '🎯', get nombre() { return L('Día perfecto', 'Perfect day') }, get descripcion() { return L('20+ tarjetas en un día con ≥ 90 % de aciertos', '20+ cards in a day with ≥ 90% correct') }, progreso: meta('diaPerfecto', 1) },
  { id: 'maraton', icono: '🏃', get nombre() { return L('Maratón', 'Marathon') }, get descripcion() { return L('4 h de enfoque en un mismo día', '4 h of focus in a single day') }, progreso: meta('maraton', 240) },
  { id: 'buho', icono: '🦉', get nombre() { return L('Búho', 'Night owl') }, get descripcion() { return L('1 h de enfoque entre las 22 y las 5 h', '1 h of focus between 10 pm and 5 am') }, progreso: meta('nocturno', 60) },
  { id: 'madrugador', icono: '🌅', get nombre() { return L('Madrugador', 'Early bird') }, get descripcion() { return L('1 h de enfoque entre las 5 y las 8 h', '1 h of focus between 5 and 8 am') }, progreso: meta('madrugador', 60) },
  { id: 'examen-1', icono: '📝', get nombre() { return L('A prueba', 'Put to the test') }, get descripcion() { return L('Haz tu primer examen simulado', 'Take your first mock exam') }, progreso: meta('examenes', 1) },
  { id: 'examen-9', icono: '🏅', get nombre() { return L('Sobresaliente', 'Top marks') }, get descripcion() { return L('Saca un 9 o más en un examen simulado', 'Score 9 or more on a mock exam') }, progreso: meta('mejorNota', 9) },
  { id: 'mapa-1', icono: '🗺️', get nombre() { return L('Cartógrafo', 'Cartographer') }, get descripcion() { return L('Crea un mapa mental', 'Create a mind map') }, progreso: meta('mapas', 1) },
  { id: 'pdf-1', icono: '🖨️', get nombre() { return L('A papel', 'On paper') }, get descripcion() { return L('Genera tu primer PDF de repaso', 'Generate your first review PDF') }, progreso: meta('pdfs', 1) },
  { id: 'temas-5', icono: '🧩', get nombre() { return L('Polímata', 'Polymath') }, get descripcion() { return L('Estudia 5 temas distintos', 'Study 5 different topics') }, progreso: meta('temas', 5) },
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

const TITULOS: readonly [number, string, string][] = [
  [25, 'Leyenda', 'Legend'], [20, 'Maestro', 'Master'], [16, 'Sabio', 'Sage'], [12, 'Erudito', 'Scholar'],
  [8, 'Avanzado', 'Advanced'], [5, 'Estudiante', 'Student'], [3, 'Aprendiz', 'Apprentice'], [0, 'Novato', 'Rookie'],
]

export function titulo(n: number): string {
  const t = TITULOS.find(([desde]) => n >= desde) ?? TITULOS[TITULOS.length - 1]
  return t === undefined ? L('Novato', 'Rookie') : L(t[1], t[2])
}

/** Logros recién conseguidos: los que se cumplen y no estaban apuntados. */
export function nuevos(r: Resumen, apuntados: Readonly<Record<string, string>>): Logro[] {
  return LOGROS.filter(l => apuntados[l.id] === undefined && conseguido(l, r))
}
