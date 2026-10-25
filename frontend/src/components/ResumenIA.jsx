// HU-14: resumen inteligente. Qué reponer, qué agregar al catálogo y qué ofertas poner esta semana.
import { useState } from 'react'
import { api } from '../api.js'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE', { maximumFractionDigits: 0 })
const caja = 'rounded-xl border border-white/10 bg-superficie p-4'

export default function ResumenIA() {
  const [r, setR] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const generar = async () => {
    setCargando(true)
    setError('')
    try {
      setR(await api('/ia/resumen'))
    } catch (e) {
      setError(e.message)
    }
    setCargando(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Resumen inteligente de la semana</h2>
        <button onClick={generar} disabled={cargando} className="rounded-lg bg-morado px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {cargando ? 'Calculando...' : r ? 'Volver a calcular' : 'Generar con IA'}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{error}</p>}

      {r && (
        <>
          <p className="text-xs text-white/60">
            Ganó <b>{r.modelo.algoritmo_elegido}</b> · aprendió de {r.modelo.filas} semanas-producto
            {' '}({r.modelo.productos} productos, {r.modelo.semanas} semanas de historial) · error promedio (MAE):{' '}
            {Object.entries(r.modelo.resultados).map(([nombre, x]) => nombre + ' ' + x.mae_prueba).join(' · ')} unidades.
            {r.modelo.historial_simulado && ' Historial de la tienda simulado hasta tener las ventas reales.'}
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={caja}>
              <h3 className="font-semibold">Qué reponer</h3>
              <p className="text-xs text-white/50">Lo que se venderá en 2 semanas menos lo que hay en stock</p>
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-white/50"><tr><th className="py-1">Producto</th><th>Stock</th><th>Venderá/sem.</th><th>Pedir</th></tr></thead>
                <tbody className="divide-y divide-white/10">
                  {r.reponer.map((x) => (
                    <tr key={x.producto_id}>
                      <td className="py-2">{x.nombre}</td><td>{x.stock}</td><td>{x.demanda_semana}</td>
                      <td className="font-semibold text-rosa">{x.pedir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.reponer.length === 0 && <p className="mt-2 text-sm text-white/60">El stock alcanza para las próximas 2 semanas.</p>}
            </div>

            <div className={caja}>
              <h3 className="font-semibold">Qué ofertas poner</h3>
              <p className="text-xs text-white/50">
                Hill Climbing: ganancia estimada {soles(r.ofertas.ganancia_sin_ofertas)} sin ofertas →{' '}
                <b className="text-green-300">{soles(r.ofertas.ganancia_con_ofertas)}</b> con estas ofertas
              </p>
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-white/50"><tr><th className="py-1">Producto</th><th>Descuento</th><th>Unidades</th></tr></thead>
                <tbody className="divide-y divide-white/10">
                  {r.ofertas.sugeridas.map((x) => (
                    <tr key={x.producto_id}>
                      <td className="py-2">{x.nombre}</td><td>-{x.descuento}%</td>
                      <td>{x.unidades_sin_oferta} → <b>{x.unidades_con_oferta}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.ofertas.sugeridas.length === 0 && <p className="mt-2 text-sm text-white/60">Esta semana conviene no poner ofertas.</p>}
            </div>
          </div>

          <div className={caja}>
            <h3 className="font-semibold">Qué agregar al catálogo</h3>
            <p className="text-xs text-white/50">Búsquedas agrupadas de productos que la tienda no tiene</p>
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