// El enlace con el motor: los valores de sesión y el Host que los usa.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Host } from './host'
import { INICIAL } from './pomodoro'

const pomodoroA = atom({ plugin: 'estudio', key: 'pomodoro' } as const, INICIAL)
const repasoA = atom({ plugin: 'estudio', key: 'repaso' } as const, { mostrarReverso: false, hechasHoy: 0 })
const pestanaA = atom({ plugin: 'estudio', key: 'pestana' } as const, 'pomodoro')
const cuadernoA = atom({ plugin: 'estudio', key: 'cuaderno' } as const, null)
const tarjetasA = atom({ plugin: 'estudio', key: 'tarjetas' } as const, [])
const ahoraA = atom({ plugin: 'estudio', key: 'ahora' } as const, 0)
const statsA = atom({ plugin: 'estudio', key: 'stats' } as const, {})

/**
 * Enlaza un Host desde `$`. Cada miembro se escribe `$.noun.event(...)` aquí,
 * para que el motor lea del código lo que el módulo llama. Dentro de un
 * `ui.render`, enlazado con el `$` de ese dibujo, sus lecturas lo suscriben.
 */
export function hostOf($: EngineInterface, home: string): Host {
  return {
    pluginRoot: $.plugin.root,
    home,
    fs: {
      read: path => $.fs.read(path),
      write: (path, text) => $.fs.write(path, text),
      list: path => $.fs.list(path),
      exists: path => $.fs.exists(path),
    },
    now: () => $.clock.now(),
    after: (ms, fn) => $.clock.after(ms, fn),
    every: (ms, fn) => $.clock.every(ms, fn),
    storeGet: key => $.store.get(key),
    storeSet: (key, value) => $.store.set(key, value),
    st: {
      pomodoro: { leer: () => read($, pomodoroA), cambiar: fn => update($, pomodoroA, fn) },
      repaso: { leer: () => read($, repasoA), cambiar: fn => update($, repasoA, fn) },
      pestana: { leer: () => read($, pestanaA), cambiar: fn => update($, pestanaA, fn) },
      cuaderno: { leer: () => read($, cuadernoA), cambiar: fn => update($, cuadernoA, fn) },
      tarjetas: { leer: () => read($, tarjetasA), cambiar: fn => update($, tarjetasA, fn) },
      ahora: { leer: () => read($, ahoraA), cambiar: fn => update($, ahoraA, fn) },
      stats: { leer: () => read($, statsA), cambiar: fn => update($, statsA, fn) },
    },
    status: text => $.ui.status(text),
    toast: (text, timeoutMs) => $.ui.toast(text, timeoutMs !== undefined ? { timeoutMs } : undefined),
    notify: text => $.ui.notify(text, { title: 'Estudio' }),
    log: text => $.ui.log(text, { to: 'debug' }),
    linea: text => $.ui.log(text),
    openPane: pane => $.ui.open(pane),
    registerCommand: spec => $.command.register(spec),
    registerTool: spec => $.tool.register(spec),
    submitPrompt: text => $.prompt.submit({ text }),
    run: (argv, init) => $.process.run(argv, init),
    play: (asset, gain) => $.audio.play({ asset }, { gain }),
    speak: text => $.audio.speak(text),
  }
}
