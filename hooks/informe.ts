// Informe semanal: una tarjeta de 1080×1350 (formato vertical de Instagram) para compartir.
import type { Stats } from '../types'
import { COLORES_TEMA } from './graficos'
import * as lg from './logros'
import { escapar } from './markdown'
import { nombreMes, sumarDias } from './srs'
import * as stats from './stats'
import { L } from './i18n'

export const ANCHO = 1080
export const ALTO = 1350

/** El lunes de la semana de `dia`. */
export function lunesDe(dia: string): string {
  const dow = (new Date(`${dia}T12:00:00`).getDay() + 6) % 7
  return sumarDias(dia, -dow)
}

export type DatosInforme = {
  /** lunes de la semana */
  lunes: string
  hoy: string
  stats: Stats
  logros: Readonly<Record<string, string>>
}


function rango(lunes: string): string {
  const domingo = sumarDias(lunes, 6)
  const [, m1, d1] = lunes.split('-').map(Number)
  const [y2, m2, d2] = domingo.split('-').map(Number)
  const mes = (m: number | undefined) => nombreMes(m ?? 1)
  if (m1 === m2) return L(`${d1}–${d2} de ${mes(m2)} de ${y2}`, `${mes(m2)} ${d1}–${d2}, ${y2}`)
  return L(`${d1} de ${mes(m1)} – ${d2} de ${mes(m2)} de ${y2}`, `${mes(m1)} ${d1} – ${mes(m2)} ${d2}, ${y2}`)
}

/** Las estadísticas hasta el día anterior a `dia` (para la XP ganada en la semana). */
const antesDe = (s: Stats, dia: string): Stats => Object.fromEntries(Object.entries(s).filter(([d]) => d < dia))

export function resumenSemana(d: DatosInforme) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(d.lunes, i))
  const semana = Object.fromEntries(dias.map(dia => [dia, d.stats[dia] ?? stats.VACIO]))
  const total = stats.totales(semana)
  const logrosSemana = lg.LOGROS.filter(l => {
    const cuando = d.logros[l.id]
    return cuando !== undefined && cuando >= d.lunes && cuando <= sumarDias(d.lunes, 6)
  })
  const nLogros = Object.keys(d.logros).length
  const xp = lg.experiencia(d.stats, nLogros)
  const logrosAntes = Object.values(d.logros).filter(f => f < d.lunes).length
  const xpAntes = lg.experiencia(antesDe(d.stats, d.lunes), logrosAntes)
  const finSemana = sumarDias(d.lunes, 6) < d.hoy ? sumarDias(d.lunes, 6) : d.hoy
  return {
    dias, semana, total,
    temas: stats.temas(semana).slice(0, 4),
    racha: stats.racha(d.stats, finSemana),
    mejoresHoras: stats.mejoresHoras(semana, finSemana, 7, 1),
    logrosSemana,
    nivel: lg.nivel(xp),
    xpSemana: Math.max(0, xp - xpAntes),
    examenes: stats.examenes(semana),
    diasActivos: dias.filter(dia => (semana[dia]?.minutos ?? 0) > 0 || (semana[dia]?.repasos ?? 0) > 0).length,
  }
}

/** El HTML de la tarjeta, autocontenido, para que Chrome lo capture como PNG. */
export function htmlInforme(d: DatosInforme): string {
  const r = resumenSemana(d)
  const max = Math.max(1, ...r.dias.map(dia => (r.semana[dia]?.minutos ?? 0)))
  const barras = r.dias.map((dia, i) => {
    const min = r.semana[dia]?.minutos ?? 0
    const alto = min === 0 ? 6 : Math.max(14, Math.round((min / max) * 140))
    const hoy = dia === d.hoy
    return `<div class="dia"><div class="valor">${min > 0 ? stats.horas(min).replace(' min', '′').replace(' h ', 'h') : ''}</div>` +
      `<div class="barra${min === 0 ? ' vacia' : ''}${hoy ? ' hoy' : ''}" style="height:${alto}px"></div><div class="letra">${L('LMXJVSD', 'MTWTFSS')[i] ?? ''}</div></div>`
  }).join('')
  const maxTema = Math.max(1, ...r.temas.map(t => t.minutos))
  const temas = r.temas.length === 0
    ? `<div class="vacio">${L('Pon una tarea a tus pomodoros para ver tus temas', 'Give your pomodoros a task to see your topics')}</div>`
    : r.temas.map((t, i) => `<div class="tema"><span class="nombre">${escapar(t.tema)}</span>` +
      `<span class="pista"><span class="relleno" style="width:${Math.max(4, (t.minutos / maxTema) * 100)}%;background:${COLORES_TEMA[i % COLORES_TEMA.length]}"></span></span>` +
      `<span class="horas">${stats.horas(t.minutos)}</span></div>`).join('')
  const logros = r.logrosSemana.length === 0
    ? `<div class="vacio">${r.diasActivos >= 5 ? L('¡Constancia de campeón!', 'Champion consistency!') : L('Esta semana, a por el próximo logro', 'Next week: go for the next achievement')}</div>`
    : r.logrosSemana.slice(0, 4).map(l => `<div class="logro"><span class="icono">${l.icono}</span>${escapar(l.nombre)}</div>`).join('')
  const progreso = Math.min(100, Math.max(0, ((lg.experiencia(d.stats, Object.keys(d.logros).length) - r.nivel.desde) / Math.max(1, r.nivel.hasta - r.nivel.desde)) * 100))
  const hora = r.mejoresHoras[0]
  const examen = r.examenes.length === 0 ? undefined : Math.max(...r.examenes.map(e => e.nota))

  return `<!doctype html><html lang="${L('es', 'en')}"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; }
html, body { width: ${ANCHO}px; height: ${ALTO}px; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif; color: #FFF8F2;
  background: radial-gradient(1200px 700px at 85% -10%, #E8553F55, transparent 60%), radial-gradient(900px 700px at -10% 110%, #3B82C455, transparent 60%), #17131F;
  padding: 60px 68px 52px; display: flex; flex-direction: column; gap: 24px; }
.marca { display: flex; justify-content: space-between; align-items: center; font-size: 26px; letter-spacing: .14em; text-transform: uppercase; color: #F6B04A; font-weight: 800; }
.marca .nivel { letter-spacing: 0; text-transform: none; font-size: 26px; color: #FFF8F2; background: #FFFFFF14; padding: 10px 20px; border-radius: 99px; font-weight: 700; }
h1 { font-size: 70px; line-height: 1; font-weight: 900; letter-spacing: -.02em; }
.rango { font-size: 28px; color: #C9C2D6; margin-top: 10px; }
.cifras { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.cifra { background: #FFFFFF0D; border: 2px solid #FFFFFF14; border-radius: 26px; padding: 20px 20px; }
.cifra .n { font-size: 48px; font-weight: 900; line-height: 1.05; white-space: nowrap; }
.cifra .t { font-size: 21px; color: #C9C2D6; margin-top: 4px; }
.c1 .n { color: #FF7A5C; } .c2 .n { color: #F6B04A; } .c3 .n { color: #63D3A0; } .c4 .n { color: #7FB3F5; }
.fila { display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px; }
.panel { background: #FFFFFF0D; border: 2px solid #FFFFFF14; border-radius: 26px; padding: 22px 28px; }
.panel h2 { font-size: 21px; letter-spacing: .1em; text-transform: uppercase; color: #C9C2D6; margin-bottom: 14px; font-weight: 700; }
.dias { display: flex; align-items: flex-end; justify-content: space-between; height: 200px; }
.dia { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 13%; height: 100%; gap: 8px; }
.barra { width: 100%; border-radius: 12px; background: linear-gradient(#FF7A5C, #E8553F); }
.barra.hoy { box-shadow: 0 0 0 4px #F6B04A; } .barra.vacia { background: #FFFFFF1A; }
.valor { font-size: 19px; color: #FFD9CC; font-weight: 700; white-space: nowrap; } .letra { font-size: 24px; color: #C9C2D6; font-weight: 700; }
.lateral { display: flex; flex-direction: column; gap: 12px; justify-content: center; }
.dato { font-size: 24px; line-height: 1.25; } .dato b { font-size: 36px; color: #F6B04A; }
.temas { display: flex; flex-direction: column; gap: 12px; }
.tema { display: grid; grid-template-columns: 240px 1fr 130px; align-items: center; gap: 16px; font-size: 24px; }
.tema .nombre { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
.pista { height: 20px; background: #FFFFFF14; border-radius: 99px; overflow: hidden; } .relleno { display: block; height: 100%; border-radius: 99px; }
.tema .horas { text-align: right; color: #C9C2D6; }
.logros { display: flex; flex-wrap: wrap; gap: 14px; }
.logro { font-size: 22px; background: #F6B04A22; border: 2px solid #F6B04A66; padding: 10px 18px; border-radius: 99px; font-weight: 600; }
.logro .icono { margin-right: 8px; }
.vacio { font-size: 23px; color: #9C94AC; }
.xp { height: 16px; background: #FFFFFF14; border-radius: 99px; overflow: hidden; margin-top: 14px; }
.xp span { display: block; height: 100%; width: ${progreso.toFixed(1)}%; background: linear-gradient(90deg, #F6B04A, #E8553F); }
.pie { margin-top: auto; display: flex; justify-content: space-between; color: #9C94AC; font-size: 21px; }
.pie b { color: #FFF8F2; }
</style></head><body>
<div class="marca"><span>📚 ${L('Mi semana de estudio', 'My study week')}</span><span class="nivel">⭐ ${L('Nivel', 'Level')} ${r.nivel.nivel} · ${escapar(r.nivel.titulo)}</span></div>
<div><h1>${stats.horas(r.total.minutos)}<br>${L('de enfoque', 'of focus')}</h1><div class="rango">${escapar(rango(d.lunes))}</div></div>
<div class="cifras">
  <div class="cifra c1"><div class="n">${r.total.pomodoros} 🍅</div><div class="t">pomodoros</div></div>
  <div class="cifra c2"><div class="n">🔥 ${r.racha}</div><div class="t">${r.racha === 1 ? L('día de racha', 'day streak') : L('días de racha', 'day streak')}</div></div>
  <div class="cifra c3"><div class="n">${r.total.repasos}</div><div class="t">${L('tarjetas repasadas', 'cards reviewed')}</div></div>
  <div class="cifra c4"><div class="n">${stats.porcentaje(r.total.aciertos, r.total.repasos)}</div><div class="t">${L('de aciertos', 'correct')}</div></div>
</div>
<div class="fila">
  <div class="panel"><h2>${L('Enfoque por día', 'Focus per day')}</h2><div class="dias">${barras}</div></div>
  <div class="panel lateral">
    <div class="dato"><b>${r.diasActivos}</b>/7 ${L('días activos', 'active days')}</div>
    <div class="dato">${hora !== undefined ? `⭐ <b>${hora.hora}–${hora.hora + 1} h</b> ${L('tu mejor hora', 'your best hour')}` : `⭐ ${L('Aún sin mejor hora', 'No best hour yet')}`}</div>
    ${examen !== undefined ? `<div class="dato">📝 <b>${examen.toFixed(1)}</b>/10 ${L('en simulacro', 'on a mock exam')}</div>` : ''}
    <div class="dato">+<b>${r.xpSemana}</b> XP<div class="xp"><span></span></div></div>
  </div>
</div>
<div class="panel"><h2>${L('Temas', 'Topics')}</h2><div class="temas">${temas}</div></div>
<div class="panel"><h2>🏆 ${L('Logros de la semana', 'Achievements this week')}</h2><div class="logros">${logros}</div></div>
<div class="pie"><span>${L('Hecho con <b>claude-study-kit</b> · el plugin de estudio para Claude Code', 'Made with <b>claude-study-kit</b> · the study plugin for Claude Code')}</span><span>${escapar(d.hoy)}</span></div>
</body></html>`
}
