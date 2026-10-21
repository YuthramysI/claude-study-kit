import { describe, expect, test } from 'claude-code/testing'

import * as anki from './anki'
import { interpretar, normalizar } from './cuadernos'
import * as pomo from './pomodoro'
import { nueva, pronostico } from './srs'
import * as stats from './stats'

const D = { enfoque: 25, descanso: 5, descansoLargo: 15 }
const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()

describe('estadísticas', () => {
  test('registrar suma por día', async () => {
    let s = stats.registrar({}, '2026-10-20', { pomodoros: 1, minutos: 25 })
    s = stats.registrar(s, '2026-10-20', { repasos: 3, aciertos: 2 })
    expect(s['2026-10-20']).toEqual({ pomodoros: 1, minutos: 25, repasos: 3, aciertos: 2 })
  })

  test('la racha cuenta días seguidos y tolera que hoy aún esté vacío', async () => {
    const s = {
      '2026-10-16': { ...stats.VACIO, pomodoros: 1 },
      '2026-10-18': { ...stats.VACIO, repasos: 5 },
      '2026-10-19': { ...stats.VACIO, pomodoros: 2 },
    }
    expect(stats.racha(s, '2026-10-20')).toBe(2)
    expect(stats.racha(s, '2026-10-21')).toBe(0)
    expect(stats.racha({ ...s, '2026-10-20': { ...stats.VACIO, pomodoros: 1 } }, '2026-10-20')).toBe(3)
    expect(stats.mejorRacha(s)).toBe(2)
  })

  test('sparkline escala a 8 alturas y marca los ceros', async () => {
    expect(stats.sparkline([0, 1, 4, 8])).toBe('·▁▄█')
    expect(stats.sparkline([0, 0])).toBe('··')
  })

  test('migra el historial de la versión 0.1', async () => {
    expect(stats.migrar({ '2026-10-19': 3, basura: 'x' }, 25)).toEqual({
      '2026-10-19': { pomodoros: 3, minutos: 75, repasos: 0, aciertos: 0 },
    })
  })

  test('sanear descarta días mal formados', async () => {
    expect(stats.sanear({ '2026-10-19': { pomodoros: 2, minutos: -1 }, mal: {} })).toEqual({
      '2026-10-19': { pomodoros: 2, minutos: 0, repasos: 0, aciertos: 0 },
    })
  })

  test('etapas de las tarjetas', async () => {
    const t = nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x')
    const e = stats.etapas([t, { ...t, ultimo: 1, intervalo: 3 }, { ...t, ultimo: 1, intervalo: 30 }])
    expect(e).toEqual({ nuevas: 1, aprendiendo: 1, maduras: 1 })
  })
})

describe('Anki', () => {
  test('exporta con cabeceras de Anki, mazo y etiquetas', async () => {
    const t = nueva({ frente: '¿Qué es\tATP?', reverso: 'Energía', fuente: 'celula.pdf, p. 3' }, '2026-10-20', 'x')
    const texto = anki.exportar([t], 'Biología')
    expect(texto).toContain('#separator:tab')
    expect(texto).toContain('#deck:Biología')
    expect(texto).toContain('¿Qué es ATP?\tEnergía\testudio celula.pdf')
  })

  test('importa texto de Anki con HTML y cabeceras', async () => {
    const r = anki.importar('#separator:tab\n#html:true\nCapital de <b>Francia</b>\tParís&nbsp;\tgeo\nsolo frente\n')
    expect(r.tarjetas).toEqual([{ frente: 'Capital de Francia', reverso: 'París', fuente: 'importada' }])
    expect(r.ignoradas).toBe(1)
  })

  test('importa CSV con comillas y punto y coma', async () => {
    const csv = anki.importar('"Hola, ¿qué tal?";"Bien; gracias"\nA;B\n')
    expect(csv.tarjetas.map(t => [t.frente, t.reverso])).toEqual([['Hola, ¿qué tal?', 'Bien; gracias'], ['A', 'B']])
    const flechas = anki.importar('uno :: one\ndos :: two')
    expect(flechas.tarjetas.length).toBe(2)
  })
})

describe('robustez de tarjetas.json', () => {
  test('un JSON dañado se detecta', async () => {
    expect(interpretar('[{"frente": "a", ')).toBe(undefined)
    expect(interpretar('{"no": "lista"}')).toBe(undefined)
  })

  test('acepta tarjetas escritas a mano y descarta las incompletas', async () => {
    const r = interpretar('[{"frente": "¿2+2?", "reverso": "4"}, {"frente": "sin reverso"}, 7]')
    expect(r?.length).toBe(1)
    expect(r?.[0]?.vence).toBe('0000-00-00')
    expect(r?.[0]?.facilidad).toBe(2.5)
  })

  test('el id generado es estable entre lecturas', async () => {
    const a = normalizar({ frente: 'x', reverso: 'y' }, 0)
    const b = normalizar({ frente: 'x', reverso: 'y' }, 0)
    expect(a?.id).toBe(b?.id ?? '')
  })
})

describe('Pomodoro pro', () => {
  test('con autoIniciar, el siguiente enfoque arranca solo', async () => {
    const descanso = pomo.iniciar({ ...pomo.INICIAL, fase: 'descanso', ronda: 1 }, T0, D)
    const s = pomo.siguiente(descanso, descanso.terminaEn, D, true)
    expect(s.pomodoro.fase).toBe('enfoque')
    expect(s.pomodoro.estado).toBe('corriendo')
  })

  test('restaurar: sigue si aún corre, se descarta si terminó o es basura', async () => {
    const p = pomo.iniciar(pomo.INICIAL, T0, D)
    expect(pomo.restaurar(p, T0 + 60_000)).toEqual(p)
    expect(pomo.restaurar(p, p.terminaEn + 1).estado).toBe('parado')
    expect(pomo.restaurar({ fase: 'otra' }, T0)).toEqual(pomo.INICIAL)
    expect(pomo.restaurar(undefined, T0)).toEqual(pomo.INICIAL)
  })
})

describe('gráficos pro: datos', () => {
  test('minutosPorHora reparte un pomodoro que cruza la hora', async () => {
    const inicio = new Date(2026, 9, 20, 10, 50).getTime()
    expect(stats.minutosPorHora(inicio, inicio + 25 * 60_000)).toEqual({ '10': 10, '11': 15 })
  })

  test('registrar suma horas y notas, y acumula exámenes; sanear filtra lo inválido', async () => {
    let s = stats.registrar({}, '2026-10-20', { horas: { '9': 25 }, notas: { bien: 2 } })
    s = stats.registrar(s, '2026-10-20', { horas: { '9': 5, '10': 20 }, notas: { bien: -1, otra: 1 }, examenes: [{ nota: 8.5, preguntas: 10, cuaderno: 'bio' }] })
    expect(s['2026-10-20']?.horas).toEqual({ '9': 30, '10': 20 })
    expect(s['2026-10-20']?.notas).toEqual({ bien: 1, otra: 1 })
    expect(stats.examenes(s).map(e => e.nota)).toEqual([8.5])
    const sano = stats.sanear({ '2026-10-20': { pomodoros: 1, horas: { '9': 5, '99': 3 }, notas: { bien: 1, raro: 4 }, examenes: [{ nota: 14 }, { nota: 'x' }] } })
    expect(sano['2026-10-20']?.horas).toEqual({ '9': 5 })
    expect(sano['2026-10-20']?.notas).toEqual({ bien: 1 })
    expect(sano['2026-10-20']?.examenes?.map(e => e.nota)).toEqual([10])
  })

  test('horario y mejores horas', async () => {
    const s = {
      '2026-10-19': { ...stats.VACIO, horas: { '10': 50, '18': 20 } }, // lunes
      '2026-10-20': { ...stats.VACIO, horas: { '10': 25 } }, // martes
    }
    const m = stats.horario(s, '2026-10-20', 7)
    expect(m[0]?.[10]).toBe(50)
    expect(m[1]?.[10]).toBe(25)
    expect(stats.mejoresHoras(s, '2026-10-20', 7)).toEqual([{ hora: 10, minutos: 75 }, { hora: 18, minutos: 20 }])
  })

  test('aciertos por día: null sin repasos', async () => {
    const s = { '2026-10-20': { ...stats.VACIO, repasos: 4, aciertos: 3 } }
    expect(stats.aciertosPorDia(s, '2026-10-20', 2)).toEqual([null, 75])
  })

  test('pronóstico: los atrasados cuentan hoy y las nuevas no cuentan', async () => {
    const base = nueva({ frente: 'a', reverso: 'b' }, '2026-10-20', 'x')
    const ts = [
      { ...base, id: '1', ultimo: 1, vence: '2026-10-18' },
      { ...base, id: '2', ultimo: 1, vence: '2026-10-21' },
      { ...base, id: '3', ultimo: 1, vence: '2026-10-21' },
      { ...base, id: '4' },
      { ...base, id: '5', ultimo: 1, vence: '2027-01-01' },
    ]
    expect(pronostico(ts, '2026-10-20', 3)).toEqual([1, 2, 0])
  })
})
