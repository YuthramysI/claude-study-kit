export type Fase = 'enfoque' | 'descanso' | 'descansoLargo'

export type Pomodoro = {
  fase: Fase
  estado: 'parado' | 'corriendo' | 'pausado'
  /** ms desde epoch en que termina la fase (solo mientras corre) */
  terminaEn: number
  /** ms que faltaban al pausar */
  restanteMs: number
  duracionMs: number
  /** pomodoros de enfoque completados en este ciclo */
  ronda: number
}

export type Tarjeta = {
  id: string
  frente: string
  reverso: string
  fuente?: string
  /** días hasta el próximo repaso */
  intervalo: number
  /** factor de facilidad SM-2 (mínimo 1.3) */
  facilidad: number
  repeticiones: number
  /** fecha YYYY-MM-DD en que vence */
  vence: string
  /** ms del último repaso (ordena la cola) */
  ultimo: number
}

export type Repaso = { mostrarReverso: boolean }

export type Pestana = 'pomodoro' | 'repaso' | 'cuaderno' | 'stats'

/** Actividad de un día. */
export type DiaStats = { pomodoros: number; minutos: number; repasos: number; aciertos: number }

/** Actividad por fecha YYYY-MM-DD. */
export type Stats = Record<string, DiaStats>

export type InfoCuaderno = {
  nombre: string
  ruta: string
  fuentes: string[]
}

declare module 'claude-code' {
  interface PluginState {
    estudio: {
      pomodoro: Pomodoro
      repaso: Repaso
      pestana: Pestana
      cuaderno: InfoCuaderno | null
      tarjetas: Tarjeta[]
      ahora: number
      stats: Stats
    }
  }
}
