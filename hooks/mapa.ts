// Mapas mentales: un esquema en Markdown (lista anidada) dibujado como árbol.
import { COLORES_TEMA } from './graficos'

export type Nodo = { texto: string; hijos: Nodo[] }
export type Mapa = { titulo: string; raiz: Nodo }

const MAX_NODOS = 90
const MAX_PROFUNDIDAD = 4

/** Quita el formato en línea de una etiqueta: **negrita**, *cursiva*, `código`, [enlaces](…). */
const limpiar = (s: string) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Lee un mapa: el título `# Mapa mental: X` es la raíz y la lista anidada,
 * sus ramas. Sin título, una lista con un solo elemento arriba es la raíz.
 */
export function leerMapa(md: string): Mapa | undefined {
  let titulo: string | undefined
  const raiz: Nodo = { texto: '', hijos: [] }
  const pila: { sangria: number; nodo: Nodo }[] = [{ sangria: -1, nodo: raiz }]
  let nodos = 0
  for (const linea of md.replace(/\r\n?/g, '\n').split('\n')) {
    const cabecera = /^#\s+(.+?)\s*#*\s*$/.exec(linea)
    if (cabecera && titulo === undefined) {
      titulo = limpiar((cabecera[1] ?? '').replace(/^mapa mental\s*[:·-]\s*/i, ''))
      continue
    }
    const item = /^(\s*)(?:[-*+]|\d+[.)])\s+(.+)$/.exec(linea)
    if (!item || nodos >= MAX_NODOS) continue
    const sangria = (item[1] ?? '').replace(/\t/g, '  ').length
    const texto = limpiar(item[2] ?? '')
    if (texto === '') continue
    while (pila.length > 1 && sangria <= (pila[pila.length - 1]?.sangria ?? -1)) pila.pop()
    if (pila.length > MAX_PROFUNDIDAD) continue
    const nodo: Nodo = { texto, hijos: [] }
    pila[pila.length - 1]?.nodo.hijos.push(nodo)
    pila.push({ sangria, nodo })
    nodos++
  }
  // un título sin ramas no es un mapa
  if (raiz.hijos.length === 0) return undefined
  if (titulo !== undefined && titulo !== '') return { titulo, raiz: { texto: titulo, hijos: raiz.hijos } }
  const unica = raiz.hijos.length === 1 ? raiz.hijos[0] : undefined
  if (unica !== undefined) return { titulo: unica.texto, raiz: unica }
  return { titulo: 'Mapa mental', raiz: { texto: 'Mapa mental', hijos: raiz.hijos } }
}

/** El mapa como árbol de texto para la terminal: ├─ └─ │ */
export function arbolTexto(mapa: Mapa): string[] {
  const lineas = [`🧠 ${mapa.raiz.texto}`]
  const recorrer = (nodo: Nodo, prefijo: string) => {
    nodo.hijos.forEach((h, i) => {
      const ultimo = i === nodo.hijos.length - 1
      lineas.push(`${prefijo}${ultimo ? '└─ ' : '├─ '}${h.texto}`)
      recorrer(h, `${prefijo}${ultimo ? '   ' : '│  '}`)
    })
  }
  recorrer(mapa.raiz, '')
  return lineas
}

// ── Dibujo ──────────────────────────────────────────────────────────────────

const FUENTE = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Parte una etiqueta en líneas de unos `max` caracteres (como mucho 3). */
export function partir(texto: string, max = 18): string[] {
  const lineas: string[] = []
  let actual = ''
  for (const palabra of texto.split(' ')) {
    if (actual !== '' && (actual + ' ' + palabra).length > max) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = actual === '' ? palabra : `${actual} ${palabra}`
    }
  }
  if (actual !== '') lineas.push(actual)
  if (lineas.length > 3) return [...lineas.slice(0, 2), `${(lineas[2] ?? '').slice(0, max - 1)}…`]
  return lineas.map(l => (l.length > max + 4 ? `${l.slice(0, max + 3)}…` : l))
}

/** Mezcla un color con blanco: el fondo pastel de cada rama. */
function pastel(hex: string, blanco = 0.82): string {
  const n = parseInt(hex.slice(1), 16)
  const canal = (c: number) => Math.round(c + (255 - c) * blanco).toString(16).padStart(2, '0')
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`
}

type Colocado = { nodo: Nodo; x: number; y: number; w: number; h: number; lineas: string[]; nivel: number; color: string }

/**
 * Dibuja el mapa como árbol horizontal: la raíz a la izquierda, cada nivel en
 * su columna, las hojas repartidas en vertical y cada rama con su color.
 */
export function mapaSvg(mapa: Mapa): string {
  const columna = 178
  const fila = 54
  const linea = 15
  const anchoNodo = (nivel: number) => (nivel === 0 ? 150 : 140)
  const colocados: Colocado[] = []
  let hoja = 0
  const colocar = (nodo: Nodo, nivel: number, color: string): Colocado => {
    const lineas = partir(nodo.texto, nivel === 0 ? 16 : 18)
    const h = lineas.length * linea + 14
    const hijos = nodo.hijos.map((hijo, i) => colocar(hijo, nivel + 1, nivel === 0 ? COLORES_TEMA[i % COLORES_TEMA.length] ?? color : color))
    const y = hijos.length > 0
      ? ((hijos[0]?.y ?? 0) + (hijos[hijos.length - 1]?.y ?? 0)) / 2
      : hoja++ * fila + fila / 2
    const c: Colocado = { nodo, x: nivel * columna, y, w: anchoNodo(nivel), h, lineas, nivel, color }
    colocados.push(c)
    return c
  }
  colocar(mapa.raiz, 0, '#E8553F')
  const niveles = Math.max(...colocados.map(c => c.nivel)) + 1
  const ancho = (niveles - 1) * columna + anchoNodo(niveles - 1) + 8
  const alto = Math.max(fila, hoja * fila)
  const porNodo = new Map(colocados.map(c => [c.nodo, c]))

  const enlaces: string[] = []
  for (const c of colocados) {
    for (const hijo of c.nodo.hijos) {
      const d = porNodo.get(hijo)
      if (d === undefined) continue
      const x1 = c.x + c.w
      const x2 = d.x
      const medio = (x1 + x2) / 2
      enlaces.push(`<path d="M${x1} ${c.y} C${medio} ${c.y} ${medio} ${d.y} ${x2} ${d.y}" fill="none" stroke="${d.color}" stroke-opacity="0.7" stroke-width="${c.nivel === 0 ? 2.5 : 1.6}"/>`)
    }
  }
  const cajas = colocados.map(c => {
    const esRaiz = c.nivel === 0
    const fondo = esRaiz ? c.color : c.nivel === 1 ? pastel(c.color, 0.78) : '#FFFFFF'
    const texto = esRaiz ? '#FFFFFF' : '#1F2328'
    const y0 = c.y - c.h / 2
    const textos = c.lineas.map((l, i) =>
      `<text x="${c.x + c.w / 2}" y="${y0 + 18 + i * linea}" text-anchor="middle" font-family="${FUENTE}" font-size="${esRaiz ? 13 : 12}" font-weight="${c.nivel <= 1 ? 700 : 500}" fill="${texto}">${esc(l)}</text>`,
    ).join('')
    return `<g><title>${esc(c.nodo.texto)}</title><rect x="${c.x}" y="${y0}" width="${c.w}" height="${c.h}" rx="${esRaiz ? 14 : 9}" fill="${fondo}" stroke="${c.color}" stroke-width="${c.nivel <= 1 ? 1.6 : 1.2}"/>${textos}</g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${ancho + 8} ${alto + 8}" width="${ancho + 8}" height="${alto + 8}">${enlaces.join('')}${cajas}</svg>`
}
