# 📚 estudio: study inside Claude Code

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code)

English · **[Español](README.md)**

A plugin that turns Claude Code into your study space: **Pomodoro timer**, **spaced-repetition flashcards** and **NotebookLM-style source notebooks**. Claude studies with *your* notes and cites where every answer comes from.

> The interface and commands are in Spanish (*estudio* = study). This page explains them in English.

## ✨ Features

| | |
|---|---|
| 🍅 **Pomodoro** | Timer in the status line and in a side pane, an alarm (bell ×3) and a notification at the end of each phase, a long break every 4 rounds. A running timer survives restarting Claude Code. |
| 🃏 **SM-2 flashcards** | Claude writes cards from your sources; you review them in the pane (`m` reveals the answer, `1`–`4` grades it) on a SuperMemo-2 schedule. |
| 📚 **Notebooks** | One folder per subject with your PDFs, notes or photos. Claude answers **only from your sources**, cites `[file, p. X]` and says when something isn't in them. |
| 📝 **Guide, quiz, audio** | A study guide with glossary and FAQ, an interactive quiz (missed questions become flashcards) and a podcast-style summary read aloud. |
| 📊 **Stats** | Daily streak, pomodoros and focus hours, accuracy, 7- and 28-day charts, and new, learning and mature cards. |
| 🔁 **Anki** | Export your cards to Anki and import Anki decks or CSV files. |
| 🛡️ **Safe** | Automatic card backups (one week of history) and recovery if `tarjetas.json` gets corrupted. |

Everything stays on your machine: the plugin makes no network calls.

## 🚀 Install

```
/plugin install estudio --marketplace YuthramysI/estudio
```

or from a shell: `claude plugin install estudio --marketplace YuthramysI/estudio`.

## 🏁 Quick start

| Command | What it does |
|---|---|
| `/cuaderno biology` | Create a notebook (*cuaderno*); put your files in `~/estudio/biology/fuentes/` |
| `/estudio` | Open the study pane (tabs: Pomodoro · Review · Notebook · Stats) |
| `/pomodoro` · `/pomodoro 50` | Start or pause the timer · a 50-minute focus session |
| `/pomodoro pausar\|reanudar\|saltar\|parar\|estado` | pause · resume · skip · stop · status |
| `/repasar` | Review the cards due today |
| `/tarjetas` · `exportar` · `importar <file>` | Card summary · export to Anki · import from Anki/CSV |
| `/estudio:preguntar <question>` | Answer from your sources, with citations |
| `/estudio:tarjetas [n]` | Generate n flashcards |
| `/estudio:guia` | Study guide → `salidas/` |
| `/estudio:quiz [n]` | Interactive multiple-choice quiz |
| `/estudio:audio [min]` | Spoken summary |

## ⚙️ Settings

In `/config` → **estudio**: notebook folder, focus/break lengths (25/5/15), alarm (on, 3 rings, volume 80), auto-start the next pomodoro, and a reminder of the cards due today when a session opens.

## 🔊 Sound on Linux

The alarm uses `paplay` and the voice uses `spd-say`: `sudo apt install speech-dispatcher espeak-ng`. On macOS it works out of the box.

## 🛠️ Development

```bash
claude --plugin-dir .       # run Claude Code with this folder's plugin loaded
claude plugin validate .
claude plugin test .        # 32 tests
```

## 📄 License

[MIT](LICENSE)
