// HU-03: el cliente ve sus compras (web y también las de tienda con su mismo celular).
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

const ESTADOS = { pagado: 'Pagado', reservado: 'Reservado', listo_para_recoger: 'Listo para recoger',
  entregado: 'Entregado', cancelado: 'Cancelado' }
const METODOS = { yape: 'Yape', tarjeta: 'Tarjeta', efectivo: 'Efectivo', transferencia: 'Transferencia BCP' }

export default function MisCompras() {
  const sesion = leerSesion()
  const [ventas, setVentas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (sesion?.usuario.rol === 'cliente') api('/ventas/mias').then(setVentas).catch((e) => setError(e.message))
  }, [])

  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login?volver=/mis-compras" />

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Mis compras</h1>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {ventas.map((v) => (
        <article key={v.codigo} className="rounded-xl border border-white/10 bg-superficie p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-rosa">{v.codigo}</span>
            <span className="text-white/60">{new Date(v.fecha + 'T12:00').toLocaleDateString('es-PE')}</span>
            <span className="text-white/60">{METODOS[v.metodo_pago]}</span>
            <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-xs">{ESTADOS[v.estado]}</span>
          </div>
          <ul className="mt-2 text-white/80">
            {v.items.map((i, n) => <li key={n}>{i.cantidad} × {i.nombre} · S/ {Number(i.precio_unitario)}</li>)}
          </ul>
          <p className="mt-2 text-right font-semibold">Total: S/ {Number(v.total)}</p>
        </article>
      ))}
    </section>
  )
}