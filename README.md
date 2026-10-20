# 📚 estudio: estudia dentro de Claude Code

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code)
[![Tests](https://img.shields.io/badge/tests-32_pasan-brightgreen.svg)](#desarrollo)

**[English](README.en.md)** · Español

Un plugin que convierte Claude Code en tu espacio de estudio: **Pomodoro**, **tarjetas con repaso espaciado** y **cuadernos de fuentes al estilo NotebookLM**. Claude estudia contigo usando *tus* apuntes y cita de dónde saca cada respuesta.

```
╭─ Estudio ─────────────────────────────────────────╮
│ 🍅 Pomodoro  🃏 Repaso  📚 Cuaderno  📊 Stats     │
│                                                   │
│ 🍅 ENFOQUE  ·  ronda 2/4                          │
│ 18:42                                             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░              │
│                                                   │
│ [ Pausar ] [ Saltar ] [ Parar ]                   │
│                                                   │
│ Hoy: 3 pomodoros 🍅🍅🍅  ·  🔥 5 días             │
╰───────────────────────────────────────────────────╯
```

## ✨ Qué hace

| | |
|---|---|
| 🍅 **Pomodoro** | Reloj en la barra de estado y en el panel. Alarma (campana ×3) y notificación al terminar cada fase. Descanso largo cada 4 pomodoros. Si cierras Claude Code, el pomodoro sigue al volver. |
| 🃏 **Tarjetas SM-2** | Claude crea flashcards a partir de tus fuentes; tú las repasas en el panel (`m` muestra la respuesta, `1`–`4` califica). El algoritmo SuperMemo-2 programa cada repaso. |
| 📚 **Cuadernos** | Una carpeta por tema con tus PDFs, apuntes o fotos. Claude responde **solo con tus fuentes**, cita `[archivo, p. X]` y avisa cuando algo no está en ellas. |
| 📝 **Guía, quiz y audio** | Guía de estudio con glosario y FAQ, quiz interactivo (las preguntas que fallas se convierten en tarjetas) y un resumen tipo podcast leído en voz alta. |
| 📊 **Estadísticas** | Racha de días, pomodoros y horas de enfoque, % de aciertos, gráfico de los últimos 7 y 28 días, y tarjetas nuevas, en aprendizaje o maduras. |
| 🔁 **Anki** | Exporta tus tarjetas a Anki o importa mazos de Anki y CSV. |
| 🛡️ **A prueba de fallos** | Copia de seguridad automática de las tarjetas (una semana de historia) y recuperación si `tarjetas.json` se daña. |

Todo se queda en tu equipo: el plugin no usa la red, y tus fuentes solo las lee Claude cuando se lo pides.

## 🚀 Instalación

Necesitas [Claude Code](https://docs.claude.com/en/docs/claude-code). Está probado con la versión 2.1.304.

En una sesión de Claude Code, en la terminal:

```
/plugin install estudio --marketplace YuthramysI/estudio
```

Responde `y` para añadir el marketplace y elige el ámbito (usuario). Desde una shell:

```bash
claude plugin install estudio --marketplace YuthramysI/estudio
```

En la app de escritorio: **+** junto al cuadro de texto → **Plugins** → **Add marketplace** `YuthramysI/estudio` → **Add plugin**.

## 🏁 Primeros pasos

```text
/cuaderno biologia            crea ~/estudio/biologia/
                              → copia tus PDFs o apuntes a ~/estudio/biologia/fuentes/
/estudio                      abre el panel
/pomodoro                     empieza a estudiar (25 min)
/estudio:tarjetas 20          Claude crea 20 tarjetas a partir de tus fuentes
/repasar                      repasa lo que toca hoy
```

## 📖 Comandos

| Comando | Qué hace |
|---|---|
| `/estudio [pomodoro\|repaso\|cuaderno\|stats]` | Abre el panel en esa pestaña |
| `/estudio callar` · `/estudio ayuda` | Detiene la voz · muestra la ayuda |
| `/pomodoro` | Inicia o pausa el pomodoro |
| `/pomodoro 50` · `/pomodoro iniciar 50` | Un enfoque de 50 minutos |
| `/pomodoro pausar\|reanudar\|saltar\|parar\|estado` | Control del temporizador (también vale `/promodoro`) |
| `/cuaderno` · `/cuaderno <nombre>` | Lista los cuadernos · crea o activa uno |
| `/repasar` | Repaso de las tarjetas pendientes |
| `/tarjetas` | Resumen: total, pendientes y etapas |
| `/tarjetas exportar` | Crea `salidas/anki-<cuaderno>.txt` para importarlo en Anki |
| `/tarjetas importar <archivo>` | Importa de Anki (texto con tabuladores), CSV (`,` o `;`) o líneas `frente :: reverso` |

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

| Tecla | Acción | | Tecla | Acción |
|---|---|---|---|---|
| `i` | iniciar | | `m` | mostrar respuesta |
| `p` | pausar/reanudar | | `1`–`4` | Otra vez / Difícil / Bien / Fácil |
| `s` | saltar fase | | `t` `g` `q` `a` | tarjetas · guía · quiz · audio |
| `x` | parar | | `r` | recargar el cuaderno |

## 🗂️ Dónde se guardan tus datos

```
~/estudio/
└── biologia/
    ├── fuentes/            ← tus materiales: pdf, md, txt, html, docx, imágenes...
    ├── salidas/            ← guías, quizzes, guiones y exportaciones de Anki
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

## 🔊 Sonido y voz

- **macOS**: funciona sin instalar nada.
- **Linux**: la alarma usa `paplay` (PulseAudio/PipeWire) y la voz `spd-say`:
  ```bash
  sudo apt install speech-dispatcher espeak-ng   # Debian/Ubuntu
  ```

## 🛠️ Desarrollo

```bash
git clone https://github.com/YuthramysI/estudio && cd estudio
claude --plugin-dir .         # ejecuta Claude Code con el plugin cargado desde esta carpeta
claude plugin validate .      # manifiesto y hooks
claude plugin test .          # 32 tests: SM-2, Pomodoro, estadísticas, Anki, panel, recuperación
```

| Archivo | Contenido |
|---|---|
| `hooks/register.tsx` | Comandos, herramientas y arranque |
| `hooks/panel.tsx` | El panel y sus 4 pestañas |
| `hooks/acciones.ts` | Pomodoro, cuadernos, tarjetas, estadísticas, voz |
| `hooks/srs.ts` · `pomodoro.ts` · `stats.ts` · `anki.ts` | Lógica pura (con tests) |
| `hooks/cuadernos.ts` | Archivos, copias de seguridad y recuperación |
| `hooks/motor.ts` | Enlace con el motor de Claude Code y estado de sesión |
| `skills/*/SKILL.md` | preguntar, tarjetas, guía, quiz, audio |

Las contribuciones son bienvenidas: lee [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Licencia

[MIT](LICENSE)
