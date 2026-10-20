import { describe, expect, test } from 'claude-code/testing'

import { arbolTexto, leerMapa, mapaSvg, partir } from './mapa'
import { documentoRepaso } from './pdf'

const MD = `# Mapa mental: La **célula**

- Tipos
  - Procariota
    - Sin núcleo
  - Eucariota
- Orgánulos
  - [Mitocondria](https://x.es): *energía*
  - Ribosoma
`

describe('mapas mentales', () => {
  test('lee el título como raíz y la lista anidada como ramas, sin formato', async () => {
    const m = leerMapa(MD)
    expect(m?.titulo).toBe('La célula')
    expect(m?.raiz.hijos.map(h => h.texto)).toEqual(['Tipos', 'Orgánulos'])
    expect(m?.raiz.hijos[0]?.hijos[0]?.hijos[0]?.texto).toBe('Sin núcleo')
    expect(m?.raiz.hijos[1]?.hijos[0]?.texto).toBe('Mitocondria: energía')
  })

  test('sin título, una sola rama arriba es la raíz; sin lista no hay mapa', async () => {
    const m = leerMapa('- Agua\n  - Estados\n  - Ciclo')
    expect(m?.titulo).toBe('Agua')
    expect(m?.raiz.hijos.length).toBe(2)
    expect(leerMapa('# Solo un título\n\nTexto suelto.')).toBeUndefined()
  })

  test('limita la profundidad y el número de nodos', async () => {
    const hondo = leerMapa('# R\n- a\n  - b\n    - c\n      - d\n        - e')
    expect(arbolTexto(hondo ?? { titulo: '', raiz: { texto: '', hijos: [] } }).length).toBe(5)
    const enorme = leerMapa('# R\n' + Array.from({ length: 200 }, (_, i) => `- n${i}`).join('\n'))
    expect(enorme?.raiz.hijos.length).toBe(90)
  })

  test('árbol de texto para la terminal', async () => {
    const m = leerMapa(MD)
    expect(m === undefined ? [] : arbolTexto(m)).toEqual([
      '🧠 La célula',
      '├─ Tipos',
      '│  ├─ Procariota',
      '│  │  └─ Sin núcleo',
      '│  └─ Eucariota',
      '└─ Orgánulos',
      '   ├─ Mitocondria: energía',
      '   └─ Ribosoma',
    ])
  })

  test('el SVG tiene una caja por nodo y un enlace por rama, y escapa el texto', async () => {
    const m = leerMapa('# A <b>\n- x & y\n- z')
    const svg = m === undefined ? '' : mapaSvg(m)
    expect((svg.match(/<rect/g) ?? []).length).toBe(3)
    expect((svg.match(/<path/g) ?? []).length).toBe(2)
    expect(svg).toContain('A &lt;b&gt;')
    expect(svg).toContain('x &amp; y')
  })

  test('partir etiquetas largas en como mucho 3 líneas', async () => {
    expect(partir('Núcleo y material genético (ADN)')).toEqual(['Núcleo y material', 'genético (ADN)'])
    expect(partir('una dos tres cuatro cinco seis siete ocho nueve diez once doce', 10).length).toBe(3)
  })

  test('en el PDF, un mapa de salidas/ se dibuja como diagrama', async () => {
    const html = documentoRepaso({
      cuaderno: { nombre: 'bio', ruta: '/r', fuentes: [], nuevas: [] },
      hoy: '2026-10-20', tarjetas: [], stats: {},
      documentos: [{ archivo: 'mapa-celula.md', markdown: MD }],
    })
    expect(html).toContain('🧠 La célula')
    expect(html).toContain('<figure class="mapa"><svg')
    expect(html).toContain('Mapa mental · celula')
  })
})
