// HU-14: resumen inteligente. Qué reponer, qué agregar al catálogo y qué ofertas poner esta semana.
import { useState } from 'react'
import { api } from '../api.js'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE', { maximumFractionDigits: 0 })
const caja = 'rounded-xl border border-tinta/10 bg-superficie p-4'

export default function ResumenIA() {
  const [r, setR] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [oculto, setOculto] = useState(false) // HU-24: el resumen se puede ocultar y volver a mostrar

  const generar = async () => {
    setCargando(true)
    setError('')
    try {
      setR(await api('/ia/resumen'))
      setOculto(false)
    } catch (e) {
      setError(e.message)
    }
    setCargando(false)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-rosa/30 bg-gradient-to-r from-morado/10 via-rosa/5 to-rosa/10 p-5">
      {/* HU-24: cabecera lila como la del prototipo */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rosa to-morado text-xl text-white" aria-hidden="true">✦</span>
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="text-lg font-medium">Resumen inteligente</h2>
          <p className="text-sm text-tinta/70">Lee las ventas, el stock y lo que buscan los clientes, y propone qué reponer, qué agregar y qué poner en oferta esta semana.</p>
        </div>
        {r && (
          <button type="button" onClick={() => setOculto(!oculto)} aria-expanded={!oculto}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-tinta/80 hover:bg-tinta/5">
            {oculto ? '▾ Mostrar' : '▴ Ocultar'}
          </button>
        )}
        <button onClick={generar} disabled={cargando}
          className="rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
          {cargando ? 'Calculando...' : r ? 'Volver a generar' : '✦ Generar resumen'}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-500/15 p-3 text-sm text-error">{error}</p>}

      {r && !oculto && (
        <>
          <p className="text-xs text-tinta/60">
            Ganó <b>{r.modelo.algoritmo_elegido}</b> · aprendió de {r.modelo.filas} semanas-producto
            {' '}({r.modelo.productos} productos, {r.modelo.semanas} semanas de historial) · error promedio (MAE):{' '}
            {Object.entries(r.modelo.resultados).map(([nombre, x]) => nombre + ' ' + x.mae_prueba).join(' · ')} unidades.
            {r.modelo.historial_simulado && ' Historial de la tienda simulado hasta tener las ventas reales.'}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={caja}>
              <h3 className="font-semibold">Qué reponer</h3>
              <p className="text-xs text-tinta/60">Lo que se venderá en 4 semanas (lo que tarda un pedido) menos lo que hay en stock</p>
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-tinta/60"><tr><th className="py-1">Producto</th><th>Stock</th><th>Venderá/sem.</th><th>Pedir</th></tr></thead>
                <tbody className="divide-y divide-tinta/10">
                  {r.reponer.map((x) => (
                    <tr key={x.producto_id}>
                      <td className="py-2">{x.nombre}</td><td>{x.stock}</td><td>{x.demanda_semana}</td>
                      <td className="font-semibold text-rosa">{x.pedir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.reponer.length === 0 && <p className="mt-2 text-sm text-tinta/60">El stock alcanza para las próximas 4 semanas.</p>}
            </div>

            <div className={caja}>
              <h3 className="font-semibold">Qué ofertas poner</h3>
              <p className="text-xs text-tinta/60">
                Hill Climbing: ganancia estimada {soles(r.ofertas.ganancia_sin_ofertas)} sin ofertas →{' '}
                <b className="text-ok">{soles(r.ofertas.ganancia_con_ofertas)}</b> con estas ofertas
              </p>
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-tinta/60"><tr><th className="py-1">Producto</th><th>Descuento</th><th>Unidades</th></tr></thead>
                <tbody className="divide-y divide-tinta/10">
                  {r.ofertas.sugeridas.map((x) => (
                    <tr key={x.producto_id}>
                      <td className="py-2">{x.nombre}</td><td>-{x.descuento}%</td>
                      <td>{x.unidades_sin_oferta} → <b>{x.unidades_con_oferta}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.ofertas.sugeridas.length === 0 && <p className="mt-2 text-sm text-tinta/60">Esta semana conviene no poner ofertas.</p>}
            </div>
          </div>

          <div className={caja}>
            <h3 className="font-semibold">Qué agregar al catálogo</h3>
            <p className="text-xs text-tinta/60">Búsquedas agrupadas de productos que la tienda no tiene</p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {r.agregar.map((x) => (
                <li key={x.nombre} className="rounded-full border border-rosa/50 px-3 py-1">{x.nombre} · {x.busquedas} búsquedas</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
