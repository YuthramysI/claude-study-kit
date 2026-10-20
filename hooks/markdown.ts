// Markdown → HTML, lo justo para las guías, quizzes y guiones que escribe Claude.
// Todo el texto se escapa; los enlaces solo admiten http(s).

export const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Formato dentro de una línea: código, negrita, cursiva, tachado y enlaces. */
export function enLinea(texto: string): string {
  const codigos: string[] = []
  let s = escapar(texto).replace(/`([^`]+)`/g, (_, c: string) => {
    codigos.push(`<code>${c}</code>`)
    return `\u0000${codigos.length - 1}\u0000`
  })
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codigos[Number(i)] ?? '')
}

type Lista = { tipo: 'ul' | 'ol'; sangria: number }

/** Convierte un documento Markdown en HTML (bloques y formato en línea). */
export function aHtml(md: string): string {
  const lineas = md.replace(/\r\n?/g, '\n').split('\n')
  const salida: string[] = []
  const listas: Lista[] = []
  let parrafo: string[] = []
  let i = 0

  const cerrarParrafo = () => {
    if (parrafo.length > 0) salida.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`)
    parrafo = []
  }
  const cerrarListas = (hasta = 0) => {
    while (listas.length > hasta) salida.push(`</li></${listas.pop()?.tipo ?? 'ul'}>`)
  }

  while (i < lineas.length) {
    const linea = lineas[i] ?? ''

    // bloque de código
    const valla = /^\s*(```|~~~)\s*([\w+-]*)/.exec(linea)
    if (valla) {
      cerrarParrafo()
      cerrarListas()
      const cuerpo: string[] = []
      i++
      while (i < lineas.length && !(lineas[i] ?? '').trim().startsWith(valla[1] ?? '```')) cuerpo.push(lineas[i++] ?? '')
      i++
      salida.push(`<pre><code>${escapar(cuerpo.join('\n'))}</code></pre>`)
      continue
    }

    if (linea.trim() === '') {
      cerrarParrafo()
      // una línea en blanco no cierra la lista si sigue otro elemento
      const siguiente = lineas[i + 1] ?? ''
      if (!/^\s*([-*+]|\d+[.)])\s+/.test(siguiente)) cerrarListas()
      i++
      continue
    }

    const titulo = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(linea)
    if (titulo) {
      cerrarParrafo()
      cerrarListas()
      const n = (titulo[1] ?? '#').length
      salida.push(`<h${n}>${enLinea(titulo[2] ?? '')}</h${n}>`)
      i++
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linea)) {
      cerrarParrafo()
      cerrarListas()
      salida.push('<hr>')
      i++
      continue
    }

    // tabla: cabecera | separador | filas
    const sep = lineas[i + 1] ?? ''
    if (linea.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(sep)) {
      cerrarParrafo()
      cerrarListas()
      const celdas = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
      const cabecera = celdas(linea)
      const filas: string[][] = []
      i += 2
      while (i < lineas.length && (lineas[i] ?? '').includes('|') && (lineas[i] ?? '').trim() !== '') filas.push(celdas(lineas[i++] ?? ''))
      salida.push(
        `<table><thead><tr>${cabecera.map(c => `<th>${enLinea(c)}</th>`).join('')}</tr></thead>` +
        `<tbody>${filas.map(f => `<tr>${f.map(c => `<td>${enLinea(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      )
      continue
    }

    if (/^\s*>/.test(linea)) {
      cerrarParrafo()
      cerrarListas()
      const cita: string[] = []
      while (i < lineas.length && /^\s*>/.test(lineas[i] ?? '')) cita.push((lineas[i++] ?? '').replace(/^\s*>\s?/, ''))
      salida.push(`<blockquote>${aHtml(cita.join('\n'))}</blockquote>`)
      continue
    }

    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(linea)
    if (item) {
      cerrarParrafo()
      const sangria = (item[1] ?? '').replace(/\t/g, '  ').length
      const tipo: Lista['tipo'] = /\d/.test(item[2] ?? '') ? 'ol' : 'ul'
      const ultima = listas[listas.length - 1]
      if (ultima === undefined || sangria > ultima.sangria) {
        listas.push({ tipo, sangria })
        salida.push(`<${tipo}><li>`)
      } else {
        while (listas.length > 1 && sangria < (listas[listas.length - 1]?.sangria ?? 0)) salida.push(`</li></${listas.pop()?.tipo ?? 'ul'}>`)
        salida.push('</li><li>')
      }
      const casilla = /^\[([ xX])\]\s+(.*)$/.exec(item[3] ?? '')
      salida.push(casilla ? `${casilla[1] === ' ' ? '☐' : '☑'} ${enLinea(casilla[2] ?? '')}` : enLinea(item[3] ?? ''))
      i++
      continue
    }

    if (listas.length > 0 && /^\s{2,}\S/.test(linea)) {
      // continuación de un elemento de lista
      salida.push(`<br>${enLinea(linea.trim())}`)
      i++
      continue
    }

    cerrarListas()
    parrafo.push(linea.trim())
    i++
  }
  cerrarParrafo()
  cerrarListas()
  return salida.join('\n')
}
