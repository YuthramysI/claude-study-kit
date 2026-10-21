// Configuración del plugin a partir de sus opciones (userConfig).
import type { PluginOptions } from 'claude-code'

import type { Duraciones } from './pomodoro'

export const PANEL = 'estudio'

export type Config = {
  /** «auto», «es» o «en»: se resuelve al arrancar con detectarIdioma */
  idioma: string
  carpeta: string
  duraciones: Duraciones
  sonido: boolean
  toquesAlarma: number
  /** 0-100 */
  volumen: number
  autoIniciar: boolean
  recordatorio: boolean
  /** tarjetas nuevas que entran al repaso cada día */
  nuevasPorDia: number
  /** retención deseada de FSRS (0,70-0,97) */
  retencion: number
}

const numero = (v: unknown, defecto: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defecto

export function config(options: PluginOptions): Config {
  return {
    idioma: typeof options.idioma === 'string' ? options.idioma : 'auto',
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
    nuevasPorDia: Math.round(numero(options.nuevasPorDia, 20, 0, 1000)),
    retencion: numero(options.retencion, 90, 70, 97) / 100,
  }
}
