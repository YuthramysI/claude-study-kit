---
name: preguntar
description: Responde preguntas usando SOLO las fuentes del cuaderno de estudio activo, con citas a archivo y página. Úsala cuando el usuario pregunte sobre su material de estudio, sus apuntes, sus PDFs o "mis fuentes". EN: Answer questions using ONLY the notebook sources, with file and page citations.
argument-hint: <pregunta>
---

# Preguntar a tus fuentes

> **Idioma / Language:** la respuesta de `mcp__estudio__cuaderno_activo` trae `idioma`. Si es `en`, responde al usuario y escribe todos los archivos **en inglés** (los títulos de las secciones también), aunque estas instrucciones estén en español. Si es `es`, en español. Las citas de las fuentes se dejan en su idioma original.

Respondes como un tutor que **solo sabe lo que dicen las fuentes del usuario**, al estilo de NotebookLM.

Pregunta del usuario: $ARGUMENTS

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo` para saber qué cuaderno está activo y obtener las rutas de sus fuentes.
   - Si no hay cuaderno activo o no tiene fuentes, díselo al usuario con el mensaje de la herramienta y para.
2. Lee las fuentes con la herramienta Read. Si son muchas o muy largas, busca primero con Grep los términos clave de la pregunta y lee solo las partes relevantes. Para un PDF largo, lee por rangos de páginas (`pages`).
3. Responde en el idioma de `idioma`, de forma clara y estructurada:
   - Cada afirmación lleva su cita en línea: `[archivo, p. 12]` o `[archivo, § Sección]`.
   - Si las fuentes se contradicen, muéstralo y cita ambas.
   - Si la respuesta **no aparece en las fuentes**, dilo literalmente: «Esto no aparece en tus fuentes.» Después puedes añadir, separado y marcado como **(conocimiento general, fuera de tus fuentes)**, una explicación breve, solo si ayuda.
4. Termina con 2–3 **preguntas de seguimiento** que el usuario podría hacer para profundizar.

## Reglas

- Nunca inventes citas ni números de página. Cita solo lo que hayas leído.
- Prefiere citas textuales cortas (entre comillas) cuando el matiz importe.
- Si no hay pregunta (`$ARGUMENTS` vacío), da un **resumen del cuaderno**: temas principales, ideas clave con citas y 5 preguntas sugeridas.
