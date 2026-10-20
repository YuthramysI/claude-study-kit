# Cómo contribuir

¡Gracias por querer mejorar **estudio**!

## Preparar el entorno

1. Instala [Claude Code](https://docs.claude.com/en/docs/claude-code).
2. Clona el repositorio y ejecuta Claude Code con el plugin cargado desde la carpeta:
   ```bash
   claude --plugin-dir /ruta/a/estudio
   ```
   Al guardar un archivo, el plugin se recarga solo.

## Antes de abrir un pull request

```bash
claude plugin validate .   # manifiesto y hooks, sin errores
claude plugin test .       # todos los tests pasan
```

- Añade tests para lo nuevo: la lógica pura va en `hooks/*.ts` con su `*.test.ts`, y la interfaz se prueba montando el panel en `terminal` y `desktop`.
- Anota el cambio en `CHANGELOG.md`, en la sección «Sin publicar».

## Reglas del motor que conviene conocer

El módulo de hooks corre en un entorno propio, sin Node ni DOM. El validador exige:

- `$` solo se usa como `$.noun.metodo(...)` o se pasa a funciones declaradas en el nivel superior de un archivo del plugin. Por eso `hooks/motor.ts` enlaza un `Host` y el resto del código usa ese `Host`.
- Las referencias de estado (`atom(...)`) son constantes del mismo archivo donde se leen; por eso viven en `motor.ts`.
- En un `.tsx` no llames `h` a ninguna variable: `h` es la función de JSX.

## Estilo

- Código, interfaz y comentarios en español.
- Funciones pequeñas y puras donde se pueda.
- Mensajes claros para quien estudia: qué pasó y qué hacer.

## Ideas bienvenidas

- Traducción de la interfaz a otros idiomas.
- Más formatos de importación (Quizlet, Markdown).
- Un mapa mental visual en el panel.
