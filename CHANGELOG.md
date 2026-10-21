# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- **Cuaderno de ejemplo**: `/cuaderno demo` (también `ejemplo` o `example`) crea un cuaderno con dos fuentes (la célula y la fotosíntesis), 10 tarjetas con su cita y un mapa mental, en el idioma de la interfaz, para probarlo todo sin preparar nada. Si ya existe, solo lo activa. La ayuda, `/cuaderno` sin cuadernos y la pestaña Cuaderno vacía lo sugieren.

### Documentación
- Demo en inglés (`docs/demo-en.gif` y `docs/demo-en.mp4`) y capturas en inglés para el README en inglés (`docs/*-en.png`).
- Sección «Pruébalo en 30 segundos» en los dos README.
- README nuevo en español e inglés, más limpio: demo en video (`docs/demo.gif` y `docs/demo.mp4`, 65 s), guía de uso paso a paso, tabla de todo lo que hace, referencia plegable (comandos, skills, teclas, configuración, idioma, datos), requisitos y problemas frecuentes.

## [1.4.0] - 2026-10-20

### Añadido
- **Interfaz en español o inglés.** Opción `idioma` en `/config` (`auto`, `es`, `en`); con `auto`, se elige según `LANGUAGE`, `LC_ALL` o `LANG`. Se traducen el panel, los comandos y su ayuda, los avisos, la voz, los logros y niveles, el PDF de repaso y el informe semanal. `cuaderno_activo` devuelve `idioma` y las skills responden y escriben sus archivos en ese idioma.
- Los comandos entienden argumentos en inglés: `/pomodoro start|pause|resume|skip|stop|status|task|test`, `/estudio review|notebook|map|achievements|summary|report [last]|mute|help`, `/anki export|import`, `/examen goal|clear`.
- `/examen` lee fechas en inglés («November 15», «Nov 15 2026», «in 3 weeks», «tomorrow») y también mes/día cuando no puede ser día/mes («11/15»).
- Las pestañas de `/estudio` se pueden abrir por el comienzo de su nombre (`/estudio rep`).

## [1.3.0] - 2026-10-20

### Añadido
- **Estadísticas pro**: la pestaña Stats se divide en General, Repaso y Hábitos. Gráficos nuevos: pronóstico de repasos a 30 días, curva de aciertos, notas por tipo, histograma de dificultad FSRS, mapa hora × día de la semana y mejores horas. Los días guardan los minutos por hora, las notas por tipo y los exámenes.
- **Sesiones de estudio**: tramos de actividad seguida (pausas de hasta 30 min) con duración, pomodoros, temas, repasos y tarjetas creadas; la en curso, en la pestaña Pomodoro; las recientes, en Hábitos.
- **Diario** diario en `~/estudio/diario/AAAA-MM-DD.md` y **coach**: `/estudio resumen` resume la sesión y el día, y Claude (modelo pequeño) da 2–3 consejos con tus datos. Herramienta `resumen_estudio` para que Claude responda «¿cómo voy?».
- **Logros y niveles**: XP calculada de tus datos, niveles con título y 24 insignias, con aviso al desbloquear y al subir de nivel. Pestaña 🏆 Logros.
- **Plan de examen**: `/examen <fecha> [título]` (también «en 20 días», «15 de noviembre»), `meta`, `borrar`; cuenta atrás, meta diaria de tarjetas nuevas y pomodoros, previsión FSRS de recuerdo el día del examen y aviso si vas atrasado. El límite diario de nuevas sube solo si el plan lo necesita. Se ve en las pestañas Cuaderno y Pomodoro, y en la portada del PDF.
- **Examen simulado**: skill `/estudio:simulacro` y herramientas `examen_cronometro` y `registrar_examen`. Cronómetro en la barra de estado (junto al del pomodoro) con aviso al acabar; las notas y su evolución salen en Stats.
- **Informe semanal compartible**: `/estudio informe [pasada]`, botón 📸 en Stats y herramienta `generar_informe_semanal`; imagen PNG de 1080×1350 en `~/estudio/informes/`. Recordatorio los lunes.

### Cambiado
- La conversión con el navegador (PDF y PNG) comparte una sola función.
- `fechaLarga` y los nombres de los meses viven en `srs.ts`, en vez de duplicados.

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
