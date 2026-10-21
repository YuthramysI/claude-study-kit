// Idioma de la interfaz: español o inglés. Cada texto visible lleva sus dos versiones juntas, L('…', '…').
export type Idioma = 'es' | 'en'

let actual: Idioma = 'es'

export const idioma = (): Idioma => actual

export function fijarIdioma(i: Idioma) {
  actual = i
}

/** El texto en el idioma de la interfaz. */
export const L = (es: string, en: string): string => (actual === 'en' ? en : es)

/**
 * La opción `idioma` de /config: «es», «en» o «auto», que mira LANG,
 * LC_ALL y LANGUAGE (español si empieza por «es», inglés si no; español si no hay ninguna).
 */
export function detectarIdioma(opcion: unknown, entorno: readonly (string | undefined)[]): Idioma {
  if (opcion === 'es' || opcion === 'en') return opcion
  const valor = entorno.find(v => v !== undefined && v.trim() !== '' && v !== 'C' && v !== 'POSIX')
  if (valor === undefined) return 'es'
  return valor.toLowerCase().startsWith('es') ? 'es' : 'en'
}
