---
name: tarjetas
description: Genera tarjetas (flashcards) de estudio a partir de las fuentes del cuaderno activo y las guarda para el repaso espaciado. Úsala cuando el usuario pida flashcards, tarjetas o material para memorizar.
argument-hint: "[número] [tema o archivo]"
---

# Crear tarjetas de estudio

Petición: $ARGUMENTS (por defecto, 15 tarjetas de todo el cuaderno).

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo`. Si no hay cuaderno o fuentes, avisa y para.
2. Lee las fuentes relevantes con Read (si el usuario nombró un tema o un archivo, céntrate en eso).
3. Escribe las tarjetas siguiendo estas reglas (principios de Wozniak):
   - **Una idea por tarjeta.** Frente concreto y sin ambigüedad: «¿Qué es…?», «¿Por qué…?», «¿Cuál es la diferencia entre…?», «Completa: …».
   - **Reverso breve**: 1–2 frases o una lista corta. Nada de párrafos.
   - Incluye definiciones, causas y efectos, comparaciones, fórmulas, fechas y ejemplos clave.
   - Evita las preguntas de sí/no y las que se responden copiando el frente.
   - `fuente`: archivo y página o sección, p. ej. `tema3.pdf, p. 14`.
   - Usa el idioma de las fuentes, salvo que el usuario pida otro.
4. Guárdalas con **una sola** llamada a `mcp__estudio__guardar_tarjetas` con `{ "tarjetas": [ { "frente", "reverso", "fuente" }, ... ] }`.
5. Di cuántas se guardaron, muestra 3 de ejemplo y recuerda que se repasan con `/repasar` (o en el panel `/estudio`).
