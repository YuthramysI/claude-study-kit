// El panel "Estudio": pestañas Pomodoro, Repaso, Cuaderno y Stats.
// Donde la superficie dibuja SVG (VS Code, escritorio, móvil) usa gráficos;
// en la terminal, dígitos grandes y barras de texto.
import type { On } from 'claude-code'

import type { Pestana } from '../types'
import * as acc from './acciones'
import type { Config } from './estado'
import * as g from './graficos'
import { hostOf } from './motor'
import * as pomo from './pomodoro'
import { describirIntervalo, ETIQUETAS, fecha, intervaloPara, NOTAS, pendientes } from './srs'
import * as stats from './stats'

const PESTANAS: readonly { id: Pestana; label: string }[] = [
  { id: 'pomodoro', label: '🍅 Pomodoro' },
  { id: 'repaso', label: '🃏 Repaso' },
  { id: 'cuaderno', label: '📚 Cuaderno' },
  { id: 'stats', label: '📊 Stats' },
]

const SKILLS = [
  { id: 'tarjetas', label: '🃏 Crear tarjetas', hotkey: 't' },
  { id: 'guia', label: '📝 Guía', hotkey: 'g' },
  { id: 'quiz', label: '❓ Quiz', hotkey: 'q' },
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
    const m = hostOf($, home())
    const pestana = await m.st.pestana.leer()
    const columnas = e.props.bodyColumns
    const ancho = Math.max(16, Math.min(44, columnas - 4))
    const anchoSvg = Math.max(220, Math.min(340, columnas * 7))

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
          <Box flexDirection="column" alignItems={Svg !== undefined ? 'center' : 'flex-start'}>
            <Text dimColor>Después: {proxima}</Text>
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
      const etapas = cuaderno === null ? undefined : stats.etapas(await m.st.tarjetas.leer())
      const racha = stats.racha(s, hoy)
      const tarjeta = (titulo: string, valor: string, detalle: string, color: string) => (
        <Box key={titulo} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} minWidth={14}>
          <Text dimColor>{titulo}</Text>
          <Text bold color={color} size="heading">{valor}</Text>
          <Text dimColor>{detalle}</Text>
        </Box>
      )
      const resumen = (
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {tarjeta('Racha', `🔥 ${racha}`, `mejor: ${stats.mejorRacha(s)} días`, 'claude')}
          {tarjeta('Hoy', `${d.pomodoros} 🍅`, `${stats.horas(d.minutos)} · ${d.repasos} tarjetas`, 'success')}
          {tarjeta('Aciertos', stats.porcentaje(d.aciertos, d.repasos), `7 días: ${stats.porcentaje(t7.aciertos, t7.repasos)}`, 'suggestion')}
        </Box>
      )

      if (Svg !== undefined) {
        const historia = stats.ultimosDias(s, hoy, 7 * 16).map(x => ({ dia: x.dia, valor: g.actividad(x.datos), diaSemana: diaSemana(x.dia) }))
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            {resumen}
            <Box flexDirection="column">
              <Text bold>Pomodoros · últimos 7 días</Text>
              <Svg
                source={g.barras(semana.map(x => ({ etiqueta: DIAS[diaSemana(x.dia)] ?? '', valor: x.datos.pomodoros, esHoy: x.dia === hoy })))}
                alt={`Pomodoros por día: ${semana.map(x => x.datos.pomodoros).join(', ')}`}
                width={anchoSvg}
              />
            </Box>
            <Box flexDirection="column">
              <Text bold>Actividad · 16 semanas</Text>
              <Svg source={g.mapaCalor(historia)} alt={`Actividad de las últimas 16 semanas; total ${total.pomodoros} pomodoros`} width={anchoSvg} />
            </Box>
            {cuaderno !== null && etapas !== undefined && (
              <Box flexDirection="column">
                <Text bold>Tarjetas de «{cuaderno.nombre}»</Text>
                <Svg source={g.etapas(etapas)} alt={`${etapas.nuevas} nuevas, ${etapas.aprendiendo} aprendiendo, ${etapas.maduras} maduras`} width={anchoSvg} />
              </Box>
            )}
            <Text dimColor>
              Total: {total.pomodoros} pomodoros · {stats.horas(total.minutos)} de enfoque · {total.repasos} repasos
            </Text>
          </Box>
        )
      }

      const maxSemana = Math.max(1, ...semana.map(x => x.datos.pomodoros))
      const anchoBarra = Math.max(6, ancho - 10)
      const mes = stats.ultimosDias(s, hoy, 28)
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          {resumen}
          <Box flexDirection="column">
            <Text bold>Pomodoros · últimos 7 días</Text>
            {semana.map(x => (
              <Text key={x.dia}>
                <Text dimColor={x.dia !== hoy} bold={x.dia === hoy}>{(DIAS[diaSemana(x.dia)] ?? '').padEnd(4)}</Text>
                <Text color="claude">{'█'.repeat(Math.round((x.datos.pomodoros / maxSemana) * anchoBarra))}</Text>
                <Text dimColor>{x.datos.pomodoros > 0 ? ` ${x.datos.pomodoros}` : ' ·'}</Text>
              </Text>
            ))}
          </Box>
          <Box flexDirection="column">
            <Text bold>Actividad · 4 semanas</Text>
            <Text color="success">{stats.sparkline(mes.map(x => g.actividad(x.datos)))}</Text>
          </Box>
          {cuaderno !== null && etapas !== undefined && (
            <Text>
              🃏 «{cuaderno.nombre}»: <Text color="suggestion">{etapas.nuevas} nuevas</Text> ·{' '}
              <Text color="warning">{etapas.aprendiendo} aprendiendo</Text> · <Text color="success">{etapas.maduras} maduras</Text>
            </Text>
          )}
          <Text dimColor>
            Total: {total.pomodoros} pomodoros · {stats.horas(total.minutos)} · {total.repasos} repasos
          </Text>
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

    // ── Repaso ────────────────────────────────────────────────────────────
    if (pestana === 'repaso') {
      const hoy = fecha(await $.clock.now())
      const cola = pendientes(tarjetas, hoy)
      const repaso = await m.st.repaso.leer()
      const actual = cola[0]
      if (actual === undefined) {
        const proxima = tarjetas.map(t => t.vence).sort()[0]
        const vacio = tarjetas.length === 0
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Box flexDirection="column" borderStyle="round" borderColor={vacio ? 'subtle' : 'success'} paddingX={1} paddingY={1} alignItems="center">
              <Text bold size="heading">{vacio ? '🃏 Aún no hay tarjetas' : '🎉 ¡Nada pendiente hoy!'}</Text>
              <Text dimColor>
                {vacio
                  ? 'Pide a Claude que las cree con /estudio:tarjetas'
                  : `${repaso.hechasHoy} repasadas hoy · próxima el ${proxima}`}
              </Text>
            </Box>
          </Box>
        )
      }
      const totalSesion = repaso.hechasHoy + cola.length
      const progreso = g.barraTexto(totalSesion === 0 ? 0 : repaso.hechasHoy / totalSesion, ancho)
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Box flexDirection="column">
            <Text>
              <Text bold>{cola.length}</Text>
              <Text dimColor> pendientes · {repaso.hechasHoy} repasadas · {cuaderno.nombre}</Text>
            </Text>
            <Text>
              <Text color="success">{progreso.lleno}</Text>
              <Text dimColor>{progreso.vacio}</Text>
            </Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor={repaso.mostrarReverso ? 'success' : 'claude'} paddingX={2} paddingY={1}>
            <Text dimColor>PREGUNTA</Text>
            <Text bold size="heading">{actual.frente}</Text>
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
              <Text dimColor>¿Qué tal la recordaste?</Text>
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                {NOTAS.map((nota, i) => (
                  <Button
                    key={`nota-${nota}`}
                    hotkey={String(i + 1)}
                    variant={nota === 'bien' ? 'primary' : undefined}
                    onPress={() => void acc.calificar(m, actual.id, nota)}
                  >
                    <Text color={COLOR_NOTA[nota]}>{ETIQUETAS[nota]}</Text>
                    <Text dimColor> {describirIntervalo(intervaloPara(actual, nota))}</Text>
                  </Button>
                ))}
              </Box>
            </Box>
          ) : (
            <Button key="mostrar" label="👁 Mostrar respuesta" hotkey="m" variant="primary" autoFocus
              onPress={() => void m.st.repaso.cambiar(r => ({ ...r, mostrarReverso: true }))} />
          )}
        </Box>
      )
    }

    // ── Cuaderno ──────────────────────────────────────────────────────────
    const pendientesHoy = pendientes(tarjetas, fecha(await $.clock.now())).length
    const visibles = cuaderno.fuentes.slice(0, 12)
    const etapas = stats.etapas(tarjetas)
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
            <Button key="refrescar" label="↻" hotkey="r" dimColor onPress={() => void acc.refrescarCuaderno(m, cfg)} />
          </Box>
          <Text dimColor>Pregunta lo que quieras: /estudio:preguntar &lt;pregunta&gt;</Text>
        </Box>
      </Box>
    )
  })
}
