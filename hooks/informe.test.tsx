import { describe, expect, mock, test } from 'claude-code/testing'
import type { FsEntry } from 'claude-code'

import { htmlInforme, lunesDe, resumenSemana } from './informe'
import { VACIO } from './stats'

describe('informe semanal', () => {
  test('el lunes de cada semana', async () => {
    expect(lunesDe('2026-10-20')).toBe('2026-10-19') // martes
    expect(lunesDe('2026-10-19')).toBe('2026-10-19')
    expect(lunesDe('2026-10-25')).toBe('2026-10-19') // domingo
  })

  test('resumen: solo la semana, XP ganada en ella, logros de la semana y días activos', async () => {
    const stats = {
      '2026-10-12': { ...VACIO, pomodoros: 4, minutos: 100 },
      '2026-10-19': { ...VACIO, pomodoros: 2, minutos: 50, repasos: 10, aciertos: 9, temas: { 'Bio <x>': 50 } },
      '2026-10-20': { ...VACIO, repasos: 5, aciertos: 5 },
    }
    const logros = { 'pomodoro-1': '2026-10-12', 'racha-3': '2026-10-20' }
    const r = resumenSemana({ lunes: '2026-10-19', hoy: '2026-10-20', stats, logros })
    expect(r.total.minutos).toBe(50)
    expect(r.diasActivos).toBe(2)
    expect(r.logrosSemana.map(l => l.id)).toEqual(['racha-3'])
    // 50 min + 15 repasos·2 + 14 aciertos + 2 pomodoros·5 + 1 logro nuevo·100
    expect(r.xpSemana).toBe(204)
    const html = htmlInforme({ lunes: '2026-10-19', hoy: '2026-10-20', stats, logros })
    expect(html).toContain('50 min<br>de enfoque')
    expect(html).toContain('19–25 de octubre de 2026')
    expect(html).toContain('Bio &lt;x&gt;')
    expect(html).toContain('<span class="icono">🔥</span>Calentando')
  })
})

test('/estudio informe hace la captura con el navegador a 1080×1350', async ($, on) => {
  mock.clock(on, { now: new Date(2026, 9, 20, 10).getTime() })
  mock.store(on)
  mock.env(on, { HOME: '/h' })
  const archivos = new Map<string, string>()
  on('fs.write', (_, e) => {
    archivos.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.read', (_, e) => ({ value: archivos.get(e.path) ?? '' }))
  on('fs.exists', (_, e) => ({ value: archivos.has(e.path) }))
  on('fs.list', () => ({ value: [] as FsEntry[] }))
  const ejecutados: string[][] = []
  on('process.run', (_, e) => {
    ejecutados.push([...e.argv])
    const captura = e.argv.find(a => a.startsWith('--screenshot='))
    if (captura !== undefined) archivos.set(captura.slice('--screenshot='.length), 'PNG')
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__estudio__${e.name}` } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const cmd = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } } as const
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const r = await $.command.run({ command: 'estudio', args: 'informe', ...cmd })
  expect(r.text).toBe('📸 Informe semanal listo: /h/estudio/informes/semana-2026-10-19.png (1080×1350, listo para compartir)')
  expect(archivos.get('/h/estudio/informes/semana-2026-10-19.html')).toContain('Mi semana de estudio')
  const chrome = ejecutados.find(a => a[0] === 'google-chrome') ?? []
  expect(chrome).toContain('--window-size=1080,1350')
  const pasada = await $.tool.call({ tool: 'mcp__estudio__generar_informe_semanal', semana: 'pasada' })
  expect(String(pasada.result)).toContain('semana-2026-10-12.png')
})
