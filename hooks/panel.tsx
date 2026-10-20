// El panel "Estudio": pestañas Pomodoro, Repaso, Cuaderno y Stats.
// Donde la superficie dibuja SVG (VS Code, escritorio, móvil) usa gráficos;
// en la terminal, dígitos grandes y barras de texto.
import type { On } from 'claude-code'

import type { Pestana } from '../types'
import * as acc from './acciones'
import type { Config } from './estado'
import * as g from './graficos'
import { arbolTexto, mapaSvg } from './mapa'
import { hostOf } from './motor'
import * as pomo from './pomodoro'
import { describirIntervalo, ETIQUETAS, fecha, intervaloPara, NOTAS, nuevasEnEspera, pendientes } from './srs'
import * as stats from './stats'

const PESTANAS: readonly { id: Pestana; label: string }[] = [
  { id: 'pomodoro', label: '🍅 Pomodoro' },
  { id: 'repaso', label: '🃏 Repaso' },
  { id: 'cuaderno', label: '📚 Cuaderno' },
  { id: 'mapa', label: '🧠 Mapa' },
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
    // móvil no tiene campos de texto: allí no hay modo escribir ni edición
    const Input = 'Input' in els ? els.Input : undefined
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
      const editandoTarea = await m.st.editandoTarea.leer()
      const recientes = await m.st.tareas.leer()
      const cuadernoActual = await m.st.cuaderno.leer()
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
      const temas7 = stats.temas(s, semana[0]?.dia).slice(0, 8)
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
            {temas7.length > 0 && (
              <Box flexDirection="column">
                <Text bold>Tiempo por tema · 7 días</Text>
                <Svg source={g.barrasTemas(temas7, stats.horas)} alt={temas7.map(t => `${t.tema}: ${stats.horas(t.minutos)}`).join(', ')} width={anchoSvg} />
              </Box>
            )}
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
          {temas7.length > 0 && (
            <Box flexDirection="column">
              <Text bold>Tiempo por tema · 7 días</Text>
              {temas7.map((t, i) => (
                <Text key={`tema-${i}`}>
                  <Text dimColor>{(t.tema.length > 12 ? `${t.tema.slice(0, 11)}…` : t.tema).padEnd(13)}</Text>
                  <Text color={g.COLORES_TEMA[i % g.COLORES_TEMA.length] ?? 'subtle'}>{'█'.repeat(Math.max(1, Math.round((t.minutos / (temas7[0]?.minutos ?? 1)) * Math.max(4, ancho - 24))))}</Text>
                  <Text dimColor> {stats.horas(t.minutos)}</Text>
                </Text>
              ))}
            </Box>
          )}
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
      const cola = pendientes(tarjetas, hoy, cfg.nuevasPorDia)
      const espera = nuevasEnEspera(tarjetas, hoy, cfg.nuevasPorDia)
      const repaso = await m.st.repaso.leer()
      const hechas = (await m.st.stats.leer())[hoy]?.repasos ?? 0
      const actual = cola[0]
      const avisar = (texto: Promise<string>) => void texto.then(t => m.toast(t, 5000), err => m.toast(String(err), 6000))
      const botonDeshacer = repaso.deshacer !== undefined && (
        <Button key="deshacer" label="↶ Deshacer" hotkey="u" dimColor onPress={() => avisar(acc.deshacer(m))} />
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
    const pendientesHoy = pendientes(tarjetas, fecha(await $.clock.now()), cfg.nuevasPorDia).length
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
