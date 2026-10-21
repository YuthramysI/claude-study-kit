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

/** Colores de los temas, en orden: los mismos en el panel y en el PDF. */
export const COLORES_TEMA = ['#E8553F', '#3B82C4', '#2FA67A', '#F6B04A', '#9B6BD3', '#E86FA6', '#5BB8C8', '#8A8F98']

/** Barras horizontales del tiempo por tema: nombre, barra y horas. */
export function barrasTemas(temas: readonly { tema: string; minutos: number }[], formato: (min: number) => string): string {
  const ancho = 320
  const fila = 24
  const etiqueta = 96
  const valor = 64
  const max = Math.max(1, ...temas.map(t => t.minutos))
  const alto = Math.max(fila, temas.length * fila)
  const cuerpo = temas.map((t, i) => {
    const y = i * fila
    const w = Math.max(3, (t.minutos / max) * (ancho - etiqueta - valor - 8))
    const nombre = t.tema.length > 14 ? `${t.tema.slice(0, 13)}…` : t.tema
    const color = COLORES_TEMA[i % COLORES_TEMA.length] ?? GRIS
    return `<text x="0" y="${y + 16}" font-family="${FUENTE}" font-size="12" fill="${GRIS}">${esc(nombre)}<title>${esc(t.tema)}</title></text>` +
      `<rect x="${etiqueta}" y="${y + 5}" width="${r1(w)}" height="14" rx="4" fill="${color}"/>` +
      `<text x="${r1(etiqueta + w + 6)}" y="${y + 16}" font-family="${FUENTE}" font-size="12" font-weight="600" fill="${color}">${esc(formato(t.minutos))}</text>`
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

/**
 * Columnas para series largas (30 días): etiqueta cada `cada` columnas, el
 * valor de cada una en su <title> y el máximo marcado arriba.
 */
export function columnas(
  valores: readonly number[],
  etiquetas: readonly string[],
  opciones: { color?: string; cada?: number; destacar?: number } = {},
): string {
  const ancho = 320
  const alto = 120
  const base = 96
  const color = opciones.color ?? COLOR_FASE.descansoLargo
  const cada = opciones.cada ?? 7
  const max = Math.max(1, ...valores)
  const paso = ancho / Math.max(1, valores.length)
  const w = Math.max(2, paso * 0.7)
  const cuerpo = valores.map((v, i) => {
    const h = v === 0 ? 1.5 : Math.max(3, (v / max) * 76)
    const x = paso * i + (paso - w) / 2
    const fuerte = opciones.destacar === i
    return `<rect x="${r1(x)}" y="${r1(base - h)}" width="${r1(w)}" height="${r1(h)}" rx="2" fill="${v === 0 ? GRIS : color}" fill-opacity="${v === 0 ? 0.3 : fuerte ? 1 : 0.78}"><title>${esc(etiquetas[i] ?? '')}: ${v}</title></rect>` +
      (i % cada === 0 ? `<text x="${r1(x + w / 2)}" y="${base + 16}" text-anchor="middle" font-family="${FUENTE}" font-size="10" fill="${GRIS}">${esc(etiquetas[i] ?? '')}</text>` : '')
  }).join('')
  const pico = valores.indexOf(Math.max(...valores))
  const marca = max > 0 && pico >= 0 && (valores[pico] ?? 0) > 0
    ? `<text x="${r1(paso * pico + paso / 2)}" y="${r1(base - ((valores[pico] ?? 0) / max) * 76 - 5)}" text-anchor="middle" font-family="${FUENTE}" font-size="11" font-weight="700" fill="${color}">${valores[pico]}</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${cuerpo}${marca}</svg>`
}

/** Curva de un porcentaje (0–100) por día; los días sin dato cortan la línea. */
export function curva(valores: readonly (number | null)[], etiquetas: readonly string[], color = COLOR_FASE.descanso): string {
  const ancho = 320
  const alto = 130
  const izq = 28
  const arriba = 8
  const base = 104
  const paso = (ancho - izq - 6) / Math.max(1, valores.length - 1)
  const y = (v: number) => base - (v / 100) * (base - arriba)
  const guias = [0, 50, 100].map(v =>
    `<line x1="${izq}" x2="${ancho}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="${GRIS}" stroke-opacity="0.2" stroke-dasharray="${v === 0 ? '' : '3 3'}"/>` +
    `<text x="${izq - 4}" y="${r1(y(v) + 3)}" text-anchor="end" font-family="${FUENTE}" font-size="10" fill="${GRIS}">${v}%</text>`).join('')
  const tramos: string[][] = [[]]
  const puntos: string[] = []
  valores.forEach((v, i) => {
    const x = izq + paso * i
    if (v === null) {
      if ((tramos[tramos.length - 1] ?? []).length > 0) tramos.push([])
      return
    }
    tramos[tramos.length - 1]?.push(`${r1(x)},${r1(y(v))}`)
    puntos.push(`<circle cx="${r1(x)}" cy="${r1(y(v))}" r="2.6" fill="${color}"><title>${esc(etiquetas[i] ?? '')}: ${v}%</title></circle>`)
  })
  const lineas = tramos.filter(t => t.length > 1).map(t => {
    const primero = t[0]?.split(',')[0] ?? '0'
    const ultimo = t[t.length - 1]?.split(',')[0] ?? '0'
    return `<polygon points="${primero},${base} ${t.join(' ')} ${ultimo},${base}" fill="${color}" fill-opacity="0.12"/>` +
      `<polyline points="${t.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`
  }).join('')
  // la última solo si no pisa a la anterior
  const ultima = etiquetas.length - 1
  const marcas = etiquetas.map((e, i) => (i % 7 === 0 || (i === ultima && ultima % 7 > 3)
    ? `<text x="${r1(izq + paso * i)}" y="${base + 16}" text-anchor="middle" font-family="${FUENTE}" font-size="10" fill="${GRIS}">${esc(e)}</text>` : '')).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${guias}${lineas}${puntos.join('')}${marcas}</svg>`
}

/** Mapa de calor hora × día de la semana: cuándo sueles estudiar. */
export function horarioCalor(matriz: readonly (readonly number[])[]): string {
  const celda = 11
  const hueco = 2
  const izq = 18
  const arriba = 14
  const max = Math.max(1, ...matriz.flat())
  const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
  const cuerpo = matriz.map((fila, d) => fila.map((v, h) => {
    const nivel = v <= 0 ? -1 : Math.min(3, Math.floor((v / max) * 4 - 1e-9))
    const color = nivel < 0 ? GRIS : VERDES[nivel] ?? VERDES[3]
    return `<rect x="${izq + h * (celda + hueco)}" y="${arriba + d * (celda + hueco)}" width="${celda}" height="${celda}" rx="2" fill="${color}" fill-opacity="${nivel < 0 ? 0.15 : 1}"><title>${dias[d]} ${h}:00 · ${Math.round(v)} min</title></rect>`
  }).join('')).join('')
  const horas = [0, 6, 12, 18, 23].map(h => `<text x="${izq + h * (celda + hueco) + celda / 2}" y="10" text-anchor="middle" font-family="${FUENTE}" font-size="9" fill="${GRIS}">${h}h</text>`).join('')
  const filas = dias.map((t, d) => `<text x="0" y="${arriba + d * (celda + hueco) + 9}" font-family="${FUENTE}" font-size="9" fill="${GRIS}">${t}</text>`).join('')
  const ancho = izq + 24 * (celda + hueco)
  const alto = arriba + 7 * (celda + hueco)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${horas}${filas}${cuerpo}</svg>`
}

/** Histograma con etiquetas bajo cada barra (p. ej. la dificultad de 1 a 10). */
export function histograma(valores: readonly number[], etiquetas: readonly string[], color = COLOR_FASE.enfoque): string {
  return barras(valores.map((valor, i) => ({ etiqueta: etiquetas[i] ?? '', valor, esHoy: false }))).replace(new RegExp(COLOR_FASE.enfoque, 'g'), color)
}

/** La tarjeta de nivel: anillo con el número, título y barra de experiencia. */
export function tarjetaNivel(n: { nivel: number; titulo: string; xp: number; desde: number; hasta: number; logros: number; total: number }): string {
  const ancho = 320
  const alto = 96
  const hecho = Math.min(1, Math.max(0, (n.xp - n.desde) / Math.max(1, n.hasta - n.desde)))
  const r = 34
  const c = 2 * Math.PI * r
  const barra = 180
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">` +
    `<defs><linearGradient id="xp" x1="0" x2="1"><stop offset="0" stop-color="#F6B04A"/><stop offset="1" stop-color="#E8553F"/></linearGradient></defs>` +
    `<circle cx="46" cy="48" r="${r}" fill="none" stroke="${GRIS}" stroke-opacity="0.2" stroke-width="7"/>` +
    `<circle cx="46" cy="48" r="${r}" fill="none" stroke="url(#xp)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${r1(c)}" stroke-dashoffset="${r1(c * (1 - hecho))}" transform="rotate(-90 46 48)"/>` +
    `<text x="46" y="45" text-anchor="middle" font-family="${FUENTE}" font-size="10" fill="${GRIS}">NIVEL</text>` +
    `<text x="46" y="64" text-anchor="middle" font-family="${FUENTE}" font-size="22" font-weight="800" fill="#E8553F">${n.nivel}</text>` +
    `<text x="98" y="36" font-family="${FUENTE}" font-size="18" font-weight="800" fill="#E8553F">${esc(n.titulo)}</text>` +
    `<rect x="98" y="48" width="${barra}" height="10" rx="5" fill="${GRIS}" fill-opacity="0.2"/>` +
    `<rect x="98" y="48" width="${r1(Math.max(4, barra * hecho))}" height="10" rx="5" fill="url(#xp)"/>` +
    `<text x="98" y="76" font-family="${FUENTE}" font-size="11" fill="${GRIS}">${n.xp - n.desde} / ${n.hasta - n.desde} XP para el nivel ${n.nivel + 1} · 🏆 ${n.logros}/${n.total}</text>` +
    `</svg>`
}

/** Medidores semicirculares (0–100 %) con su etiqueta: el estado del plan de examen. */
export function medidores(items: readonly { valor: number; etiqueta: string; color: string }[]): string {
  const cada = 104
  const ancho = cada * items.length
  const alto = 82
  const r = 36
  const cuerpo = items.map((it, i) => {
    const cx = i * cada + cada / 2
    const cy = 50
    const v = Math.min(100, Math.max(0, it.valor)) / 100
    const arco = (hasta: number) => {
      const a = Math.PI * (1 - hasta)
      return `M${r1(cx - r)} ${cy} A${r} ${r} 0 0 1 ${r1(cx + r * Math.cos(a))} ${r1(cy - r * Math.sin(a))}`
    }
    return `<path d="${arco(1)}" fill="none" stroke="${GRIS}" stroke-opacity="0.2" stroke-width="9" stroke-linecap="round"/>` +
      (v > 0 ? `<path d="${arco(v)}" fill="none" stroke="${it.color}" stroke-width="9" stroke-linecap="round"/>` : '') +
      `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="${FUENTE}" font-size="17" font-weight="800" fill="${it.color}">${Math.round(it.valor)}%</text>` +
      `<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-family="${FUENTE}" font-size="11" fill="${GRIS}">${esc(it.etiqueta)}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${cuerpo}</svg>`
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
