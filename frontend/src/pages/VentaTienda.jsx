// HU-15: Linda o Ángel registran lo que se vende en el mostrador o por WhatsApp.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
// Medios de pago que acepta cada canal (regla del dueño)
const METODOS = { tienda: ['efectivo', 'yape', 'transferencia'], whatsapp: ['yape'] }
const NOMBRES = { efectivo: 'Efectivo', yape: 'Yape', transferencia: 'Transferencia BCP' }
const campo = 'w-full rounded-lg border border-tinta/15 bg-superficie px-3 py-2'

export default function VentaTienda() {
  const sesion = leerSesion()
  const [productos, setProductos] = useState([])
  const [buscar, setBuscar] = useState('')
  const [lineas, setLineas] = useState([]) // [{ producto, cantidad }]
  const [canal, setCanal] = useState('tienda')
  const [metodo, setMetodo] = useState('efectivo')
  const [operacion, setOperacion] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [ultimas, setUltimas] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const cargarUltimas = () => api('/ventas/tienda').then(setUltimas).catch((e) => setError(e.message))
  useEffect(() => {
    if (!sesion || sesion.usuario.rol === 'cliente') return
    api('/productos').then((ps) => setProductos(ps.filter((p) => !p.es_preventa))).catch((e) => setError(e.message))
    cargarUltimas()
  }, [])

  if (!sesion || sesion.usuario.rol === 'cliente') return <Navigate to="/login" />

  const encontrados = buscar.trim().length < 2 ? []
    : productos.filter((p) => p.nombre.toLowerCase().includes(buscar.trim().toLowerCase())).slice(0, 6)

  const agregar = (p) => {
    const ya = lineas.find((l) => l.producto.id === p.id)
    if (ya) setLineas(lineas.map((l) => (l === ya ? { ...l, cantidad: Math.min(l.cantidad + 1, 5, p.stock) } : l)))
    else setLineas([...lineas, { producto: p, cantidad: 1 }])
    setBuscar('')
  }
  const cambiarCantidad = (id, cantidad) =>
    setLineas(lineas.map((l) => (l.producto.id === id ? { ...l, cantidad } : l)).filter((l) => l.cantidad > 0))
  const elegirCanal = (c) => { setCanal(c); setMetodo(METODOS[c][0]) }
  const total = lineas.reduce((s, l) => s + Number(l.producto.precio_final) * l.cantidad, 0)

  const registrar = async (e) => {
    e.preventDefault()
    setError(''); setMensaje('')
    const cuerpo = {
      canal, metodo_pago: metodo, items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
      cliente_nombre: nombre || null, cliente_telefono: telefono || null,
      numero_operacion: metodo === 'yape' ? operacion : null,
    }
    try {
      const v = await api('/ventas/tienda', { metodo: 'POST', cuerpo })
      setMensaje(`Venta ${v.codigo} registrada por ${soles(v.total)}. El stock ya se actualizó.`)
      setLineas([]); setOperacion(''); setNombre(''); setTelefono('')
      cargarUltimas()
      api('/productos').then((ps) => setProductos(ps.filter((p) => !p.es_preventa)))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <form onSubmit={registrar} className="space-y-3 rounded-xl border border-tinta/10 bg-superficie/50 p-5">
        <h1 className="text-xl font-bold">Registrar venta</h1>

        <div className="flex gap-2">
          {['tienda', 'whatsapp'].map((c) => (
            <button type="button" key={c} onClick={() => elegirCanal(c)}
              className={'flex-1 rounded-lg border px-3 py-2 text-sm ' + (canal === c ? 'border-rosa bg-rosa/20' : 'border-tinta/15')}>
              {c === 'tienda' ? 'En tienda' : 'Por WhatsApp'}
            </button>
          ))}
        </div>

        {/* Buscador de productos: escribe 2 letras y elige */}
        <div className="relative">
          <input placeholder="Buscar producto (ej. dualsense)" value={buscar} onChange={(e) => setBuscar(e.target.value)} className={campo} />
          {encontrados.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-tinta/15 bg-fondo text-sm">
              {encontrados.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => agregar(p)} disabled={p.stock === 0}
                    className="flex w-full justify-between px-3 py-2 text-left hover:bg-tinta/10 disabled:opacity-40">
                    <span>{p.nombre}</span><span className="text-tinta/60">{soles(p.precio_final)} · {p.stock} en stock</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ul className="space-y-2 text-sm">
          {lineas.map((l) => (
            <li key={l.producto.id} className="flex items-center justify-between gap-2 rounded-lg bg-tinta/5 px-3 py-2">
              <span className="flex-1">{l.producto.nombre}</span>
              <input type="number" min="0" max={Math.min(5, l.producto.stock)} value={l.cantidad}
                onChange={(e) => cambiarCantidad(l.producto.id, Number(e.target.value))} className="w-14 rounded bg-superficie px-2 py-1" />
              <span className="w-20 text-right">{soles(Number(l.producto.precio_final) * l.cantidad)}</span>
            </li>
          ))}
          {lineas.length === 0 && <li className="text-tinta/60">Agrega al menos un producto.</li>}
        </ul>
        <p className="text-right text-lg font-bold">Total: {soles(total)}</p>

        <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={campo}>
          {METODOS[canal].map((m) => <option key={m} value={m}>{NOMBRES[m]}</option>)}
        </select>
        {metodo === 'yape' && (
          <input placeholder="N.º de operación de Yape" value={operacion} onChange={(e) => setOperacion(e.target.value)} className={campo}
            pattern="\d{6,12}" required />
        )}
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
          <input placeholder="Celular (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={campo}
            pattern="9\d{8}" title="9 dígitos, empieza con 9" />
        </div>
        <p className="text-xs text-tinta/60">Con el celular, la compra aparece en “Mis compras” del cliente y podrá dejar una reseña verificada.</p>

        {error && <p className="text-sm text-error">{error}</p>}
        {mensaje && <p className="text-sm text-ok">{mensaje}</p>}
        <button disabled={lineas.length === 0} className="w-full rounded-lg bg-rosa py-2 font-semibold text-white disabled:opacity-40">
          Registrar venta
        </button>
      </form>

      <div>
        <h2 className="text-lg font-semibold">Últimas ventas en tienda y WhatsApp</h2>
        <table className="mt-3 w-full text-sm [&_td]:pr-3 [&_th]:pr-3">
          <thead className="text-left text-tinta/60">
            <tr><th className="py-1">Código</th><th>Fecha</th><th>Canal</th><th>Cliente</th><th>Productos</th><th>Pago</th><th>Total</th></tr>
          </thead>
          <tbody className="divide-y divide-tinta/10">
            {ultimas.map((v) => (
              <tr key={v.codigo}>
                <td className="whitespace-nowrap py-2 font-mono text-rosa">{v.codigo}</td>
                <td className="whitespace-nowrap">{new Date(v.fecha + 'T12:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</td>
                <td>{v.canal === 'tienda' ? 'Tienda' : 'WhatsApp'}</td>
                <td>{v.cliente}</td>
                <td>{v.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')}</td>
                <td>{NOMBRES[v.metodo_pago]}</td>
                <td className="whitespace-nowrap">{soles(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ultimas.length === 0 && <p className="mt-2 text-sm text-tinta/60">Todavía no hay ventas registradas en la tienda.</p>}
      </div>
    </section>
  )
}
