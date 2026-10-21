// Cuaderno de ejemplo («/cuaderno demo»): fuentes, tarjetas y un mapa listos para probar el plugin.
import type { TarjetaSimple } from './anki'
import { idioma, L } from './i18n'

export const NOMBRE_EJEMPLO = 'demo'
/** Lo que se acepta en /cuaderno para pedir el ejemplo. */
export const ALIAS_EJEMPLO = ['demo', 'ejemplo', 'example']

export type Ejemplo = {
  fuentes: Record<string, string>
  tarjetas: TarjetaSimple[]
  /** salidas/mapa.md */
  mapa: string
}

const CELULA_ES = `# La célula

## Qué es
La célula es la **unidad básica de la vida**: todos los seres vivos están formados por una o más células, y toda célula procede de otra célula (teoría celular).

## Tipos
- **Procariota**: sin núcleo; su ADN está libre en el citoplasma. Ejemplo: las bacterias.
- **Eucariota**: con núcleo rodeado de membrana. Forma animales, plantas, hongos y protistas.

## Estructura
- **Membrana plasmática**: bicapa de lípidos que separa la célula del exterior y controla qué entra y qué sale.
- **Citoplasma**: medio acuoso donde están los orgánulos.
- **Núcleo**: guarda el ADN y dirige la actividad de la célula.

## Orgánulos
- **Mitocondria**: produce la mayor parte del **ATP** de la célula mediante la **respiración celular**, que consume oxígeno y glucosa.
- **Ribosoma**: fabrica las proteínas.
- **Retículo endoplasmático**: el rugoso (con ribosomas) produce proteínas; el liso, lípidos.
- **Aparato de Golgi**: modifica, empaqueta y envía las proteínas.
- **Cloroplasto** (solo en plantas y algas): hace la fotosíntesis.
`

const FOTO_ES = `# La fotosíntesis

## Idea clave
La fotosíntesis convierte la **energía de la luz** en energía química. Ocurre en los **cloroplastos**, gracias a la **clorofila**, el pigmento verde que absorbe la luz.

## Ecuación
6 CO₂ + 6 H₂O + luz → C₆H₁₂O₆ (glucosa) + 6 O₂

## Fases
1. **Fase luminosa** (en los tilacoides): la luz rompe el agua, se libera **oxígeno** y se obtienen ATP y NADPH.
2. **Ciclo de Calvin** (en el estroma): con ese ATP y NADPH se fija el **CO₂** y se fabrica glucosa.

## Por qué importa
Produce casi todo el oxígeno de la atmósfera y es la base de casi todas las cadenas alimentarias.
`

const CELULA_EN = `# The cell

## What it is
The cell is the **basic unit of life**: every living thing is made of one or more cells, and every cell comes from another cell (cell theory).

## Types
- **Prokaryotic**: no nucleus; its DNA floats freely in the cytoplasm. Example: bacteria.
- **Eukaryotic**: has a membrane-bound nucleus. Makes up animals, plants, fungi and protists.

## Structure
- **Plasma membrane**: a lipid bilayer that separates the cell from the outside and controls what goes in and out.
- **Cytoplasm**: the watery medium that holds the organelles.
- **Nucleus**: stores the DNA and directs the cell's activity.

## Organelles
- **Mitochondrion**: makes most of the cell's **ATP** through **cellular respiration**, which uses oxygen and glucose.
- **Ribosome**: builds proteins.
- **Endoplasmic reticulum**: the rough ER (with ribosomes) makes proteins; the smooth ER makes lipids.
- **Golgi apparatus**: modifies, packages and ships proteins.
- **Chloroplast** (plants and algae only): carries out photosynthesis.
`

const FOTO_EN = `# Photosynthesis

## Key idea
Photosynthesis turns **light energy** into chemical energy. It happens in **chloroplasts**, thanks to **chlorophyll**, the green pigment that absorbs light.

## Equation
6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ (glucose) + 6 O₂

## Stages
1. **Light reactions** (in the thylakoids): light splits water, **oxygen** is released, and ATP and NADPH are made.
2. **Calvin cycle** (in the stroma): that ATP and NADPH are used to fix **CO₂** and build glucose.

## Why it matters
It produces almost all the oxygen in the atmosphere and is the base of nearly every food chain.
`

const T = (frente: string, reverso: string, fuente: string): TarjetaSimple => ({ frente, reverso, fuente })

/** El contenido del ejemplo, en el idioma de la interfaz. */
export function ejemplo(): Ejemplo {
  const celula = L('la-celula.md', 'the-cell.md')
  const foto = L('fotosintesis.md', 'photosynthesis.md')
  return {
    fuentes: { [celula]: L(CELULA_ES, CELULA_EN), [foto]: L(FOTO_ES, FOTO_EN) },
    tarjetas: idioma() === 'es'
      ? [
          T('¿Qué es la célula según la teoría celular?', 'La unidad básica de la vida: todo ser vivo está hecho de células y toda célula procede de otra.', `${celula}, § Qué es`),
          T('¿En qué se diferencia una célula procariota de una eucariota?', 'La procariota no tiene núcleo (su ADN está libre en el citoplasma); la eucariota sí.', `${celula}, § Tipos`),
          T('¿Qué función tiene la membrana plasmática?', 'Separa la célula del exterior y controla qué entra y qué sale.', `${celula}, § Estructura`),
          T('¿Qué orgánulo produce la mayor parte del ATP?', 'La mitocondria, mediante la respiración celular.', `${celula}, § Orgánulos`),
          T('¿Qué fabrican los ribosomas?', 'Las proteínas.', `${celula}, § Orgánulos`),
          T('¿Qué hace el aparato de Golgi?', 'Modifica, empaqueta y envía las proteínas.', `${celula}, § Orgánulos`),
          T('¿Dónde ocurre la fotosíntesis?', 'En los cloroplastos, gracias a la clorofila.', `${foto}, § Idea clave`),
          T('¿Cuál es la ecuación de la fotosíntesis?', '6 CO₂ + 6 H₂O + luz → glucosa + 6 O₂', `${foto}, § Ecuación`),
          T('¿Qué se libera en la fase luminosa?', 'Oxígeno (al romperse el agua), y se obtienen ATP y NADPH.', `${foto}, § Fases`),
          T('¿Qué ocurre en el ciclo de Calvin?', 'Se fija el CO₂ y se fabrica glucosa usando el ATP y el NADPH.', `${foto}, § Fases`),
        ]
      : [
          T('What is the cell, according to cell theory?', 'The basic unit of life: every living thing is made of cells, and every cell comes from another cell.', `${celula}, § What it is`),
          T('How does a prokaryotic cell differ from a eukaryotic one?', 'A prokaryotic cell has no nucleus (its DNA floats in the cytoplasm); a eukaryotic cell does.', `${celula}, § Types`),
          T('What does the plasma membrane do?', 'It separates the cell from the outside and controls what goes in and out.', `${celula}, § Structure`),
          T('Which organelle makes most of the ATP?', 'The mitochondrion, through cellular respiration.', `${celula}, § Organelles`),
          T('What do ribosomes build?', 'Proteins.', `${celula}, § Organelles`),
          T('What does the Golgi apparatus do?', 'It modifies, packages and ships proteins.', `${celula}, § Organelles`),
          T('Where does photosynthesis happen?', 'In the chloroplasts, thanks to chlorophyll.', `${foto}, § Key idea`),
          T('What is the equation of photosynthesis?', '6 CO₂ + 6 H₂O + light → glucose + 6 O₂', `${foto}, § Equation`),
          T('What is released in the light reactions?', 'Oxygen (when water is split), and ATP and NADPH are made.', `${foto}, § Stages`),
          T('What happens in the Calvin cycle?', 'CO₂ is fixed and glucose is built using ATP and NADPH.', `${foto}, § Stages`),
        ],
    mapa: L(
      `# Mapa mental: La célula
- Tipos
  - Procariota
    - Sin núcleo
    - Bacterias
  - Eucariota
    - Con núcleo
- Estructura
  - Membrana plasmática
  - Citoplasma
  - Núcleo: ADN
- Orgánulos
  - Mitocondria: ATP
  - Ribosoma: proteínas
  - Aparato de Golgi
  - Cloroplasto
- Fotosíntesis
  - Fase luminosa: O₂
  - Ciclo de Calvin: glucosa
`,
      `# Mind map: The cell
- Types
  - Prokaryotic
    - No nucleus
    - Bacteria
  - Eukaryotic
    - Has a nucleus
- Structure
  - Plasma membrane
  - Cytoplasm
  - Nucleus: DNA
- Organelles
  - Mitochondrion: ATP
  - Ribosome: proteins
  - Golgi apparatus
  - Chloroplast
- Photosynthesis
  - Light reactions: O₂
  - Calvin cycle: glucose
`,
    ),
  }
}
