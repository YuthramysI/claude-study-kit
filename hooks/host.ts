import type {
  CommandSpec,
  FsEntry,
  PaneOpenArgs,
  ProcessRunInit,
  ProcessRunResult,
  ToolSpec,
  TimerCall,
  UiNotifyResult,
  UiOpenResult,
} from 'claude-code'

import type { InfoCuaderno, Pestana, Pomodoro, Repaso, Stats, Tarjeta } from '../types'

export type Celda<T> = {
  leer: () => Promise<T>
  cambiar: (fn: (v: T) => T) => Promise<T>
}

/**
 * El motor tal como `session.start` lo enlaza desde su `$`: cada temporizador,
 * botón y comando posterior llega al motor por aquí, así que el resto del
 * módulo son funciones normales sobre una interfaz pequeña.
 */
export type Host = {
  pluginRoot: string
  home: string
  fs: {
    read: (path: string) => Promise<string>
    write: (path: string, text: string) => Promise<void>
    list: (path: string) => Promise<FsEntry[]>
    exists: (path: string) => Promise<boolean>
  }
  now: () => Promise<number>
  after: TimerCall
  every: TimerCall
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  /** Valores de sesión que lee el panel. */
  st: {
    pomodoro: Celda<Pomodoro>
    repaso: Celda<Repaso>
    pestana: Celda<Pestana>
    cuaderno: Celda<InfoCuaderno | null>
    tarjetas: Celda<Tarjeta[]>
    ahora: Celda<number>
    stats: Celda<Stats>
  }
  status: (text: string | undefined) => void
  toast: (text: string, timeoutMs?: number) => void
  notify: (text: string) => Promise<UiNotifyResult>
  /** Al registro de depuración. */
  log: (text: string) => void
  /** Una línea tenue en la conversación (no la lee el modelo). */
  linea: (text: string) => void
  openPane: (pane: PaneOpenArgs) => Promise<UiOpenResult>
  registerCommand: (spec: CommandSpec) => Promise<unknown>
  registerTool: (spec: ToolSpec) => Promise<unknown>
  submitPrompt: (text: string) => Promise<unknown>
  run: (argv: readonly string[], init?: ProcessRunInit) => Promise<ProcessRunResult>
  play: (asset: string, gain: number) => Promise<void>
  speak: (text: string) => Promise<unknown>
}
