// Configuración del plugin a partir de sus opciones (userConfig).
import type { PluginOptions } from 'claude-code'

import type { Duraciones } from './pomodoro'

export const PANEL = 'estudio'

export type Config = {
  carpeta: string
  duraciones: Duraciones
  sonido: boolean
  toquesAlarma: number
  /** 0-100 */
  volumen: number
  autoIniciar: boolean
  recordatorio: boolean
}

const numero = (v: unknown, defecto: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defecto

export function config(options: PluginOptions): Config {
  return {
    carpeta: typeof options.carpeta === 'string' && options.carpeta.trim() !== '' ? options.carpeta : '~/estudio',
    duraciones: {
      enfoque: numero(options.minutosEnfoque, 25, 1, 240),
      descanso: numero(options.minutosDescanso, 5, 1, 120),
      descansoLargo: numero(options.minutosDescansoLargo, 15, 1, 120),
    },
    sonido: options.sonido !== false,
    toquesAlarma: Math.round(numero(options.toquesAlarma, 3, 1, 10)),
    volumen: numero(options.volumen, 80, 0, 100),
    autoIniciar: options.autoIniciar === true,
    recordatorio: options.recordatorio !== false,
  }
}
