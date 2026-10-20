---
name: mapa
description: Crea un mapa mental de los conceptos de las fuentes del cuaderno activo (o de un tema) y lo guarda para verlo dibujado en el panel y en el PDF. Úsala cuando el usuario pida un mapa mental, un mapa conceptual, un esquema o una visión de conjunto del tema.
argument-hint: "[tema o archivo]"
---

# Mapa mental

Tema: $ARGUMENTS (si está vacío, todo el cuaderno).

## Pasos

1. Llama a `mcp__estudio__cuaderno_activo`. Si no hay cuaderno o fuentes, avisa y para.
2. Lee las fuentes relevantes con Read.
3. Organiza los conceptos en un árbol:
   - **Raíz**: el tema central, en 1–4 palabras.
   - **4–7 ramas** principales (categorías, partes, etapas, causas…).
   - Cada rama con **2–5 hijos**, y como mucho **un nivel más** donde aporte (3 niveles bajo la raíz en total).
   - **Etiquetas cortas**: 1–5 palabras, sin frases completas ni puntos finales. Una fórmula o un dato clave cabe («ATP: energía»).
   - Ordena las ramas con lógica (de lo general a lo concreto, o cronológica).
   - Como mucho ~60 nodos: si el tema es enorme, haz un mapa por subtema.
4. Guárdalo con Write en `<salidas>/mapa-<tema-en-minusculas-con-guiones>.md` (o `mapa.md` si es de todo el cuaderno) con **exactamente** este formato: el título y una lista anidada con dos espacios por nivel, nada más.

   ```
   # Mapa mental: La célula
   - Tipos
     - Procariota
       - Sin núcleo
     - Eucariota
   - Orgánulos
     - Mitocondria: energía (ATP)
     - Ribosoma: proteínas
   ```

5. Dile al usuario que el mapa está en la pestaña **🧠 Mapa** del panel (`/estudio mapa`) y que `/estudio pdf` lo incluye dibujado. Muestra en el chat el mismo esquema en forma de lista y ofrece crear tarjetas de las ramas que más le cuesten (`/estudio:tarjetas`).
