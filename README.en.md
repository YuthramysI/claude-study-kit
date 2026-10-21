# 📚 estudio: study inside Claude Code

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code)
[![Tests](https://img.shields.io/badge/tests-100_passing-brightgreen.svg)](#-development)

English · **[Español](README.md)**

![Study pane in VS Code: Pomodoro ring, weekly pomodoros and activity map](docs/graficos.png)

A plugin that turns Claude Code into your study space: **Pomodoro timer**, **spaced-repetition flashcards** and **NotebookLM-style source notebooks**. Claude studies with *your* notes and cites where every answer comes from.

> 🌐 **The interface speaks English and Spanish.** It follows your system language; pick one in `/config` → **estudio** → *Idioma / Language*. Command names are the same in both languages (*estudio* = study, *cuaderno* = notebook, *repasar* = review), and they take English arguments. [More below](#-language).

## ✨ Features

| | |
|---|---|
| 🍅 **Pomodoro** | Timer in the status line and in a side pane, an alarm (bell ×3) and a notification at the end of each phase, a long break every 4 rounds. Each pomodoro has a task, and stats show time per topic. A running timer survives restarting Claude Code. |
| 🃏 **FSRS flashcards** | Claude writes cards from your sources; you review them in the pane on an **FSRS** schedule (the modern Anki algorithm) with a **daily new-card limit**. Type your answer and Claude grades it; edit, delete or undo the last grade from the pane. |
| 📚 **Notebooks** | One folder per subject with your PDFs, notes or photos. Claude answers **only from your sources**, cites `[file, p. X]` and says when something isn't in them. New files are detected and Claude offers to summarize them and make cards. |
| 🧠 **Mind maps** | `/estudio:mapa`: Claude maps the concepts; the plugin draws the map in the pane and in the PDF. |
| 📝 **Guide, quiz, audio** | A study guide with glossary and FAQ, an interactive quiz (missed questions become flashcards) and a podcast-style summary read aloud. |
| 📊 **Stats** | Daily streak, pomodoros and focus hours, accuracy, 7- and 28-day charts, and new, learning and mature cards. |
| 📄 **Review PDF** | `/estudio pdf`: a printable document with a stats cover, every card, the guides and quizzes Claude wrote, and cut-out double-sided flashcards. |
| 📊 **Pro stats** | General, Review and Habits views: 30-day review forecast, accuracy curve, FSRS difficulty, hour × weekday heatmap, best study hours, recent sessions. |
| 📝 **Sessions & coach** | Every study stretch is a session, every day gets a Markdown journal, and a Claude **coach** gives 2–3 concrete tips from your data (`/estudio resumen`). |
| 🏆 **Achievements** | XP, levels from Rookie to Legend, and 24 badges (streaks, marathons, night owl, top exam score…). |
| 🎯 **Exam plan** | `/examen November 15 Biochemistry`: countdown, daily card and pomodoro goals, FSRS forecast of how much you'll remember on exam day, and an alert if you fall behind. |
| ⏱️ **Mock exam** | `/estudio:simulacro`: timed exam from your sources, graded out of 10 by Claude, with weak points and cards from your mistakes. |
| 📸 **Weekly report** | `/estudio informe`: a beautiful 1080×1350 PNG of your week, ready to share. |
| 🔁 **Anki** | Export your cards to Anki and import Anki decks or CSV files. |
| 🛡️ **Safe** | Automatic card backups (one week of history) and recovery if `tarjetas.json` gets corrupted. |

Everything stays on your machine: the plugin makes no network calls.

## 🚀 Install

```
/plugin install estudio --marketplace YuthramysI/claude-study-kit
```

or from a shell: `claude plugin install estudio --marketplace YuthramysI/claude-study-kit`.

## 🏁 Quick start

| Command | What it does |
|---|---|
| `/cuaderno biology` | Create a notebook (*cuaderno*); put your files in `~/estudio/biology/fuentes/` |
| `/estudio [review\|notebook\|map\|stats\|achievements]` | Open the study pane on that tab |
| `/pomodoro` · `/pomodoro 50` | Start or pause the timer · a 50-minute focus session |
| `/pomodoro pause\|resume\|skip\|stop\|status` | Timer controls (`/pomodoro test` checks the alarm) |
| `/repasar` | Review the cards due today |
| `/anki` · `export` · `import <file>` | Card summary · export to Anki · import from Anki/CSV |
| `/estudio:preguntar <question>` | Answer from your sources, with citations |
| `/estudio:tarjetas [n]` | Generate n flashcards |
| `/estudio:guia` | Study guide → `salidas/` |
| `/estudio:quiz [n]` | Interactive multiple-choice quiz |
| `/estudio:audio [min]` | Spoken summary |
| `/estudio:resumir [files]` | Summarize new sources and make their cards |
| `/estudio:mapa [topic]` | Mind map, drawn in the 🧠 Map tab and the PDF |
| `/estudio:simulacro [n] [min]` | Timed mock exam, graded out of 10 |
| `/pomodoro 50 Chemistry` | A 50-minute focus session on a task |
| `/estudio pdf` | Your whole review as a printable PDF |
| `/estudio summary` | Your session and day, plus 2–3 coach tips |
| `/estudio report [last]` | Weekly PNG report card |
| `/examen <date> [title]` · `goal <n>` · `clear` | Exam plan: «November 15», «11/15», «in 20 days» |
| `/estudio help` · `/estudio mute` | Help · stop the voice |

## 📊 Stats & weekly report

![Plugin charts: level, exam plan, review forecast, accuracy, habits heatmap, time per topic](docs/estadisticas.png)

<img src="docs/informe-en.png" alt="Weekly report card in English: focus hours, pomodoros, streak, cards, accuracy, focus per day, topics and achievements" width="320">

## 🧠 Mind maps

![Mind map drawn by the plugin](docs/mapa.png)

## 📄 Review PDF

![Review PDF pages: stats cover, flashcards, study guide and cut-out cards (front and back)](docs/pdf-repaso.png)

Run **`/estudio pdf`**, press **📄 PDF** (key `d`) in the Notebook tab, or just ask Claude: *"make my review PDF"*. It saves `salidas/repaso-<notebook>-<date>.pdf` and opens it. It contains:

- **Cover**: streak, pomodoros, focus time, accuracy, cards due today, weekly and 16-week charts, card stages, sources and a linked table of contents.
- **Flashcards**: every card with its answer, source and next review date, grouped into *due today*, *learning* and *mature*.
- **Documents**: each guide, quiz, FAQ or audio script in `salidas/`, typeset.
- **Cut-out cards**: 10 per A4 sheet. Print **double-sided, flip on long edge, at 100 %**; each answer lands right behind its question.

It needs Chrome, Chromium, Edge or Brave (run headless, nothing to set up). Without one, it leaves the `.html` next to it: print it to PDF with *background graphics* on. Everything is generated locally.

## ⚙️ Settings

In `/config` → **estudio**: notebook folder, focus/break lengths (25/5/15), alarm (on, 3 rings, volume 80), auto-start the next pomodoro, new cards per day (20), desired FSRS retention (90 %), a reminder of the cards due today when a session opens, and the language.

## 🌐 Language

The whole plugin speaks **English or Spanish**: the pane and its buttons, command replies, Pomodoro alerts, the voice, achievements and levels, the review PDF and the weekly report. The skills (`/estudio:preguntar`, `/estudio:guia`…) also reply and write their files in the chosen language; quotes from your sources stay as they are.

- **`auto`** (default): reads `LANGUAGE`, `LC_ALL` and `LANG`; Spanish if they start with `es`, English otherwise.
- **`es`** or **`en`**: fixes the language regardless of the system.

Dates in `/examen`: `2026-11-15`, `November 15`, `Nov 15 2026`, `in 3 weeks`, `tomorrow`. `11/15` works too; an ambiguous one like `3/11` is read day/month (3 November), and the reply always spells the date out.

## 🔊 Sound on Linux

The alarm uses `paplay` and the voice uses `spd-say`: `sudo apt install speech-dispatcher espeak-ng`. On macOS it works out of the box.

## 🛠️ Development

```bash
claude --plugin-dir .       # run Claude Code with this folder's plugin loaded
claude plugin validate .
claude plugin test .        # 100 tests
```

## 📄 License

[MIT](LICENSE)
