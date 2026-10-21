# 📚 estudio: estudia dentro de Claude Code

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code)
[![Tests](https://img.shields.io/badge/tests-95_pasan-brightgreen.svg)](#desarrollo)

**[English](README.en.md)** · Español

Un plugin que convierte Claude Code en tu espacio de estudio: **Pomodoro**, **tarjetas con repaso espaciado** y **cuadernos de fuentes al estilo NotebookLM**. Claude estudia contigo usando *tus* apuntes y cita de dónde saca cada respuesta.

![Panel de estudio en VS Code: anillo del Pomodoro, pomodoros de la semana y mapa de actividad](docs/graficos.png)

<sub>El panel en VS Code y en la app de escritorio (datos de ejemplo). En la terminal se dibuja así:</sub>

```
🍅 Pomodoro  🃏 Repaso  📚 Cuaderno  🧠 Mapa  📊 Stats  🏆 Logros
──────────────────────────────────────────────
🍅 ENFOQUE   ● ○ ○ ○

┏━┓ ┏━╸   ┏━┓ ┏━┓
┃ ┃ ┗━┓ ╹ ┃ ┃ ┃ ┃
┗━┛ ┗━┛ ╹ ┗━┛ ┗━┛

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────

[ ⏸ Pausar ] [ ⏭ Saltar ] [ ⏹ Parar ]
Después: descanso · 5 min
Hoy: 3 pomodoros · 1 h 15 min  ·  🔥 5 días
```

## ✨ Qué hace

| | |
|---|---|
| 🍅 **Pomodoro** | Reloj en la barra de estado y en el panel. Alarma (campana ×3) y notificación al terminar cada fase. Descanso largo cada 4 pomodoros. **Cada pomodoro lleva su tarea** (por defecto, el cuaderno activo) y las estadísticas muestran el tiempo por tema. Si cierras Claude Code, el pomodoro sigue al volver. |
| 🃏 **Tarjetas FSRS** | Claude crea flashcards a partir de tus fuentes y tú las repasas en el panel. Las programa **FSRS**, el algoritmo de Anki moderno (menos repasos para recordar lo mismo), con un **límite diario de nuevas**. Puedes **escribir tu respuesta** para que Claude la corrija, **editar** o **borrar** una tarjeta y **deshacer** la última nota. |
| 📚 **Cuadernos** | Una carpeta por tema con tus PDFs, apuntes o fotos. Claude responde **solo con tus fuentes**, cita `[archivo, p. X]` y avisa cuando algo no está en ellas. Cuando añades material, **lo detecta y te ofrece resumirlo y crear tarjetas**. |
| 🧠 **Mapa mental** | Claude organiza los conceptos en un mapa que se dibuja en el panel y en el PDF. |
| 📝 **Guía, quiz y audio** | Guía de estudio con glosario y FAQ, quiz interactivo (las preguntas que fallas se convierten en tarjetas) y un resumen tipo podcast leído en voz alta. |
| 📊 **Estadísticas pro** | Tres vistas: **General** (racha, semana, tiempo por tema, actividad de 16 semanas), **Repaso** (pronóstico de repasos a 30 días, curva de aciertos, notas, dificultad FSRS, etapas) y **Hábitos** (mapa hora × día de cuándo estudias, tus mejores horas, sesiones recientes). |
| 📝 **Sesiones y diario** | Cada tramo de estudio queda como sesión, cada día tiene su diario en Markdown y un **coach** (Claude) te da 2–3 consejos concretos con tus datos. |
| 🏆 **Logros y niveles** | XP por cada minuto de foco y cada repaso, niveles con título (de Novato a Leyenda) y 24 insignias: rachas, maratones, búho nocturno, sobresaliente… |
| 🎯 **Plan de examen** | Fecha del examen por cuaderno: cuenta atrás, meta diaria de tarjetas y pomodoros, **previsión de cuánto recordarás ese día** (FSRS) y aviso si vas atrasado. |
| ⏱️ **Examen simulado** | Cronometrado, con preguntas tipo test y de desarrollo sacadas de tus fuentes; Claude lo corrige con nota sobre 10 y ves tu evolución. |
| 📸 **Informe semanal** | Una tarjeta PNG preciosa con tu semana (horas, racha, temas, logros, nivel), lista para compartir en redes o con tu grupo. |
| 📄 **PDF de repaso** | Un documento listo para imprimir: portada con estadísticas y gráficos, todas tus tarjetas, las guías y quizzes que generó Claude, y tarjetas para recortar a doble cara. |
| 🔁 **Anki** | Exporta tus tarjetas a Anki o importa mazos de Anki y CSV. |
| 🛡️ **A prueba de fallos** | Copia de seguridad automática de las tarjetas (una semana de historia) y recuperación si `tarjetas.json` se daña. |

Todo se queda en tu equipo: el plugin no usa la red, y tus fuentes solo las lee Claude cuando se lo pides.

## 🚀 Instalación

Necesitas [Claude Code](https://docs.claude.com/en/docs/claude-code). Está probado con la versión 2.1.304.

En una sesión de Claude Code, en la terminal:

```
/plugin install estudio --marketplace YuthramysI/claude-study-kit
```

Responde `y` para añadir el marketplace y elige el ámbito (usuario). Desde una shell:

```bash
claude plugin install estudio --marketplace YuthramysI/claude-study-kit
```

En la app de escritorio: **+** junto al cuadro de texto → **Plugins** → **Add marketplace** `YuthramysI/claude-study-kit` → **Add plugin**.

## 🏁 Primeros pasos

```text
/cuaderno biologia            crea ~/estudio/biologia/
                              → copia tus PDFs o apuntes a ~/estudio/biologia/fuentes/
/estudio                      abre el panel
/pomodoro                     empieza a estudiar (25 min)
/estudio:tarjetas 20          Claude crea 20 tarjetas a partir de tus fuentes
/repasar                      repasa lo que toca hoy
/estudio:mapa                 mapa mental de tus fuentes
/estudio pdf                  todo tu repaso en un PDF para imprimir
/examen 15/11 Bioquímica      plan de examen con cuenta atrás y meta diaria
/estudio:simulacro            examen simulado cronometrado, con nota sobre 10
/estudio informe              tu semana en una imagen para compartir
```

## 📖 Comandos

| Comando | Qué hace |
|---|---|
| `/estudio [pomodoro\|repaso\|cuaderno\|mapa\|stats]` | Abre el panel en esa pestaña |
| `/estudio pdf` | Genera el PDF de repaso del cuaderno en `salidas/` y lo abre |
| `/estudio callar` · `/estudio ayuda` | Detiene la voz · muestra la ayuda |
| `/pomodoro` | Inicia el pomodoro (si ya corre, dice cuánto queda) |
| `/pomodoro probar` | Prueba la alarma y los avisos |
| `/pomodoro 50` · `/pomodoro iniciar 50` | Un enfoque de 50 minutos |
| `/pomodoro 50 Química` · `/pomodoro tarea Química` | Un enfoque con su tarea · cambiar la tarea |
| `/pomodoro pausar\|reanudar\|saltar\|parar\|estado` | Control del temporizador (también vale `/promodoro`) |
| `/cuaderno` · `/cuaderno <nombre>` | Lista los cuadernos · crea o activa uno |
| `/repasar` | Repaso de las tarjetas pendientes |
| `/estudio resumen` | Tu sesión, tu día y 2–3 consejos del coach; actualiza el diario |
| `/estudio informe [pasada]` | Tarjeta PNG de la semana (actual o pasada) en `~/estudio/informes/` |
| `/examen <fecha> [título]` | Plan de examen: «/examen 15/11 Bioquímica», «/examen en 20 días», «/examen 15 de diciembre» |
| `/examen` · `/examen meta 6` · `/examen borrar` | Estado del plan · meta diaria de pomodoros · quitar el plan |
| `/anki` | Resumen de tus tarjetas: total, pendientes y etapas |
| `/anki exportar` | Crea `salidas/anki-<cuaderno>.txt` para importarlo en Anki |
| `/anki importar <archivo>` | Importa de Anki (texto con tabuladores), CSV (`,` o `;`) o líneas `frente :: reverso` |

### Con Claude (skills)

| Skill | Qué hace |
|---|---|
| `/estudio:preguntar <pregunta>` | Respuesta citada a partir de tus fuentes; sin pregunta, resume el cuaderno |
| `/estudio:resumir [archivos]` | Resume cada fuente (las nuevas, si no dices cuáles) en `salidas/resumen-*.md` y crea sus tarjetas |
| `/estudio:tarjetas [n] [tema]` | Crea tarjetas siguiendo buenas prácticas (una idea por tarjeta, con su fuente) |
| `/estudio:guia [tema]` | Guía completa (resumen, ideas clave, mapa de conceptos, glosario, FAQ) → `salidas/` |
| `/estudio:mapa [tema]` | Mapa mental en `salidas/mapa-*.md`, dibujado en la pestaña 🧠 Mapa y en el PDF |
| `/estudio:quiz [n] [tema]` | Quiz de opción múltiple, una pregunta a la vez, con su puntuación |
| `/estudio:simulacro [n] [min] [tema]` | Examen simulado cronometrado: test + desarrollo, nota sobre 10, puntos débiles y tarjetas de los fallos |
| `/estudio:audio [min] [tema]` | Resumen tipo podcast, leído en voz alta |

También puedes pedirlo con tus palabras: *«hazme un quiz de 5 preguntas sobre el tema 3»*.

### Teclas del panel

| Pestaña | Teclas |
|---|---|
| 🍅 Pomodoro | `i` iniciar · `p` pausar/reanudar · `s` saltar fase · `x` parar · `t` cambiar la tarea |
| 🃏 Repaso | `m` mostrar respuesta · `1`–`4` Otra vez / Difícil / Bien / Fácil · `w` modo escribir · `e` editar · `b` borrar · `u` deshacer |
| 📚 Cuaderno | `t` tarjetas · `g` guía · `q` quiz · `x` simulacro · `a` audio · `d` **PDF de repaso** · `e` fijar examen · `r` recargar · `n` resumir fuentes nuevas · `i` ignorarlas |
| 🧠 Mapa | `n` nuevo mapa mental |
| 📊 Stats | `g` general · `r` repaso · `h` hábitos · `i` informe semanal · `c` consejo del coach (en Hábitos) |

## 🗂️ Dónde se guardan tus datos

```
~/estudio/
└── biologia/
    ├── fuentes/            ← tus materiales: pdf, md, txt, html, docx, imágenes...
    ├── salidas/            ← guías, quizzes, guiones, exportaciones de Anki
    │   └── repaso-biologia-2026-10-20.pdf   ← tu PDF de repaso (y su .html)
    ├── tarjetas.json       ← tus tarjetas (puedes editarlo a mano)
    ├── tarjetas.bak.json   ← versión anterior
    ├── plan.json           ← tu plan de examen
    └── .respaldos/         ← una copia por día de la semana
~/estudio/diario/2026-10-20.md        ← el diario de cada día: totales, sesiones y consejo del coach
~/estudio/informes/semana-2026-10-19.png  ← tus informes semanales
```

Para añadir tarjetas a mano basta con `{"frente": "...", "reverso": "..."}`: el plugin completa el resto.

## ⚙️ Configuración

En `/config` → **estudio**:

| Opción | Por defecto |
|---|---|
| Carpeta de estudio | `~/estudio` |
| Minutos de enfoque / descanso / descanso largo | 25 / 5 / 15 |
| Alarma al terminar · toques · volumen | sí · 3 · 80 |
| Iniciar solo el siguiente pomodoro | no |
| Tarjetas nuevas por día | 20 |
| Retención deseada (FSRS) | 90 % |
| Recordar tarjetas pendientes al abrir sesión | sí |

## 📊 Estadísticas pro

![Gráficos del plugin: nivel, plan de examen, pronóstico de repasos, curva de aciertos, mapa de hábitos y tiempo por tema](docs/estadisticas.png)

<sub>Gráficos reales del plugin con datos de ejemplo. En la terminal se dibujan con caracteres.</sub>

La pestaña **📊 Stats** tiene tres vistas: **General** (`g`), **Repaso** (`r`) con el pronóstico de los próximos 30 días como en Anki, y **Hábitos** (`h`), que descubre a qué horas rindes más.

## 📝 Sesiones, diario y coach

- Cada tramo de estudio seguido (sin pausas de más de 30 min) es una **sesión**: duración, pomodoros, temas, tarjetas y aciertos. La en curso se ve en la pestaña Pomodoro y las últimas, en **Hábitos**.
- Cada día queda en **`~/estudio/diario/AAAA-MM-DD.md`**, que se actualiza solo.
- **`/estudio resumen`** (o el botón **🤖** en Hábitos): Claude mira tus datos y te da 2–3 consejos concretos para mañana («repasa Bioquímica a las 10 h, tu mejor hora»). Se guardan en el diario.
- Pregúntale a Claude con tus palabras: *«¿cómo voy esta semana?»*, *«¿qué debería repasar?»*.

## 🏆 Logros y niveles

Ganas **XP** con cada minuto de foco (1), cada repaso (2, +1 si aciertas), cada pomodoro (5), cada simulacro (50) y cada logro (100). Los niveles suben de **Novato** a **Aprendiz, Estudiante, Avanzado, Erudito, Sabio, Maestro y Leyenda**. Hay **24 insignias**: rachas de 3, 7, 30 y 100 días, 100 h de foco, día perfecto, maratón de 4 h, búho nocturno, madrugador, sobresaliente en un simulacro… Al desbloquear una, el plugin lo celebra.

## 🎯 Plan de examen

```text
/examen 15/11 Final de Bioquímica
🎯 Final de Bioquímica: 15 de noviembre de 2026 (en 26 días)
  📚 vistas 40 % · 60 nuevas por empezar (3/día)
  🧠 previsión de recuerdo el día del examen: 34 %
  🍅 hoy 1/4 pomodoros
  👉 Hoy te faltan 2 tarjetas nuevas y 3 🍅.
```

- Calcula cuántas tarjetas nuevas necesitas al día para verlas todas **dos días antes** del examen, y **sube solo el límite diario** si hace falta.
- Con FSRS estima **qué porcentaje recordarás el día del examen** si sigues así.
- La pestaña Cuaderno lo muestra con medidores, y la pestaña Pomodoro, con la cuenta atrás.

## ⏱️ Examen simulado

`/estudio:simulacro 12 20` (12 preguntas, 20 minutos): Claude prepara un examen de tus fuentes (~70 % test, ~30 % desarrollo), el **cronómetro** corre en la barra de estado y avisa al acabar, y al final te da la **nota sobre 10**, una tabla de aciertos y fallos con citas, tus **puntos débiles** y tarjetas nuevas de lo que fallaste. La nota queda en tus estadísticas para ver tu evolución, y el examen corregido entra en el PDF.

## 📸 Informe semanal

<img src="docs/informe.png" alt="Informe semanal de ejemplo: horas de enfoque, pomodoros, racha, tarjetas, aciertos, enfoque por día, temas y logros" width="360">

`/estudio informe` (o el botón **📸** en Stats): una imagen de 1080×1350 con tu semana, lista para Instagram, WhatsApp o tu grupo de estudio. Los lunes, el plugin te recuerda que ya tienes la de la semana pasada (`/estudio informe pasada`).

## 🃏 Repasar mejor

- **FSRS**: cada nota ajusta la *estabilidad* (cuánto aguanta el recuerdo) y la *dificultad* de la tarjeta, y el siguiente repaso cae cuando la probabilidad de recordarla baja al 90 % (configurable). Junto a cada botón ves cuándo volverá la tarjeta. Las tarjetas de versiones anteriores (SM-2) se convierten solas.
- **Límite diario de nuevas** (20 por defecto): si Claude crea 50 tarjetas de golpe, entran poco a poco.
- **⌨ Modo escribir** (`w`): escribes tu respuesta antes de verla, Claude la compara con la correcta por su significado y te sugiere la nota (sin conexión, compara las palabras clave).
- **✎ Editar** (`e`), **🗑 Borrar** (`b`) y **↶ Deshacer** (`u`) la última calificación, sin salir del panel.

## 🧠 Mapas mentales

![Mapa mental de ejemplo dibujado por el plugin](docs/mapa.png)

`/estudio:mapa [tema]`: Claude organiza los conceptos de tus fuentes en un árbol y lo guarda como lista en `salidas/mapa-<tema>.md` (puedes editarla a mano). El plugin lo dibuja en la pestaña **🧠 Mapa** (en la terminal, como árbol de texto) y en el PDF de repaso.

## 📥 Fuentes nuevas

El plugin revisa la carpeta `fuentes/` cada medio minuto. Cuando añades un PDF o unos apuntes, te avisa y la pestaña **📚 Cuaderno** ofrece **✨ Resumir y crear tarjetas**: Claude escribe `salidas/resumen-<archivo>.md` y crea las tarjetas de cada fuente. **Ignorar** las da por vistas.

## 📄 PDF de repaso

Todo lo que has estudiado en un cuaderno, en un solo PDF listo para leer en la tablet o imprimir.

![Páginas del PDF de repaso: portada con estadísticas, tarjetas, guía de estudio y tarjetas para recortar (anverso y reverso)](docs/pdf-repaso.png)

<sub>Páginas de un repaso de ejemplo generado por el plugin.</sub>

### Cómo generarlo

Elige la forma que prefieras:

- Escribe **`/estudio pdf`**.
- En el panel, pestaña **📚 Cuaderno**, pulsa **📄 PDF** (tecla `d`).
- O pídeselo a Claude con tus palabras: *«hazme el PDF de repaso de biología»*.

El PDF se guarda en `salidas/repaso-<cuaderno>-<fecha>.pdf` y se abre solo. Puedes generarlo las veces que quieras: cada día crea uno nuevo, y si lo repites el mismo día se sobrescribe con lo más reciente.

### Qué incluye

| Sección | Contenido |
|---|---|
| **Portada** | Nombre del cuaderno y fecha; racha, pomodoros, horas de enfoque, % de aciertos y tarjetas para hoy; gráficos de la semana y de las últimas 16 semanas; etapas de las tarjetas; tus fuentes; índice con enlaces. |
| **🃏 Tarjetas** | Todas, con su respuesta, su fuente y la fecha del próximo repaso, agrupadas en *para repasar hoy*, *aprendiendo* y *maduras*. Numeradas igual que las tarjetas para recortar. |
| **Documentos** | Cada guía, quiz, FAQ o guion de audio de `salidas/`, maquetado: títulos, listas, tablas, citas y código. |
| **✂️ Tarjetas para recortar** | 10 tarjetas por hoja A4, con la pregunta en el anverso y la respuesta (con su fuente) en el reverso. |

> 💡 **Consejo:** genera antes la guía (`/estudio:guia`) y un quiz (`/estudio:quiz`); así el PDF los incluye y queda como un dosier de estudio completo.

### Imprimir las tarjetas para recortar

1. Imprime **a doble cara, girando por el borde largo**, al **100 %** (sin «ajustar a la página»).
2. Cada hoja de preguntas va seguida de su hoja de respuestas, en espejo, para que cada respuesta quede justo detrás de su pregunta.
3. Recorta por las líneas discontinuas. El número de la esquina te ayuda a emparejarlas.

### Requisitos

- Usa **Chrome, Chromium, Edge o Brave** sin abrir ventana. Si tienes alguno instalado, no hay que configurar nada.
- Si no hay ninguno, el plugin deja el **`.html`** junto al PDF y lo abre: usa *Imprimir → Guardar como PDF* con **«Gráficos de fondo»** activado.
- Todo se genera en tu equipo; nada se sube a internet.

## 🔊 Sonido y voz

- **macOS**: funciona sin instalar nada.
- **Linux**: la alarma usa `paplay` (PulseAudio/PipeWire) y la voz `spd-say`:
  ```bash
  sudo apt install speech-dispatcher espeak-ng   # Debian/Ubuntu
  ```

## 🛠️ Desarrollo

```bash
git clone https://github.com/YuthramysI/claude-study-kit && cd claude-study-kit
claude --plugin-dir .         # ejecuta Claude Code con el plugin cargado desde esta carpeta
claude plugin validate .      # manifiesto y hooks
claude plugin test .          # 95 tests: FSRS, Pomodoro, sesiones, logros, plan, simulacro, informe, PDF, mapas, panel
```

| Archivo | Contenido |
|---|---|
| `hooks/register.tsx` | Comandos, herramientas y arranque |
| `hooks/panel.tsx` | El panel y sus 6 pestañas |
| `hooks/graficos.ts` | Gráficos SVG (anillo, barras, mapa de actividad, etapas) y el reloj grande de la terminal |
| `hooks/pdf.ts` · `markdown.ts` | El documento del PDF de repaso y el conversor de Markdown |
| `hooks/acciones.ts` | Pomodoro, cuadernos, tarjetas, estadísticas, PDF, voz |
| `hooks/srs.ts` · `pomodoro.ts` · `stats.ts` · `anki.ts` · `mapa.ts` | Lógica pura (con tests): FSRS, temporizador, estadísticas, Anki, mapas mentales |
| `hooks/sesiones.ts` · `logros.ts` · `plan.ts` · `informe.ts` | Sesiones y diario, logros y niveles, plan de examen, informe semanal |
| `hooks/cuadernos.ts` | Archivos, copias de seguridad y recuperación |
| `hooks/motor.ts` | Enlace con el motor de Claude Code y estado de sesión |
| `skills/*/SKILL.md` | preguntar, resumir, tarjetas, guía, mapa, quiz, simulacro, audio |

Las contribuciones son bienvenidas: lee [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Licencia

[MIT](LICENSE)
