// HU-03: carrito y pago con Yape o tarjeta, con recojo en la tienda.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import { cambiarCantidad, leerCarrito, vaciarCarrito } from '../carrito.js'

const YAPE_TIENDA = '987 654 321' // EJEMPLO: cambiar por el número de Yape real de la tienda
const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')

export default function Carrito() {
  const sesion = leerSesion()
  const [items, setItems] = useState(leerCarrito())
  const [metodo, setMetodo] = useState('yape')
  const [operacion, setOperacion] = useState('')
  const [compra, setCompra] = useState(null)
  const [error, setError] = useState('')

  // Si el carrito cambia (por ejemplo, en otra pestaña), se vuelve a leer
  useEffect(() => {
    const leer = () => setItems(leerCarrito())
    window.addEventListener('carrito', leer)
    return () => window.removeEventListener('carrito', leer)
  }, [])

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const pagar = async () => {
    setError('')
    try {
      const cuerpo = { items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })), metodo_pago: metodo,
        numero_operacion: metodo === 'yape' ? (operacion.trim() || null) : null }
      setCompra(await api('/ventas', { metodo: 'POST', cuerpo }))
      vaciarCarrito()
    } catch (err) {
      setError(err.message)
    }
  }

  if (compra) {
    return (
      <section className="mx-auto max-w-lg space-y-3 rounded-xl border border-green-500/40 bg-green-500/10 p-6">
        <h1 className="text-xl font-bold">¡Compra confirmada!</h1>
        <p>Tu código es <span className="font-mono text-rosa">{compra.codigo}</span>. Total pagado: <b>{soles(compra.total)}</b>.</p>
        <p className="text-sm text-white/70">Muéstralo al recoger en Av. Revolución 1420, Villa El Salvador.
          Horario: lunes a sábado 12:00–20:00, domingo 15:00–20:00.</p>
        <Link to="/mis-compras" className="inline-block rounded-lg bg-rosa px-4 py-2 font-semibold text-white">Ver mis compras</Link>
      </section>
    )
  }

  if (!items.length) {
    return <p className="text-white/60">Tu carrito está vacío. <Link to="/" className="text-rosa">Ir al catálogo</Link></p>
  }

  const campo = 'w-full rounded-lg border border-white/15 bg-superficie px-3 py-2'
  return (
    <section className="grid gap-6 md:grid-cols-[1fr_360px]">
      <div>
        <h1 className="text-2xl font-bold">Tu carrito</h1>
        <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-superficie">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 p-4">
              <span className="flex-1 font-semibold">{i.nombre}</span>
              <select value={i.cantidad} onChange={(e) => cambiarCantidad(i.id, Number(e.target.value))}
                className="rounded border border-white/15 bg-fondo px-2 py-1">
                {Array.from({ length: Math.min(i.stock, 5) }, (_, n) => <option key={n + 1}>{n + 1}</option>)}
              </select>
              <span className="w-24 text-right">{soles(i.precio * i.cantidad)}</span>
              <button onClick={() => cambiarCantidad(i.id, 0)} className="text-sm text-white/50 hover:text-red-300">Quitar</button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-lg">Total: <b>{soles(total)}</b></p>
        <p className="text-right text-xs text-white/50">Recojo gratis en tienda. El precio final se confirma al pagar.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-superficie/50 p-5">
        <h2 className="font-semibold">¿Cómo quieres pagar?</h2>
        {[['yape', 'Yape'], ['tarjeta', 'Tarjeta (BCP)']].map(([k, nombre]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="radio" name="metodo" checked={metodo === k} onChange={() => { setMetodo(k); setError('') }} /> {nombre}
          </label>
        ))}

        {metodo === 'yape' ? (
          <div className="space-y-2 text-sm">
            <p>1. Yapea <b>{soles(total)}</b> al <b>{YAPE_TIENDA}</b> (Play Shop Tek).</p>
            <p>2. Escribe el número de operación que te muestra Yape:</p>
            <input placeholder="Número de operación" value={operacion} onChange={(e) => setOperacion(e.target.value)}
              className={campo} inputMode="numeric" />
          </div>
        ) : (
          <p className="rounded-lg border border-white/15 p-3 text-sm text-white/70">
            Pago con tarjeta <b>simulado</b> para la demostración. En producción se conecta a una pasarela de pago
            certificada; la tienda nunca ve ni guarda los datos de tu tarjeta.
          </p>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}
        {sesion?.usuario.rol === 'cliente'
          ? <button onClick={pagar} className="w-full rounded-lg bg-rosa py-2 font-semibold text-white">Pagar {soles(total)}</button>
          : <Link to="/login?volver=/carrito" className="block rounded-lg bg-rosa py-2 text-center font-semibold text-white">Inicia sesión como cliente para pagar</Link>}
      </div>
    </section>
  )
}