// El documento de repaso: un HTML para imprimir que Chrome convierte en PDF.
import type { InfoCuaderno, Stats, Tarjeta } from '../types'
import * as g from './graficos'
import { aHtml, escapar } from './markdown'
import { pendientes, sumarDias } from './srs'
import * as stats from './stats'

export type DatosRepaso = {
  cuaderno: InfoCuaderno
  /** YYYY-MM-DD */
  hoy: string
  tarjetas: readonly Tarjeta[]
  stats: Stats
  /** Lo que Claude generó en salidas/ (Markdown). */
  documentos: readonly { archivo: string; markdown: string }[]
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00`).getDay()

export function fechaLarga(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number)
  return `${d ?? ''} de ${MESES[(m ?? 1) - 1] ?? ''} de ${y ?? ''}`
}

/** Título legible de un archivo de salidas/: «guia-celula.md» → «Guía · celula». */
export function tituloDocumento(archivo: string): string {
  const base = archivo.replace(/\.(md|markdown|txt)$/i, '')
  const [tipo = base, ...resto] = base.split('-')
  const nombres: Record<string, string> = { guia: 'Guía de estudio', quiz: 'Quiz', audio: 'Guion de audio', faq: 'Preguntas frecuentes', resumen: 'Resumen' }
  const nombre = nombres[tipo.toLowerCase()]
  if (nombre === undefined) return base
  const detalle = resto.join('-')
  if (detalle === '') return nombre
  return `${nombre} · ${/^\d{4}-\d{2}-\d{2}$/.test(detalle) ? fechaLarga(detalle) : detalle.replace(/-/g, ' ')}`
}

/** Agrupa las tarjetas para el PDF: primero lo que toca hoy, luego por etapa. */
export function grupos(tarjetas: readonly Tarjeta[], hoy: string): { titulo: string; nota: string; tarjetas: Tarjeta[] }[] {
  const hoyIds = new Set(pendientes(tarjetas, hoy).map(t => t.id))
  const resto = tarjetas.filter(t => !hoyIds.has(t.id))
  return [
    { titulo: 'Para repasar hoy', nota: 'Vencen hoy o antes', tarjetas: pendientes(tarjetas, hoy) },
    { titulo: 'Aprendiendo', nota: 'Repaso en menos de 3 semanas', tarjetas: resto.filter(t => t.intervalo < 21) },
    { titulo: 'Maduras', nota: 'Bien aprendidas (21 días o más)', tarjetas: resto.filter(t => t.intervalo >= 21) },
  ].filter(x => x.tarjetas.length > 0)
}

const tamano = (s: string) => (s.length > 220 ? 'xs' : s.length > 120 ? 's' : s.length > 60 ? 'm' : 'l')

/** Páginas de tarjetas para recortar: anverso y reverso alternos, listos para imprimir a doble cara (borde largo). */
export function recortables(tarjetas: readonly Tarjeta[], porPagina = 10, columnas = 2): string {
  const paginas: string[] = []
  for (let i = 0; i < tarjetas.length; i += porPagina) {
    const lote = tarjetas.slice(i, i + porPagina)
    const relleno = Array.from({ length: porPagina - lote.length }, () => undefined)
    const celdas = [...lote, ...relleno]
    const anverso = celdas.map((t, j) =>
      t === undefined
        ? '<div class="corte vacia"></div>'
        : `<div class="corte"><span class="num">${i + j + 1}</span><div class="txt ${tamano(t.frente)}">${escapar(t.frente)}</div></div>`,
    )
    // reverso: cada fila en espejo, para que al imprimir a doble cara cada respuesta caiga detrás de su pregunta
    const reverso: string[] = []
    for (let f = 0; f < celdas.length; f += columnas) {
      const fila = celdas.slice(f, f + columnas).map((t, j) =>
        t === undefined
          ? '<div class="corte vacia"></div>'
          : `<div class="corte reverso"><span class="num">${i + f + j + 1}</span><div class="txt ${tamano(t.reverso)}">${escapar(t.reverso)}</div>${t.fuente !== undefined ? `<div class="fuente">${escapar(t.fuente)}</div>` : ''}</div>`,
      )
      reverso.push(...fila.reverse())
    }
    paginas.push(`<section class="hoja-corte"><div class="rejilla">${anverso.join('')}</div></section>`)
    paginas.push(`<section class="hoja-corte"><div class="rejilla">${reverso.join('')}</div></section>`)
  }
  return paginas.join('\n')
}

export function documentoRepaso(d: DatosRepaso): string {
  const { cuaderno, hoy, tarjetas } = d
  const s = d.stats
  const dia = s[hoy] ?? stats.VACIO
  const total = stats.totales(s)
  const semana = stats.ultimosDias(s, hoy, 7)
  const t7 = stats.totales(s, semana[0]?.dia)
  const etapas = stats.etapas(tarjetas)
  const nHoy = pendientes(tarjetas, hoy).length
  const proxima = tarjetas.filter(t => t.vence > hoy).map(t => t.vence).sort()[0]
  const historia = stats.ultimosDias(s, hoy, 7 * 16).map(x => ({ dia: x.dia, valor: g.actividad(x.datos), diaSemana: diaSemana(x.dia) }))
  const lote = grupos(tarjetas, hoy)
  const racha = stats.racha(s, hoy)
  // una sola numeración: la de la lista y la de las tarjetas para recortar
  const ordenadas = lote.flatMap(gr => gr.tarjetas)
  const numero = new Map(ordenadas.map((t, i) => [t.id, i + 1]))

  const indice = [
    tarjetas.length > 0 ? '<li><a href="#tarjetas">Tarjetas</a></li>' : '',
    ...d.documentos.map((doc, i) => `<li><a href="#doc-${i}">${escapar(tituloDocumento(doc.archivo))}</a></li>`),
    tarjetas.length > 0 ? '<li><a href="#recortar">Tarjetas para recortar</a></li>' : '',
  ].join('')

  const azulejo = (titulo: string, valor: string, detalle: string, color: string) =>
    `<div class="azulejo" style="border-color:${color}"><div class="t">${escapar(titulo)}</div><div class="v" style="color:${color}">${escapar(valor)}</div><div class="d">${escapar(detalle)}</div></div>`

  const portada = `
<section class="portada">
  <div class="marca">📚 estudio · repaso</div>
  <h1>${escapar(cuaderno.nombre)}</h1>
  <div class="fecha">${escapar(fechaLarga(hoy))}</div>
  <div class="azulejos">
    ${azulejo('Racha', `🔥 ${racha} ${racha === 1 ? 'día' : 'días'}`, `mejor: ${stats.mejorRacha(s)}`, g.COLOR_FASE.enfoque)}
    ${azulejo('Pomodoros', `${total.pomodoros} 🍅`, `${stats.horas(total.minutos)} de enfoque`, g.COLOR_FASE.enfoque)}
    ${azulejo('Aciertos', stats.porcentaje(total.aciertos, total.repasos), `7 días: ${stats.porcentaje(t7.aciertos, t7.repasos)}`, g.COLOR_FASE.descansoLargo)}
    ${azulejo('Tarjetas', `${tarjetas.length}`, `${nHoy} para hoy${proxima !== undefined && nHoy === 0 ? ` · próxima ${proxima}` : ''}`, g.COLOR_FASE.descanso)}
  </div>
  <div class="graficos">
    <figure><figcaption>Pomodoros · últimos 7 días</figcaption>${g.barras(semana.map(x => ({ etiqueta: DIAS[diaSemana(x.dia)] ?? '', valor: x.datos.pomodoros, esHoy: x.dia === hoy })))}</figure>
    <figure><figcaption>Actividad · 16 semanas</figcaption>${g.mapaCalor(historia)}</figure>
  </div>
  ${tarjetas.length > 0 ? `<figure class="ancho"><figcaption>Etapas de las tarjetas</figcaption>${g.etapas(etapas)}</figure>` : ''}
  <div class="columnas">
    <div>
      <h3>Fuentes (${cuaderno.fuentes.length})</h3>
      <ul class="fuentes">${cuaderno.fuentes.map(f => `<li>${g.iconoFuente(f)} ${escapar(f)}</li>`).join('') || '<li class="tenue">Sin fuentes todavía</li>'}</ul>
    </div>
    <div>
      <h3>Contenido</h3>
      <ol class="indice">${indice || '<li class="tenue">Aún no hay tarjetas ni documentos</li>'}</ol>
      <p class="tenue">Hoy: ${dia.pomodoros} pomodoros · ${dia.repasos} tarjetas repasadas</p>
    </div>
  </div>
</section>`

  const seccionTarjetas = tarjetas.length === 0 ? '' : `
<section id="tarjetas" class="salto">
  <h2>🃏 Tarjetas <span class="tenue">· ${tarjetas.length}</span></h2>
  ${lote.map(gr => `
  <div class="grupo">
  <h3>${escapar(gr.titulo)} <span class="tenue">· ${gr.tarjetas.length} · ${escapar(gr.nota)}</span></h3>
  <div class="lista">
    ${gr.tarjetas.map(t => `
    <article class="tarjeta">
      <div class="q"><span class="n">${numero.get(t.id) ?? ''}</span>${escapar(t.frente)}</div>
      <div class="a">${escapar(t.reverso)}</div>
      <div class="meta">${t.fuente !== undefined ? `📎 ${escapar(t.fuente)} · ` : ''}próximo repaso: ${t.vence <= hoy ? 'hoy' : escapar(t.vence)}</div>
    </article>`).join('')}
  </div>
  </div>`).join('')}
</section>`

  const documentos = d.documentos.map((doc, i) => `
<section id="doc-${i}" class="salto documento">
  <div class="origen">salidas/${escapar(doc.archivo)}</div>
  ${/^\s*#\s/.test(doc.markdown) ? '' : `<h1>${escapar(tituloDocumento(doc.archivo))}</h1>`}
  ${aHtml(doc.markdown)}
</section>`).join('')

  const corte = tarjetas.length === 0 ? '' : `
<section id="recortar" class="instrucciones">
  <h2>✂️ Tarjetas para recortar</h2>
  <p>Imprime las páginas siguientes <strong>a doble cara, girando por el borde largo</strong>: cada respuesta queda detrás de su pregunta. Recorta por las líneas discontinuas.</p>
  <p class="tenue">${tarjetas.length} tarjetas · ${Math.ceil(tarjetas.length / 10)} hojas (anverso y reverso)</p>
</section>
${recortables(ordenadas)}`

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Repaso · ${escapar(cuaderno.nombre)} · ${escapar(hoy)}</title>
<style>${CSS}</style></head>
<body>
${portada}
${seccionTarjetas}
${documentos}
<footer class="pie">Generado con el plugin estudio para Claude Code · ${escapar(hoy)} · próximo repaso sugerido: ${escapar(proxima ?? sumarDias(hoy, 1))}</footer>
${corte}
</body></html>`
}

const CSS = `
@page { size: A4; margin: 16mm 15mm 18mm; @bottom-center { content: counter(page) " / " counter(pages); font: 9pt system-ui, sans-serif; color: #8A8F98; } }
@page corte { margin: 10mm; @bottom-center { content: none; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 10.5pt/1.5 system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif; color: #1F2328; margin: 0; }
h1, h2, h3, h4 { line-height: 1.25; margin: 1.1em 0 .45em; }
h1 { font-size: 22pt; } h2 { font-size: 16pt; } h3 { font-size: 12.5pt; } h4 { font-size: 11pt; }
p { margin: .4em 0 .7em; }
a { color: #3B82C4; text-decoration: none; }
code { font: 9.5pt ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #F2F3F5; padding: .1em .35em; border-radius: 4px; }
pre { background: #F6F8FA; padding: 10px 12px; border-radius: 8px; overflow: hidden; white-space: pre-wrap; }
pre code { background: none; padding: 0; }
blockquote { margin: .6em 0; padding: .2em 1em; border-left: 4px solid #E8553F; background: #FDF3F1; border-radius: 0 8px 8px 0; }
table { border-collapse: collapse; width: 100%; margin: .6em 0 1em; font-size: 9.5pt; }
th, td { border: 1px solid #D8DCE1; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #F2F3F5; }
hr { border: 0; border-top: 1px solid #D8DCE1; margin: 1.2em 0; }
ul, ol { padding-left: 1.4em; } li { margin: .15em 0; }
.tenue { color: #8A8F98; font-weight: normal; }
h1, h2, h3, h4 { break-after: avoid-page; }
.grupo h3 + .lista > .tarjeta:first-child, .grupo h3 + .lista > .tarjeta:nth-child(2) { break-before: avoid-page; }
.salto { break-before: page; }
.portada .marca { color: #E8553F; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 9pt; }
.portada h1 { font-size: 30pt; margin: .2em 0 0; }
.portada .fecha { color: #8A8F98; margin-bottom: 14px; }
.azulejos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0 16px; }
.azulejo { border: 1.5px solid; border-radius: 12px; padding: 8px 12px; }
.azulejo .t { font-size: 8.5pt; color: #8A8F98; text-transform: uppercase; letter-spacing: .06em; }
.azulejo .v { font-size: 17pt; font-weight: 700; }
.azulejo .d { font-size: 8.5pt; color: #6B7079; }
.graficos { display: flex; gap: 22px; align-items: flex-start; }
figure { margin: 0 0 10px; break-inside: avoid; }
figcaption { font-weight: 600; font-size: 10pt; margin-bottom: 4px; }
figure svg { max-width: 100%; height: auto; }
.columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 6px; }
.fuentes { list-style: none; padding: 0; } .fuentes li { padding: 2px 0; border-bottom: 1px dotted #E1E4E8; }
.lista { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
.tarjeta { border: 1px solid #D8DCE1; border-left: 4px solid #E8553F; border-radius: 8px; padding: 7px 10px; break-inside: avoid; }
.tarjeta .q { font-weight: 650; }
.tarjeta .q .n { display: inline-block; min-width: 1.6em; color: #E8553F; font-weight: 700; }
.tarjeta .a { margin: 3px 0 2px 1.6em; color: #2F363D; }
.tarjeta .meta { margin-left: 1.6em; font-size: 8pt; color: #8A8F98; }
.documento .origen { font: 8.5pt ui-monospace, monospace; color: #8A8F98; }
.documento h1:first-of-type { margin-top: .2em; }
.instrucciones { margin-top: 22px; padding: 12px 16px; border: 1.5px dashed #B8BDC4; border-radius: 12px; break-inside: avoid; }
.instrucciones h2 { margin-top: 0; }
.hoja-corte { page: corte; break-before: page; }
.rejilla { display: grid; grid-template-columns: repeat(2, 1fr); grid-auto-rows: 54mm; }
.corte { position: relative; border: 1px dashed #B8BDC4; padding: 7mm 6mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; overflow: hidden; }
.corte.vacia { border-color: #EEF0F2; }
.corte .num { position: absolute; top: 3mm; left: 4mm; font-size: 8pt; color: #E8553F; font-weight: 700; }
.corte.reverso .num { color: #2FA67A; }
.corte .txt { font-weight: 600; }
.corte.reverso .txt { font-weight: 400; }
.corte .txt.l { font-size: 14pt; } .corte .txt.m { font-size: 12pt; } .corte .txt.s { font-size: 10pt; } .corte .txt.xs { font-size: 8.5pt; }
.corte .fuente { position: absolute; bottom: 3mm; left: 0; right: 0; font-size: 7pt; color: #8A8F98; }
.pie { margin-top: 18px; font-size: 8pt; color: #8A8F98; text-align: center; }
`
