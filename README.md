# 📚 estudio: estudia dentro de Claude Code

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code)
[![Tests](https://img.shields.io/badge/tests-47_pasan-brightgreen.svg)](#desarrollo)

**[English](README.en.md)** · Español

Un plugin que convierte Claude Code en tu espacio de estudio: **Pomodoro**, **tarjetas con repaso espaciado** y **cuadernos de fuentes al estilo NotebookLM**. Claude estudia contigo usando *tus* apuntes y cita de dónde saca cada respuesta.

![Panel de estudio en VS Code: anillo del Pomodoro, pomodoros de la semana y mapa de actividad](docs/graficos.png)

<sub>El panel en VS Code y en la app de escritorio (datos de ejemplo). En la terminal se dibuja así:</sub>

```
🍅 Pomodoro  🃏 Repaso  📚 Cuaderno  📊 Stats
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
| 🍅 **Pomodoro** | Reloj en la barra de estado y en el panel. Alarma (campana ×3) y notificación al terminar cada fase. Descanso largo cada 4 pomodoros. Si cierras Claude Code, el pomodoro sigue al volver. |
| 🃏 **Tarjetas SM-2** | Claude crea flashcards a partir de tus fuentes; tú las repasas en el panel (`m` muestra la respuesta, `1`–`4` califica). El algoritmo SuperMemo-2 programa cada repaso. |
| 📚 **Cuadernos** | Una carpeta por tema con tus PDFs, apuntes o fotos. Claude responde **solo con tus fuentes**, cita `[archivo, p. X]` y avisa cuando algo no está en ellas. |
| 📝 **Guía, quiz y audio** | Guía de estudio con glosario y FAQ, quiz interactivo (las preguntas que fallas se convierten en tarjetas) y un resumen tipo podcast leído en voz alta. |
| 📊 **Estadísticas** | Racha de días, pomodoros y horas de enfoque, % de aciertos, barras de la semana, mapa de actividad de 16 semanas (estilo GitHub) y tarjetas nuevas, en aprendizaje o maduras. |
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
/estudio pdf                  todo tu repaso en un PDF para imprimir
```

## 📖 Comandos

| Comando | Qué hace |
|---|---|
| `/estudio [pomodoro\|repaso\|cuaderno\|stats]` | Abre el panel en esa pestaña |
| `/estudio pdf` | Genera el PDF de repaso del cuaderno en `salidas/` y lo abre |
| `/estudio callar` · `/estudio ayuda` | Detiene la voz · muestra la ayuda |
| `/pomodoro` | Inicia el pomodoro (si ya corre, dice cuánto queda) |
| `/pomodoro probar` | Prueba la alarma y los avisos |
| `/pomodoro 50` · `/pomodoro iniciar 50` | Un enfoque de 50 minutos |
| `/pomodoro pausar\|reanudar\|saltar\|parar\|estado` | Control del temporizador (también vale `/promodoro`) |
| `/cuaderno` · `/cuaderno <nombre>` | Lista los cuadernos · crea o activa uno |
| `/repasar` | Repaso de las tarjetas pendientes |
| `/anki` | Resumen de tus tarjetas: total, pendientes y etapas |
| `/anki exportar` | Crea `salidas/anki-<cuaderno>.txt` para importarlo en Anki |
| `/anki importar <archivo>` | Importa de Anki (texto con tabuladores), CSV (`,` o `;`) o líneas `frente :: reverso` |

### Con Claude (skills)

| Skill | Qué hace |
|---|---|
| `/estudio:preguntar <pregunta>` | Respuesta citada a partir de tus fuentes; sin pregunta, resume el cuaderno |
| `/estudio:tarjetas [n] [tema]` | Crea tarjetas siguiendo buenas prácticas (una idea por tarjeta, con su fuente) |
| `/estudio:guia [tema]` | Guía completa (resumen, ideas clave, mapa de conceptos, glosario, FAQ) → `salidas/` |
| `/estudio:quiz [n] [tema]` | Quiz de opción múltiple, una pregunta a la vez, con su puntuación |
| `/estudio:audio [min] [tema]` | Resumen tipo podcast, leído en voz alta |

También puedes pedirlo con tus palabras: *«hazme un quiz de 5 preguntas sobre el tema 3»*.

### Teclas del panel

| Pestaña | Teclas |
|---|---|
| 🍅 Pomodoro | `i` iniciar · `p` pausar/reanudar · `s` saltar fase · `x` parar |
| 🃏 Repaso | `m` mostrar respuesta · `1`–`4` Otra vez / Difícil / Bien / Fácil |
| 📚 Cuaderno | `t` tarjetas · `g` guía · `q` quiz · `a` audio · `d` **PDF de repaso** · `r` recargar |

## 🗂️ Dónde se guardan tus datos

```
~/estudio/
└── biologia/
    ├── fuentes/            ← tus materiales: pdf, md, txt, html, docx, imágenes...
    ├── salidas/            ← guías, quizzes, guiones, exportaciones de Anki
    │   └── repaso-biologia-2026-10-20.pdf   ← tu PDF de repaso (y su .html)
    ├── tarjetas.json       ← tus tarjetas (puedes editarlo a mano)
    ├── tarjetas.bak.json   ← versión anterior
    └── .respaldos/         ← una copia por día de la semana
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
| Recordar tarjetas pendientes al abrir sesión | sí |

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
claude plugin test .          # 47 tests: SM-2, Pomodoro, estadísticas, Anki, PDF, panel, recuperación
```

| Archivo | Contenido |
|---|---|
| `hooks/register.tsx` | Comandos, herramientas y arranque |
| `hooks/panel.tsx` | El panel y sus 4 pestañas |
| `hooks/graficos.ts` | Gráficos SVG (anillo, barras, mapa de actividad, etapas) y el reloj grande de la terminal |
| `hooks/pdf.ts` · `markdown.ts` | El documento del PDF de repaso y el conversor de Markdown |
| `hooks/acciones.ts` | Pomodoro, cuadernos, tarjetas, estadísticas, PDF, voz |
| `hooks/srs.ts` · `pomodoro.ts` · `stats.ts` · `anki.ts` | Lógica pura (con tests) |
| `hooks/cuadernos.ts` | Archivos, copias de seguridad y recuperación |
| `hooks/motor.ts` | Enlace con el motor de Claude Code y estado de sesión |
| `skills/*/SKILL.md` | preguntar, tarjetas, guía, quiz, audio |

Las contribuciones son bienvenidas: lee [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Licencia

[MIT](LICENSE)
