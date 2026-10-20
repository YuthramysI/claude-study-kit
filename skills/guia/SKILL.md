---
name: guia
description: Crea una guía de estudio completa (resumen, conceptos clave, glosario, FAQ y línea de tiempo) a partir de las fuentes del cuaderno activo y la guarda en salidas/. Úsala cuando el usuario pida un resumen, una guía, apuntes o un repaso del tema.
argument-hint: "[tema opcional]"
---

# Guía de estudio

Enfoque pedido: $ARGUMENTS (si está vacío, todo el cuaderno).

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo`. Si no hay cuaderno o fuentes, avisa y para.
2. Lee todas las fuentes relevantes con Read.
3. Escribe la guía en Markdown con estas secciones, citando `[archivo, p. X]` en cada idea:

   ```
   # Guía de estudio: <tema>
   ## Resumen en 5 líneas
   ## Ideas clave        (8–15 viñetas, de lo más a lo menos importante)
   ## Conceptos y relaciones   (cómo se conectan las ideas; un mapa mental en lista anidada)
   ## Glosario           (término — definición breve)
   ## Preguntas frecuentes      (6–10 preguntas y respuestas)
   ## Línea de tiempo    (solo si hay fechas o procesos con orden)
   ## Preguntas para practicar  (5 preguntas abiertas de examen, sin respuesta)
   ## Fuentes usadas
   ```

4. Guárdala con Write en `<salidas>/guia-<tema-en-minusculas-con-guiones>.md` (o `guia.md` si es de todo el cuaderno).
5. En el chat muestra solo el **Resumen** y las **Ideas clave**, más la ruta del archivo. Ofrece crear tarjetas con `/estudio:tarjetas`, hacer un quiz con `/estudio:quiz` o reunirlo todo en un PDF para imprimir con `/estudio pdf`.
