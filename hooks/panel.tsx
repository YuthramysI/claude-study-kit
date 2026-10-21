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

const PESTANAS: readonly { id: Pestana; label: string }[] = [
  { id: 'pomodoro', label: '🍅 Pomodoro' },
  { id: 'repaso', label: '🃏 Repaso' },
  { id: 'cuaderno', label: '📚 Cuaderno' },
  { id: 'mapa', label: '🧠 Mapa' },
  { id: 'stats', label: '📊 Stats' },
  { id: 'logros', label: '🏆 Logros' },
]

const SKILLS = [
  { id: 'tarjetas', label: '🃏 Crear tarjetas', hotkey: 't' },
  { id: 'guia', label: '📝 Guía', hotkey: 'g' },
  { id: 'quiz', label: '❓ Quiz', hotkey: 'q' },
  { id: 'simulacro', label: '⏱️ Simulacro', hotkey: 'x' },
  { id: 'audio', label: '🎧 Audio', hotkey: 'a' },
] as const

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
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
          <Text bold>Sesiones recientes</Text>
          {lista.length === 0 && <Text dimColor>  Aún no hay sesiones: empieza un pomodoro o repasa unas tarjetas.</Text>}
          {lista.map((s, i) => (
            <Text key={`ses-${s.id}`}>
              <Text color={i === 0 && ses.abierta(actual, ahora) ? 'success' : 'subtle'}>{i === 0 && ses.abierta(actual, ahora) ? '● ' : '○ '}</Text>
              {ses.linea(s, ahora)}
            </Text>
          ))}
        </Box>,
        <Box key="coach" flexDirection="row" gap={1} flexWrap="wrap">
          <Button key="coach-consejo" label="🤖 Resumen y consejo del coach" hotkey="c"
            onPress={() => {
              m.toast('El coach está mirando tus datos…', 4000)
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
      const etiqueta = p.estado === 'parado' ? `listo · ${pomo.NOMBRE_FASE[p.fase]}` : p.estado === 'pausado' ? 'en pausa' : pomo.NOMBRE_FASE[p.fase]
      const completados = p.ronda % pomo.RONDAS_POR_CICLO
      const proxima = p.fase === 'enfoque'
        ? (p.ronda + 1) % pomo.RONDAS_POR_CICLO === 0 ? `descanso largo · ${cfg.duraciones.descansoLargo} min` : `descanso · ${cfg.duraciones.descanso} min`
        : `enfoque · ${cfg.duraciones.enfoque} min`

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
              <Button key="iniciar" label="▶ Iniciar" hotkey="i" variant="primary" autoFocus
                onPress={() => void acc.pomodoro(m, cfg, 'iniciar')} />
            )}
            {p.estado === 'corriendo' && (
              <Button key="pausar" label="⏸ Pausar" hotkey="p" onPress={() => void acc.pomodoro(m, cfg, 'pausar')} />
            )}
            {p.estado === 'pausado' && (
              <Button key="reanudar" label="▶ Reanudar" hotkey="p" variant="primary"
                onPress={() => void acc.pomodoro(m, cfg, 'reanudar')} />
            )}
            <Button key="saltar" label="⏭ Saltar" hotkey="s" onPress={() => void acc.pomodoro(m, cfg, 'saltar')} />
            {p.estado !== 'parado' && (
              <Button key="parar" label="⏹ Parar" hotkey="x" onPress={() => void acc.pomodoro(m, cfg, 'parar')} />
            )}
          </Box>
          {editandoTarea && Input !== undefined ? (
            <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
              <Input key="tarea" label="¿En qué vas a trabajar?" value={p.tarea ?? cuadernoActual?.nombre ?? ''} autoFocus
                placeholder="Química, TFG, inglés…" submitLabel="fijar"
                onSubmit={v => void acc.fijarTarea(m, v)} />
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                {recientes.map((t, i) => (
                  <Button key={`tarea-${i}`} label={t} plain dimColor={t !== p.tarea} onPress={() => void acc.fijarTarea(m, t)} />
                ))}
                <Button key="tarea-cancelar" label="Cancelar" plain dimColor onPress={() => void m.st.editandoTarea.cambiar(() => false)} />
              </Box>
            </Box>
          ) : (
            <Box flexDirection="row" columnGap={1} justifyContent={Svg !== undefined ? 'center' : 'flex-start'}>
              <Text>📌 <Text bold>{p.tarea ?? cuadernoActual?.nombre ?? 'General'}</Text></Text>
              {Input !== undefined && (
                <Button key="cambiar-tarea" label="✎ tarea" hotkey="t" plain dimColor onPress={() => void m.st.editandoTarea.cambiar(() => true)} />
              )}
            </Box>
          )}
          <Box flexDirection="column" alignItems={Svg !== undefined ? 'center' : 'flex-start'}>
            <Text dimColor>Después: {proxima}</Text>
            {examenHoy !== null && examenHoy.dias >= 0 && (
              <Text color={examenHoy.ritmo === 'atrasado' ? 'error' : 'claude'}>
                🎯 {examenHoy.titulo ?? 'Examen'} {examenHoy.dias === 0 ? 'hoy' : `en ${examenHoy.dias} días`} · {examenHoy.mensaje}
              </Text>
            )}
            {sesionHoy !== null && ses.abierta(sesionHoy, ahora) && !ses.vacia(sesionHoy) && (
              <Text dimColor>Esta sesión: {ses.linea(sesionHoy)}</Text>
            )}
            <Text>
              Hoy: {hoy.pomodoros} {hoy.pomodoros === 1 ? 'pomodoro' : 'pomodoros'} · {stats.horas(hoy.minutos)}
              {racha > 0 ? `  ·  🔥 ${racha} ${racha === 1 ? 'día' : 'días'}` : ''}
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
          {([['general', 'General', 'g'], ['repaso', 'Repaso', 'r'], ['habitos', 'Hábitos', 'h']] as const).map(([id, nombre, tecla]) => (
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
        const media = conDatos.length === 0 ? '—' : `${Math.round(conDatos.reduce((a, b) => a + b, 0) / conDatos.length)} %`
        cuerpo = [
          <Box key="resumen-repaso" flexDirection="row" gap={1} flexWrap="wrap">
            {tarjeta('Mañana', `${pron[1] ?? 0}`, 'repasos previstos', 'suggestion')}
            {tarjeta('7 días', `${pron.slice(0, 7).reduce((a, b) => a + b, 0)}`, 'repasos previstos', 'claude')}
            {tarjeta('Aciertos', media, 'media de 30 días', 'success')}
          </Box>,
          seccion('Pronóstico · próximos 30 días',
            Svg !== undefined
              ? <Svg source={g.columnas(pron, etiquetasPron, { destacar: 0 })} alt={`Repasos previstos: ${pron.join(', ')}`} width={anchoSvg} />
              : <Text color="suggestion">{stats.sparkline(pron)}</Text>),
          seccion('Aciertos · últimos 30 días',
            Svg !== undefined
              ? <Svg source={g.curva(aciertos, mes.map(x => corta(x.dia)))} alt={`Aciertos por día: ${aciertos.map(x => x ?? '—').join(', ')}`} width={anchoSvg} />
              : <Text color="success">{stats.sparkline(aciertos.map(x => x ?? 0))}</Text>),
          seccion('Notas · 7 días',
            <Text>
              {NOTAS.map((n, i) => (
                <Text key={`n-${n}`} color={COLOR_NOTA[n]}>{i > 0 ? '  ' : ''}{ETIQUETAS[n]} {notas7[n] ?? 0}</Text>
              ))}
            </Text>),
          ...(tarjetasStats.length > 0
            ? [
              seccion('Dificultad de las tarjetas (FSRS, 1 fácil · 10 difícil)',
                dibujo(g.histograma(dificultades, dificultades.map((_, i) => String(i + 1)), '#9B6BD3'), dificultades.map((n, i) => `${i + 1}: ${n}`).join(' · '))),
              seccion(`Etapas · ${cuaderno?.nombre ?? ''}`,
                Svg !== undefined
                  ? <Svg source={g.etapas(etapas)} alt={`${etapas.nuevas} nuevas, ${etapas.aprendiendo} aprendiendo, ${etapas.maduras} maduras`} width={anchoSvg} />
                  : <Text><Text color="suggestion">{etapas.nuevas} nuevas</Text> · <Text color="warning">{etapas.aprendiendo} aprendiendo</Text> · <Text color="success">{etapas.maduras} maduras</Text></Text>),
            ]
            : [<Text key="sin-tarjetas" dimColor>Sin tarjetas en el cuaderno activo.</Text>]),
        ]
      } else if (vista === 'habitos') {
        const matriz = stats.horario(s, hoy, 56)
        const mejores = stats.mejoresHoras(s, hoy, 56)
        const sombras = ' ░▒▓█'
        const maxCelda = Math.max(1, ...matriz.flat())
        const diasCortos = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
        cuerpo = [
          seccion('¿Cuándo estudias? · 8 semanas',
            Svg !== undefined
              ? <Svg source={g.horarioCalor(matriz)} alt="Minutos de enfoque por día de la semana y hora" width={anchoSvg} />
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
              ? <Text dimColor>Completa algunos pomodoros para descubrir tus mejores horas.</Text>
              : <Text>⭐ Tus mejores horas: <Text bold color="claude">{mejores.map(x => `${x.hora}–${x.hora + 1} h`).join(' · ')}</Text></Text>}
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
          seccion('Pomodoros · últimos 7 días',
            Svg !== undefined
              ? <Svg source={g.barras(semana.map(x => ({ etiqueta: DIAS[diaSemana(x.dia)] ?? '', valor: x.datos.pomodoros, esHoy: x.dia === hoy })))} alt={`Pomodoros por día: ${semana.map(x => x.datos.pomodoros).join(', ')}`} width={anchoSvg} />
              : (
                <Box flexDirection="column">
                  {semana.map(x => (
                    <Text key={x.dia}>
                      <Text dimColor={x.dia !== hoy} bold={x.dia === hoy}>{(DIAS[diaSemana(x.dia)] ?? '').padEnd(4)}</Text>
                      <Text color="claude">{'█'.repeat(Math.round((x.datos.pomodoros / maxSemana) * anchoBarra))}</Text>
                      <Text dimColor>{x.datos.pomodoros > 0 ? ` ${x.datos.pomodoros}` : ' ·'}</Text>
                    </Text>
                  ))}
                </Box>
              )),
          ...(temas7.length > 0
            ? [seccion('Tiempo por tema · 7 días',
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
          seccion(Svg !== undefined ? 'Actividad · 16 semanas' : 'Actividad · 4 semanas',
            Svg !== undefined
              ? <Svg source={g.mapaCalor(historia)} alt={`Actividad de las últimas 16 semanas; total ${total.pomodoros} pomodoros`} width={anchoSvg} />
              : <Text color="success">{stats.sparkline(stats.ultimosDias(s, hoy, 28).map(x => g.actividad(x.datos)))}</Text>),
          ...(examenes.length > 0
            ? [seccion('📝 Exámenes simulados',
              <Box flexDirection="column">
                {Svg !== undefined && examenes.length > 1 && (
                  <Svg source={g.curva(examenes.map(e => e.nota * 10), examenes.map(e => corta(e.dia)), '#E8553F')}
                    alt={`Notas: ${examenes.map(e => e.nota.toFixed(1)).join(', ')}`} width={anchoSvg} />
                )}
                {examenes.slice(-5).reverse().map((e, i) => (
                  <Text key={`ex-${i}`}>
                    <Text bold color={e.nota >= 9 ? 'success' : e.nota >= 5 ? 'claude' : 'error'}>{e.nota.toFixed(1)}</Text>
                    <Text dimColor> /10 · {e.dia.slice(5).split('-').reverse().join('/')} · {e.titulo ?? e.cuaderno} · {e.preguntas} preguntas</Text>
                  </Text>
                ))}
              </Box>)]
            : []),
          <Text key="total" dimColor>
            Total: {total.pomodoros} pomodoros · {stats.horas(total.minutos)} de enfoque · {total.repasos} repasos
          </Text>,
          <Box key="informe" flexDirection="row" gap={1} flexWrap="wrap">
            <Button key="informe-semana" label="📸 Informe de la semana" hotkey="i" variant="primary"
              onPress={() => {
                m.toast('Preparando tu informe semanal…', 4000)
                void acc.generarInforme(m, cfg).then(t => {
                  m.toast(t, 8000)
                  m.linea(t)
                }, err => m.toast(String(err), 6000))
              }} />
            <Button key="informe-pasada" label="semana pasada" plain dimColor
              onPress={() => void acc.generarInforme(m, cfg, true).then(t => m.linea(t), err => m.toast(String(err), 6000))} />
          </Box>,
        ]
      }

      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {tarjeta('Racha', `🔥 ${racha}`, `mejor: ${stats.mejorRacha(s)} días`, 'claude')}
            {tarjeta('Hoy', `${d.pomodoros} 🍅`, `${stats.horas(d.minutos)} · ${d.repasos} tarjetas`, 'success')}
            {tarjeta('Aciertos', stats.porcentaje(d.aciertos, d.repasos), `7 días: ${stats.porcentaje(t7.aciertos, t7.repasos)}`, 'suggestion')}
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
              alt={`Nivel ${n.nivel} · ${n.titulo} · ${xp} XP`} width={anchoSvg} />
          ) : (
            <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
              <Text bold color="claude">⭐ Nivel {n.nivel} · {n.titulo}</Text>
              <Text>
                <Text color="claude">{barraXp.lleno}</Text>
                <Text dimColor>{barraXp.vacio}</Text>
              </Text>
              <Text dimColor>{xp - n.desde} / {n.hasta - n.desde} XP para el nivel {n.nivel + 1} · 🏆 {Object.keys(conseguidos).length}/{lg.LOGROS.length}</Text>
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
          <Text dimColor>XP: 1 por minuto de enfoque · 2 por repaso (+1 si aciertas) · 5 por pomodoro · 50 por examen · 100 por logro</Text>
        </Box>
      )
    }

    if (cuaderno === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1} paddingY={1}>
            <Text bold>📚 No hay cuaderno activo</Text>
            <Text dimColor>Crea uno con /cuaderno &lt;nombre&gt; y pon tus PDFs o apuntes en su carpeta fuentes/.</Text>
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
        <Button key="nuevo-mapa" label="🧠 Nuevo mapa mental" hotkey="n" variant={actual === undefined ? 'primary' : 'secondary'}
          onPress={() => void m.submitPrompt('/estudio:mapa')} />
      )
      if (actual === undefined) {
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Box flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1} paddingY={1}>
              <Text bold>🧠 Aún no hay mapas mentales</Text>
              <Text dimColor>Claude organiza los conceptos de tus fuentes en un mapa: /estudio:mapa [tema]</Text>
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
              {lineas.length > 80 && <Text dimColor>… y {lineas.length - 80} más</Text>}
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
        <Button key="deshacer" label="↶ Deshacer" hotkey="u" dimColor onPress={() => avisar(acc.deshacer(m, cfg))} />
      )
      if (actual === undefined) {
        const proxima = tarjetas.filter(t => t.vence > hoy).map(t => t.vence).sort()[0]
        const vacio = tarjetas.length === 0
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Box flexDirection="column" borderStyle="round" borderColor={vacio ? 'subtle' : 'success'} paddingX={1} paddingY={1} alignItems="center">
              <Text bold size="heading">{vacio ? '🃏 Aún no hay tarjetas' : '🎉 ¡Nada pendiente hoy!'}</Text>
              <Text dimColor>
                {vacio
                  ? 'Pide a Claude que las cree con /estudio:tarjetas'
                  : `${hechas} repasadas hoy${proxima !== undefined ? ` · próxima el ${proxima}` : ''}${espera > 0 ? ` · ${espera} nuevas esperan a mañana` : ''}`}
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
            <Text dimColor> para hoy · {hechas} repasadas{espera > 0 ? ` · ${espera} nuevas en espera` : ''} · {cuaderno.nombre}</Text>
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
              <Text bold color="warning">✎ Editar tarjeta</Text>
              <Input key="editar-frente" label="Pregunta" value={actual.frente} autoFocus
                onSubmit={v => avisar(acc.editarTarjeta(m, actual.id, { frente: v }))} />
              <Input key="editar-reverso" label="Respuesta" value={actual.reverso} rows={3}
                onSubmit={v => avisar(acc.editarTarjeta(m, actual.id, { reverso: v }))} />
              <Text dimColor>Enter guarda cada campo.</Text>
            </Box>
            <Button key="editar-listo" label="✓ Listo" hotkey="l" variant="primary"
              onPress={() => void m.st.repaso.cambiar(r => ({ ...r, editando: false }))} />
          </Box>
        )
      }

      if (repaso.confirmarBorrado) {
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Box flexDirection="column" borderStyle="round" borderColor="error" paddingX={2} paddingY={1}>
              <Text bold color="error">🗑 ¿Borrar esta tarjeta?</Text>
              <Text>{actual.frente}</Text>
              <Text dimColor>Quedará en tarjetas.bak.json por si te arrepientes.</Text>
            </Box>
            <Box flexDirection="row" gap={1}>
              <Button key="borrar-si" label="Sí, borrar" hotkey="s" onPress={() => avisar(acc.borrarTarjeta(m, actual.id))} />
              <Button key="borrar-no" label="Cancelar" hotkey="n" variant="primary" autoFocus
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
            <Text dimColor>{nueva ? 'PREGUNTA · NUEVA' : 'PREGUNTA'}</Text>
            <Text bold size="heading">{actual.frente}</Text>
            {respuesta !== undefined && (
              <Box flexDirection="column" marginTop={1}>
                <Text dimColor>TU RESPUESTA</Text>
                <Text italic>{respuesta.texto}</Text>
                {respuesta.pensando && <Text color="suggestion">🤖 Claude está corrigiendo…</Text>}
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
                <Text dimColor>RESPUESTA</Text>
                <Text>{actual.reverso}</Text>
                {actual.fuente !== undefined && <Text dimColor italic>📎 {actual.fuente}</Text>}
              </Box>
            )}
          </Box>
          {repaso.mostrarReverso ? (
            <Box flexDirection="column">
              <Text dimColor>{sugerida !== undefined ? 'Nota sugerida resaltada · ¿qué tal la recordaste?' : '¿Qué tal la recordaste?'}</Text>
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
            <Input key="respuesta" label="Tu respuesta" placeholder="Escríbela y pulsa Enter: Claude la corrige" rows={2} autoFocus
              submitLabel="corregir" onSubmit={v => void acc.corregirRespuesta(m, actual, v)} />
          ) : (
            !respuesta?.pensando && (
              <Button key="mostrar" label="👁 Mostrar respuesta" hotkey="m" variant="primary" autoFocus
                onPress={() => void m.st.repaso.cambiar(r => ({ ...r, mostrarReverso: true }))} />
            )
          )}
          <Box flexDirection="row" columnGap={2} flexWrap="wrap">
            {Input !== undefined && (
              <Button key="modo-escribir" plain dimColor={!repaso.escribir} hotkey="w"
                label={repaso.escribir ? '⌨ Escribir: sí' : '⌨ Escribir: no'}
                onPress={() => void m.st.repaso.cambiar(r => ({ ...r, escribir: !r.escribir }))} />
            )}
            {Input !== undefined && (
              <Button key="editar" label="✎ Editar" hotkey="e" plain dimColor
                onPress={() => void m.st.repaso.cambiar(r => ({ ...r, editando: true }))} />
            )}
            <Button key="borrar" label="🗑 Borrar" hotkey="b" plain dimColor
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
            <Text color="suggestion">{cuaderno.fuentes.length} fuentes</Text>
            <Text dimColor> · </Text>
            <Text color="claude">{tarjetas.length} tarjetas</Text>
            <Text dimColor> · </Text>
            <Text color={pendientesHoy > 0 ? 'warning' : 'success'}>{pendientesHoy} para hoy</Text>
            <Text dimColor> · {etapas.maduras} maduras</Text>
          </Text>
        </Box>
        {simulacro !== null && (
          <Box flexDirection="row" columnGap={1} borderStyle="round" borderColor={ahoraCuaderno >= simulacro.terminaEn ? 'error' : 'warning'} paddingX={1}>
            <Text bold color={ahoraCuaderno >= simulacro.terminaEn ? 'error' : 'warning'}>{acc.lineaSimulacro(simulacro, ahoraCuaderno)}</Text>
            <Text dimColor>· {simulacro.preguntas} preguntas · {simulacro.minutos} min</Text>
          </Box>
        )}
        {estadoExamen !== null && estadoExamen.dias >= 0 ? (
          <Box flexDirection="column" borderStyle="round" borderColor={estadoExamen.ritmo === 'atrasado' ? 'error' : estadoExamen.ritmo === 'listo' ? 'success' : 'claude'} paddingX={1}>
            <Text bold size="heading">
              🎯 {estadoExamen.titulo ?? 'Examen'} · {estadoExamen.dias === 0 ? '¡hoy!' : estadoExamen.dias === 1 ? 'mañana' : `en ${estadoExamen.dias} días`}
            </Text>
            <Text dimColor>{fechaLarga(estadoExamen.examen)}</Text>
            {Svg !== undefined ? (
              <Svg source={g.medidores([
                { valor: estadoExamen.vistas, etiqueta: 'vistas', color: '#3B82C4' },
                { valor: estadoExamen.prevision, etiqueta: 'recordarás', color: '#2FA67A' },
                { valor: Math.min(100, (estadoExamen.pomodorosHoy / Math.max(1, estadoExamen.metaPomodoros)) * 100), etiqueta: `🍅 ${estadoExamen.pomodorosHoy}/${estadoExamen.metaPomodoros} hoy`, color: '#E8553F' },
              ])} alt={`Vistas ${estadoExamen.vistas} %, previsión ${estadoExamen.prevision} %`} width={Math.min(anchoSvg, 312)} />
            ) : (
              <Text>
                <Text color="suggestion">vistas {estadoExamen.vistas} %</Text>
                <Text dimColor> · </Text>
                <Text color="success">recordarás {estadoExamen.prevision} %</Text>
                <Text dimColor> · </Text>
                <Text color="claude">🍅 {estadoExamen.pomodorosHoy}/{estadoExamen.metaPomodoros} hoy</Text>
              </Text>
            )}
            <Text color={estadoExamen.ritmo === 'atrasado' ? 'error' : estadoExamen.ritmo === 'listo' ? 'success' : 'text'}>
              {estadoExamen.ritmo === 'atrasado' ? '⚠️ ' : estadoExamen.ritmo === 'listo' ? '✅ ' : '👉 '}{estadoExamen.mensaje}
              {estadoExamen.nuevasPorDia > 0 ? `  (${estadoExamen.nuevasPorDia} nuevas/día)` : ''}
            </Text>
          </Box>
        ) : editandoPlan && Input !== undefined ? (
          <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
            <Input key="plan-fecha" label="🎯 ¿Cuándo es el examen?" placeholder="15/11 Bioquímica · en 20 días · 15 de diciembre" autoFocus submitLabel="fijar"
              onSubmit={v => void acc.fijarPlanTexto(m, cfg, v).then(t => m.toast(t.split('\n')[0] ?? t, 6000))} />
          </Box>
        ) : (
          Input !== undefined && (
            <Button key="fijar-examen" label="🎯 Fijar fecha de examen" hotkey="e" plain dimColor
              onPress={() => void m.st.editandoPlan.cambiar(() => true)} />
          )
        )}
        {cuaderno.nuevas.length > 0 && (
          <Box flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1}>
            <Text bold color="suggestion">
              📥 {cuaderno.nuevas.length === 1 ? 'Una fuente nueva' : `${cuaderno.nuevas.length} fuentes nuevas`}
            </Text>
            {cuaderno.nuevas.slice(0, 5).map(f => (
              <Text key={`nueva-${f}`} wrap="truncate-middle">  {g.iconoFuente(f)} {f}</Text>
            ))}
            {cuaderno.nuevas.length > 5 && <Text dimColor>  … y {cuaderno.nuevas.length - 5} más</Text>}
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              <Button key="resumir-nuevas" label="✨ Resumir y crear tarjetas" hotkey="n" variant="primary"
                onPress={() => void acc.resumirNuevas(m, cfg)} />
              <Button key="ignorar-nuevas" label="Ignorar" hotkey="i" dimColor
                onPress={() => void acc.marcarFuentesVistas(m, cfg)} />
            </Box>
          </Box>
        )}
        <Box flexDirection="column">
          <Text bold>Fuentes</Text>
          {cuaderno.fuentes.length === 0 && (
            <Text dimColor>  Vacía: copia tus archivos a fuentes/ y pulsa ↻</Text>
          )}
          {visibles.map(f => (
            <Text key={f} wrap="truncate-middle">  {g.iconoFuente(f)} {f}</Text>
          ))}
          {cuaderno.fuentes.length > visibles.length && (
            <Text dimColor>  … y {cuaderno.fuentes.length - visibles.length} más</Text>
          )}
        </Box>
        <Box flexDirection="column">
          <Text bold>Estudiar con Claude</Text>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {SKILLS.map(s => (
              <Button key={`skill-${s.id}`} label={s.label} hotkey={s.hotkey}
                onPress={() => void m.submitPrompt(`/estudio:${s.id}`)} />
            ))}
            <Button key="pdf" label="📄 PDF" hotkey="d" variant="primary"
              onPress={() => {
                m.toast('Generando el PDF de repaso…', 4000)
                void acc.generarPdf(m, cfg).then(
                  texto => {
                    m.linea(texto)
                    m.toast(texto.split('\n')[0] ?? texto, 8000)
                  },
                  err => m.toast(`No pude generar el PDF: ${err instanceof Error ? err.message : String(err)}`, 8000),
                )
              }} />
            <Button key="refrescar" label="↻" hotkey="r" dimColor onPress={() => void acc.refrescarCuaderno(m, cfg)} />
          </Box>
          <Text dimColor>Pregunta lo que quieras: /estudio:preguntar &lt;pregunta&gt;</Text>
        </Box>
      </Box>
    )
  })
}
