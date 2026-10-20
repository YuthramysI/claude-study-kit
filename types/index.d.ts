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
  /** en qué se trabaja (por defecto, el cuaderno activo) */
  tarea?: string
}

export type Tarjeta = {
  id: string
  frente: string
  reverso: string
  fuente?: string
  /** días hasta el próximo repaso */
  intervalo: number
  /** factor de facilidad de SM-2 (versión 1.1 y anteriores); FSRS lo usa solo para migrar */
  facilidad: number
  repeticiones: number
  /** fecha YYYY-MM-DD en que vence */
  vence: string
  /** ms del último repaso (0: nueva; ordena la cola) */
  ultimo: number
  /** FSRS: días en que la probabilidad de recordar baja al 90 % */
  estabilidad?: number
  /** FSRS: dificultad de 1 (fácil) a 10 (difícil) */
  dificultad?: number
  /** fecha YYYY-MM-DD del primer repaso (para el límite diario de nuevas) */
  primera?: string
}

export type NotaRepaso = 'otra' | 'dificil' | 'bien' | 'facil'

/** Lo que dice la corrección de una respuesta escrita. */
export type Veredicto = { nota: NotaRepaso; comentario: string; origen: 'claude' | 'local' }

export type Repaso = {
  mostrarReverso: boolean
  /** editando la tarjeta actual */
  editando?: boolean
  /** pidiendo confirmación para borrar la tarjeta actual */
  confirmarBorrado?: boolean
  /** modo «escribe la respuesta antes de verla» */
  escribir?: boolean
  /** la respuesta escrita para la tarjeta actual y su corrección */
  respuesta?: { id: string; texto: string; pensando: boolean; veredicto?: Veredicto }
  /** la última calificación, para deshacerla */
  deshacer?: { previa: Tarjeta; dia: string; acierto: boolean }
}

export type Pestana = 'pomodoro' | 'repaso' | 'cuaderno' | 'mapa' | 'stats'

/** Actividad de un día; `temas`: minutos de enfoque por tarea. */
export type DiaStats = { pomodoros: number; minutos: number; repasos: number; aciertos: number; temas?: Record<string, number> }

/** Actividad por fecha YYYY-MM-DD. */
export type Stats = Record<string, DiaStats>

export type InfoCuaderno = {
  nombre: string
  ruta: string
  fuentes: string[]
  /** fuentes que aparecieron desde la última vez que las resumiste o ignoraste */
  nuevas: string[]
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
      /** tareas usadas hace poco, la más reciente primero */
      tareas: string[]
      editandoTarea: boolean
      /** el mapa mental que se ve en el panel (archivo de salidas/) */
      mapa: string | null
    }
  }
}
