# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- `/pomodoro probar`: lanza un aviso de prueba y dice qué funcionó (sonido, notificación, temporizador).
- El aviso de fin de fase también aparece como una línea `🔔` en la conversación, para las superficies que no muestran avisos flotantes ni notificaciones (por ejemplo, VS Code).

### Corregido
- `/pomodoro` sin argumentos ya no pausa un pomodoro en marcha: lo inicia, lo reanuda o dice cuánto queda. Para pausar, usa `/pomodoro pausar`.

## [1.0.0] - 2026-10-20

### Añadido
- Pestaña **📊 Stats**: racha de días (actual y mejor), pomodoros, horas de enfoque, repasos y % de aciertos de hoy, de los últimos 7 días y en total; gráficos de 7 y 28 días; tarjetas nuevas, en aprendizaje y maduras.
- **Anki**: `/tarjetas exportar` (texto con tabuladores, con mazo y etiquetas) y `/tarjetas importar <archivo>` (Anki, CSV con `,` o `;`, o líneas `frente :: reverso`; quita el HTML).
- `/tarjetas`: resumen del cuaderno activo.
- Opciones nuevas: toques y volumen de la alarma, iniciar solo el siguiente pomodoro, y recordatorio de tarjetas pendientes al abrir sesión.
- El pomodoro en marcha se recupera al volver a abrir Claude Code.
- Copias de seguridad de las tarjetas: `tarjetas.bak.json` y una instantánea por día de la semana en `.respaldos/`.
- Recuperación automática si `tarjetas.json` se daña (la copia dañada se conserva aparte).
- Se aceptan tarjetas escritas a mano solo con `frente` y `reverso`.
- Alias `/promodoro`.
- README en inglés, licencia MIT y guía de contribución.

### Cambiado
- La alarma suena 3 veces (configurable) en vez de una.
- Los comandos que fallan responden con el error en vez de quedarse mudos.
- El historial de pomodoros de la versión 0.1 se convierte a las nuevas estadísticas.

## [0.1.0] - 2026-10-20

### Añadido
- Primera versión: Pomodoro con panel y barra de estado, tarjetas con repaso SM-2, cuadernos de fuentes, y las skills preguntar, tarjetas, guía, quiz y audio.
