import { describe, expect, test } from 'claude-code/testing'

import * as g from './graficos'

const cuenta = (s: string, sub: string) => s.split(sub).length - 1

describe('gráficos', () => {
  test('el anillo dibuja el progreso, el tiempo y los puntos del ciclo', async () => {
    const svg = g.anillo({ hecho: 0.25, reloj: '18:45', etiqueta: 'enfoque', fase: 'enfoque', pausado: false, ronda: 2, rondas: 4 })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('18:45')
    expect(svg).toContain('ENFOQUE')
    expect(svg).toContain(g.COLOR_FASE.enfoque)
    // circunferencia 2π·92 ≈ 578.1; con un 25 % hecho queda un 75 % de desfase
    expect(svg).toContain('stroke-dashoffset="433.5"')
    expect(cuenta(svg, `fill="${g.COLOR_FASE.enfoque}" stroke`)).toBe(2)
  })

  test('el anillo en pausa es gris y sin progreso no dibuja el arco', async () => {
    const pausa = g.anillo({ hecho: 0.5, reloj: '10:00', etiqueta: 'en pausa', fase: 'enfoque', pausado: true, ronda: 0, rondas: 4 })
    expect(pausa).toContain(g.COLOR_FASE.pausa)
    const parado = g.anillo({ hecho: 0, reloj: '25:00', etiqueta: 'listo', fase: 'enfoque', pausado: false, ronda: 0, rondas: 4 })
    expect(parado).not.toContain('stroke-dasharray')
  })

  test('el mapa de calor tiene una celda por día', async () => {
    const dias = Array.from({ length: 112 }, (_, i) => ({ dia: `d${i}`, valor: i % 5, diaSemana: i % 7 }))
    const svg = g.mapaCalor(dias)
    expect(cuenta(svg, '<rect')).toBe(112)
  })

  test('las barras marcan los valores y escapan las etiquetas', async () => {
    const svg = g.barras([{ etiqueta: '<l>', valor: 3, esHoy: false }, { etiqueta: 'm', valor: 0, esHoy: true }])
    expect(svg).toContain('&lt;l&gt;')
    expect(cuenta(svg, '<rect')).toBe(2)
    expect(svg).toContain('>3</text>')
  })

  test('reloj grande de tres filas y barra de texto', async () => {
    const [a, b, c] = g.relojGrande('25:00')
    expect(a).toBe('┏━┓ ┏━╸   ┏━┓ ┏━┓')
    expect(b).toBe('┏━┛ ┗━┓ ╹ ┃ ┃ ┃ ┃')
    expect(c).toBe('┗━╸ ┗━┛ ╹ ┗━┛ ┗━┛')
    expect(g.barraTexto(0.5, 10)).toEqual({ lleno: '━━━━━', vacio: '─────' })
  })

  test('icono por tipo de fuente', async () => {
    expect(g.iconoFuente('tema1.PDF')).toBe('📕')
    expect(g.iconoFuente('apuntes.md')).toBe('📝')
    expect(g.iconoFuente('foto.jpg')).toBe('🖼️')
  })
})
