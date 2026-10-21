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
npx -p typescript tsc -p . --noUnusedLocals --noUnusedParameters   # tipos, sin código muerto
```

`tsc` necesita `.claude-plugin/types/`, que Claude Code genera al cargar el plugin con `claude --plugin-dir .`.

- Añade tests para lo nuevo: la lógica pura va en `hooks/*.ts` con su `*.test.ts`, y la interfaz se prueba montando el panel en `terminal` y `desktop`.
- Anota el cambio en `CHANGELOG.md`, en la sección «Sin publicar».

## Reglas del motor que conviene conocer

El módulo de hooks corre en un entorno propio, sin Node ni DOM. El validador exige:

- `$` solo se usa como `$.noun.metodo(...)` o se pasa a funciones declaradas en el nivel superior de un archivo del plugin. Por eso `hooks/motor.ts` enlaza un `Host` y el resto del código usa ese `Host`.
- Las referencias de estado (`atom(...)`) son constantes del mismo archivo donde se leen; por eso viven en `motor.ts`.
- En un `.tsx` no llames `h` a ninguna variable: `h` es la función de JSX.

## Estilo

- Código y comentarios en español.
- Todo texto que vea el usuario va en los dos idiomas con `L('español', 'English')` de `hooks/i18n.ts`. En objetos constantes usa *getters* (`get nombre() { return L(…) }`) para que el texto se elija al usarlo, no al cargar el módulo. Las descripciones de herramientas y los prompts para el modelo pueden quedarse en español.
- Funciones pequeñas y puras donde se pueda.
- Mensajes claros para quien estudia: qué pasó y qué hacer.

## Ideas bienvenidas

- Más idiomas: hoy `L()` admite español e inglés; añadir un tercero empieza en `hooks/i18n.ts`.
- Más formatos de importación (Quizlet, Markdown).
- Un mapa mental visual en el panel.
