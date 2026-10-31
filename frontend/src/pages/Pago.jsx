// HU-03: pago con Yape o tarjeta y recojo en la tienda.
// HU-26: en su propia página, con los pasos Carrito > Pago > Confirmación (como el prototipo).
// La tarjeta es una simulación: la tienda NUNCA pide ni guarda números de tarjeta (eso lo haría una pasarela certificada).
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, leerSesion, urlImagen } from '../api.js'
import { leerCarrito, vaciarCarrito } from '../carrito.js'
import Icono from '../components/Iconos.jsx'
import { botonRosa, campo, soles } from '../components/PiezasPanel.jsx'
import { Resumen } from './Carrito.jsx'

const YAPE_TIENDA = '987 654 321' // EJEMPLO: cambiar por el número de Yape real de la tienda

function Pasos({ paso }) {
  const lista = ['Carrito', 'Pago', 'Confirmación']
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Pasos de la compra">
      {lista.map((p, i) => (
        <li key={p} className="flex items-center gap-2" aria-current={i === paso ? 'step' : undefined}>
          {i > 0 && <Icono nombre="flechaDer" tam={12} />}
          <span className={i < paso ? 'flex items-center gap-1 text-ok' : i === paso ? 'font-semibold text-rosa' : 'text-tinta/70'}>
            {i < paso && <Icono nombre="check" tam={15} />}{p}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function Pago() {
  const sesion = leerSesion()
  const [items] = useState(leerCarrito())
  const [metodo, setMetodo] = useState('tarjeta')
  const [operacion, setOperacion] = useState('')
  const [compra, setCompra] = useState(null)
  const [pagando, setPagando] = useState(false)
  const [error, setError] = useState('')

  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login?volver=/pago" />
  if (!items.length && !compra) return <Navigate to="/carrito" />
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  const pagar = async () => {
    setError(''); setPagando(true)
    try {
      const cuerpo = { items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })), metodo_pago: metodo,
        numero_operacion: metodo === 'yape' ? (operacion.trim() || null) : null }
      setCompra(await api('/ventas', { metodo: 'POST', cuerpo }))
      vaciarCarrito()
    } catch (err) {
      setError(err.message)
    } finally {
      setPagando(false)
    }
  }

  if (compra) {
    return (
      <div className="space-y-5">
        <Pasos paso={2} />
        <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-ok/40 bg-superficie p-8 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/15 text-ok"><Icono nombre="check" tam={30} /></span>
          <h1 className="text-3xl font-semibold">¡Compra confirmada!</h1>
          <p>Tu pedido es <span className="font-mono font-semibold text-rosa">{compra.codigo}</span> · Total pagado <b>{soles(compra.total)}</b></p>
          <p className="text-sm text-tinta/70">Te avisaremos en la campanita cuando esté listo para recoger. Muestra el código en Av. Revolución 1420, Villa El Salvador (lun a sáb 12:00–20:00, dom 15:00–20:00).</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/mis-compras" className={botonRosa}>Ver mis compras</Link>
            <Link to="/catalogo" className="rounded-lg border border-tinta/15 px-4 py-2 text-sm font-semibold hover:bg-tinta/5">Seguir comprando</Link>
          </div>
        </section>
      </div>
    )
  }

  const opcion = (k, ic, t, d) => (
    <button type="button" onClick={() => { setMetodo(k); setError('') }} aria-pressed={metodo === k}
      className={'flex flex-col items-start gap-1 rounded-xl border p-4 text-left ' + (metodo === k ? 'border-rosa/60 bg-rosa/10' : 'border-tinta/15 hover:bg-tinta/5')}>
      <span className="text-rosa"><Icono nombre={ic} /></span>
      <span className="font-medium">{t}</span><span className="text-xs text-tinta/70">{d}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/carrito" className="inline-flex items-center gap-1 text-sm font-semibold text-rosa hover:underline"><Icono nombre="flechaIzq" tam={14} /> Volver al carrito</Link>
        <Pasos paso={1} />
      </div>
      <p className="rounded-xl border border-aviso/40 p-3 text-sm text-aviso">
        ⚠ <b>Pasarela de prueba.</b> El pago con tarjeta está simulado para la demostración: no te pediremos datos de ninguna tarjeta.
        En la versión final se conecta a una pasarela certificada (la tienda nunca ve ni guarda los datos de la tarjeta).
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
            <h2 className="text-lg font-medium">Método de pago</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {opcion('tarjeta', 'tarjeta', 'Tarjeta', 'Débito o crédito · Visa, Mastercard')}
              {opcion('yape', 'qr', 'Yape', 'Yapea y escribe el n.º de operación')}
            </div>
          </section>
          <section className="space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
            {metodo === 'yape' ? (
              <>
                <h2 className="text-lg font-medium">Pago con Yape</h2>
                <p className="text-sm">1. Yapea <b>{soles(total)}</b> al <b>{YAPE_TIENDA}</b> (Play Shop Tek).</p>
                <label htmlFor="pago-operacion" className="block text-sm">2. Escribe el número de operación que te muestra Yape:</label>
                <input id="pago-operacion" placeholder="Ej: 01234567" value={operacion} onChange={(e) => setOperacion(e.target.value)} className={campo + ' max-w-xs'} inputMode="numeric" />
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium">Pago con tarjeta (simulado)</h2>
                <p className="text-sm text-tinta/70">Al presionar "Pagar" se registra tu compra como pagada con tarjeta. No se cobra nada.</p>
              </>
            )}
          </section>
        </div>
        <Resumen items={items}>
          <h2 className="text-lg font-medium">Tu pedido</h2>
          <ul className="space-y-2 border-b border-tinta/10 pb-3 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                {i.foto && <img src={urlImagen(i.foto)} alt="" className="h-9 w-8 rounded bg-white object-contain" />}
                <span className="flex-1">{i.cantidad} × {i.nombre}</span><span className="tabular-nums">{soles(i.precio * i.cantidad)}</span>
              </li>
            ))}
          </ul>
        </Resumen>
      </div>
      <div className="flex justify-end">
        <div className="w-full space-y-2 lg:w-[340px]">
          {error && <p className="rounded-lg border border-error/40 p-3 text-sm text-error">{error}</p>}
          <button type="button" onClick={pagar} disabled={pagando} className={botonRosa + ' w-full py-3'}>
            <Icono nombre="candado" tam={17} /> {pagando ? 'Procesando…' : 'Pagar ' + soles(total)}
          </button>
          <p className="text-center text-xs text-tinta/70">Simulación · no se cobra nada</p>
        </div>
      </div>
    </div>
  )
}
