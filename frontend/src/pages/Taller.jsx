// HU-06: Linda o Ángel registran el equipo que llega al mostrador.
// HU-08: avanzan su estado y avisan al cliente por WhatsApp cuando está listo.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

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

  const campo = 'w-full rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm'
  return (
    <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={registrar} className="space-y-3 rounded-xl border border-tinta/10 bg-superficie/50 p-5">
        <h1 className="text-xl font-bold">Recibir equipo</h1>
        <input placeholder="Nombre del cliente" value={form.cliente_nombre} onChange={cambiar('cliente_nombre')} className={campo} required />
        <input placeholder="Celular (9 dígitos)" value={form.cliente_telefono} onChange={cambiar('cliente_telefono')} className={campo}
          pattern="9[0-9]{8}" title="9 dígitos, empieza con 9" required />
        <input placeholder="Equipo (ej. Mando DualShock 4)" value={form.equipo} onChange={cambiar('equipo')} className={campo} required />
        <textarea placeholder="¿Qué le pasa? (con las palabras del cliente)" value={form.falla} onChange={cambiar('falla')} className={campo} rows={2} required />
        <select value={form.tipo_servicio_id} onChange={elegirServicio} className={campo}>
          <option value="">Tipo de servicio</option>
          {opciones.servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={form.categoria_falla_id} onChange={cambiar('categoria_falla_id')} className={campo}>
          <option value="">Categoría de la falla</option>
          {opciones.fallas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
        <input placeholder="Diagnóstico (opcional)" value={form.diagnostico} onChange={cambiar('diagnostico')} className={campo} />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" min="0" step="1" placeholder="Costo S/" value={form.costo} onChange={cambiar('costo')} className={campo} />
          <input placeholder="Tiempo (ej. 30 min)" value={form.duracion_estimada} onChange={cambiar('duracion_estimada')} className={campo} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.precio_acordado} onChange={cambiar('precio_acordado')} />
          El cliente aceptó el precio
        </label>
        {error && <p className="text-sm text-error">{error}</p>}
        {mensaje && <p className="rounded-lg bg-green-500/15 p-2 text-sm text-ok">{mensaje}</p>}
        <button className="w-full rounded-lg bg-rosa py-2 font-semibold text-white">Registrar</button>
      </form>

      <div>
        <h2 className="text-lg font-semibold">En el taller ({lista.length})</h2>
        <ul className="mt-2 divide-y divide-tinta/10 rounded-xl border border-tinta/10 bg-superficie text-sm">
          {lista.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="font-mono text-rosa">{r.codigo}</span>
              <span className="font-semibold">{r.equipo}</span>
              <span className="text-tinta/60">{r.cliente}</span>
              <span className="ml-auto rounded bg-tinta/10 px-2 py-0.5 text-xs">{ESTADOS[r.estado]}</span>
              <span className="w-full text-tinta/60">{r.falla}{r.tecnico ? ' · ' + r.tecnico : ''}</span>
              <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                {r.estado === 'listo_para_recoger' && (
                  <>
                    <a href={enlaceWhatsApp(r)} target="_blank" rel="noreferrer" className="rounded-lg border border-green-500/50 px-3 py-1 text-xs text-ok">Reenviar WhatsApp</a>
                    <select value={pagos[r.id] || 'efectivo'} onChange={(e) => setPagos({ ...pagos, [r.id]: e.target.value })}
                      className="rounded-lg border border-tinta/15 bg-fondo px-2 py-1 text-xs">
                      <option value="efectivo">Pagó en efectivo</option>
                      <option value="yape">Pagó con Yape</option>
                      <option value="transferencia">Pagó por transferencia BCP</option>
                    </select>
                  </>
                )}
                <button onClick={() => avanzar(r)} className="ml-auto rounded-lg bg-morado px-3 py-1 text-xs font-semibold text-white">{textoBoton(r)}</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}