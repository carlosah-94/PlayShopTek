// HU-13: tablero del negocio para Ángel (ventas, taller y lo más buscado).
// HU-24: con el diseño del prototipo ("Hola Ángel, así va la tienda"). Se muestra en /panel cuando entra el dueño.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { Caja, Encabezado, Indicador, botonBorde, soles } from '../components/PiezasPanel.jsx'
import ResumenIA from '../components/ResumenIA.jsx'

const diaMes = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
const corto = (n) => (Number(n) >= 1000 ? (Number(n) / 1000).toFixed(1) + 'k' : String(Math.round(n)))

// Lista con barras horizontales: el largo de cada barra es proporcional a su valor
export function Ranking({ filas, formato = (v) => v }) {
  const max = Math.max(...filas.map((f) => Number(f.valor)), 1)
  return (
    <ul className="space-y-3 text-sm">
      {filas.map((f) => (
        <li key={f.nombre}>
          <div className="flex justify-between gap-2"><span>{f.nombre}</span><span className="tabular-nums text-tinta/70">{formato(f.valor)}</span></div>
          <div className="mt-1 h-2 rounded-full bg-tinta/10">
            <div className="h-2 rounded-full bg-gradient-to-r from-rosa to-morado" style={{ width: (Number(f.valor) / max) * 100 + '%' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Cuántas reparaciones hay en cada estado (barras como en el prototipo). La usa también el tablero de Linda.
const PASOS = [['recibido', 'Recibido', 'bg-morado'], ['diagnosticado', 'Diagnosticado', 'bg-[#8b7cf0]'],
  ['en_reparacion', 'En reparación', 'bg-rosa'], ['listo_para_recoger', 'Listo para recoger', 'bg-aviso']]
export function ReparacionesActivas({ lista }) {
  return (
    <Caja titulo="Reparaciones activas" extra={<span className="font-titulo text-2xl text-rosa">{lista.length}</span>}>
      <ul className="space-y-3 text-sm">
        {PASOS.map(([estado, nombre, color]) => {
          const n = lista.filter((r) => r.estado === estado).length
          return (
            <li key={estado}>
              <div className="flex justify-between"><span>{nombre}</span><span className="tabular-nums">{n}</span></div>
              <div className="mt-1 h-2 rounded-full bg-tinta/10">
                <div className={'h-2 rounded-full ' + color} style={{ width: (lista.length ? (n / lista.length) * 100 : 0) + '%' }} />
              </div>
            </li>
          )
        })}
      </ul>
      <Link to="/taller" className={botonBorde + ' mt-4 w-full'}><Icono nombre="llave" tam={16} /> Ver y actualizar reparaciones</Link>
    </Caja>
  )
}

// Productos por reponer. Ángel puede sumar 5 unidades con un clic; Linda solo los ve.
export function StockBajo({ productos, puedeReponer, onReponer }) {
  return (
    <Caja titulo="Stock bajo" extra={<span className="rounded-md border border-rosa/40 bg-rosa/10 px-2 py-0.5 text-xs text-rosa">{productos.length} por reponer</span>}>
      <ul className="space-y-3 text-sm">
        {productos.slice(0, 6).map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate">{p.nombre}</p>
              <div className="mt-1 h-1.5 rounded-full bg-tinta/10">
                <div className="h-1.5 rounded-full bg-aviso" style={{ width: Math.min(p.stock / 5, 1) * 100 + '%' }} />
              </div>
            </div>
            <span className={'whitespace-nowrap text-sm ' + (p.stock === 0 ? 'text-error' : 'text-aviso')}>{p.stock === 0 ? 'Agotado' : p.stock + ' u.'}</span>
            {puedeReponer && (
              <button type="button" onClick={() => onReponer(p)} aria-label={'Sumar 5 unidades a ' + p.nombre}
                className="rounded-md border border-tinta/15 px-2 py-0.5 text-xs font-semibold hover:bg-tinta/5">+5</button>
            )}
          </li>
        ))}
      </ul>
      {!puedeReponer && <p className="mt-3 flex items-center gap-2 text-xs text-tinta/70">ⓘ Avísale a Ángel para reponer: él gestiona el inventario.</p>}
      {productos.length === 0 && <p className="text-sm text-tinta/60">Todo el catálogo tiene stock suficiente.</p>}
    </Caja>
  )
}

export default function Tablero({ usuario }) {
  const [dias, setDias] = useState(30)
  const [t, setT] = useState(null)
  const [taller, setTaller] = useState([])
  const [stockBajo, setStockBajo] = useState([])
  const [error, setError] = useState('')
  const [ia, setIa] = useState(null) // resultado del agrupamiento con IA
  const [agrupando, setAgrupando] = useState(false)

  const cargar = () => api('/tablero?dias=' + dias).then(setT).catch((e) => setError(e.message))
  useEffect(() => { cargar() }, [dias])
  useEffect(() => {
    api('/reparaciones').then(setTaller).catch(() => {})
    api('/productos/stock-bajo').then(setStockBajo).catch(() => {})
  }, [])

  const reponer = async (p) => {
    try {
      const nuevo = await api('/productos/' + p.id, { metodo: 'PATCH', cuerpo: { stock: p.stock + 5 } })
      setStockBajo(stockBajo.map((x) => (x.id === p.id ? nuevo : x))) // se queda en la lista con su nuevo stock
    } catch (err) {
      setError(err.message)
    }
  }

  const agruparConIA = async () => {
    setAgrupando(true)
    try {
      setIa(await api('/ia/agrupar-busquedas', { metodo: 'POST' }))
      await cargar() // vuelve a pedir el tablero: "Lo más buscado" ya cuenta los grupos nuevos
    } catch (err) {
      setError(err.message)
    } finally {
      setAgrupando(false)
    }
  }

  const periodos = (
    <div className="flex overflow-hidden rounded-lg border border-tinta/15" role="group" aria-label="Periodo">
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" onClick={() => setDias(d)} aria-pressed={dias === d}
          className={'px-3 py-2 text-sm ' + (dias === d ? 'bg-rosa/15 font-semibold text-rosa' : 'bg-superficie hover:bg-tinta/5')}>{d} días</button>
      ))}
    </div>
  )

  if (error) return <p className="text-error">{error}</p>
  if (!t) return <Encabezado titulo={`Hola ${usuario.nombre.split(' ')[0]}, así va la tienda`} detalle="Cargando los números…">{periodos}</Encabezado>

  const maxSemana = Math.max(...t.semanas.map((s) => Number(s.ventas)), 1)
  const listos = taller.filter((r) => r.estado === 'listo_para_recoger').length

  return (
    <div className="space-y-5">
      <Encabezado titulo={`Hola ${usuario.nombre.split(' ')[0]}, así va la tienda`}
        detalle={`Del ${diaMes(t.desde)} al ${diaMes(t.hasta)} · últimos ${dias} días`}>{periodos}</Encabezado>

      <ResumenIA />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Indicador titulo="Ventas del período" valor={soles(t.ventas_total)} icono="tablero" detalle={`${t.ventas_cantidad} pedidos cobrados`} tono="text-ok" />
        <Indicador titulo="Pedidos" valor={t.ventas_cantidad} icono="ventas" detalle="web, tienda y WhatsApp" />
        <Indicador titulo="Reparaciones activas" valor={t.reparaciones_en_taller} icono="llave" detalle={`${listos} listas para recoger`} tono="text-aviso" />
        <Indicador titulo="Ticket promedio" valor={soles(t.ticket_promedio)} icono="paquete" detalle={t.calificacion ? `Calificación ★ ${t.calificacion}` : ''} />
        <Indicador titulo="Reparaciones por semana" valor={'≈ ' + Math.round(t.reparaciones_por_semana)} icono="check" detalle="promedio del período" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Caja titulo="Ventas por semana" extra={<span className="font-titulo text-2xl text-rosa">{soles(t.ventas_total)}</span>}>
          <div className="flex h-56 items-end gap-2">
            {t.semanas.map((s) => (
              <div key={s.semana} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${soles(s.ventas)} · ${s.reparaciones} reparaciones`}>
                <span className="text-[10px] tabular-nums text-tinta/60">{corto(s.ventas)}</span>
                <div className="w-full rounded-t-md bg-gradient-to-t from-morado to-rosa" style={{ height: Math.max((Number(s.ventas) / maxSemana) * 85, 2) + '%' }} />
                <span className="text-[10px] text-tinta/60">{diaMes(s.semana)}</span>
              </div>
            ))}
          </div>
        </Caja>
        <Caja titulo="Más vendidos" extra={<span className="text-xs text-tinta/60">unidades</span>}><Ranking filas={t.mas_vendidos} /></Caja>
        <ReparacionesActivas lista={taller} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StockBajo productos={stockBajo} puedeReponer onReponer={reponer} />
        <Caja titulo="Ventas por método de pago"><Ranking filas={t.ventas_por_metodo} formato={(v) => v + ' pedidos'} /></Caja>
        <Caja titulo="Reparaciones más frecuentes" extra={<span className="text-xs text-tinta/60">por falla</span>}><Ranking filas={t.fallas_frecuentes} /></Caja>
      </div>

      <Caja titulo="Lo más buscado que no tenemos"
        extra={<button onClick={agruparConIA} disabled={agrupando} className="rounded-lg border border-morado/40 bg-morado/10 px-3 py-1.5 text-xs font-semibold text-morado disabled:opacity-50">
          {agrupando ? 'Agrupando...' : '✦ Agrupar búsquedas parecidas con IA'}
        </button>}>
        <p className="-mt-2 mb-3 text-xs text-tinta/60">Búsquedas sin resultado, chatbot y avisos. Las variantes ("gta 6", "gta vi") se juntan con IA.</p>
        {ia?.algoritmo_elegido && (
          <p className="mb-3 rounded-lg bg-morado/10 p-2 text-xs text-tinta/80">
            Ganó <b>{ia.algoritmo_elegido}</b> · K-Means ({ia.kmeans.parametro}) silueta {ia.kmeans.silueta}
            {ia.dbscan && <> · DBSCAN ({ia.dbscan.parametro}) silueta {ia.dbscan.silueta}</>}
            {ia.ari_vs_grupos_manuales !== null && <> · coincide con los grupos hechos a mano: ARI {ia.ari_vs_grupos_manuales}</>}
            {' · '}{ia.busquedas_agrupadas} búsquedas nuevas agrupadas, {ia.grupos_nuevos} grupos nuevos.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-tinta/60">
              <tr><th className="py-2 pr-3">Búsqueda</th><th className="pr-3">Veces</th><th className="pr-3">Pidieron aviso</th><th>¿Lo tenemos?</th></tr>
            </thead>
            <tbody className="divide-y divide-tinta/10">
              {t.mas_buscados.map((b) => (
                <tr key={b.nombre}>
                  <td className="py-2 pr-3 font-medium">{b.nombre}</td><td className="pr-3 tabular-nums">{b.busquedas}</td>
                  <td className="pr-3 tabular-nums">{b.avisos}</td>
                  <td>{b.hay_en_tienda
                    ? <span className="rounded-md border border-ok/40 px-2 py-0.5 text-xs text-ok">Sí</span>
                    : <span className="rounded-md border border-rosa/40 bg-rosa/10 px-2 py-0.5 text-xs text-rosa">No está en catálogo</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t.sin_resultado.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium">Buscaron y no encontraron (texto exacto)</h3>
            <Ranking filas={t.sin_resultado} formato={(v) => v + ' veces'} />
          </div>
        )}
      </Caja>
    </div>
  )
}
