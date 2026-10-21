// Exportar e importar tarjetas en el formato de texto de Anki.
import type { Tarjeta } from '../types'
import { L } from './i18n'

export type TarjetaSimple = { frente: string; reverso: string; fuente?: string }

const limpiarCampo = (s: string) => s.replace(/[\t\r\n]+/g, ' ').trim()

/**
 * Texto que Anki importa directamente (Archivo → Importar): separado por
 * tabuladores, con la fuente como etiqueta y el mazo con el nombre del cuaderno.
 */
export function exportar(tarjetas: readonly Tarjeta[], mazo: string): string {
  const etiqueta = (f?: string) =>
    f === undefined ? '' : f.replace(/,?\s*(p\.|pág\.?|§).*$/i, '').trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_.-]/gu, '')
  const cabecera = [
    '#separator:tab',
    '#html:false',
    `#deck:${limpiarCampo(mazo)}`,
    '#tags column:3',
  ]
  const filas = tarjetas.map(t => [limpiarCampo(t.frente), limpiarCampo(t.reverso), `estudio ${etiqueta(t.fuente)}`.trim()].join('\t'))
  return [...cabecera, ...filas].join('\n') + '\n'
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Quita el HTML que Anki suele exportar en los campos. */
export function sinHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|p|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => {
      const codigo = e.startsWith('#x') || e.startsWith('#X') ? parseInt(e.slice(2), 16) : e.startsWith('#') ? Number(e.slice(1)) : undefined
      // un código fuera de Unicode (exportación dañada) se deja tal cual en vez de abortar la importación
      if (codigo !== undefined) return codigo <= 0x10ffff ? String.fromCodePoint(codigo) : m
      return ENTIDADES[e.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Separa una línea CSV respetando comillas dobles. */
function camposCsv(linea: string, sep: string): string[] {
  const campos: string[] = []
  let actual = ''
  let comillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else if (c === '"') comillas = false
      else actual += c
    } else if (c === '"' && actual === '') comillas = true
    else if (c === sep) {
      campos.push(actual)
      actual = ''
    } else actual += c
  }
  campos.push(actual)
  return campos
}

/**
 * Lee tarjetas de un texto de Anki (tabuladores), CSV (`,` o `;`) o líneas
 * «frente :: reverso». Las líneas que empiezan por # son cabeceras.
 */
export function importar(texto: string): { tarjetas: TarjetaSimple[]; ignoradas: number } {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '' && !l.startsWith('#'))
  const muestra = lineas.slice(0, 20).join('\n')
  const sep = muestra.includes('\t') ? '\t' : muestra.includes(' :: ') ? ' :: ' : (muestra.match(/;/g)?.length ?? 0) > (muestra.match(/,/g)?.length ?? 0) ? ';' : ','
  const tarjetas: TarjetaSimple[] = []
  let ignoradas = 0
  for (const linea of lineas) {
    const campos = sep === ' :: ' ? linea.split(' :: ') : sep === '\t' ? linea.split('\t') : camposCsv(linea, sep)
    const [frente = '', reverso = ''] = campos.map(sinHtml)
    if (frente === '' || reverso === '') {
      ignoradas++
      continue
    }
    tarjetas.push({ frente, reverso, fuente: L('importada', 'imported') })
  }
  return { tarjetas, ignoradas }
}
