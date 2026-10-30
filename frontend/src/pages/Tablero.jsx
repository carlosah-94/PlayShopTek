// HU-13: tablero del negocio para Ángel (ventas, taller y lo más buscado).
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import ResumenIA from '../components/ResumenIA.jsx'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE', { maximumFractionDigits: 0 })
const diaMes = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })

// Una tarjeta con un número grande (un KPI)
function Indicador({ titulo, valor, detalle }) {
  return (
    <div className="rounded-xl border border-tinta/10 bg-superficie p-4">
      <p className="text-xs uppercase tracking-wide text-tinta/60">{titulo}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
      {detalle && <p className="text-xs text-tinta/60">{detalle}</p>}
    </div>
  )
}

// Lista con barras horizontales: el largo de cada barra es proporcional a su valor
function Ranking({ titulo, filas, formato = (v) => v }) {
  const max = Math.max(...filas.map((f) => Number(f.valor)), 1)
  return (
    <div className="rounded-xl border border-tinta/10 bg-superficie p-4">
      <h2 className="font-semibold">{titulo}</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {filas.map((f) => (
          <li key={f.nombre}>
            <div className="flex justify-between"><span>{f.nombre}</span><span className="text-tinta/70">{formato(f.valor)}</span></div>
            <div className="mt-1 h-2 rounded bg-tinta/10"><div className="h-2 rounded bg-rosa" style={{ width: (Number(f.valor) / max) * 100 + '%' }} /></div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Tablero() {
  const sesion = leerSesion()
  const [dias, setDias] = useState(30)
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [ia, setIa] = useState(null) // resultado del agrupamiento con IA
  const [agrupando, setAgrupando] = useState(false)

  const cargar = () => api('/tablero?dias=' + dias).then(setT).catch((e) => setError(e.message))
  useEffect(() => { if (sesion?.usuario.rol === 'dueno') cargar() }, [dias])

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

  if (sesion?.usuario.rol !== 'dueno') return <Navigate to="/login" />
  if (error) return <p className="text-error">{error}</p>
  if (!t) return <p className="text-tinta/60">Cargando...</p>

  const maxSemana = Math.max(...t.semanas.map((s) => Number(s.ventas)), 1)

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tablero del negocio</h1>
          <p className="text-sm text-tinta/60">Del {diaMes(t.desde)} al {diaMes(t.hasta)} · datos de ejemplo</p>
        </div>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))}
          className="ml-auto rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm">
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Ventas" valor={soles(t.ventas_total)} detalle={`${t.ventas_cantidad} compras · ticket promedio ${soles(t.ticket_promedio)}`} />
        <Indicador titulo="Reparaciones por semana" valor={t.reparaciones_por_semana} detalle={`${t.reparaciones_en_taller} equipos en el taller ahora`} />
        <Indicador titulo="Calificación" valor={t.calificacion ? '★ ' + t.calificacion : '—'} detalle="promedio de todas las reseñas" />
        <Indicador titulo="Por reponer" valor={t.stock_bajo} detalle="productos con stock bajo" />
      </div>

      <div className="rounded-xl border border-tinta/10 bg-superficie p-4">
        <h2 className="font-semibold">Ventas por semana</h2>
        <div className="mt-4 flex items-end gap-2">
          {t.semanas.map((s) => (
            <div key={s.semana} className="flex flex-1 flex-col items-center gap-1" title={`${soles(s.ventas)} · ${s.reparaciones} reparaciones`}>
              <span className="text-[10px] text-tinta/60">{soles(s.ventas)}</span>
              <div className="flex h-32 w-full items-end">
                <div className="w-full rounded-t bg-morado" style={{ height: (Number(s.ventas) / maxSemana) * 100 + '%' }} />
              </div>
              <span className="text-[10px] text-tinta/60">{diaMes(s.semana)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Ranking titulo="Más vendidos (unidades)" filas={t.mas_vendidos} />
        <Ranking titulo="Fallas más frecuentes" filas={t.fallas_frecuentes} />
        <Ranking titulo="Ventas por método de pago" filas={t.ventas_por_metodo} formato={(v) => v + ' compras'} />
      </div>

      <div className="rounded-xl border border-tinta/10 bg-superficie p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Lo más buscado por los clientes</h2>
          <button onClick={agruparConIA} disabled={agrupando}
            className="ml-auto rounded-lg bg-morado px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {agrupando ? 'Agrupando...' : '✨ Agrupar búsquedas parecidas con IA'}
          </button>
        </div>
        {ia?.algoritmo_elegido && (
          <p className="mt-2 rounded-lg bg-morado/15 p-2 text-xs text-tinta/80">
            Ganó <b>{ia.algoritmo_elegido}</b> · K-Means ({ia.kmeans.parametro}) silueta {ia.kmeans.silueta}
            {ia.dbscan && <> · DBSCAN ({ia.dbscan.parametro}) silueta {ia.dbscan.silueta}</>}
            {ia.ari_vs_grupos_manuales !== null && <> · coincide con los grupos hechos a mano: ARI {ia.ari_vs_grupos_manuales}</>}
            {' · '}{ia.busquedas_agrupadas} búsquedas nuevas agrupadas, {ia.grupos_nuevos} grupos nuevos.
          </p>
        )}
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-tinta/60"><tr><th className="py-1">Búsqueda</th><th>Veces</th><th>Pidieron "Avísame"</th><th>¿Lo tenemos?</th></tr></thead>
          <tbody className="divide-y divide-tinta/10">
            {t.mas_buscados.map((b) => (
              <tr key={b.nombre}>
                <td className="py-2">{b.nombre}</td><td>{b.busquedas}</td><td>{b.avisos}</td>
                <td className={b.hay_en_tienda ? 'text-ok' : 'text-error'}>{b.hay_en_tienda ? 'Sí' : 'No · oportunidad de venta'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Ranking titulo="Buscaron y no encontraron (texto exacto)" filas={t.sin_resultado} formato={(v) => v + ' veces'} />
      <ResumenIA />
    </section>
  )
}