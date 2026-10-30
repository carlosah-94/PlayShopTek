// HU-15: Linda o Ángel registran lo que se vende en el mostrador o por WhatsApp.
// HU-24: sección "Ventas" del panel: todos los pedidos (web, tienda y WhatsApp) con filtros,
// y el botón para pasar un pedido a "Listo para recoger" (el cliente recibe el aviso) y luego a "Entregado".
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import {
  Caja, Encabezado, Estado, Filtros, FILTROS_VACIOS, NOMBRE_ESTADO, Paginacion, botonRosa, pasaFiltros, soles,
} from '../components/PiezasPanel.jsx'

const CANAL = { web: 'Web', tienda: 'Tienda', whatsapp: 'WhatsApp' }
const SIGUIENTE = { pagado: 'listo_para_recoger', listo_para_recoger: 'entregado' }
const POR_PAGINA = 15
// Medios de pago que acepta cada canal (regla del dueño)
const METODOS = { tienda: ['efectivo', 'yape', 'transferencia'], whatsapp: ['yape'] }
const NOMBRES = { efectivo: 'Efectivo', yape: 'Yape', transferencia: 'Transferencia BCP', tarjeta: 'Tarjeta' }
const campo = 'w-full rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm'

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
  const [ventas, setVentas] = useState([])
  const [abierto, setAbierto] = useState(false) // formulario "Registrar venta"
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const cargarVentas = () => api('/ventas').then(setVentas).catch((e) => setError(e.message))
  useEffect(() => {
    if (!sesion || sesion.usuario.rol === 'cliente') return
    api('/productos').then((ps) => setProductos(ps.filter((p) => !p.es_preventa))).catch((e) => setError(e.message))
    cargarVentas()
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
      setAbierto(false)
      cargarVentas()
      api('/productos').then((ps) => setProductos(ps.filter((p) => !p.es_preventa)))
    } catch (err) {
      setError(err.message)
    }
  }

  // Avanza el pedido un paso: Pagado -> Listo para recoger -> Entregado
  const avanzar = async (v) => {
    setError(''); setMensaje('')
    try {
      const nuevo = await api(`/ventas/${v.codigo}/estado`, { metodo: 'PATCH', cuerpo: { estado: SIGUIENTE[v.estado] } })
      setVentas(ventas.map((x) => (x.codigo === v.codigo ? nuevo : x)))
      setMensaje(`${v.codigo}: ${NOMBRE_ESTADO[nuevo.estado]}` + (nuevo.estado === 'listo_para_recoger' ? '. El cliente ya tiene el aviso en su cuenta.' : ''))
    } catch (err) {
      setError(err.message)
    }
  }

  const esDueno = sesion.usuario.rol === 'dueno'
  const visibles = ventas.filter((v) => pasaFiltros(filtros, {
    textos: [v.codigo, v.cliente, ...v.items.map((i) => i.nombre)], estado: v.estado, fecha: v.fecha,
  }))
  const pagina_ = visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const cobrado = ventas.filter((v) => v.estado !== 'cancelado').reduce((s, v) => s + Number(v.total), 0)
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-tinta/60'
  const detalle = (v) => v.items[0].nombre + (v.items.length > 1 ? ` + ${v.items.length - 1} más` : '') + (v.items[0].cantidad > 1 ? ` (×${v.items[0].cantidad})` : '')

  return (
    <div className="space-y-4">
      {/* Linda no ve los montos totales del negocio */}
      <Encabezado titulo="Ventas" detalle={`${ventas.length} pedidos` + (esDueno ? ` · ${soles(cobrado)} sin cancelados` : '')}>
        <button type="button" onClick={() => setAbierto(!abierto)} className={botonRosa} aria-expanded={abierto}>
          <Icono nombre={abierto ? 'cerrar' : 'mas'} tam={16} /> {abierto ? 'Cerrar formulario' : 'Registrar venta'}
        </button>
      </Encabezado>
      {mensaje && <p className="rounded-lg bg-ok/10 p-3 text-sm text-ok">{mensaje}</p>}
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      {abierto && (
        <Caja titulo="Registrar venta" extra={<span className="max-w-md text-xs text-tinta/60">Ventas cobradas en el mostrador o coordinadas por WhatsApp. Descuentan el stock igual que una compra web y suman al tablero.</span>}>
          <form onSubmit={registrar} className="grid gap-3 lg:max-w-2xl">
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

        <button disabled={lineas.length === 0} className="w-full rounded-lg bg-rosa py-2 font-semibold text-white disabled:opacity-40">
          Registrar venta
        </button>
          </form>
        </Caja>
      )}

      <Caja>
        <Filtros filtros={filtros} setFiltros={(f) => { setFiltros(f); setPagina(1) }}
          estados={['pagado', 'reservado', 'listo_para_recoger', 'entregado', 'cancelado']} placeholder="Cliente, producto o pedido" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-tinta/10">
              <tr><th className={th}>Pedido</th><th className={th}>Fecha</th><th className={th}>Cliente</th><th className={th}>Detalle</th>
                <th className={th}>Canal · pago</th><th className={th}>Total</th><th className={th}>Estado</th><th className={th}></th></tr>
            </thead>
            <tbody className="divide-y divide-tinta/10">
              {pagina_.map((v) => (
                <tr key={v.codigo}>
                  <td className="px-3 py-3 font-mono text-xs">{v.codigo}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{v.fecha}</td>
                  <td className="px-3 py-3 font-medium">{v.cliente}</td>
                  <td className="px-3 py-3">{detalle(v)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-tinta/80">{CANAL[v.canal]} · {NOMBRES[v.metodo_pago] || v.metodo_pago}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{soles(v.total)}</td>
                  <td className="px-3 py-3"><Estado estado={v.estado} /></td>
                  <td className="px-3 py-3 text-right">
                    {SIGUIENTE[v.estado] && (
                      <button type="button" onClick={() => avanzar(v)}
                        className="whitespace-nowrap rounded-lg border border-morado/40 px-3 py-1 text-xs font-semibold text-morado hover:bg-morado/10">
                        → {NOMBRE_ESTADO[SIGUIENTE[v.estado]]}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibles.length === 0 && <p className="py-6 text-center text-sm text-tinta/60">No hay pedidos con esos filtros.</p>}
        </div>
        <Paginacion pagina={pagina} setPagina={setPagina} total={visibles.length} porPagina={POR_PAGINA} />
      </Caja>
    </div>
  )
}
