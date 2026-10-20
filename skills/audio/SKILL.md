---
name: audio
description: Crea un "resumen en audio" (estilo podcast) de las fuentes del cuaderno activo y lo lee en voz alta. Úsala cuando el usuario quiera escuchar un resumen, un podcast o repasar mientras hace otra cosa.
argument-hint: "[minutos] [tema]"
---

# Resumen en audio

Petición: $ARGUMENTS (por defecto, unos 4 minutos de todo el cuaderno).

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo`. Si no hay cuaderno o fuentes, avisa y para.
2. Lee las fuentes con Read.
3. Escribe un **guion para escuchar** (unas 140 palabras por minuto):
   - Tono cercano de profesor que explica a un amigo; frases cortas.
   - Estructura: gancho inicial → 3–5 ideas clave con un ejemplo cada una → conexiones entre ellas → resumen final con «lo que no debes olvidar».
   - **Texto plano**: sin markdown, viñetas, emojis, tablas ni fórmulas en símbolos (escríbelas con palabras: «a al cuadrado más b al cuadrado»).
   - Sin citas entre corchetes en el guion hablado.
4. Guarda el guion con Write en `<salidas>/audio-<tema>.md`, con un bloque final «Fuentes» que liste los archivos usados.
5. Llama a `mcp__estudio__leer_en_voz_alta` con el guion (solo el texto hablado, sin el bloque de fuentes).
6. Di al usuario que ya está sonando, cuánto dura aproximadamente, y que puede pararlo con `/estudio callar`.
