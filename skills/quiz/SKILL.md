---
name: quiz
description: Hace un quiz interactivo de opción múltiple sobre las fuentes del cuaderno activo, una pregunta a la vez, con puntuación y explicación. Úsala cuando el usuario quiera ponerse a prueba, un examen de práctica o un test. EN: Interactive multiple-choice quiz on the sources, one question at a time.
argument-hint: "[número de preguntas] [tema]"
---

# Quiz interactivo

> **Idioma / Language:** la respuesta de `mcp__estudio__cuaderno_activo` trae `idioma`. Si es `en`, responde al usuario y escribe todos los archivos **en inglés** (los títulos de las secciones también), aunque estas instrucciones estén en español. Si es `es`, en español. Las citas de las fuentes se dejan en su idioma original.

Petición: $ARGUMENTS (por defecto, 8 preguntas de todo el cuaderno, de dificultad mixta).

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo`. Si no hay cuaderno o fuentes, avisa y para.
2. Lee las fuentes con Read y prepara **en privado** (no las muestres todavía) N preguntas de opción múltiple:
   - 4 opciones; distractores plausibles, sacados de confusiones reales del tema.
   - Mezcla recordar, comprender y aplicar (casos o ejemplos nuevos).
   - Anota para cada una la respuesta correcta, una explicación de 1–2 frases y su cita `[archivo, p. X]`.
3. Haz las preguntas **de una en una** con la herramienta AskUserQuestion (header `P1/8`, etc.; las 4 opciones como labels cortos, el texto largo en description).
4. Tras cada respuesta di ✅ o ❌, la respuesta correcta, la explicación y la cita. Luego pasa a la siguiente.
5. Al terminar:
   - Puntuación (p. ej. `6/8 · 75 %`) y qué temas reforzar.
   - Convierte **cada pregunta fallada** en una tarjeta y guárdalas con `mcp__estudio__guardar_tarjetas`.
   - Guarda el quiz completo, con sus respuestas, en `<salidas>/quiz-<fecha AAAA-MM-DD>.md` con Write (si ya existe uno de hoy, añade `-2`, `-3`…).
   - Recuerda que `/estudio pdf` incluye este quiz y las tarjetas nuevas en el PDF de repaso.
