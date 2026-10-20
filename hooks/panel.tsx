// El panel "Estudio": pestañas Pomodoro, Repaso, Cuaderno y Stats.
import type { On } from 'claude-code'

import type { Pestana } from '../types'
import * as acc from './acciones'
import type { Config } from './estado'
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

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const SKILLS = [
  { id: 'tarjetas', label: 'Crear tarjetas', hotkey: 't' },
  { id: 'guia', label: 'Guía de estudio', hotkey: 'g' },
  { id: 'quiz', label: 'Quiz', hotkey: 'q' },
  { id: 'audio', label: 'Resumen en audio', hotkey: 'a' },
] as const

export function registrarPanel(on: On, cfg: Config, home: () => string) {
  on('ui.render', { component: 'Pane', requestId: 'estudio' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const m = hostOf($, home())
    const pestana = await m.st.pestana.leer()
    const ancho = Math.max(20, Math.min(40, e.props.bodyColumns - 2))

    const encabezado = (
      <Box flexDirection="row" gap={1} flexWrap="wrap">
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
    )

    if (pestana === 'pomodoro') {
      const p = await m.st.pomodoro.leer()
      const ahora = Math.max(await m.st.ahora.leer(), p.estado === 'parado' ? 0 : p.terminaEn - p.duracionMs)
      const s = await m.st.stats.leer()
      const dia = fecha(await $.clock.now())
      const hoy = s[dia]?.pomodoros ?? 0
      const racha = stats.racha(s, dia)
      const restante = p.estado === 'parado' ? pomo.duracionDe(p.fase, cfg.duraciones) : pomo.restante(p, ahora)
      const ronda = (p.ronda % pomo.RONDAS_POR_CICLO) + (p.fase === 'enfoque' ? 1 : 0)
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Box flexDirection="column">
            <Text bold color={p.fase === 'enfoque' ? 'red' : 'green'}>
              {p.fase === 'enfoque' ? '🍅' : '☕'} {pomo.NOMBRE_FASE[p.fase].toUpperCase()}
              {p.fase === 'enfoque' ? `  ·  ronda ${ronda}/${pomo.RONDAS_POR_CICLO}` : ''}
            </Text>
            <Text bold size="title" tabular>
              {pomo.reloj(restante)}
              {p.estado === 'pausado' ? '  ⏸' : ''}
            </Text>
            <Text dimColor>{pomo.barra(p, ahora, ancho)}</Text>
          </Box>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {p.estado === 'parado' && (
              <Button key="iniciar" label="Iniciar" hotkey="i" variant="primary"
                onPress={() => void acc.pomodoro(m, cfg, 'iniciar')} />
            )}
            {p.estado === 'corriendo' && (
              <Button key="pausar" label="Pausar" hotkey="p" onPress={() => void acc.pomodoro(m, cfg, 'pausar')} />
            )}
            {p.estado === 'pausado' && (
              <Button key="reanudar" label="Reanudar" hotkey="p" variant="primary"
                onPress={() => void acc.pomodoro(m, cfg, 'reanudar')} />
            )}
            <Button key="saltar" label="Saltar" hotkey="s" onPress={() => void acc.pomodoro(m, cfg, 'saltar')} />
            {p.estado !== 'parado' && (
              <Button key="parar" label="Parar" hotkey="x" onPress={() => void acc.pomodoro(m, cfg, 'parar')} />
            )}
          </Box>
          <Text>
            Hoy: {hoy} {hoy === 1 ? 'pomodoro' : 'pomodoros'} {'🍅'.repeat(Math.min(hoy, 12))}
            {racha > 0 ? `  ·  🔥 ${racha} ${racha === 1 ? 'día' : 'días'}` : ''}
          </Text>
        </Box>
      )
    }

    const cuaderno = await m.st.cuaderno.leer()

    if (pestana === 'stats') {
      const s = await m.st.stats.leer()
      const ahora = await $.clock.now()
      const hoy = fecha(ahora)
      const d = s[hoy] ?? stats.VACIO
      const semana = stats.ultimosDias(s, hoy, 7)
      const t7 = stats.totales(s, semana[0]?.dia)
      const total = stats.totales(s)
      const mes = stats.ultimosDias(s, hoy, 28)
      const maxSemana = Math.max(1, ...semana.map(x => x.datos.pomodoros))
      const anchoBarra = Math.max(6, ancho - 14)
      const etapas = cuaderno === null ? undefined : stats.etapas(await m.st.tarjetas.leer())
      const fila = (nombre: string, x: typeof d) =>
        `${nombre.padEnd(7)} ${String(x.pomodoros).padStart(3)} 🍅  ${stats.horas(x.minutos).padStart(10)}  ${String(x.repasos).padStart(4)} tarjetas  ${stats.porcentaje(x.aciertos, x.repasos)}`
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Text bold>
            🔥 Racha: {stats.racha(s, hoy)} días  ·  mejor: {stats.mejorRacha(s)}
          </Text>
          <Box flexDirection="column">
            <Text dimColor mono>{'        pomodoros     enfoque  repasos  aciertos'}</Text>
            <Text mono>{fila('Hoy', d)}</Text>
            <Text mono>{fila('7 días', t7)}</Text>
            <Text mono>{fila('Total', total)}</Text>
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Últimos 7 días</Text>
            {semana.map(x => (
              <Text key={x.dia} mono>
                {(DIAS[new Date(`${x.dia}T12:00:00`).getDay()] ?? '').padEnd(4)}
                <Text color="red">{'▇'.repeat(Math.round((x.datos.pomodoros / maxSemana) * anchoBarra))}</Text>
                {' '}{x.datos.pomodoros > 0 ? `${x.datos.pomodoros}` : '·'}
              </Text>
            ))}
          </Box>
          <Box flexDirection="column">
            <Text dimColor>Últimas 4 semanas (enfoque + repasos)</Text>
            <Text mono color="green">{stats.sparkline(mes.map(x => x.datos.minutos + x.datos.repasos))}</Text>
          </Box>
          {cuaderno !== null && etapas !== undefined && (
            <Text>
              🃏 «{cuaderno.nombre}»: {etapas.nuevas} nuevas · {etapas.aprendiendo} aprendiendo · {etapas.maduras} maduras
            </Text>
          )}
        </Box>
      )
    }

    if (cuaderno === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Text>No hay cuaderno activo.</Text>
          <Text dimColor>Crea uno con /cuaderno &lt;nombre&gt; y pon tus PDFs o apuntes en su carpeta fuentes/.</Text>
        </Box>
      )
    }

    const tarjetas = await m.st.tarjetas.leer()

    if (pestana === 'repaso') {
      const ahora = await $.clock.now()
      const hoy = fecha(ahora)
      const cola = pendientes(tarjetas, hoy)
      const repaso = await m.st.repaso.leer()
      const actual = cola[0]
      if (actual === undefined) {
        const proxima = tarjetas.map(t => t.vence).sort()[0]
        return (
          <Box flexDirection="column" gap={1}>
            {encabezado}
            <Text bold>{tarjetas.length === 0 ? 'Este cuaderno aún no tiene tarjetas.' : '¡Nada pendiente hoy! 🎉'}</Text>
            <Text dimColor>
              {tarjetas.length === 0
                ? 'Pide a Claude que las cree con /estudio:tarjetas.'
                : `${tarjetas.length} tarjetas · próxima el ${proxima} · hoy repasaste ${repaso.hechasHoy}`}
            </Text>
          </Box>
        )
      }
      return (
        <Box flexDirection="column" gap={1}>
          {encabezado}
          <Text dimColor>
            {cola.length} pendientes · {repaso.hechasHoy} repasadas hoy · {cuaderno.nombre}
          </Text>
          <Box flexDirection="column" borderStyle="round" paddingX={1}>
            <Text bold>{actual.frente}</Text>
            {repaso.mostrarReverso && (
              <Box flexDirection="column" marginTop={1}>
                <Text>{actual.reverso}</Text>
                {actual.fuente !== undefined && <Text dimColor italic>— {actual.fuente}</Text>}
              </Box>
            )}
          </Box>
          {repaso.mostrarReverso ? (
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              {NOTAS.map((nota, i) => (
                <Button
                  key={`nota-${nota}`}
                  hotkey={String(i + 1)}
                  variant={nota === 'bien' ? 'primary' : undefined}
                  label={`${ETIQUETAS[nota]} (${describirIntervalo(intervaloPara(actual, nota))})`}
                  onPress={() => void acc.calificar(m, actual.id, nota)}
                />
              ))}
            </Box>
          ) : (
            <Button key="mostrar" label="Mostrar respuesta" hotkey="m" variant="primary" autoFocus
              onPress={() => void m.st.repaso.cambiar(r => ({ ...r, mostrarReverso: true }))} />
          )}
        </Box>
      )
    }

    // pestaña cuaderno
    const pendientesHoy = pendientes(tarjetas, fecha(await $.clock.now())).length
    const visibles = cuaderno.fuentes.slice(0, 15)
    return (
      <Box flexDirection="column" gap={1}>
        {encabezado}
        <Box flexDirection="column">
          <Text bold>📚 {cuaderno.nombre}</Text>
          <Text dimColor wrap="truncate-middle">{cuaderno.ruta}</Text>
        </Box>
        <Box flexDirection="column">
          <Text>Fuentes ({cuaderno.fuentes.length}):</Text>
          {cuaderno.fuentes.length === 0 && <Text dimColor>  vacía: copia archivos a fuentes/</Text>}
          {visibles.map(f => (
            <Text key={f} wrap="truncate-middle">  • {f}</Text>
          ))}
          {cuaderno.fuentes.length > visibles.length && (
            <Text dimColor>  … y {cuaderno.fuentes.length - visibles.length} más</Text>
          )}
        </Box>
        <Text>
          🃏 {tarjetas.length} tarjetas · {pendientesHoy} pendientes hoy
        </Text>
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {SKILLS.map(s => (
            <Button key={`skill-${s.id}`} label={s.label} hotkey={s.hotkey}
              onPress={() => void m.submitPrompt(`/estudio:${s.id}`)} />
          ))}
          <Button key="refrescar" label="↻" hotkey="r" onPress={() => void acc.refrescarCuaderno(m, cfg)} />
        </Box>
        <Text dimColor>Pregunta lo que quieras con /estudio:preguntar &lt;pregunta&gt;</Text>
      </Box>
    )
  })
}
