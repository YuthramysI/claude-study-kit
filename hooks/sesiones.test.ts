import { describe, expect, test } from 'claude-code/testing'

import * as ses from './sesiones'
import { VACIO } from './stats'

const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()
const MIN = 60_000

describe('sesiones de estudio', () => {
  test('un pomodoro abre la sesión donde empezó; la actividad cercana la continúa', async () => {
    const a = ses.apuntar(null, T0 + 25 * MIN, { pomodoros: 1, minutos: 25, temas: { Química: 25 }, cuaderno: 'quim' })
    expect(a.sesion.inicio).toBe(T0)
    expect(a.cerrada).toBeUndefined()
    const b = ses.apuntar(a.sesion, T0 + 40 * MIN, { repasos: 10, aciertos: 8 })
    expect(b.sesion.id).toBe(a.sesion.id)
    expect(b.sesion.fin).toBe(T0 + 40 * MIN)
    expect(ses.linea(b.sesion)).toBe('10:00–10:40 · 40 min · 1 🍅 · 10 tarjetas (80 %) · Química')
  })

  test('tras más de 30 min sin actividad, cierra la sesión y abre otra', async () => {
    const a = ses.apuntar(null, T0, { repasos: 5, aciertos: 5 }).sesion
    const b = ses.apuntar(a, T0 + 45 * MIN, { repasos: 1, aciertos: 0 })
    expect(b.cerrada?.id).toBe(a.id)
    expect(b.sesion.id).not.toBe(a.id)
    expect(b.sesion.repasos).toBe(1)
    expect(ses.abierta(b.sesion, T0 + 60 * MIN)).toBe(true)
    expect(ses.abierta(b.sesion, T0 + 90 * MIN)).toBe(false)
  })

  test('el diario del día lista totales, sesiones y el consejo del coach', async () => {
    const s = ses.apuntar(null, T0 + 25 * MIN, { pomodoros: 1, minutos: 25, temas: { Bio: 25 } }).sesion
    const md = ses.diario('2026-10-20', { ...VACIO, pomodoros: 1, minutos: 25, repasos: 4, aciertos: 3, temas: { Bio: 25 }, examenes: [{ nota: 7.5, preguntas: 8, cuaderno: 'bio' }] }, [s], '- Repasa a las 10 h.')
    expect(md).toContain('# Diario de estudio · 2026-10-20')
    expect(md).toContain('- 🍅 **1 pomodoros** · 25 min de enfoque')
    expect(md).toContain('75 % de aciertos')
    expect(md).toContain('📝 Examen simulado: **7.5/10** (8 preguntas)')
    expect(md).toContain('- 10:00–10:25 · 25 min · 1 🍅 · Bio')
    expect(md).toContain('## 🤖 Consejo del coach\n\n- Repasa a las 10 h.')
  })

  test('sanear descarta basura del almacén', async () => {
    expect(ses.sanear({ id: 'x' })).toBeNull()
    expect(ses.sanear({ id: 'x', inicio: T0, fin: T0 - 5, temas: { a: 'no' }, cuadernos: ['b', 3] })).toEqual({
      id: 'x', inicio: T0, fin: T0, pomodoros: 0, minutos: 0, repasos: 0, aciertos: 0, creadas: 0, temas: {}, cuadernos: ['b'],
    })
  })
})
