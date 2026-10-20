# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

## [1.2.0] - 2026-10-20

### Añadido
- **FSRS** sustituye a SM-2 (parámetros por defecto de FSRS-4.5): cada tarjeta guarda su estabilidad y su dificultad, y el repaso cae cuando la probabilidad de recordarla baja a la retención deseada (opción `retencion`, 90 % por defecto). Las tarjetas de SM-2 se convierten solas.
- **Límite diario de tarjetas nuevas** (opción `nuevasPorDia`, 20 por defecto); el panel, `/anki` y el PDF muestran las que esperan turno.
- Repaso: **editar** y **borrar** la tarjeta actual, **deshacer** la última calificación, y **modo escribir**: Claude (modelo pequeño) corrige tu respuesta y sugiere la nota; sin modelo, compara palabras clave.
- **Tarea en cada pomodoro** (`/pomodoro 50 Química`, `/pomodoro tarea …`, o desde el panel con las recientes a un clic); por defecto, el cuaderno activo. Las estadísticas, `/estudio stats` y la portada del PDF muestran el **tiempo por tema**.
- **Fuentes nuevas**: el plugin revisa `fuentes/` cada 30 s, avisa de lo nuevo y ofrece **✨ Resumir y crear tarjetas**. Nueva skill `/estudio:resumir` y herramienta `marcar_fuentes_resumidas`; `cuaderno_activo` incluye `fuentesNuevas`.
- **Mapa mental**: skill `/estudio:mapa`, pestaña **🧠 Mapa** (SVG en VS Code y escritorio; árbol de texto en la terminal) y diagrama en el PDF.

## [1.1.0] - 2026-10-20

### Añadido
- **PDF de repaso** (`/estudio pdf`, botón 📄 PDF y herramienta `generar_pdf_repaso`): portada con estadísticas y gráficos, todas las tarjetas agrupadas por etapa, las guías, quizzes y guiones de `salidas/` maquetados, y tarjetas para recortar a doble cara. Usa Chrome, Chromium, Edge o Brave sin abrir ventana; si no hay ninguno, deja el HTML para imprimir.
- `/pomodoro probar`: lanza un aviso de prueba y dice qué funcionó (sonido, notificación, temporizador).
- El aviso de fin de fase también aparece como una línea `🔔` en la conversación, para las superficies que no muestran avisos flotantes ni notificaciones (por ejemplo, VS Code).

### Cambiado
- Las tarjetas repasadas hoy se cuentan desde las estadísticas, así que siguen bien aunque la sesión pase de medianoche.
- Código muerto eliminado (`barra` del Pomodoro y dos métodos sin uso del Host) y registros de arranque con nombre propio, en vez de una lista paralela.
- **Rediseño del panel.** En VS Code y escritorio, el Pomodoro es un anillo de progreso con los puntos del ciclo; las estadísticas muestran barras de la semana, un mapa de actividad de 16 semanas y la barra de etapas de las tarjetas. En la terminal, el reloj usa dígitos grandes y barras de color. Tarjetas de resumen con borde y colores del tema, tarjeta de repaso con pregunta y respuesta destacadas, botones de calificación en colores con su intervalo, e iconos por tipo de fuente.
- `/tarjetas` pasa a llamarse **`/anki`** (resumen, `exportar`, `importar <archivo>`).

### Corregido
- **El Pomodoro no avisaba al terminar.** Claude Code rechazaba el comando `/tarjetas` (choca con la skill `/estudio:tarjetas`), y ese rechazo abortaba el arranque del plugin antes de encender el temporizador. Ahora el temporizador arranca primero, cada comando se registra por separado y cualquier comando o turno vuelve a encender el temporizador si no está latiendo.
- `/pomodoro` sin argumentos ya no pausa un pomodoro en marcha: lo inicia, lo reanuda o dice cuánto queda. Para pausar, usa `/pomodoro pausar`.
- `/repasar` sin tarjetas pendientes ya no dice que pulses `m`.
- El respaldo del temporizador podía sustituir el temporizador de la sesión por uno ligado a un comando o a un turno; ahora siempre rearranca el de la sesión, y no salta en el primer segundo tras una recarga.
- `/pomodoro iniciar` con el reloj en marcha ya no reinicia la fase (con minutos, `/pomodoro iniciar 50`, sí empieza uno nuevo).
- Releer un `tarjetas.json` dañado sin copia válida creaba una copia del archivo dañado en cada lectura; ahora guarda una sola por contenido.
- Si el navegador falla al crear el PDF, el mensaje da el motivo en vez de «no encontré Chrome».
- La racha decía «1 días».
- En Windows, la carpeta de estudio se resuelve con `USERPROFILE`.
- `tsc -p .` fallaba con los tipos que genera Claude Code (la lista de herramientas MCP va una recarga por detrás); el `tsconfig.json` ya no depende de ella.
- La herramienta `generar_pdf_repaso` está siempre visible para Claude, que la usa cuando le pides el PDF.
- Los ids de tarjetas nuevas son únicos aunque dos tandas coincidan en el mismo milisegundo.

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
