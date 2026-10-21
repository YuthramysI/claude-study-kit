// Cuadernos: una carpeta por tema con fuentes/, salidas/ y tarjetas.json.
import type { InfoCuaderno, PlanExamen, Tarjeta } from '../types'
import { sanear as sanearPlan } from './plan'
import type { Host } from './host'
import { L } from './i18n'

const CLAVE_ACTIVO = 'cuadernoActivo'
/** Carpetas que el propio plugin crea en la raíz y que no son cuadernos. */
export const RESERVADAS = ['diario', 'informes']

const EXTENSIONES = /\.(pdf|md|markdown|txt|text|html?|csv|json|tex|rst|org|docx?|pptx?|png|jpe?g|webp)$/i

export function raiz(h: Host, carpeta: string): string {
  const limpia = carpeta.trim().replace(/\/+$/, '') || '~/estudio'
  if (limpia === '~' || limpia.startsWith('~/')) return h.home + limpia.slice(1)
  return limpia
}

/** Nombre válido de cuaderno: letras, números, espacios, `-` y `_`. */
export function nombreValido(nombre: string): string | undefined {
  const n = nombre.trim()
  if (n === '' || n.length > 64 || n.startsWith('.') || RESERVADAS.includes(n.toLowerCase())) return undefined
  return /^[\p{L}\p{N} _-]+$/u.test(n) ? n : undefined
}

export async function listar(h: Host, base: string): Promise<string[]> {
  if (!(await h.fs.exists(base))) return []
  const entradas = await h.fs.list(base)
  return entradas
    .filter(e => e.kind === 'dir' && !e.name.startsWith('.') && !RESERVADAS.includes(e.name.toLowerCase()))
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b))
}

export async function crear(h: Host, base: string, nombre: string): Promise<string> {
  const ruta = `${base}/${nombre}`
  // un cuaderno recién creado no ha visto ninguna fuente: todo lo que llegue será nuevo
  if (!(await h.fs.exists(ruta))) await h.storeSet(claveVistas(ruta), [])
  if (!(await h.fs.exists(`${ruta}/fuentes/.leeme`))) {
    await h.fs.write(
      `${ruta}/fuentes/.leeme`,
      L('Pon aquí tus materiales: PDF, Markdown, texto, imágenes de apuntes...\n', 'Put your materials here: PDF, Markdown, text, photos of notes...\n'),
    )
  }
  if (!(await h.fs.exists(`${ruta}/salidas/.leeme`))) {
    await h.fs.write(`${ruta}/salidas/.leeme`, L('Aquí guarda Claude las guías, quizzes y guiones.\n', 'Claude saves guides, quizzes and scripts here.\n'))
  }
  if (!(await h.fs.exists(`${ruta}/tarjetas.json`))) {
    await h.fs.write(`${ruta}/tarjetas.json`, '[]\n')
  }
  return ruta
}

export async function fuentes(h: Host, ruta: string): Promise<string[]> {
  const carpeta = `${ruta}/fuentes`
  if (!(await h.fs.exists(carpeta))) return []
  const salida: string[] = []
  const recorrer = async (dir: string, prefijo: string, profundidad: number) => {
    for (const e of await h.fs.list(dir)) {
      if (e.name.startsWith('.')) continue
      if (e.kind === 'dir' && profundidad < 3) {
        await recorrer(`${dir}/${e.name}`, `${prefijo}${e.name}/`, profundidad + 1)
      } else if (e.kind === 'file' && EXTENSIONES.test(e.name)) {
        salida.push(`${prefijo}${e.name}`)
      }
    }
  }
  await recorrer(carpeta, '', 0)
  return salida.sort((a, b) => a.localeCompare(b))
}

export async function info(h: Host, base: string, nombre: string): Promise<InfoCuaderno> {
  const ruta = `${base}/${nombre}`
  const lista = await fuentes(h, ruta)
  const vistas = await fuentesVistas(h, ruta)
  if (vistas === undefined) {
    // cuaderno de antes de esta función: lo que ya tenía no cuenta como nuevo
    await h.storeSet(claveVistas(ruta), lista)
    return { nombre, ruta, fuentes: lista, nuevas: [] }
  }
  const conocidas = new Set(vistas)
  return { nombre, ruta, fuentes: lista, nuevas: lista.filter(f => !conocidas.has(f)) }
}

const claveVistas = (ruta: string) => `fuentesVistas:${ruta}`

async function fuentesVistas(h: Host, ruta: string): Promise<string[] | undefined> {
  const v = await h.storeGet(claveVistas(ruta))
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
}

/** Da por vistas estas fuentes (resumidas o ignoradas): dejan de salir como nuevas. */
export async function marcarVistas(h: Host, ruta: string, archivos: readonly string[]) {
  const vistas = new Set((await fuentesVistas(h, ruta)) ?? [])
  for (const a of archivos) vistas.add(a)
  // solo se guardan las que siguen existiendo
  const actuales = new Set(await fuentes(h, ruta))
  await h.storeSet(claveVistas(ruta), [...vistas].filter(a => actuales.has(a)).sort())
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'] as const

export type Lectura = { tarjetas: Tarjeta[]; aviso?: string }

/**
 * Lee tarjetas.json. Si está dañado, guarda la copia dañada aparte y recupera
 * la última copia de seguridad buena (tarjetas.bak.json o .respaldos/).
 */
export async function leerTarjetas(h: Host, ruta: string): Promise<Lectura> {
  const archivo = `${ruta}/tarjetas.json`
  if (!(await h.fs.exists(archivo))) return { tarjetas: [] }
  const texto = await h.fs.read(archivo)
  const leidas = interpretar(texto)
  if (leidas !== undefined) return { tarjetas: leidas }

  // un nombre por contenido: releer el mismo archivo dañado no crea copias nuevas
  const danado = `${ruta}/tarjetas.danado-${huella(texto)}.json`
  if (!(await h.fs.exists(danado))) await h.fs.write(danado, texto)
  for (const copia of await copiasDeSeguridad(h, ruta)) {
    const recuperadas = interpretar(await h.fs.read(copia).catch(() => ''))
    if (recuperadas === undefined) continue
    await h.fs.write(archivo, JSON.stringify(recuperadas, null, 2) + '\n')
    return {
      tarjetas: recuperadas,
      aviso: L(
        `tarjetas.json estaba dañado: recuperé ${recuperadas.length} tarjetas de ${copia.slice(ruta.length + 1)}. El archivo dañado quedó en ${danado.slice(ruta.length + 1)}.`,
        `tarjetas.json was damaged: recovered ${recuperadas.length} cards from ${copia.slice(ruta.length + 1)}. The damaged file was kept as ${danado.slice(ruta.length + 1)}.`,
      ),
    }
  }
  return {
    tarjetas: [],
    aviso: L(
      `tarjetas.json está dañado y no hay copia de seguridad válida. Lo guardé en ${danado.slice(ruta.length + 1)}; revísalo a mano.`,
      `tarjetas.json is damaged and there is no valid backup. It was saved as ${danado.slice(ruta.length + 1)}; check it by hand.`,
    ),
  }
}

/** Las copias de seguridad, de la más reciente a la más antigua. */
async function copiasDeSeguridad(h: Host, ruta: string): Promise<string[]> {
  const copias: { ruta: string; mtime: number }[] = []
  if (await h.fs.exists(`${ruta}/tarjetas.bak.json`)) copias.push({ ruta: `${ruta}/tarjetas.bak.json`, mtime: Infinity })
  if (await h.fs.exists(`${ruta}/.respaldos`)) {
    for (const e of await h.fs.list(`${ruta}/.respaldos`)) {
      if (e.kind === 'file' && e.name.endsWith('.json')) copias.push({ ruta: `${ruta}/.respaldos/${e.name}`, mtime: e.mtimeMs })
    }
  }
  return copias.sort((a, b) => b.mtime - a.mtime).map(c => c.ruta)
}

/** Lista de tarjetas válidas, o undefined si el texto no es un JSON de lista. */
export function interpretar(texto: string): Tarjeta[] | undefined {
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    return undefined
  }
  if (!Array.isArray(datos)) return undefined
  return datos.flatMap((x, i) => {
    const t = normalizar(x, i)
    return t === undefined ? [] : [t]
  })
}

/**
 * Acepta tarjetas escritas a mano: basta con `frente` y `reverso`; lo demás
 * se completa (nueva, vence ya).
 */
export function normalizar(x: unknown, i: number): Tarjeta | undefined {
  if (typeof x !== 'object' || x === null) return undefined
  const t = x as Record<string, unknown>
  if (typeof t.frente !== 'string' || typeof t.reverso !== 'string') return undefined
  if (t.frente.trim() === '' || t.reverso.trim() === '') return undefined
  const num = (v: unknown, defecto: number) => (typeof v === 'number' && Number.isFinite(v) ? v : defecto)
  return {
    id: typeof t.id === 'string' && t.id !== '' ? t.id : `m${i}-${huella(t.frente)}`,
    frente: t.frente,
    reverso: t.reverso,
    ...(typeof t.fuente === 'string' && t.fuente !== '' ? { fuente: t.fuente } : {}),
    intervalo: Math.max(0, num(t.intervalo, 0)),
    facilidad: Math.max(1.3, num(t.facilidad, 2.5)),
    repeticiones: Math.max(0, Math.round(num(t.repeticiones, 0))),
    vence: typeof t.vence === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.vence) ? t.vence : '0000-00-00',
    ultimo: num(t.ultimo, 0),
    ...(typeof t.estabilidad === 'number' && t.estabilidad > 0 ? { estabilidad: t.estabilidad } : {}),
    ...(typeof t.dificultad === 'number' && Number.isFinite(t.dificultad) ? { dificultad: Math.min(10, Math.max(1, t.dificultad)) } : {}),
    ...(typeof t.primera === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.primera) ? { primera: t.primera } : {}),
  }
}

function huella(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/**
 * Guarda tarjetas.json dejando la versión anterior en tarjetas.bak.json y una
 * instantánea por día de la semana en .respaldos/ (una semana de historia).
 */
export async function guardarTarjetas(h: Host, ruta: string, tarjetas: readonly Tarjeta[], ahora: number) {
  const archivo = `${ruta}/tarjetas.json`
  const texto = JSON.stringify(tarjetas, null, 2) + '\n'
  if (await h.fs.exists(archivo)) {
    const anterior = await h.fs.read(archivo)
    if (anterior === texto) return
    if (interpretar(anterior) !== undefined) await h.fs.write(`${ruta}/tarjetas.bak.json`, anterior)
  }
  await h.fs.write(archivo, texto)
  const dia = DIAS_SEMANA[new Date(ahora).getDay()] ?? 'dom'
  await h.fs.write(`${ruta}/.respaldos/tarjetas-${dia}.json`, texto)
}

export async function leerPlan(h: Host, ruta: string): Promise<PlanExamen | null> {
  const archivo = `${ruta}/plan.json`
  if (!(await h.fs.exists(archivo))) return null
  try {
    return sanearPlan(JSON.parse(await h.fs.read(archivo)))
  } catch {
    return null
  }
}

/** Guarda el plan de examen del cuaderno (null lo quita). */
export async function guardarPlan(h: Host, ruta: string, plan: PlanExamen | null) {
  await h.fs.write(`${ruta}/plan.json`, plan === null ? 'null\n' : JSON.stringify(plan, null, 2) + '\n')
}

export async function activo(h: Host): Promise<string | undefined> {
  const v = await h.storeGet(CLAVE_ACTIVO)
  return typeof v === 'string' ? v : undefined
}

export async function fijarActivo(h: Host, nombre: string) {
  await h.storeSet(CLAVE_ACTIVO, nombre)
}
