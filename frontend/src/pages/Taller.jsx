// HU-06: Linda o Ángel registran el equipo que llega al mostrador.
// HU-08: avanzan su estado y avisan al cliente por WhatsApp cuando está listo.
// HU-24: sección "Reparaciones" del panel, con tabla y filtros como el prototipo.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import {
  Caja, Encabezado, Estado, Filtros, FILTROS_VACIOS, botonRosa, campo, pasaFiltros,
} from '../components/PiezasPanel.jsx'

const VACIO = { cliente_nombre: '', cliente_telefono: '', equipo: '', falla: '', tipo_servicio_id: '',
  categoria_falla_id: '', diagnostico: '', costo: '', precio_acordado: false, duracion_estimada: '' }
const ESTADOS = { recibido: 'Recibido', diagnosticado: 'Diagnosticado', en_reparacion: 'En reparación',
  listo_para_recoger: 'Listo para recoger', entregado: 'Entregado' }
const ORDEN = Object.keys(ESTADOS)

// Arma el enlace de WhatsApp con el mensaje ya escrito; Linda solo presiona "Enviar"
function enlaceWhatsApp(r) {
  const texto = `Hola ${r.cliente.split(' ')[0]}, tu ${r.equipo} ya está listo para recoger en Play Shop Tek ` +
    `(Av. Revolución 1420, VES). Código: ${r.codigo}. Total: S/ ${Number(r.costo)}. ` +
    'Horario: lunes a sábado 12:00-20:00, domingo 15:00-20:00.'
  return `https://wa.me/51${r.telefono}?text=${encodeURIComponent(texto)}`
}

export default function Taller() {
  const sesion = leerSesion()
  const [form, setForm] = useState(VACIO)
  const [opciones, setOpciones] = useState({ servicios: [], fallas: [] })
  const [lista, setLista] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [pagos, setPagos] = useState({}) // cómo pagó cada cliente al entregar: { id: 'yape' }
  const [abierto, setAbierto] = useState(false) // formulario "Registrar reparación"
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)

  const cargarLista = () => api('/reparaciones').then(setLista).catch((e) => setError(e.message))
  useEffect(() => {
    if (!sesion || sesion.usuario.rol === 'cliente') return
    api('/reparaciones/opciones').then(setOpciones).catch((e) => setError(e.message))
    cargarLista()
  }, [])

  if (!sesion || sesion.usuario.rol === 'cliente') return <Navigate to="/login" />

  const cambiar = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  // Al elegir el servicio, propone su precio "desde" como costo inicial
  const elegirServicio = (e) => {
    const s = opciones.servicios.find((x) => String(x.id) === e.target.value)
    setForm({ ...form, tipo_servicio_id: e.target.value, costo: form.costo || (s?.precio_desde ?? '') })
  }

  const registrar = async (e) => {
    e.preventDefault()
    setError(''); setMensaje('')
    const cuerpo = { ...form, costo: Number(form.costo || 0),
      tipo_servicio_id: form.tipo_servicio_id ? Number(form.tipo_servicio_id) : null,
      categoria_falla_id: form.categoria_falla_id ? Number(form.categoria_falla_id) : null }
    try {
      const r = await api('/reparaciones', { metodo: 'POST', cuerpo })
      setMensaje(`Registrado con el código ${r.codigo}. Dáselo a ${r.cliente.split(' ')[0]} para que rastree su equipo.`)
      setForm(VACIO)
      setAbierto(false)
      cargarLista()
    } catch (err) {
      setError(err.message)
    }
  }

  const avanzar = async (r) => {
    const siguiente = ORDEN[ORDEN.indexOf(r.estado) + 1]
    const cuerpo = { estado: siguiente }
    if (siguiente === 'en_reparacion' && !r.precio_acordado) cuerpo.precio_acordado = true
    if (siguiente === 'entregado') cuerpo.pago = pagos[r.id] || 'efectivo'
    setError(''); setMensaje('')
    try {
      const nuevo = await api(`/reparaciones/${r.id}/estado`, { metodo: 'PATCH', cuerpo })
      if (siguiente === 'listo_para_recoger') window.open(enlaceWhatsApp(nuevo), '_blank')
      setMensaje(`${r.codigo}: ${ESTADOS[siguiente]}`)
      cargarLista()
    } catch (err) {
      setError(err.message)
    }
  }

  // Texto del botón según el paso que sigue
  const textoBoton = (r) => {
    const siguiente = ORDEN[ORDEN.indexOf(r.estado) + 1]
    if (siguiente === 'en_reparacion' && !r.precio_acordado) return `Cliente aceptó S/ ${Number(r.costo)} → En reparación`
    if (siguiente === 'listo_para_recoger') return 'Listo · avisar por WhatsApp'
    return '→ ' + ESTADOS[siguiente]
  }

  const visibles = lista.filter((r) => pasaFiltros(filtros, {
    textos: [r.cliente, r.equipo, r.codigo, r.falla, r.telefono], estado: r.estado, fecha: r.fecha_ingreso,
  }))
  const listos = lista.filter((r) => r.estado === 'listo_para_recoger').length
  const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-tinta/60'

  return (
    <div className="space-y-4">
      <Encabezado titulo="Reparaciones" detalle={`${lista.length} activas · ${listos} listas para recoger`}>
        <button type="button" onClick={() => setAbierto(!abierto)} className={botonRosa} aria-expanded={abierto}>
          <Icono nombre={abierto ? 'cerrar' : 'mas'} tam={16} /> {abierto ? 'Cerrar formulario' : 'Registrar reparación'}
        </button>
      </Encabezado>

      <p className="flex items-start gap-2 rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm">
        <span className="text-ok"><Icono nombre="whatsapp" tam={18} /></span>
        El diagnóstico, el precio y el pago (Yape o en tienda) se acuerdan por WhatsApp. Aquí registras el equipo y vas moviendo su estado:
        el cliente lo ve con su código y, al pasar a «Listo para recoger», se abre el WhatsApp con el aviso ya escrito.
      </p>
      {mensaje && <p className="rounded-lg bg-ok/10 p-3 text-sm text-ok">{mensaje}</p>}
      {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

      {abierto && (
        <Caja titulo="Registrar una reparación" extra={<span className="text-xs text-tinta/60">Con los datos que acordaste con el cliente por WhatsApp.</span>}>
          <form onSubmit={registrar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input id="rep-cliente" placeholder="Nombre del cliente *" value={form.cliente_nombre} onChange={cambiar('cliente_nombre')} className={campo} required />
            <input id="rep-telefono" placeholder="WhatsApp del cliente (9 dígitos) *" value={form.cliente_telefono} onChange={cambiar('cliente_telefono')} className={campo}
              pattern="9[0-9]{8}" title="9 dígitos, empieza con 9" required />
            <input id="rep-equipo" placeholder="Equipo (ej. Mando DualShock 4) *" value={form.equipo} onChange={cambiar('equipo')} className={campo} required />
            <textarea id="rep-falla" placeholder="Falla reportada (con las palabras del cliente) *" value={form.falla} onChange={cambiar('falla')}
              className={campo + ' sm:col-span-2 lg:col-span-3'} rows={2} required />
            <select id="rep-servicio" value={form.tipo_servicio_id} onChange={elegirServicio} className={campo} aria-label="Tipo de servicio">
              <option value="">Tipo de servicio</option>
              {opciones.servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select id="rep-falla-cat" value={form.categoria_falla_id} onChange={cambiar('categoria_falla_id')} className={campo} aria-label="Categoría de la falla">
              <option value="">Categoría de la falla</option>
              {opciones.fallas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
            <input id="rep-diagnostico" placeholder="Diagnóstico (opcional)" value={form.diagnostico} onChange={cambiar('diagnostico')} className={campo} />
            <input id="rep-costo" type="number" min="0" step="1" placeholder="Precio acordado S/ (opcional)" value={form.costo} onChange={cambiar('costo')} className={campo} />
            <input id="rep-tiempo" placeholder="Tiempo (ej. 30 min)" value={form.duracion_estimada} onChange={cambiar('duracion_estimada')} className={campo} />
            <label className="flex items-center gap-2 text-sm">
              <input id="rep-acordado" type="checkbox" checked={form.precio_acordado} onChange={cambiar('precio_acordado')} />
              El cliente aceptó el precio
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <button className={botonRosa}>Registrar reparación</button>
              <button type="button" onClick={() => setAbierto(false)} className="rounded-lg px-3 py-2 text-sm text-tinta/70 hover:underline">Cancelar</button>
            </div>
          </form>
        </Caja>
      )}

      <Caja>
        <Filtros filtros={filtros} setFiltros={setFiltros} estados={ORDEN.slice(0, 4)} placeholder="Cliente, equipo, orden o código" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-tinta/10">
              <tr><th className={th}>Orden</th><th className={th}>Fecha</th><th className={th}>Cliente</th><th className={th}>Equipo</th>
                <th className={th}>Falla</th><th className={th}>Atiende</th><th className={th}>Precio</th><th className={th}>Estado</th><th className={th}>Siguiente paso</th></tr>
            </thead>
            <tbody className="divide-y divide-tinta/10">
              {visibles.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-3"><span className="inline-block rounded-md border border-rosa/40 bg-rosa/10 px-2 py-0.5 font-mono text-xs text-rosa">{r.codigo}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{r.fecha_ingreso}</td>
                  <td className="px-3 py-3"><p className="font-medium">{r.cliente}</p><p className="text-xs text-tinta/60">{r.telefono}</p></td>
                  <td className="px-3 py-3">{r.equipo}</td>
                  <td className="px-3 py-3 text-tinta/80">{r.falla}</td>
                  <td className="px-3 py-3">{r.tecnico || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums">{r.precio_acordado ? 'S/ ' + Number(r.costo) : 'Por acordar'}</td>
                  <td className="px-3 py-3"><Estado estado={r.estado} /></td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-48 flex-col gap-2">
                      {r.estado === 'listo_para_recoger' && (
                        <>
                          <a href={enlaceWhatsApp(r)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-ok hover:underline">
                            <Icono nombre="whatsapp" tam={14} /> Reenviar aviso
                          </a>
                          <select value={pagos[r.id] || 'efectivo'} onChange={(e) => setPagos({ ...pagos, [r.id]: e.target.value })}
                            aria-label={'Cómo pagó ' + r.cliente} className="rounded-lg border border-tinta/15 bg-superficie px-2 py-1 text-xs">
                            <option value="efectivo">Pagó en efectivo</option>
                            <option value="yape">Pagó con Yape</option>
                            <option value="transferencia">Pagó por transferencia BCP</option>
                          </select>
                        </>
                      )}
                      <button type="button" onClick={() => avanzar(r)} className="rounded-lg bg-morado px-3 py-1.5 text-xs font-semibold text-white">{textoBoton(r)}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibles.length === 0 && <p className="py-6 text-center text-sm text-tinta/60">No hay reparaciones con esos filtros.</p>}
        </div>
      </Caja>
    </div>
  )
}
