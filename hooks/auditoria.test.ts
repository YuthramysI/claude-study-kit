// Regresiones de la auditoría: cada test fija un bug que existió.
import { expect, test } from 'claude-code/testing'
import { sinHtml } from './anki'
import { corregirLocal } from './acciones'
import * as cuadernos from './cuadernos'
import type { Host } from './host'
import { fusionar } from './srs'
import { horas } from './stats'

const T0 = new Date(2026, 9, 20, 10, 0, 0).getTime()

test('fusionar no descarta frentes en otros alfabetos ni confunde símbolos', async () => {
  const r = fusionar([], [
    { frente: 'Τι είναι το κύτταρο;', reverso: 'Η μονάδα της ζωής' },
    { frente: '细胞是什么？', reverso: '生命的基本单位' },
    { frente: 'Что такое клетка?', reverso: 'Единица жизни' },
    { frente: '¿Qué es α?', reverso: 'alfa' },
    { frente: '¿Qué es β?', reverso: 'beta' },
    { frente: '¿Qué es ∑?', reverso: 'sumatorio' },
    { frente: '¿Qué es ∫?', reverso: 'integral' },
  ], T0)
  expect(r.agregadas).toBe(7)
  expect(r.repetidas).toBe(0)
})

test('fusionar sigue juntando el mismo frente con otros acentos o signos', async () => {
  const r = fusionar([], [{ frente: '¿Qué es la célula?', reverso: 'a' }, { frente: 'que es la celula', reverso: 'b' }], T0)
  expect(r.agregadas).toBe(1)
  expect(r.repetidas).toBe(1)
})

test('corregirLocal compara palabras en cualquier alfabeto', async () => {
  expect(corregirLocal('Η μονάδα της ζωής', 'μονάδα ζωής').nota).not.toBe('otra')
})

test('una entidad HTML fuera de rango no aborta la importación', async () => {
  expect(sinHtml('a &#99999999; b &#x41; &amp;')).toBe('a &#99999999; b A &')
})

test('horas redondea antes de partir', async () => {
  expect(horas(119.6)).toBe('2 h 00 min')
  expect(horas(59.6)).toBe('1 h 00 min')
  expect(horas(25)).toBe('25 min')
})

test('diario e informes no son cuadernos', async () => {
  expect(cuadernos.nombreValido('diario')).toBeUndefined()
  expect(cuadernos.nombreValido('Informes')).toBeUndefined()
  expect(cuadernos.nombreValido('biología')).toBe('biología')
  const h = {
    fs: {
      exists: async () => true,
      list: async () => ['biologia', 'diario', 'informes', '.navegador'].map(name => ({ name, kind: 'dir', isLink: false, size: 0, mtimeMs: 0 })),
    },
  } as unknown as Host
  expect(await cuadernos.listar(h, '/x')).toEqual(['biologia'])
})
