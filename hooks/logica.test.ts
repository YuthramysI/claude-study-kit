import { describe, expect, test } from 'claude-code/testing'

import { trozos } from './acciones'
import * as pomo from './pomodoro'
import { describirIntervalo, fecha, fusionar, intervaloPara, nueva, nuevasEnEspera, pendientes, programar, sumarDias } from './srs'

const D = { enfoque: 25, descanso: 5, descansoLargo: 15 }
const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()

const DIA = 86_400_000

describe('FSRS', () => {
  test('primer repaso: los intervalos salen de la estabilidad inicial de cada nota', async () => {
    const t = nueva({ frente: '¿Qué es la mitosis?', reverso: 'División celular' }, fecha(T0), 'a')
    expect(t.vence).toBe('2026-10-20')
    expect((['otra', 'dificil', 'bien', 'facil'] as const).map(n => intervaloPara(t, n, T0))).toEqual([0, 1, 4, 14])
    const t1 = programar(t, 'bien', T0)
    expect(t1.vence).toBe('2026-10-24')
    expect(t1.estabilidad).toBe(3.715)
    expect(t1.primera).toBe('2026-10-20')
  })

  test('repasar a tiempo y bien hace crecer el intervalo', async () => {
    let t = programar(nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x'), 'bien', T0)
    let dia = T0
    const intervalos: number[] = []
    for (let i = 0; i < 4; i++) {
      dia += t.intervalo * DIA
      t = programar(t, 'bien', dia)
      intervalos.push(t.intervalo)
    }
    for (let i = 1; i < intervalos.length; i++) expect(intervalos[i] ?? 0).toBeGreaterThan(intervalos[i - 1] ?? 0)
    expect(intervalos[0] ?? 0).toBeGreaterThan(4)
  })

  test('«otra vez» la deja para hoy, baja la estabilidad y sube la dificultad', async () => {
    const aprendida = programar(programar(nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x'), 'bien', T0), 'bien', T0 + 4 * DIA)
    const fallo = programar(aprendida, 'otra', T0 + 20 * DIA)
    expect(fallo.intervalo).toBe(0)
    expect(fallo.vence).toBe('2026-11-09')
    expect(fallo.estabilidad ?? 99).toBeLessThan(aprendida.estabilidad ?? 0)
    expect(fallo.dificultad ?? 0).toBeGreaterThan(aprendida.dificultad ?? 99)
  })

  test('la dificultad se queda entre 1 y 10', async () => {
    let t = programar(nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x'), 'otra', T0)
    for (let i = 0; i < 30; i++) t = programar(t, 'otra', T0 + i * DIA)
    expect(t.dificultad ?? 0).toBeLessThanOrEqual(10)
    let f = programar(nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'y'), 'facil', T0)
    for (let i = 0; i < 30; i++) f = programar(f, 'facil', T0 + i * DIA)
    expect(f.dificultad ?? 0).toBeGreaterThanOrEqual(1)
  })

  test('los intervalos crecen de difícil a fácil, y una retención más alta los acorta', async () => {
    const t = programar(nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x'), 'bien', T0)
    const dia = T0 + 4 * DIA
    const [d, b, f] = (['dificil', 'bien', 'facil'] as const).map(n => intervaloPara(t, n, dia))
    expect(d ?? 0).toBeLessThan(b ?? 0)
    expect(b ?? 0).toBeLessThan(f ?? 0)
    expect(intervaloPara(t, 'bien', dia, 0.97)).toBeLessThan(b ?? 0)
  })

  test('una tarjeta de SM-2 conserva su ritmo al pasar a FSRS', async () => {
    const sm2 = { ...nueva({ frente: 'a', reverso: 'b' }, '2026-10-01', 'x'), intervalo: 30, facilidad: 2.5, repeticiones: 4, ultimo: T0 - 30 * DIA }
    const r = programar(sm2, 'bien', T0)
    expect(r.intervalo).toBeGreaterThan(30)
    expect(r.estabilidad).toBeDefined()
  })

  test('cola de hoy: repasos vencidos primero y nuevas según el límite diario', async () => {
    const base = nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x')
    const lista = [
      { ...base, id: 'r1', vence: '2026-10-19', ultimo: 50, intervalo: 3 },
      { ...base, id: 'n1' },
      { ...base, id: 'r2', vence: '2026-10-20', ultimo: 10, intervalo: 3 },
      { ...base, id: 'n2' },
      { ...base, id: 'n3' },
      { ...base, id: 'futura', vence: '2026-10-25', ultimo: 5, intervalo: 9 },
      { ...base, id: 'empezada', vence: '2026-10-22', ultimo: 60, primera: '2026-10-20' },
    ]
    expect(pendientes(lista, '2026-10-20').map(t => t.id)).toEqual(['r2', 'r1', 'n1', 'n2', 'n3'])
    // límite 2 y ya empezaste 1 hoy: solo entra 1 nueva
    expect(pendientes(lista, '2026-10-20', 2).map(t => t.id)).toEqual(['r2', 'r1', 'n1'])
    expect(nuevasEnEspera(lista, '2026-10-20', 2)).toBe(2)
    expect(pendientes(lista, '2026-10-20', 0).map(t => t.id)).toEqual(['r2', 'r1'])
  })

  test('describirIntervalo', async () => {
    expect([0, 3, 21, 90, 500].map(describirIntervalo)).toEqual(['hoy', '3 d', '3 sem', '3 m', '1,4 a'])
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
