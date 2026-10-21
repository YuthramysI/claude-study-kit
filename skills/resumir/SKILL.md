---
name: resumir
description: Resume fuentes del cuaderno de estudio activo (las nuevas, o las que indique el usuario), guarda un resumen por fuente y crea tarjetas de cada una. Úsala cuando el usuario añada material nuevo o pida resumir un PDF, un tema o sus apuntes. EN: Summarize new (or chosen) sources and make flashcards from each one.
argument-hint: "[archivo | archivo ...]"
---

# Resumir fuentes

> **Idioma / Language:** la respuesta de `mcp__estudio__cuaderno_activo` trae `idioma`. Si es `en`, responde al usuario y escribe todos los archivos **en inglés** (los títulos de las secciones también), aunque estas instrucciones estén en español. Si es `es`, en español. Las citas de las fuentes se dejan en su idioma original.

Fuentes a resumir: $ARGUMENTS

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo`. Si no hay cuaderno, avisa y para.
2. Decide qué resumir:
   - Si `$ARGUMENTS` nombra archivos (separados por `|`), esos.
   - Si no, las de `fuentesNuevas`.
   - Si no hay nuevas, pregunta al usuario cuáles quiere (o todas).
3. Para **cada** fuente, de una en una:
   1. Léela con Read (los PDF largos, por rangos de `pages`).
   2. Escribe con Write `<salidas>/resumen-<nombre-del-archivo-sin-extension>.md`:

      ```
      # Resumen: <título o tema de la fuente>
      > Fuente: <archivo> · <nº de páginas o secciones>

      ## En 5 líneas
      ## Ideas clave        (6–10 viñetas, cada una con su cita [archivo, p. X])
      ## Conceptos           (término — definición breve)
      ## Para practicar      (3 preguntas abiertas)
      ```
   3. Crea **8–12 tarjetas** de esa fuente (una idea por tarjeta, reverso breve, `fuente` con archivo y página) y guárdalas con **una** llamada a `mcp__estudio__guardar_tarjetas`.
4. Al terminar, llama a `mcp__estudio__marcar_fuentes_resumidas` con los archivos resumidos, para que dejen de avisarse como nuevas.
5. Dile al usuario, en pocas líneas: qué fuentes resumiste, dónde quedaron los resúmenes, cuántas tarjetas creaste en total, y que puede repasarlas con `/repasar` o reunirlo todo con `/estudio pdf`.

## Reglas

- Usa solo lo que dicen las fuentes; nunca inventes citas ni páginas.
- Si una fuente no se puede leer (formato raro, imagen sin texto legible), dilo y sigue con las demás.
