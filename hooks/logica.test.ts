import { describe, expect, test } from 'claude-code/testing'

import { trozos } from './acciones'
import * as pomo from './pomodoro'
import { fecha, fusionar, intervaloPara, nueva, pendientes, programar, sumarDias } from './srs'

const D = { enfoque: 25, descanso: 5, descansoLargo: 15 }
const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()

describe('SM-2', () => {
  test('una tarjeta nueva vence hoy y "bien" la manda a mañana, luego a 6 días', async () => {
    const t = nueva({ frente: '¿Qué es la mitosis?', reverso: 'División celular' }, fecha(T0), 'a')
    expect(t.vence).toBe('2026-10-20')
    const t1 = programar(t, 'bien', T0)
    expect(t1.intervalo).toBe(1)
    expect(t1.vence).toBe('2026-10-21')
    const t2 = programar(t1, 'bien', T0 + 86_400_000)
    expect(t2.intervalo).toBe(6)
    expect(t2.vence).toBe('2026-10-27')
    const t3 = programar(t2, 'bien', T0 + 7 * 86_400_000)
    expect(t3.intervalo).toBe(15)
  })

  test('"otra vez" reinicia, baja la facilidad y la deja para hoy', async () => {
    const t = { ...nueva({ frente: 'a', reverso: 'b' }, '2026-10-01', 'x'), repeticiones: 3, intervalo: 20 }
    const r = programar(t, 'otra', T0)
    expect(r.repeticiones).toBe(0)
    expect(r.vence).toBe('2026-10-20')
    expect(r.facilidad).toBeLessThan(2.5)
  })

  test('la facilidad nunca baja de 1.3', async () => {
    let t = nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x')
    for (let i = 0; i < 20; i++) t = programar(t, 'otra', T0)
    expect(t.facilidad).toBe(1.3)
  })

  test('los intervalos crecen de difícil a fácil', async () => {
    const t = { ...nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x'), repeticiones: 2, intervalo: 10 }
    const [d, b, f] = (['dificil', 'bien', 'facil'] as const).map(n => intervaloPara(t, n))
    expect(d).toBeLessThan(b ?? 0)
    expect(b).toBeLessThan(f ?? 0)
  })

  test('pendientes: solo las vencidas, la repasada hace menos al final', async () => {
    const base = nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x')
    const lista = [
      { ...base, id: '1', vence: '2026-10-19', ultimo: 50 },
      { ...base, id: '2', vence: '2026-10-25', ultimo: 0 },
      { ...base, id: '3', vence: '2026-10-20', ultimo: 10 },
    ]
    expect(pendientes(lista, '2026-10-20').map(t => t.id)).toEqual(['3', '1'])
  })

  test('fusionar omite frentes repetidos (sin importar tildes ni mayúsculas) y vacíos', async () => {
    const r1 = fusionar([], [{ frente: '¿Qué es la Fotosíntesis?', reverso: 'x' }], T0)
    const r2 = fusionar(r1.tarjetas, [
      { frente: 'que es la fotosintesis', reverso: 'y' },
      { frente: 'Nueva', reverso: '' },
      { frente: 'Otra', reverso: 'z', fuente: 'tema1.pdf, p. 3' },
    ], T0 + 1)
    expect(r2.agregadas).toBe(1)
    expect(r2.repetidas).toBe(2)
    expect(r2.tarjetas[1]?.fuente).toBe('tema1.pdf, p. 3')
  })

  test('sumarDias cruza meses y años', async () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('Pomodoro', () => {
  test('enfoque → descanso corto, y largo cada 4', async () => {
    let p = pomo.iniciar(pomo.INICIAL, T0, D)
    expect(p.estado).toBe('corriendo')
    expect(pomo.restante(p, T0 + 60_000)).toBe(24 * 60_000)
    for (let ronda = 1; ronda <= 4; ronda++) {
      const fin = p.terminaEn
      expect(pomo.haTerminado(p, fin)).toBe(true)
      const s = pomo.siguiente(p, fin, D)
      expect(s.completoEnfoque).toBe(true)
      expect(s.pomodoro.fase).toBe(ronda === 4 ? 'descansoLargo' : 'descanso')
      expect(s.pomodoro.estado).toBe('corriendo')
      // el descanso termina y espera al usuario
      const tras = pomo.siguiente(s.pomodoro, s.pomodoro.terminaEn, D)
      expect(tras.pomodoro.fase).toBe('enfoque')
      expect(tras.pomodoro.estado).toBe('parado')
      p = pomo.iniciar(tras.pomodoro, s.pomodoro.terminaEn, D)
    }
    expect(p.ronda).toBe(0)
  })

  test('pausar congela el tiempo y reanudar lo continúa', async () => {
    const p = pomo.iniciar(pomo.INICIAL, T0, D, 10)
    const pausado = pomo.pausar(p, T0 + 4 * 60_000)
    expect(pomo.restante(pausado, T0 + 99 * 60_000)).toBe(6 * 60_000)
    const sigue = pomo.reanudar(pausado, T0 + 20 * 60_000)
    expect(sigue.terminaEn).toBe(T0 + 26 * 60_000)
  })

  test('reloj y línea de estado', async () => {
    expect(pomo.reloj(25 * 60_000)).toBe('25:00')
    expect(pomo.reloj(61_500)).toBe('01:02')
    const p = pomo.iniciar(pomo.INICIAL, T0, D)
    expect(pomo.lineaEstado(p, T0)).toBe('🍅 25:00 · enfoque 1/4')
    expect(pomo.lineaEstado(pomo.INICIAL, T0)).toBe(undefined)
  })
})

test('la voz se corta en frases de menos de 3500 caracteres', async () => {
  const texto = Array.from({ length: 200 }, (_, i) => `Esta es la frase número ${i} del guion.`).join(' ')
  const partes = trozos(texto)
  expect(partes.length).toBeGreaterThan(1)
  for (const p of partes) expect(p.length).toBeLessThanOrEqual(3500)
  expect(partes.join(' ')).toBe(texto)
})
