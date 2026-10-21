import { describe, expect, test } from 'claude-code/testing'

import * as lg from './logros'
import { VACIO } from './stats'

const datos = (stats: lg.DatosLogros['stats'], extra: Partial<lg.DatosLogros> = {}): lg.DatosLogros => ({ stats, maduras: 0, mapas: 0, pdfs: 0, cuadernos: 0, ...extra })

describe('logros y niveles', () => {
  test('niveles: 100, 300, 600… XP, con su título', async () => {
    expect(lg.nivel(0)).toEqual({ nivel: 0, titulo: 'Novato', desde: 0, hasta: 100 })
    expect(lg.nivel(299).nivel).toBe(1)
    expect(lg.nivel(300).nivel).toBe(2)
    expect(lg.nivel(lg.xpDeNivel(5)).titulo).toBe('Estudiante')
    expect(lg.titulo(25)).toBe('Leyenda')
  })

  test('experiencia a partir de los datos', async () => {
    const s = { '2026-10-20': { ...VACIO, pomodoros: 2, minutos: 50, repasos: 10, aciertos: 8, examenes: [{ nota: 9, preguntas: 5, cuaderno: 'x' }] } }
    // 50 min + 20 repasos + 8 aciertos + 10 pomodoros + 50 examen + 2 logros·100
    expect(lg.experiencia(s, 2)).toBe(338)
  })

  test('detecta logros por racha, horario, día perfecto y contadores', async () => {
    const s = {
      '2026-10-18': { ...VACIO, pomodoros: 1, minutos: 25, horas: { '23': 30, '1': 35 } },
      '2026-10-19': { ...VACIO, repasos: 20, aciertos: 19 },
      '2026-10-20': { ...VACIO, pomodoros: 1, minutos: 25, horas: { '6': 25 }, temas: { a: 25 } },
    }
    const r = lg.resumir(datos(s, { mapas: 1 }))
    const ids = lg.nuevos(r, {}).map(l => l.id)
    expect(ids).toContain('pomodoro-1')
    expect(ids).toContain('racha-3')
    expect(ids).toContain('buho')
    expect(ids).toContain('dia-perfecto')
    expect(ids).toContain('mapa-1')
    expect(ids).not.toContain('madrugador')
    expect(lg.nuevos(r, { 'pomodoro-1': '2026-10-18' }).map(l => l.id)).not.toContain('pomodoro-1')
  })

  test('cada logro tiene id único y progreso coherente', async () => {
    expect(new Set(lg.LOGROS.map(l => l.id)).size).toBe(lg.LOGROS.length)
    const r = lg.resumir(datos({}))
    for (const l of lg.LOGROS) {
      const [actual, meta] = l.progreso(r)
      expect(actual).toBe(0)
      expect(meta).toBeGreaterThan(0)
    }
  })
})
