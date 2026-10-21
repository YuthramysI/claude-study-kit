// El panel "Estudio": pestañas Pomodoro, Repaso, Cuaderno y Stats.
// Donde la superficie dibuja SVG (VS Code, escritorio, móvil) usa gráficos;
// en la terminal, dígitos grandes y barras de texto.
import type { On, RenderElement } from 'claude-code'

import type { Pestana } from '../types'
import * as acc from './acciones'
import type { Config } from './estado'
import * as g from './graficos'
import * as lg from './logros'
import { arbolTexto, mapaSvg } from './mapa'
import { hostOf } from './motor'
import * as pomo from './pomodoro'
import * as ses from './sesiones'
import { describirIntervalo, ETIQUETAS, fecha, fechaLarga, intervaloPara, NOTAS, nuevasEnEspera, pendientes, pronostico, sumarDias } from './srs'
import * as stats from './stats'
import { L } from './i18n'

const PESTANAS: readonly { id: Pestana; label: string }[] = [
  { id: 'pomodoro', get label() { return '🍅 Pomodoro' } },
  { id: 'repaso', get label() { return L('🃏 Repaso', '🃏 Review') } },
  { id: 'cuaderno', get label() { return L('📚 Cuaderno', '📚 Notebook') } },
  { id: 'mapa', get label() { return L('🧠 Mapa', '🧠 Map') } },
  { id: 'stats', get label() { return '📊 Stats' } },
  { id: 'logros', get label() { return L('🏆 Logros', '🏆 Achievements') } },
]

const SKILLS = [
  { id: 'tarjetas', get label() { return L('🃏 Crear tarjetas', '🃏 Make cards') }, hotkey: 't' },
  { id: 'guia', get label() { return L('📝 Guía', '📝 Guide') }, hotkey: 'g' },
  { id: 'quiz', get label() { return '❓ Quiz' }, hotkey: 'q' },
  { id: 'simulacro', get label() { return L('⏱️ Simulacro', '⏱️ Mock exam') }, hotkey: 'x' },
  { id: 'audio', get label() { return '🎧 Audio' }, hotkey: 'a' },
] as const

const dias = () => L('dom lun mar mié jue vie sáb', 'Sun Mon Tue Wed Thu Fri Sat').split(' ')
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00`).getDay()

const COLOR_NOTA = { otra: 'error', dificil: 'warning', bien: 'success', facil: 'suggestion' } as const

export function registrarPanel(on: On, cfg: Config, home: () => string) {
  on('ui.render', { component: 'Pane', requestId: 'estudio' }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // la terminal no dibuja SVG: allí van dígitos grandes y barras de texto
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
    // móvil no tiene campos de texto: allí no hay modo escribir ni edición
    const Input = 'Input' in els ? els.Input : undefined
    const m = hostOf($, home())
    const pestana = await m.st.pestana.leer()
    const columnas = e.props.bodyColumns
    const ancho = Math.max(16, Math.min(44, columnas - 4))
    const anchoSvg = Math.max(220, Math.min(340, columnas * 7))

    // bloque de sesiones recientes (vista Hábitos)
    const sesionesRecientes = async (): Promise<RenderElement[]> => {
      const ahora = await $.clock.now()
      const actual = await m.st.sesion.leer()
      const lista = [...(actual !== null && !ses.vacia(actual) ? [actual] : []), ...(await m.st.sesiones.leer()).filter(s => s.id !== actual?.id)].slice(0, 6)
      return [
        <Box key="sesiones" flexDirection="column">
          <Text bold>{L('Sesiones recientes', 'Recent sessions')}</Text>
          {lista.length === 0 && <Text dimColor>{L('  Aún no hay sesiones: empieza un pomodoro o repasa unas tarjetas.', '  No sessions yet: start a pomodoro or review some cards.')}</Text>}
          {lista.map((s, i) => (
            <Text key={`ses-${s.id}`}>
              <Text color={i === 0 && ses.abierta(actual, ahora) ? 'success' : 'subtle'}>{i === 0 && ses.abierta(actual, ahora) ? '● ' : '○ '}</Text>
              {ses.linea(s, ahora)}
            </Text>
          ))}
        </Box>,
        <Box key="coach" flexDirection="row" gap={1} flexWrap="wrap">
          <Button key="coach-consejo" label={L('🤖 Resumen y consejo del coach', '🤖 Summary and coach tip')} hotkey="c"
            onPress={() => {
              m.toast(L('El coach está mirando tus datos…', 'The coach is looking at your data…'), 4000)
              void acc.resumenSesion(m, cfg).then(texto => m.linea(texto), err => m.toast(String(err), 6000))
            }} />
        </Box>,
      ]
    }

    const encabezado = (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2} flexWrap="wrap">
          {PESTANAS.map(p => (
            <Button
              key={`tab-${p.id}`}
              label={p.label}
              plain
              dimColor={p.id !== pestana}
              onPress={() => void m.st.pestana.cambiar(() => p.id)}
            />
          ))}
        </Box>
        <Text dimColor>{'─'.repeat(Math.max(10, columnas - 2))}</Text>
      </Box>
    )

    // ── Pomodoro ──────────────────────────────────────────────────────────
    if (pestana === 'pomodoro') {
      const p = await m.st.pomodoro.leer()
      const ahora = Math.max(await m.st.ahora.leer(), p.estado === 'parado' ? 0 : p.terminaEn - p.duracionMs)
      const s = await m.st.stats.leer()
      const dia = fecha(await $.clock.now())
      const hoy = s[dia] ?? stats.VACIO
      const racha = stats.racha(s, dia)
      const restante = p.estado === 'parado' ? pomo.duracionDe(p.fase, cfg.duraciones) : pomo.restante(p, ahora)
      const hecho = p.estado === 'parado' || p.duracionMs <= 0 ? 0 : 1 - restante / p.duracionMs
      const reloj = pomo.reloj(restante)
      const tono = p.estado === 'pausado' ? 'pausa' : p.fase
      const etiqueta = p.estado === 'parado' ? `${L('listo', 'ready')} · ${pomo.NOMBRE_FASE[p.fase]}` : p.estado === 'pausado' ? L('en pausa', 'paused') : pomo.NOMBRE_FASE[p.fase]
      const completados = p.ronda % pomo.RONDAS_POR_CICLO
      const proxima = p.fase === 'enfoque'
        ? (p.ronda + 1) % pomo.RONDAS_POR_CICLO === 0 ? `${pomo.NOMBRE_FASE.descansoLargo} · ${cfg.duraciones.descansoLargo} min` : `${pomo.NOMBRE_FASE.descanso} · ${cfg.duraciones.descanso} min`
        : `${pomo.NOMBRE_FASE.enfoque} · ${cfg.duraciones.enfoque} min`

      const grande = g.relojGrande(reloj)
      const editandoTarea = await m.st.editandoTarea.leer()
      const recientes = await m.st.tareas.leer()
      const cuadernoActual = await m.st.cuaderno.leer()
      const sesionHoy = await m.st.sesion.leer()
      const examenHoy = await acc.estadoPlan(m)
      const barra = g.barraTexto(hecho, ancho)
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          {Svg !== undefined ? (
            <Box flexDirection="column" alignItems="center">
              <Svg
                source={g.anillo({ hecho, reloj, etiqueta, fase: p.fase, pausado: p.estado === 'pausado', ronda: completados, rondas: pomo.RONDAS_POR_CICLO })}
                alt={`${reloj} · ${etiqueta}`}
                width={200}
              />
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text bold color={g.TEMA_FASE[tono]}>
                {p.fase === 'enfoque' ? '🍅' : '☕'} {etiqueta.toUpperCase()}
                {'   '}
                {Array.from({ length: pomo.RONDAS_POR_CICLO }, (_, i) => (i < completados ? '●' : '○')).join(' ')}
              </Text>
              <Box flexDirection="column" marginY={1}>
                {grande.map((fila, i) => (
                  <Text key={`d${i}`} bold color={g.TEMA_FASE[tono]}>{fila}</Text>
                ))}
              </Box>
              <Text>
                <Text color={g.TEMA_FASE[tono]}>{barra.lleno}</Text>
                <Text dimColor>{barra.vacio}</Text>
              </Text>
            </Box>
          )}
          <Box flexDirection="row" gap={1} flexWrap="wrap" justifyContent={Svg !== undefined ? 'center' : 'flex-start'}>
            {p.estado === 'parado' && (
              <Button key="iniciar" label={L('▶ Iniciar', '▶ Start')} hotkey="i" variant="primary" autoFocus
                onPress={() => void acc.pomodoro(m, cfg, 'iniciar')} />
            )}
            {p.estado === 'corriendo' && (
              <Button key="pausar" label={L('⏸ Pausar', '⏸ Pause')} hotkey="p" onPress={() => void acc.pomodoro(m, cfg, 'pausar')} />
            )}
            {p.estado === 'pausado' && (
              <Button key="reanudar" label={L('▶ Reanudar', '▶ Resume')} hotkey="p" variant="primary"
                onPress={() => void acc.pomodoro(m, cfg, 'reanudar')} />
            )}
            <Button key="saltar" label={L('⏭ Saltar', '⏭ Skip')} hotkey="s" onPress={() => void acc.pomodoro(m, cfg, 'saltar')} />
            {p.estado !== 'parado' && (
              <Button key="parar" label={L('⏹ Parar', '⏹ Stop')} hotkey="x" onPress={() => void acc.pomodoro(m, cfg, 'parar')} />
            )}
          </Box>
          {editandoTarea && Input !== undefined ? (
            <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
              <Input key="tarea" label={L('¿En qué vas a trabajar?', 'What are you working on?')} value={p.tarea ?? cuadernoActual?.nombre ?? ''} autoFocus
                placeholder={L('Química, TFG, inglés…', 'Chemistry, thesis, Spanish…')} submitLabel={L('fijar', 'set')}
                onSubmit={v => void acc.fijarTarea(m, v)} />
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                {recientes.map((t, i) => (
                  <Button key={`tarea-${i}`} label={t} plain dimColor={t !== p.tarea} onPress={() => void acc.fijarTarea(m, t)} />
                ))}
                <Button key="tarea-cancelar" label={L('Cancelar', 'Cancel')} plain dimColor onPress={() => void m.st.editandoTarea.cambiar(() => false)} />
              </Box>
            </Box>
          ) : (
            <Box flexDirection="row" columnGap={1} justifyContent={Svg !== undefined ? 'center' : 'flex-start'}>
              <Text>📌 <Text bold>{p.tarea ?? cuadernoActual?.nombre ?? 'General'}</Text></Text>
              {Input !== undefined && (
                <Button key="cambiar-tarea" label={L('✎ tarea', '✎ task')} hotkey="t" plain dimColor onPress={() => void m.st.editandoTarea.cambiar(() => true)} />
              )}
            </Box>
          )}
          <Box flexDirection="column" alignItems={Svg !== undefined ? 'center' : 'flex-start'}>
            <Text dimColor>{L('Después', 'Next')}: {proxima}</Text>
            {examenHoy !== null && examenHoy.dias >= 0 && (
              <Text color={examenHoy.ritmo === 'atrasado' ? 'error' : 'claude'}>
                🎯 {examenHoy.titulo ?? L('Examen', 'Exam')} {examenHoy.dias === 0 ? L('hoy', 'today') : L(`en ${examenHoy.dias} días`, `in ${examenHoy.dias} days`)} · {examenHoy.mensaje}
              </Text>
            )}
            {sesionHoy !== null && ses.abierta(sesionHoy, ahora) && !ses.vacia(sesionHoy) && (
              <Text dimColor>{L('Esta sesión', 'This session')}: {ses.linea(sesionHoy)}</Text>
            )}
            <Text>
              {L('Hoy', 'Today')}: {hoy.pomodoros} {hoy.pomodoros === 1 ? 'pomodoro' : 'pomodoros'} · {stats.horas(hoy.minutos)}
              {racha > 0 ? `  ·  🔥 ${racha} ${racha === 1 ? L('día', 'day') : L('días', 'days')}` : ''}
            </Text>
          </Box>
        </Box>
      )
    }

    const cuaderno = await m.st.cuaderno.leer()

    // ── Stats ─────────────────────────────────────────────────────────────
    if (pestana === 'stats') {
      const s = await m.st.stats.leer()
      const hoy = fecha(await $.clock.now())
      const d = s[hoy] ?? stats.VACIO
      const semana = stats.ultimosDias(s, hoy, 7)
      const t7 = stats.totales(s, semana[0]?.dia)
      const total = stats.totales(s)
      const racha = stats.racha(s, hoy)
      const vista = await m.st.vistaStats.leer()
      const tarjetasStats = cuaderno === null ? [] : await m.st.tarjetas.leer()
      const tarjeta = (titulo: string, valor: string, detalle: string, color: string) => (
        <Box key={titulo} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} minWidth={14}>
          <Text dimColor>{titulo}</Text>
          <Text bold color={color} size="heading">{valor}</Text>
          <Text dimColor>{detalle}</Text>
        </Box>
      )
      const vistas = (
        <Box flexDirection="row" columnGap={2}>
          {([['general', 'General', 'g'], ['repaso', L('Repaso', 'Review'), 'r'], ['habitos', L('Hábitos', 'Habits'), 'h']] as const).map(([id, nombre, tecla]) => (
            <Button key={`vista-${id}`} label={vista === id ? `◉ ${nombre}` : `○ ${nombre}`} hotkey={tecla} plain dimColor={vista !== id}
              onPress={() => void m.st.vistaStats.cambiar(() => id)} />
          ))}
        </Box>
      )
      const seccion = (titulo: string, contenido: RenderElement | RenderElement[] | false) => (
        <Box key={titulo} flexDirection="column">
          <Text bold>{titulo}</Text>
          {contenido}
        </Box>
      )
      const corta = (dia: string) => String(Number(dia.slice(8)))
      const dibujo = (source: string, alt: string) => (Svg !== undefined ? <Svg source={source} alt={alt} width={anchoSvg} /> : <Text>{alt}</Text>)

      let cuerpo: RenderElement[]
      if (vista === 'repaso') {
        const pron = pronostico(tarjetasStats, hoy, 30)
        const etiquetasPron = Array.from({ length: 30 }, (_, i) => corta(sumarDias(hoy, i)))
        const mes = stats.ultimosDias(s, hoy, 30)
        const aciertos = stats.aciertosPorDia(s, hoy, 30)
        const notas7 = semana.reduce<Record<string, number>>((acc, x) => {
          for (const [k, n] of Object.entries(x.datos.notas ?? {})) acc[k] = (acc[k] ?? 0) + n
          return acc
        }, {})
        const dificultades = Array.from({ length: 10 }, (_, i) => tarjetasStats.filter(t => Math.min(10, Math.max(1, Math.round(t.dificultad ?? 0))) === i + 1 && t.dificultad !== undefined).length)
        const etapas = stats.etapas(tarjetasStats)
        const conDatos = aciertos.filter((x): x is number => x !== null)
        const media = conDatos.length === 0 ? '—' : stats.porcentaje(Math.round(conDatos.reduce((a, b) => a + b, 0) / conDatos.length), 100)
        cuerpo = [
          <Box key="resumen-repaso" flexDirection="row" gap={1} flexWrap="wrap">
            {tarjeta(L('Mañana', 'Tomorrow'), `${pron[1] ?? 0}`, L('repasos previstos', 'reviews due'), 'suggestion')}
            {tarjeta(L('7 días', '7 days'), `${pron.slice(0, 7).reduce((a, b) => a + b, 0)}`, L('repasos previstos', 'reviews due'), 'claude')}
            {tarjeta(L('Aciertos', 'Accuracy'), media, L('media de 30 días', '30-day average'), 'success')}
          </Box>,
          seccion(L('Pronóstico · próximos 30 días', 'Forecast · next 30 days'),
            Svg !== undefined
              ? <Svg source={g.columnas(pron, etiquetasPron, { destacar: 0 })} alt={`${L('Repasos previstos', 'Reviews due')}: ${pron.join(', ')}`} width={anchoSvg} />
              : <Text color="suggestion">{stats.sparkline(pron)}</Text>),
          seccion(L('Aciertos · últimos 30 días', 'Accuracy · last 30 days'),
            Svg !== undefined
              ? <Svg source={g.curva(aciertos, mes.map(x => corta(x.dia)))} alt={`${L('Aciertos por día', 'Accuracy per day')}: ${aciertos.map(x => x ?? '—').join(', ')}`} width={anchoSvg} />
              : <Text color="success">{stats.sparkline(aciertos.map(x => x ?? 0))}</Text>),
          seccion(L('Notas · 7 días', 'Grades · 7 days'),
            <Text>
              {NOTAS.map((n, i) => (
                <Text key={`n-${n}`} color={COLOR_NOTA[n]}>{i > 0 ? '  ' : ''}{ETIQUETAS[n]} {notas7[n] ?? 0}</Text>
              ))}
            </Text>),
          ...(tarjetasStats.length > 0
            ? [
              seccion(L('Dificultad de las tarjetas (FSRS, 1 fácil · 10 difícil)', 'Card difficulty (FSRS, 1 easy · 10 hard)'),
                dibujo(g.histograma(dificultades, dificultades.map((_, i) => String(i + 1)), '#9B6BD3'), dificultades.map((n, i) => `${i + 1}: ${n}`).join(' · '))),
              seccion(`${L('Etapas', 'Stages')} · ${cuaderno?.nombre ?? ''}`,
                Svg !== undefined
                  ? <Svg source={g.etapas(etapas)} alt={L(`${etapas.nuevas} nuevas, ${etapas.aprendiendo} aprendiendo, ${etapas.maduras} maduras`, `${etapas.nuevas} new, ${etapas.aprendiendo} learning, ${etapas.maduras} mature`)} width={anchoSvg} />
                  : <Text><Text color="suggestion">{etapas.nuevas} {L('nuevas', 'new')}</Text> · <Text color="warning">{etapas.aprendiendo} {L('aprendiendo', 'learning')}</Text> · <Text color="success">{etapas.maduras} {L('maduras', 'mature')}</Text></Text>),
            ]
            : [<Text key="sin-tarjetas" dimColor>{L('Sin tarjetas en el cuaderno activo.', 'No cards in the active notebook.')}</Text>]),
        ]
      } else if (vista === 'habitos') {
        const matriz = stats.horario(s, hoy, 56)
        const mejores = stats.mejoresHoras(s, hoy, 56)
        const sombras = ' ░▒▓█'
        const maxCelda = Math.max(1, ...matriz.flat())
        const diasCortos = L('LMXJVSD', 'MTWTFSS').split('')
        cuerpo = [
          seccion(L('¿Cuándo estudias? · 8 semanas', 'When do you study? · 8 weeks'),
            Svg !== undefined
              ? <Svg source={g.horarioCalor(matriz)} alt={L('Minutos de enfoque por día de la semana y hora', 'Focus minutes by weekday and hour')} width={anchoSvg} />
              : (
                <Box flexDirection="column">
                  <Text dimColor>{'  0     6     12    18   23'}</Text>
                  {matriz.map((fila, i) => (
                    <Text key={`h-${i}`} color="success">{diasCortos[i]} {fila.map(v => sombras[v <= 0 ? 0 : Math.min(4, Math.ceil((v / maxCelda) * 4))]).join('')}</Text>
                  ))}
                </Box>
              )),
          <Text key="mejores">
            {mejores.length === 0
              ? <Text dimColor>{L('Completa algunos pomodoros para descubrir tus mejores horas.', 'Complete a few pomodoros to discover your best hours.')}</Text>
              : <Text>⭐ {L('Tus mejores horas', 'Your best hours')}: <Text bold color="claude">{mejores.map(x => `${x.hora}–${x.hora + 1} h`).join(' · ')}</Text></Text>}
          </Text>,
          ...(await sesionesRecientes()),
        ]
      } else {
        const temas7 = stats.temas(s, semana[0]?.dia).slice(0, 8)
        const examenes = stats.examenes(s).slice(-12)
        const historia = stats.ultimosDias(s, hoy, 7 * 16).map(x => ({ dia: x.dia, valor: g.actividad(x.datos), diaSemana: diaSemana(x.dia) }))
        const maxSemana = Math.max(1, ...semana.map(x => x.datos.pomodoros))
        const anchoBarra = Math.max(6, ancho - 10)
        cuerpo = [
          seccion(L('Pomodoros · últimos 7 días', 'Pomodoros · last 7 days'),
            Svg !== undefined
              ? <Svg source={g.barras(semana.map(x => ({ etiqueta: dias()[diaSemana(x.dia)] ?? '', valor: x.datos.pomodoros, esHoy: x.dia === hoy })))} alt={`${L('Pomodoros por día', 'Pomodoros per day')}: ${semana.map(x => x.datos.pomodoros).join(', ')}`} width={anchoSvg} />
              : (
                <Box flexDirection="column">
                  {semana.map(x => (
                    <Text key={x.dia}>
                      <Text dimColor={x.dia !== hoy} bold={x.dia === hoy}>{(dias()[diaSemana(x.dia)] ?? '').padEnd(4)}</Text>
                      <Text color="claude">{'█'.repeat(Math.round((x.datos.pomodoros / maxSemana) * anchoBarra))}</Text>
                      <Text dimColor>{x.datos.pomodoros > 0 ? ` ${x.datos.pomodoros}` : ' ·'}</Text>
                    </Text>
                  ))}
                </Box>
              )),
          ...(temas7.length > 0
            ? [seccion(L('Tiempo por tema · 7 días', 'Time per topic · 7 days'),
              Svg !== undefined
                ? <Svg source={g.barrasTemas(temas7, stats.horas)} alt={temas7.map(t => `${t.tema}: ${stats.horas(t.minutos)}`).join(', ')} width={anchoSvg} />
                : (
                  <Box flexDirection="column">
                    {temas7.map((t, i) => (
                      <Text key={`tema-${i}`}>
                        <Text dimColor>{(t.tema.length > 12 ? `${t.tema.slice(0, 11)}…` : t.tema).padEnd(13)}</Text>
                        <Text color={g.COLORES_TEMA[i % g.COLORES_TEMA.length] ?? 'subtle'}>{'█'.repeat(Math.max(1, Math.round((t.minutos / (temas7[0]?.minutos ?? 1)) * Math.max(4, ancho - 24))))}</Text>
                        <Text dimColor> {stats.horas(t.minutos)}</Text>
                      </Text>
                    ))}
                  </Box>
                ))]
            : []),
          seccion(Svg !== undefined ? L('Actividad · 16 semanas', 'Activity · 16 weeks') : L('Actividad · 4 semanas', 'Activity · 4 weeks'),
            Svg !== undefined
              ? <Svg source={g.mapaCalor(historia)} alt={L(`Actividad de las últimas 16 semanas; total ${total.pomodoros} pomodoros`, `Activity over the last 16 weeks; ${total.pomodoros} pomodoros in total`)} width={anchoSvg} />
              : <Text color="success">{stats.sparkline(stats.ultimosDias(s, hoy, 28).map(x => g.actividad(x.datos)))}</Text>),
          ...(examenes.length > 0
            ? [seccion(L('📝 Exámenes simulados', '📝 Mock exams'),
              <Box flexDirection="column">
                {Svg !== undefined && examenes.length > 1 && (
                  <Svg source={g.curva(examenes.map(e => e.nota * 10), examenes.map(e => corta(e.dia)), '#E8553F')}
                    alt={`${L('Notas', 'Scores')}: ${examenes.map(e => e.nota.toFixed(1)).join(', ')}`} width={anchoSvg} />
                )}
                {examenes.slice(-5).reverse().map((e, i) => (
                  <Text key={`ex-${i}`}>
                    <Text bold color={e.nota >= 9 ? 'success' : e.nota >= 5 ? 'claude' : 'error'}>{e.nota.toFixed(1)}</Text>
                    <Text dimColor> /10 · {e.dia.slice(5).split('-').reverse().join('/')} · {e.titulo ?? e.cuaderno} · {e.preguntas} {L('preguntas', 'questions')}</Text>
                  </Text>
                ))}
              </Box>)]
            : []),
          <Text key="total" dimColor>
            Total: {total.pomodoros} pomodoros · {stats.horas(total.minutos)} {L('de enfoque', 'of focus')} · {total.repasos} {L('repasos', 'reviews')}
          </Text>,
          <Box key="informe" flexDirection="row" gap={1} flexWrap="wrap">
            <Button key="informe-semana" label={L('📸 Informe de la semana', '📸 Weekly report')} hotkey="i" variant="primary"
              onPress={() => {
                m.toast(L('Preparando tu informe semanal…', 'Preparing your weekly report…'), 4000)
                void acc.generarInforme(m, cfg).then(t => {
                  m.toast(t, 8000)
                  m.linea(t)
                }, err => m.toast(String(err), 6000))
              }} />
            <Button key="informe-pasada" label={L('semana pasada', 'last week')} plain dimColor
              onPress={() => void acc.generarInforme(m, cfg, true).then(t => m.linea(t), err => m.toast(String(err), 6000))} />
          </Box>,
        ]
      }

      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {tarjeta(L('Racha', 'Streak'), `🔥 ${racha}`, L(`mejor: ${stats.mejorRacha(s)} días`, `best: ${stats.mejorRacha(s)} days`), 'claude')}
            {tarjeta(L('Hoy', 'Today'), `${d.pomodoros} 🍅`, `${stats.horas(d.minutos)} · ${d.repasos} ${L('tarjetas', 'cards')}`, 'success')}
            {tarjeta(L('Aciertos', 'Accuracy'), stats.porcentaje(d.aciertos, d.repasos), `${L('7 días', '7 days')}: ${stats.porcentaje(t7.aciertos, t7.repasos)}`, 'suggestion')}
          </Box>
          {vistas}
          {cuerpo}
        </Box>
      )
    }

    // ── Logros y nivel ────────────────────────────────────────────────────
    if (pestana === 'logros') {
      const datos = await acc.datosLogros(m)
      const resumen = lg.resumir(datos)
      const conseguidos = await m.st.logros.leer()
      const xp = lg.experiencia(datos.stats, Object.keys(conseguidos).length)
      const n = lg.nivel(xp)
      const hecho = (xp - n.desde) / Math.max(1, n.hasta - n.desde)
      const barraXp = g.barraTexto(hecho, ancho)
      const orden = [...lg.LOGROS].sort((a, b) => {
        const ya = conseguidos[a.id] !== undefined ? 0 : 1
        const yb = conseguidos[b.id] !== undefined ? 0 : 1
        if (ya !== yb) return ya - yb
        const [pa, ma] = a.progreso(resumen)
        const [pb, mb] = b.progreso(resumen)
        return pb / mb - pa / ma
      })
      const anchoInsignia = Math.max(26, Math.floor((columnas - 4) / 2))
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          {Svg !== undefined ? (
            <Svg source={g.tarjetaNivel({ ...n, xp, logros: Object.keys(conseguidos).length, total: lg.LOGROS.length })}
              alt={`${L('Nivel', 'Level')} ${n.nivel} · ${n.titulo} · ${xp} XP`} width={anchoSvg} />
          ) : (
            <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
              <Text bold color="claude">⭐ {L('Nivel', 'Level')} {n.nivel} · {n.titulo}</Text>
              <Text>
                <Text color="claude">{barraXp.lleno}</Text>
                <Text dimColor>{barraXp.vacio}</Text>
              </Text>
              <Text dimColor>{xp - n.desde} / {n.hasta - n.desde} {L('XP para el nivel', 'XP to level')} {n.nivel + 1} · 🏆 {Object.keys(conseguidos).length}/{lg.LOGROS.length}</Text>
            </Box>
          )}
          <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={0}>
            {orden.map(l => {
              const ya = conseguidos[l.id]
              const [actual, objetivo] = l.progreso(resumen)
              const prog = g.barraTexto(actual / objetivo, 10)
              return (
                <Box key={`logro-${l.id}`} flexDirection="column" width={anchoInsignia} borderStyle="round"
                  borderColor={ya !== undefined ? 'warning' : 'subtle'} paddingX={1}>
                  <Text bold={ya !== undefined} dimColor={ya === undefined}>{ya !== undefined ? l.icono : '🔒'} {l.nombre}</Text>
                  <Text dimColor>{l.descripcion}</Text>
                  {ya !== undefined
                    ? <Text color="warning">✓ {ya}</Text>
                    : <Text dimColor>{prog.lleno}{prog.vacio} {Number.isInteger(actual) ? actual : actual.toFixed(1)}/{objetivo}</Text>}
                </Box>
              )
            })}
          </Box>
          <Text dimColor>{L('XP: 1 por minuto de enfoque · 2 por repaso (+1 si aciertas) · 5 por pomodoro · 50 por examen · 100 por logro', 'XP: 1 per focus minute · 2 per review (+1 if correct) · 5 per pomodoro · 50 per exam · 100 per achievement')}</Text>
        </Box>
      )
    }

    if (cuaderno === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1} paddingY={1}>
            <Text bold>{L('📚 No hay cuaderno activo', '📚 No active notebook')}</Text>
            <Text dimColor>{L('Crea uno con /cuaderno <nombre> y pon tus PDFs o apuntes en su carpeta fuentes/.', 'Create one with /cuaderno <name> and put your PDFs or notes in its fuentes/ folder.')}</Text>
          </Box>
        </Box>
      )
    }

    const tarjetas = await m.st.tarjetas.leer()

    // ── Mapa mental ───────────────────────────────────────────────────────
    if (pestana === 'mapa') {
      const mapas = await acc.leerMapas(m)
      const elegido = await m.st.mapa.leer()
      const actual = mapas.find(x => x.archivo === elegido) ?? mapas[0]
      const crear = (
        <Button key="nuevo-mapa" label={L('🧠 Nuevo mapa mental', '🧠 New mind map')} hotkey="n" variant={actual === undefined ? 'primary' : 'secondary'}
          onPress={() => void m.submitPrompt('/estudio:mapa')} />
      )
      if (actual === undefined) {
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Box flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1} paddingY={1}>
              <Text bold>{L('🧠 Aún no hay mapas mentales', '🧠 No mind maps yet')}</Text>
              <Text dimColor>{L('Claude organiza los conceptos de tus fuentes en un mapa: /estudio:mapa [tema]', 'Claude organizes the concepts of your sources into a map: /estudio:mapa [topic]')}</Text>
            </Box>
            {crear}
          </Box>
        )
      }
      const lineas = arbolTexto(actual.mapa)
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          {mapas.length > 1 && (
            <Box flexDirection="row" columnGap={2} flexWrap="wrap">
              {mapas.slice(0, 8).map((x, i) => (
                <Button key={`mapa-${i}`} label={x.mapa.titulo} plain dimColor={x.archivo !== actual.archivo}
                  onPress={() => void m.st.mapa.cambiar(() => x.archivo)} />
              ))}
            </Box>
          )}
          {Svg !== undefined ? (
            <Svg source={mapaSvg(actual.mapa)} alt={lineas.join('\n')} width={Math.max(260, Math.min(760, columnas * 8))} />
          ) : (
            <Box flexDirection="column">
              {lineas.slice(0, 80).map((l, i) => (
                <Text key={`l${i}`} bold={i === 0} color={i === 0 ? 'claude' : 'text'}>{l}</Text>
              ))}
              {lineas.length > 80 && <Text dimColor>{L(`… y ${lineas.length - 80} más`, `… and ${lineas.length - 80} more`)}</Text>}
            </Box>
          )}
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {crear}
            <Text dimColor>salidas/{actual.archivo}</Text>
          </Box>
        </Box>
      )
    }

    // ── Repaso ────────────────────────────────────────────────────────────
    if (pestana === 'repaso') {
      const ahoraRepaso = await $.clock.now()
      const hoy = fecha(ahoraRepaso)
      const limite = await acc.limiteNuevas(m, cfg, tarjetas)
      const cola = pendientes(tarjetas, hoy, limite)
      const espera = nuevasEnEspera(tarjetas, hoy, limite)
      const repaso = await m.st.repaso.leer()
      const hechas = (await m.st.stats.leer())[hoy]?.repasos ?? 0
      const actual = cola[0]
      const avisar = (texto: Promise<string>) => void texto.then(t => m.toast(t, 5000), err => m.toast(String(err), 6000))
      const botonDeshacer = repaso.deshacer !== undefined && (
        <Button key="deshacer" label={L('↶ Deshacer', '↶ Undo')} hotkey="u" dimColor onPress={() => avisar(acc.deshacer(m, cfg))} />
      )
      if (actual === undefined) {
        const proxima = tarjetas.filter(t => t.vence > hoy).map(t => t.vence).sort()[0]
        const vacio = tarjetas.length === 0
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Box flexDirection="column" borderStyle="round" borderColor={vacio ? 'subtle' : 'success'} paddingX={1} paddingY={1} alignItems="center">
              <Text bold size="heading">{vacio ? L('🃏 Aún no hay tarjetas', '🃏 No cards yet') : L('🎉 ¡Nada pendiente hoy!', '🎉 Nothing due today!')}</Text>
              <Text dimColor>
                {vacio
                  ? L('Pide a Claude que las cree con /estudio:tarjetas', 'Ask Claude to make some with /estudio:tarjetas')
                  : L(`${hechas} repasadas hoy${proxima !== undefined ? ` · próxima el ${proxima}` : ''}${espera > 0 ? ` · ${espera} nuevas esperan a mañana` : ''}`,
                    `${hechas} reviewed today${proxima !== undefined ? ` · next on ${proxima}` : ''}${espera > 0 ? ` · ${espera} new waiting for tomorrow` : ''}`)}
              </Text>
            </Box>
            {botonDeshacer}
          </Box>
        )
      }
      const totalHoy = hechas + cola.length
      const progreso = g.barraTexto(totalHoy === 0 ? 0 : hechas / totalHoy, ancho)
      const nueva = actual.ultimo === 0
      const respuesta = repaso.respuesta?.id === actual.id ? repaso.respuesta : undefined
      const sugerida = respuesta?.veredicto?.nota
      const cabecera = (
        <Box flexDirection="column">
          <Text>
            <Text bold>{cola.length}</Text>
            <Text dimColor> {L('para hoy', 'for today')} · {hechas} {L('repasadas', 'reviewed')}{espera > 0 ? L(` · ${espera} nuevas en espera`, ` · ${espera} new waiting`) : ''} · {cuaderno.nombre}</Text>
          </Text>
          <Text>
            <Text color="success">{progreso.lleno}</Text>
            <Text dimColor>{progreso.vacio}</Text>
          </Text>
        </Box>
      )

      // editar: cada campo se guarda al pulsar Enter
      if (repaso.editando && Input !== undefined) {
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            {cabecera}
            <Box flexDirection="column" borderStyle="round" borderColor="warning" paddingX={2} paddingY={1} gap={1}>
              <Text bold color="warning">{L('✎ Editar tarjeta', '✎ Edit card')}</Text>
              <Input key="editar-frente" label={L('Pregunta', 'Question')} value={actual.frente} autoFocus
                onSubmit={v => avisar(acc.editarTarjeta(m, actual.id, { frente: v }))} />
              <Input key="editar-reverso" label={L('Respuesta', 'Answer')} value={actual.reverso} rows={3}
                onSubmit={v => avisar(acc.editarTarjeta(m, actual.id, { reverso: v }))} />
              <Text dimColor>{L('Enter guarda cada campo.', 'Enter saves each field.')}</Text>
            </Box>
            <Button key="editar-listo" label={L('✓ Listo', '✓ Done')} hotkey="l" variant="primary"
              onPress={() => void m.st.repaso.cambiar(r => ({ ...r, editando: false }))} />
          </Box>
        )
      }

      if (repaso.confirmarBorrado) {
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Box flexDirection="column" borderStyle="round" borderColor="error" paddingX={2} paddingY={1}>
              <Text bold color="error">{L('🗑 ¿Borrar esta tarjeta?', '🗑 Delete this card?')}</Text>
              <Text>{actual.frente}</Text>
              <Text dimColor>{L('Quedará en tarjetas.bak.json por si te arrepientes.', 'It stays in tarjetas.bak.json in case you change your mind.')}</Text>
            </Box>
            <Box flexDirection="row" gap={1}>
              <Button key="borrar-si" label={L('Sí, borrar', 'Yes, delete')} hotkey="s" onPress={() => avisar(acc.borrarTarjeta(m, actual.id))} />
              <Button key="borrar-no" label={L('Cancelar', 'Cancel')} hotkey="n" variant="primary" autoFocus
                onPress={() => void m.st.repaso.cambiar(r => ({ ...r, confirmarBorrado: false }))} />
            </Box>
          </Box>
        )
      }

      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          {cabecera}
          <Box flexDirection="column" borderStyle="round" borderColor={repaso.mostrarReverso ? 'success' : 'claude'} paddingX={2} paddingY={1}>
            <Text dimColor>{nueva ? L('PREGUNTA · NUEVA', 'QUESTION · NEW') : L('PREGUNTA', 'QUESTION')}</Text>
            <Text bold size="heading">{actual.frente}</Text>
            {respuesta !== undefined && (
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>{L('TU RESPUESTA', 'YOUR ANSWER')}</Text>
                <Text italic>{respuesta.texto}</Text>
                {respuesta.pensando && <Text color="suggestion">{L('🤖 Claude está corrigiendo…', '🤖 Claude is grading…')}</Text>}
                {respuesta.veredicto !== undefined && (
                  <Text>
                    <Text color={COLOR_NOTA[respuesta.veredicto.nota]}>{respuesta.veredicto.origen === 'claude' ? '🤖 ' : '≈ '}{ETIQUETAS[respuesta.veredicto.nota]}</Text>
                    <Text dimColor> · {respuesta.veredicto.comentario}</Text>
                  </Text>
                )}
              </Box>
            )}
            {repaso.mostrarReverso && (
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>{L('RESPUESTA', 'ANSWER')}</Text>
                <Text>{actual.reverso}</Text>
                {actual.fuente !== undefined && <Text dimColor italic>📎 {actual.fuente}</Text>}
              </Box>
            )}
          </Box>
          {repaso.mostrarReverso ? (
            <Box flexDirection="column">
              <Text dimColor>{sugerida !== undefined ? L('Nota sugerida resaltada · ¿qué tal la recordaste?', 'Suggested grade highlighted · how well did you recall it?') : L('¿Qué tal la recordaste?', 'How well did you recall it?')}</Text>
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                {NOTAS.map((nota, i) => (
                  <Button
                    key={`nota-${nota}`}
                    hotkey={String(i + 1)}
                    variant={nota === (sugerida ?? 'bien') ? 'primary' : 'secondary'}
                    {...(nota === sugerida ? { autoFocus: true as const } : {})}
                    onPress={() => void acc.calificar(m, cfg, actual.id, nota)}
                  >
                    <Text color={COLOR_NOTA[nota]}>{ETIQUETAS[nota]}</Text>
                    <Text dimColor> {describirIntervalo(intervaloPara(actual, nota, ahoraRepaso, cfg.retencion))}</Text>
                  </Button>
                ))}
              </Box>
            </Box>
          ) : repaso.escribir && Input !== undefined && respuesta === undefined ? (
            <Input key="respuesta" label={L('Tu respuesta', 'Your answer')} placeholder={L('Escríbela y pulsa Enter: Claude la corrige', 'Type it and press Enter: Claude grades it')} rows={2} autoFocus
              submitLabel={L('corregir', 'grade')} onSubmit={v => void acc.corregirRespuesta(m, actual, v)} />
          ) : (
            !respuesta?.pensando && (
              <Button key="mostrar" label={L('👁 Mostrar respuesta', '👁 Show answer')} hotkey="m" variant="primary" autoFocus
                onPress={() => void m.st.repaso.cambiar(r => ({ ...r, mostrarReverso: true }))} />
            )
          )}
          <Box flexDirection="row" columnGap={2} flexWrap="wrap">
            {Input !== undefined && (
              <Button key="modo-escribir" plain dimColor={!repaso.escribir} hotkey="w"
                label={repaso.escribir ? L('⌨ Escribir: sí', '⌨ Type: on') : L('⌨ Escribir: no', '⌨ Type: off')}
                onPress={() => void m.st.repaso.cambiar(r => ({ ...r, escribir: !r.escribir }))} />
            )}
            {Input !== undefined && (
              <Button key="editar" label={L('✎ Editar', '✎ Edit')} hotkey="e" plain dimColor
                onPress={() => void m.st.repaso.cambiar(r => ({ ...r, editando: true }))} />
            )}
            <Button key="borrar" label={L('🗑 Borrar', '🗑 Delete')} hotkey="b" plain dimColor
              onPress={() => void m.st.repaso.cambiar(r => ({ ...r, confirmarBorrado: true }))} />
            {botonDeshacer}
          </Box>
        </Box>
      )
    }

    // ── Cuaderno ──────────────────────────────────────────────────────────
    const pendientesHoy = pendientes(tarjetas, fecha(await $.clock.now()), await acc.limiteNuevas(m, cfg, tarjetas)).length
    const visibles = cuaderno.fuentes.slice(0, 12)
    const etapas = stats.etapas(tarjetas)
    const estadoExamen = await acc.estadoPlan(m)
    const simulacro = await m.st.simulacro.leer()
    const ahoraCuaderno = await $.clock.now()
    const editandoPlan = await m.st.editandoPlan.leer()
    return (
      <Box flexDirection="column" gap={1}>
        {encabezado}
        <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
          <Text bold size="heading">📚 {cuaderno.nombre}</Text>
          <Text dimColor wrap="truncate-middle">{cuaderno.ruta}</Text>
          <Text>
            <Text color="suggestion">{cuaderno.fuentes.length} {L('fuentes', 'sources')}</Text>
            <Text dimColor> · </Text>
            <Text color="claude">{tarjetas.length} {L('tarjetas', 'cards')}</Text>
            <Text dimColor> · </Text>
            <Text color={pendientesHoy > 0 ? 'warning' : 'success'}>{pendientesHoy} {L('para hoy', 'for today')}</Text>
            <Text dimColor> · {etapas.maduras} {L('maduras', 'mature')}</Text>
          </Text>
        </Box>
        {simulacro !== null && (
          <Box flexDirection="row" columnGap={1} borderStyle="round" borderColor={ahoraCuaderno >= simulacro.terminaEn ? 'error' : 'warning'} paddingX={1}>
            <Text bold color={ahoraCuaderno >= simulacro.terminaEn ? 'error' : 'warning'}>{acc.lineaSimulacro(simulacro, ahoraCuaderno)}</Text>
            <Text dimColor>· {simulacro.preguntas} {L('preguntas', 'questions')} · {simulacro.minutos} min</Text>
          </Box>
        )}
        {estadoExamen !== null && estadoExamen.dias >= 0 ? (
          <Box flexDirection="column" borderStyle="round" borderColor={estadoExamen.ritmo === 'atrasado' ? 'error' : estadoExamen.ritmo === 'listo' ? 'success' : 'claude'} paddingX={1}>
            <Text bold size="heading">
              🎯 {estadoExamen.titulo ?? L('Examen', 'Exam')} · {estadoExamen.dias === 0 ? L('¡hoy!', 'today!') : estadoExamen.dias === 1 ? L('mañana', 'tomorrow') : L(`en ${estadoExamen.dias} días`, `in ${estadoExamen.dias} days`)}
            </Text>
            <Text dimColor>{fechaLarga(estadoExamen.examen)}</Text>
            {Svg !== undefined ? (
              <Svg source={g.medidores([
                { valor: estadoExamen.vistas, etiqueta: L('vistas', 'seen'), color: '#3B82C4' },
                { valor: estadoExamen.prevision, etiqueta: L('recordarás', 'recall'), color: '#2FA67A' },
                { valor: Math.min(100, (estadoExamen.pomodorosHoy / Math.max(1, estadoExamen.metaPomodoros)) * 100), etiqueta: `🍅 ${estadoExamen.pomodorosHoy}/${estadoExamen.metaPomodoros} ${L('hoy', 'today')}`, color: '#E8553F' },
              ])} alt={L(`Vistas ${estadoExamen.vistas} %, previsión ${estadoExamen.prevision} %`, `Seen ${estadoExamen.vistas}%, forecast ${estadoExamen.prevision}%`)} width={Math.min(anchoSvg, 312)} />
            ) : (
              <Text>
                <Text color="suggestion">{L('vistas', 'seen')} {stats.porcentaje(estadoExamen.vistas, 100)}</Text>
                <Text dimColor> · </Text>
                <Text color="success">{L('recordarás', 'recall')} {stats.porcentaje(estadoExamen.prevision, 100)}</Text>
                <Text dimColor> · </Text>
                <Text color="claude">🍅 {estadoExamen.pomodorosHoy}/{estadoExamen.metaPomodoros} {L('hoy', 'today')}</Text>
              </Text>
            )}
            <Text color={estadoExamen.ritmo === 'atrasado' ? 'error' : estadoExamen.ritmo === 'listo' ? 'success' : 'text'}>
              {estadoExamen.ritmo === 'atrasado' ? '⚠️ ' : estadoExamen.ritmo === 'listo' ? '✅ ' : '👉 '}{estadoExamen.mensaje}
              {estadoExamen.nuevasPorDia > 0 ? L(`  (${estadoExamen.nuevasPorDia} nuevas/día)`, `  (${estadoExamen.nuevasPorDia} new/day)`) : ''}
            </Text>
          </Box>
        ) : editandoPlan && Input !== undefined ? (
          <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
            <Input key="plan-fecha" label={L('🎯 ¿Cuándo es el examen?', '🎯 When is the exam?')} placeholder={L('15/11 Bioquímica · en 20 días · 15 de diciembre', '2026-12-15 Biochemistry · in 20 days · December 15')} autoFocus submitLabel={L('fijar', 'set')}
              onSubmit={v => void acc.fijarPlanTexto(m, cfg, v).then(t => m.toast(t.split('\n')[0] ?? t, 6000))} />
          </Box>
        ) : (
          Input !== undefined && (
            <Button key="fijar-examen" label={L('🎯 Fijar fecha de examen', '🎯 Set exam date')} hotkey="e" plain dimColor
              onPress={() => void m.st.editandoPlan.cambiar(() => true)} />
          )
        )}
        {cuaderno.nuevas.length > 0 && (
          <Box flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1}>
            <Text bold color="suggestion">
              📥 {cuaderno.nuevas.length === 1 ? L('Una fuente nueva', 'One new source') : L(`${cuaderno.nuevas.length} fuentes nuevas`, `${cuaderno.nuevas.length} new sources`)}
            </Text>
            {cuaderno.nuevas.slice(0, 5).map(f => (
              <Text key={`nueva-${f}`} wrap="truncate-middle">  {g.iconoFuente(f)} {f}</Text>
            ))}
            {cuaderno.nuevas.length > 5 && <Text dimColor>{L(`  … y ${cuaderno.nuevas.length - 5} más`, `  … and ${cuaderno.nuevas.length - 5} more`)}</Text>}
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              <Button key="resumir-nuevas" label={L('✨ Resumir y crear tarjetas', '✨ Summarize and make cards')} hotkey="n" variant="primary"
                onPress={() => void acc.resumirNuevas(m, cfg)} />
              <Button key="ignorar-nuevas" label={L('Ignorar', 'Ignore')} hotkey="i" dimColor
                onPress={() => void acc.marcarFuentesVistas(m, cfg)} />
            </Box>
          </Box>
        )}
        <Box flexDirection="column">
          <Text bold>{L('Fuentes', 'Sources')}</Text>
          {cuaderno.fuentes.length === 0 && (
            <Text dimColor>{L('  Vacía: copia tus archivos a fuentes/ y pulsa ↻', '  Empty: copy your files to fuentes/ and press ↻')}</Text>
          )}
          {visibles.map(f => (
            <Text key={f} wrap="truncate-middle">  {g.iconoFuente(f)} {f}</Text>
          ))}
          {cuaderno.fuentes.length > visibles.length && (
            <Text dimColor>{L(`  … y ${cuaderno.fuentes.length - visibles.length} más`, `  … and ${cuaderno.fuentes.length - visibles.length} more`)}</Text>
          )}
        </Box>
        <Box flexDirection="column">
          <Text bold>{L('Estudiar con Claude', 'Study with Claude')}</Text>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {SKILLS.map(s => (
              <Button key={`skill-${s.id}`} label={s.label} hotkey={s.hotkey}
                onPress={() => void m.submitPrompt(`/estudio:${s.id}`)} />
            ))}
            <Button key="pdf" label="📄 PDF" hotkey="d" variant="primary"
              onPress={() => {
                m.toast(L('Generando el PDF de repaso…', 'Generating the review PDF…'), 4000)
                void acc.generarPdf(m, cfg).then(
                  texto => {
                    m.linea(texto)
                    m.toast(texto.split('\n')[0] ?? texto, 8000)
                  },
                  err => m.toast(`${L('No pude generar el PDF', 'Could not generate the PDF')}: ${err instanceof Error ? err.message : String(err)}`, 8000),
                )
              }} />
            <Button key="refrescar" label="↻" hotkey="r" dimColor onPress={() => void acc.refrescarCuaderno(m, cfg)} />
          </Box>
          <Text dimColor>{L('Pregunta lo que quieras: /estudio:preguntar <pregunta>', 'Ask anything: /estudio:preguntar <question>')}</Text>
        </Box>
      </Box>
    )
  })
}
