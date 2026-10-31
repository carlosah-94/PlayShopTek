// HU-03: carrito con recojo en la tienda.
// HU-26: como el prototipo: productos a la izquierda y "Resumen" a la derecha; el pago va en su propia página (/pago).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, leerSesion, urlImagen } from '../api.js'
import { cambiarCantidad, completarFotos, leerCarrito } from '../carrito.js'
import Icono from '../components/Iconos.jsx'
import { botonRosa, soles } from '../components/PiezasPanel.jsx'

export function Resumen({ items, children }) {
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  return (
    <aside className="h-fit space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
      {children}
      <div className="space-y-2 border-b border-tinta/10 pb-3 text-sm">
        <p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{soles(subtotal)}</span></p>
        <p className="flex justify-between"><span>Recojo en tienda</span><span>Gratis</span></p>
      </div>
      <p className="flex items-baseline justify-between"><span>Total</span><span className="font-titulo text-3xl font-semibold tabular-nums">{soles(subtotal)}</span></p>
    </aside>
  )
}

export default function Carrito() {
  const [items, setItems] = useState(leerCarrito())
  const navegar = useNavigate()
  const esCliente = leerSesion()?.usuario.rol === 'cliente'
  // Si el carrito cambia (por ejemplo, en otra pestaña), se vuelve a leer
  useEffect(() => {
    const leer = () => setItems(leerCarrito())
    window.addEventListener('carrito', leer)
    if (leerCarrito().some((i) => !i.foto)) api('/productos').then(completarFotos).catch(() => {})
    return () => window.removeEventListener('carrito', leer)
  }, [])

  if (!items.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Tu carrito</h1>
        <div className="grid place-items-center gap-3 rounded-2xl border border-tinta/10 bg-superficie p-10 text-center shadow-sm">
          <span className="text-morado"><Icono nombre="carrito" tam={40} /></span>
          <h2 className="text-2xl font-semibold">Todavía no agregaste nada</h2>
          <p className="text-sm text-tinta/70">Mira lo que te recomendamos según tus gustos.</p>
          <Link to="/catalogo" className={botonRosa}>Ir al catálogo</Link>
        </div>
      </div>
    )
  }

  const boton = 'grid h-8 w-8 place-items-center text-lg disabled:opacity-30'
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Tu carrito</h1>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-tinta/10 bg-superficie p-4 shadow-sm">
                {i.foto
                  ? <img src={urlImagen(i.foto)} alt="" className="h-16 w-14 rounded-md bg-white object-contain" />
                  : <span className="grid h-16 w-14 place-items-center rounded-md bg-morado/10 text-morado"><Icono nombre="paquete" /></span>}
                <div className="min-w-0 flex-1 basis-40">
                  <Link to={'/producto/' + i.id} className="font-medium hover:text-rosa">{i.nombre}</Link>
                  <p className="text-xs text-tinta/70">{soles(i.precio)} por unidad · Disponible hoy</p>
                  <button type="button" onClick={() => cambiarCantidad(i.id, 0)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rosa hover:underline">
                    <Icono nombre="basura" tam={13} /> Quitar
                  </button>
                </div>
                <div className="flex items-center rounded-lg border border-tinta/15" role="group" aria-label={'Cantidad de ' + i.nombre}>
                  <button type="button" onClick={() => cambiarCantidad(i.id, i.cantidad - 1)} aria-label="Una menos" className={boton}>−</button>
                  <span className="w-7 text-center tabular-nums">{i.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(i.id, i.cantidad + 1)} disabled={i.cantidad >= Math.min(i.stock, 5)} aria-label="Una más" className={boton}>+</button>
                </div>
                <span className="w-24 text-right font-medium tabular-nums">{soles(i.precio * i.cantidad)}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-3 rounded-2xl border border-tinta/10 bg-superficie p-4 text-sm shadow-sm">
            <span className="text-morado"><Icono nombre="tienda" /></span>
            <span><b className="font-medium">Entrega: recoger en tienda</b><br />
              <span className="text-xs text-tinta/70">Gratis · Av. Revolución 1420, Villa El Salvador · lun a sáb 12:00–20:00, dom 15:00–20:00.</span></span>
          </p>
        </div>
        <Resumen items={items}>
          <h2 className="text-lg font-medium">Resumen</h2>
        </Resumen>
      </div>
      <div className="flex justify-end">
        <div className="w-full space-y-1 lg:w-[340px]">
          <button type="button" onClick={() => navegar(esCliente ? '/pago' : '/login?volver=/pago')} className={botonRosa + ' w-full py-3'}>
            <Icono nombre="tarjeta" tam={17} /> {esCliente ? 'Ir a pagar' : 'Inicia sesión para pagar'}
          </button>
          <p className="text-center text-xs text-tinta/70">Al iniciar sesión te devolvemos directo al pago.</p>
        </div>
      </div>
    </div>
  )
}
