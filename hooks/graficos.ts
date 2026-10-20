// Gráficos del panel: SVG para VS Code y escritorio, texto para la terminal.
import type { DiaStats, Fase } from '../types'

/** Colores de cada fase en los SVG: tonos medios, legibles sobre fondo claro y oscuro. */
export const COLOR_FASE: Record<Fase | 'pausa', string> = {
  enfoque: '#E8553F',
  descanso: '#2FA67A',
  descansoLargo: '#3B82C4',
  pausa: '#9AA0A6',
}

/** Los mismos papeles con las claves del tema de Claude Code, para los textos. */
export const TEMA_FASE: Record<Fase | 'pausa', string> = {
  enfoque: 'claude',
  descanso: 'success',
  descansoLargo: 'suggestion',
  pausa: 'subtle',
}

const GRIS = '#8A8F98'
const FUENTE = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r1 = (n: number) => Math.round(n * 10) / 10

export type Anillo = {
  /** 0 a 1: cuánto de la fase ha pasado. */
  hecho: number
  reloj: string
  etiqueta: string
  fase: Fase
  pausado: boolean
  /** pomodoros completados en el ciclo (0-4) */
  ronda: number
  rondas: number
}

/** El reloj del Pomodoro como anillo de progreso con el tiempo dentro. */
export function anillo(a: Anillo): string {
  const color = a.pausado ? COLOR_FASE.pausa : COLOR_FASE[a.fase]
  const r = 92
  const c = 2 * Math.PI * r
  const hecho = Math.min(1, Math.max(0, a.hecho))
  const puntos = Array.from({ length: a.rondas }, (_, i) => {
    const x = 110 + (i - (a.rondas - 1) / 2) * 16
    const lleno = i < a.ronda
    return `<circle cx="${r1(x)}" cy="176" r="4.5" fill="${lleno ? COLOR_FASE.enfoque : 'none'}" stroke="${lleno ? COLOR_FASE.enfoque : GRIS}" stroke-opacity="${lleno ? 1 : 0.6}" stroke-width="1.5"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220">` +
    `<circle cx="110" cy="110" r="${r}" fill="none" stroke="${GRIS}" stroke-opacity="0.18" stroke-width="12"/>` +
    (hecho > 0
      ? `<circle cx="110" cy="110" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" ` +
        `stroke-dasharray="${r1(c)}" stroke-dashoffset="${r1(c * (1 - hecho))}" transform="rotate(-90 110 110)"/>`
      : '') +
    `<text x="110" y="118" text-anchor="middle" font-family="${MONO}" font-size="46" font-weight="700" fill="${color}">${esc(a.reloj)}</text>` +
    `<text x="110" y="148" text-anchor="middle" font-family="${FUENTE}" font-size="13" font-weight="600" letter-spacing="2.5" fill="${GRIS}">${esc(a.etiqueta.toUpperCase())}</text>` +
    puntos +
    `</svg>`
}

/** Barras de los últimos días (pomodoros), con el día y el valor. */
export function barras(dias: readonly { etiqueta: string; valor: number; esHoy: boolean }[]): string {
  const ancho = 320
  const alto = 130
  const base = 104
  const max = Math.max(1, ...dias.map(d => d.valor))
  const paso = ancho / dias.length
  const w = Math.min(28, paso * 0.6)
  const cuerpo = dias.map((d, i) => {
    const x = paso * i + (paso - w) / 2
    const h = d.valor === 0 ? 2 : Math.max(4, (d.valor / max) * 78)
    const color = d.valor === 0 ? GRIS : COLOR_FASE.enfoque
    return `<rect x="${r1(x)}" y="${r1(base - h)}" width="${r1(w)}" height="${r1(h)}" rx="4" fill="${color}" fill-opacity="${d.valor === 0 ? 0.3 : d.esHoy ? 1 : 0.75}"/>` +
      (d.valor > 0 ? `<text x="${r1(x + w / 2)}" y="${r1(base - h - 6)}" text-anchor="middle" font-family="${FUENTE}" font-size="12" font-weight="600" fill="${COLOR_FASE.enfoque}">${d.valor}</text>` : '') +
      `<text x="${r1(x + w / 2)}" y="${base + 18}" text-anchor="middle" font-family="${FUENTE}" font-size="11" font-weight="${d.esHoy ? 700 : 400}" fill="${GRIS}">${esc(d.etiqueta)}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${cuerpo}</svg>`
}

const VERDES = ['#9BE9A8', '#40C463', '#30A14E', '#216E39']

/** Puntuación de un día para el mapa de calor: minutos de enfoque + tarjetas. */
export const actividad = (d: DiaStats | undefined) => (d === undefined ? 0 : d.minutos + d.repasos)

/**
 * Mapa de actividad estilo GitHub: una columna por semana (lunes arriba),
 * `dias` de la más antigua a hoy, alineados para que hoy caiga en su día.
 */
export function mapaCalor(dias: readonly { dia: string; valor: number; diaSemana: number }[]): string {
  const celda = 13
  const hueco = 3
  const izq = 26
  const arriba = 4
  const max = Math.max(1, ...dias.map(d => d.valor))
  // lunes = fila 0 … domingo = fila 6
  const fila = (dow: number) => (dow + 6) % 7
  const primera = dias[0]
  const desfase = primera === undefined ? 0 : fila(primera.diaSemana)
  const semanas = Math.ceil((dias.length + desfase) / 7)
  const cuerpo = dias.map((d, i) => {
    const pos = i + desfase
    const x = izq + Math.floor(pos / 7) * (celda + hueco)
    const y = arriba + fila(d.diaSemana) * (celda + hueco)
    const nivel = d.valor === 0 ? -1 : Math.min(3, Math.floor((d.valor / max) * 4 - 1e-9))
    const color = nivel < 0 ? GRIS : VERDES[nivel] ?? VERDES[3]
    return `<rect x="${x}" y="${y}" width="${celda}" height="${celda}" rx="3" fill="${color}" fill-opacity="${nivel < 0 ? 0.18 : 1}"><title>${esc(d.dia)}</title></rect>`
  }).join('')
  const etiquetas = [['L', 0], ['X', 2], ['V', 4]]
    .map(([t, f]) => `<text x="0" y="${arriba + Number(f) * (celda + hueco) + 10}" font-family="${FUENTE}" font-size="10" fill="${GRIS}">${t}</text>`)
    .join('')
  const ancho = izq + semanas * (celda + hueco)
  const alto = arriba + 7 * (celda + hueco)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${etiquetas}${cuerpo}</svg>`
}

/** Barra apilada de las etapas de las tarjetas, con leyenda. */
export function etapas(e: { nuevas: number; aprendiendo: number; maduras: number }): string {
  const ancho = 320
  const total = e.nuevas + e.aprendiendo + e.maduras
  const partes = [
    { n: e.nuevas, color: '#8AB4F8', nombre: 'nuevas' },
    { n: e.aprendiendo, color: '#F6B04A', nombre: 'aprendiendo' },
    { n: e.maduras, color: '#2FA67A', nombre: 'maduras' },
  ]
  let x = 0
  const barra = total === 0
    ? `<rect x="0" y="0" width="${ancho}" height="14" rx="7" fill="${GRIS}" fill-opacity="0.2"/>`
    : partes.filter(p => p.n > 0).map(p => {
      const w = (p.n / total) * ancho
      const r = `<rect x="${r1(x)}" y="0" width="${r1(w)}" height="14" fill="${p.color}"/>`
      x += w
      return r
    }).join('')
  const posiciones = [0, 98, 226]
  const leyenda = partes.map((p, i) => {
    const lx = posiciones[i] ?? i * 110
    return `<circle cx="${lx + 5}" cy="33" r="5" fill="${p.color}"/>` +
      `<text x="${lx + 14}" y="37" font-family="${FUENTE}" font-size="12" fill="${GRIS}">${p.n} ${p.nombre}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} 44" width="${ancho}" height="44">` +
    `<clipPath id="b"><rect x="0" y="0" width="${ancho}" height="14" rx="7"/></clipPath><g clip-path="url(#b)">${barra}</g>${leyenda}</svg>`
}

// ── Terminal ────────────────────────────────────────────────────────────────

/** Dígitos de tres filas (estilo «future» de figlet). */
const DIGITOS: Record<string, readonly [string, string, string]> = {
  '0': ['┏━┓', '┃ ┃', '┗━┛'],
  '1': ['╺┓ ', ' ┃ ', '╺┻╸'],
  '2': ['┏━┓', '┏━┛', '┗━╸'],
  '3': ['┏━┓', '╺━┫', '┗━┛'],
  '4': ['╻ ╻', '┗━┫', '  ╹'],
  '5': ['┏━╸', '┗━┓', '┗━┛'],
  '6': ['┏━╸', '┣━┓', '┗━┛'],
  '7': ['┏━┓', '  ┃', '  ╹'],
  '8': ['┏━┓', '┣━┫', '┗━┛'],
  '9': ['┏━┓', '┗━┫', '┗━┛'],
  ':': [' ', '╹', '╹'],
}

/** El reloj «mm:ss» en dígitos grandes de tres filas. */
export function relojGrande(texto: string): [string, string, string] {
  const filas: [string[], string[], string[]] = [[], [], []]
  for (const c of texto) {
    const g = DIGITOS[c] ?? [c, ' ', ' ']
    filas[0].push(g[0])
    filas[1].push(g[1])
    filas[2].push(g[2])
  }
  return [filas[0].join(' '), filas[1].join(' '), filas[2].join(' ')]
}

/** Barra de progreso de texto con bordes redondeados: ━━━━━╸──── */
export function barraTexto(hecho: number, ancho: number): { lleno: string; vacio: string } {
  const n = Math.round(Math.min(1, Math.max(0, hecho)) * ancho)
  return { lleno: '━'.repeat(n), vacio: '─'.repeat(ancho - n) }
}

/** Icono según el tipo de archivo de una fuente. */
export function iconoFuente(nombre: string): string {
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return '📕'
  if (['md', 'markdown', 'txt', 'text', 'rst', 'org', 'tex'].includes(ext)) return '📝'
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return '🖼️'
  if (['html', 'htm'].includes(ext)) return '🌐'
  if (['doc', 'docx', 'ppt', 'pptx'].includes(ext)) return '📄'
  if (['csv', 'json'].includes(ext)) return '📊'
  return '📎'
}
