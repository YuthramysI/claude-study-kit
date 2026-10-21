import { describe, expect, test } from 'claude-code/testing'

import * as plan from './plan'
import { nueva, programar } from './srs'
import { VACIO } from './stats'

const HOY = '2026-10-20'
const T0 = new Date(2026, 9, 20, 10).getTime()
const tarjeta = (id: string) => nueva({ frente: id, reverso: id }, HOY, id)

describe('plan de examen', () => {
  test('lee fechas escritas a mano', async () => {
    expect(plan.interpretarFecha('2026-11-15', HOY)).toBe('2026-11-15')
    expect(plan.interpretarFecha('15/11', HOY)).toBe('2026-11-15')
    expect(plan.interpretarFecha('15/11/27', HOY)).toBe('2027-11-15')
    expect(plan.interpretarFecha('3/1', HOY)).toBe('2027-01-03') // ya pasó este año: el próximo
    expect(plan.interpretarFecha('15 de noviembre', HOY)).toBe('2026-11-15')
    expect(plan.interpretarFecha('1 dic 2026', HOY)).toBe('2026-12-01')
    expect(plan.interpretarFecha('en 20 días', HOY)).toBe('2026-11-09')
    expect(plan.interpretarFecha('en 2 semanas', HOY)).toBe('2026-11-03')
    expect(plan.interpretarFecha('mañana', HOY)).toBe('2026-10-21')
    expect(plan.interpretarFecha('31/02', HOY)).toBeUndefined()
    expect(plan.interpretarFecha('pronto', HOY)).toBeUndefined()
  })

  test('meta diaria de nuevas y previsión de recuerdo', async () => {
    const ts = [...Array.from({ length: 20 }, (_, i) => tarjeta(`n${i}`)), programar(tarjeta('vista'), 'bien', T0)]
    const e = plan.estado({ examen: '2026-10-30', titulo: 'Bio' }, ts, {}, HOY)
    expect(e.dias).toBe(10)
    expect(e.nuevas).toBe(20)
    // 21 por empezar (20 + la de hoy) en 8 días útiles (2 de colchón)
    expect(e.nuevasPorDia).toBe(3)
    expect(e.vistas).toBe(5)
    expect(e.prevision).toBeGreaterThan(0)
    expect(e.prevision).toBeLessThan(5)
    expect(e.mensaje).toBe('Hoy te faltan 2 tarjetas nuevas y 4 🍅.')
    expect(plan.limiteHoy(1, { examen: '2026-10-30' }, ts, {}, HOY)).toBe(3)
    expect(plan.limiteHoy(20, { examen: '2026-10-30' }, ts, {}, HOY)).toBe(20)
    expect(plan.limiteHoy(1, null, ts, {}, HOY)).toBe(1)
  })

  test('ritmo: cumplido, atrasado cerca del examen, listo y pasado', async () => {
    const vistas = [programar(tarjeta('a'), 'facil', T0)]
    const stats = { [HOY]: { ...VACIO, pomodoros: 4 } }
    expect(plan.estado({ examen: '2026-11-20' }, vistas, stats, HOY).mensaje).toBe('¡Meta de hoy cumplida! 🎉')
    expect(plan.estado({ examen: '2026-10-22' }, [tarjeta('x')], {}, HOY).ritmo).toBe('atrasado')
    expect(plan.estado({ examen: '2026-10-21' }, vistas, {}, HOY).ritmo).toBe('listo')
    expect(plan.estado({ examen: '2026-10-01' }, vistas, {}, HOY).ritmo).toBe('pasado')
  })

  test('sanear plan.json', async () => {
    expect(plan.sanear(null)).toBeNull()
    expect(plan.sanear({ examen: 'mañana' })).toBeNull()
    expect(plan.sanear({ examen: '2026-11-15', titulo: '  Final  ', metaPomodoros: 99 })).toEqual({ examen: '2026-11-15', titulo: 'Final', metaPomodoros: 20 })
  })
})
