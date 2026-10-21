---
name: simulacro
description: Hace un examen simulado cronometrado sobre las fuentes del cuaderno activo (preguntas tipo test y de desarrollo), lo corrige con nota sobre 10, explica los puntos débiles y convierte los fallos en tarjetas. Úsala cuando el usuario quiera un simulacro, un examen de prueba o ponerse a prueba en condiciones de examen.
argument-hint: "[nº de preguntas] [minutos] [tema]"
---

# Examen simulado

Petición: $ARGUMENTS (por defecto, 10 preguntas en 15 minutos, de todo el cuaderno).

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo`. Si no hay cuaderno o fuentes, avisa y para. Si tiene `plan.json` con fecha de examen, menciónala.
2. Lee las fuentes con Read y prepara **en privado** el examen (no lo muestres de golpe):
   - ~70 % **tipo test** (4 opciones, una correcta, distractores plausibles) y ~30 % **de desarrollo breve** (3–5 líneas).
   - Cubre los temas principales, de lo básico a lo aplicado (casos, ejemplos nuevos).
   - Anota la respuesta correcta, una explicación de 1–2 frases y su cita `[archivo, p. X]`.
3. Explica las reglas en dos líneas (número de preguntas, tiempo, cómo se puntúa) y llama a `mcp__estudio__examen_cronometro` con `accion: "iniciar"`, `minutos` y `preguntas`. El tiempo se ve en la barra de estado y el plugin avisa cuando se acaba.
4. Haz las preguntas **de una en una**, sin dar la solución todavía:
   - Tipo test: con AskUserQuestion (header `P1/10`, las 4 opciones como labels cortos).
   - Desarrollo: escribe la pregunta y pide al usuario que responda en el chat; espera su respuesta.
   - Si avisa de que se acabó el tiempo, termina la pregunta en curso y pasa a corregir.
5. Llama a `mcp__estudio__examen_cronometro` con `accion: "parar"`.
6. Corrige con una nota **sobre 10**: cada pregunta de test vale 1 punto y cada una de desarrollo, 2 (0, 0,5, 1, 1,5 o 2 según lo completa y precisa que sea); reescala el total a 10 con un decimal.
7. Entrega el informe:
   - **Nota** y tiempo usado.
   - Tabla: pregunta · tu respuesta · correcta · ✅/❌ · cita.
   - **Puntos débiles**: los 2–3 temas a reforzar, con qué repasar.
8. Convierte **cada fallo** en una tarjeta y guárdalas con una llamada a `mcp__estudio__guardar_tarjetas`.
9. Guarda el examen completo y su corrección con Write en `<salidas>/simulacro-<AAAA-MM-DD>.md` (si ya existe uno de hoy, añade `-2`, `-3`…). Entrará en el PDF de repaso.
10. Llama a `mcp__estudio__registrar_examen` con `nota`, `preguntas` y un `titulo` corto. Repite al usuario la comparación con el anterior que devuelve.
