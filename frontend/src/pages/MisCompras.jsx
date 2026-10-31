// HU-03: el cliente ve sus compras (web y también las de tienda con su mismo celular).
// HU-26: tabla con buscador, filtro por estado y fechas, y pestañas Compras / Reparaciones (como el prototipo).
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import { Estado, Filtros, FILTROS_VACIOS, Paginacion, pasaFiltros, soles } from '../components/PiezasPanel.jsx'
import { PestanasCliente } from '../components/TablaCliente.jsx'

const METODOS = { yape: 'Yape', tarjeta: 'Tarjeta', efectivo: 'Efectivo', transferencia: 'Transferencia BCP' }
const POR_PAGINA = 10

export default function MisCompras() {
  const sesion = leerSesion()
  const [ventas, setVentas] = useState(null)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sesion?.usuario.rol === 'cliente') api('/ventas/mias').then(setVentas).catch((e) => setError(e.message))
  }, [])
  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login?volver=/mis-compras" />

  const lista = ventas || []
  const visibles = lista.filter((v) => pasaFiltros(filtros, { textos: [v.codigo, ...v.items.map((i) => i.nombre)], estado: v.estado, fecha: v.fecha }))
  const enPagina = visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const gastado = lista.filter((v) => v.estado !== 'cancelado').reduce((s, v) => s + Number(v.total), 0)
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-tinta/70'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Mis compras</h1>
          <p className="mt-1 text-sm text-tinta/70">{ventas ? `${lista.length} compras registradas · ${soles(gastado)} en total (sin cancelados)` : 'Cargando…'}</p>
        </div>
        <PestanasCliente actual="/mis-compras" />
      </div>
      {error && <p className="rounded-lg border border-error/40 p-3 text-sm text-error">{error}</p>}
      <section className="rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
        <Filtros filtros={filtros} setFiltros={(f) => { setFiltros(f); setPagina(1) }}
          estados={['pagado', 'reservado', 'listo_para_recoger', 'entregado', 'cancelado']} placeholder="Producto o número de pedido" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-tinta/10">
              <tr><th className={th}>Pedido</th><th className={th}>Fecha</th><th className={th}>Detalle</th><th className={th}>Pago</th>
                <th className={th}>Total</th><th className={th}>Estado</th></tr>
            </thead>
            <tbody className="divide-y divide-tinta/10">
              {enPagina.map((v) => (
                <tr key={v.codigo}>
                  <td className="px-3 py-3 font-mono text-xs">{v.codigo}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{v.fecha}</td>
                  <td className="px-3 py-3">{v.items.map((i) => `${i.cantidad > 1 ? i.cantidad + ' × ' : ''}${i.nombre}`).join(', ')}</td>
                  <td className="px-3 py-3">{METODOS[v.metodo_pago]}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{soles(v.total)}</td>
                  <td className="px-3 py-3"><Estado estado={v.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {ventas && visibles.length === 0 && (
            <p className="py-6 text-center text-sm text-tinta/70">{lista.length ? 'No hay compras con esos filtros.' : <>Todavía no tienes compras. <Link to="/catalogo" className="text-rosa underline">Ir al catálogo</Link></>}</p>
          )}
        </div>
        <Paginacion pagina={pagina} setPagina={setPagina} total={visibles.length} porPagina={POR_PAGINA} />
      </section>
      <p className="text-xs text-tinta/70">Incluye lo que compraste en la tienda o por WhatsApp con tu mismo celular. Cuando un pedido pasa a «Listo para recoger», te llega un aviso en la campanita.</p>
    </div>
  )
}
