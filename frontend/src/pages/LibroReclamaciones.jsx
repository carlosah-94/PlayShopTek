// HU-18: Libro de Reclamaciones virtual (Ley N.º 29571). Cualquiera puede registrar un reclamo o una queja.
import { useState } from 'react'
import { api } from '../api.js'

const VACIO = { tipo: 'reclamo', nombre: '', correo: '', telefono: '', documento: '', domicilio: '',
  bien_contratado: '', monto_reclamado: '', detalle: '', pedido_cliente: '' }

const fecha = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })

export default function LibroReclamaciones() {
  const [form, setForm] = useState(VACIO)
  const [hoja, setHoja] = useState(null) // el reclamo ya registrado, con su código
  const [error, setError] = useState('')
  const cambiar = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const campo = 'w-full rounded-lg border border-white/15 bg-superficie px-3 py-2'

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    // Los campos opcionales vacíos se mandan como null para que el servidor no los valide
    const cuerpo = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      setHoja(await api('/reclamos', { metodo: 'POST', cuerpo }))
      setForm(VACIO)
    } catch (err) {
      setError(err.message)
    }
  }

  if (hoja) {
    return (
      <section className="mx-auto max-w-xl space-y-3 rounded-xl border border-white/10 bg-superficie p-6">
        <h1 className="text-xl font-bold">Recibimos tu {hoja.tipo}</h1>
        <p>Tu código es <span className="font-mono font-bold text-rosa">{hoja.codigo}</span>. Guárdalo para hacer seguimiento.</p>
        <p className="text-sm text-white/70">Te responderemos al correo {hoja.correo} a más tardar el <b>{fecha(hoja.fecha_limite)}</b> (15 días hábiles).</p>
        <button onClick={() => setHoja(null)} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm">Registrar otro</button>
      </section>
    )
  }

  return (
    <form onSubmit={enviar} className="mx-auto max-w-2xl space-y-4 rounded-xl border border-white/10 bg-superficie/50 p-6">
      <div>
        <h1 className="text-xl font-bold">📕 Libro de Reclamaciones</h1>
        <p className="text-sm text-white/60">Play Shop Tek · Av. Revolución 1420, Villa El Salvador. Conforme a la Ley N.º 29571.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">1. Tus datos</legend>
        <input placeholder="Nombre completo" value={form.nombre} onChange={cambiar('nombre')} className={campo} required minLength={3} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="email" placeholder="Correo" value={form.correo} onChange={cambiar('correo')} className={campo} required />
          <input placeholder="Celular (opcional)" value={form.telefono} onChange={cambiar('telefono')} className={campo}
            inputMode="numeric" pattern="9[0-9]{8}" title="9 dígitos, empieza con 9" />
          <input placeholder="DNI o CE (opcional)" value={form.documento} onChange={cambiar('documento')} className={campo}
            inputMode="numeric" pattern="[0-9]{8,12}" title="Entre 8 y 12 números" />
          <input placeholder="Domicilio (opcional)" value={form.domicilio} onChange={cambiar('domicilio')} className={campo} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">2. Lo que compraste o el servicio</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Producto o servicio (ej. Mando DualSense)" value={form.bien_contratado} onChange={cambiar('bien_contratado')} className={campo} />
          <input type="number" min="0" step="0.01" placeholder="Monto reclamado S/ (opcional)" value={form.monto_reclamado}
            onChange={cambiar('monto_reclamado')} className={campo} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">3. Detalle</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={form.tipo === 'reclamo'} onChange={() => setForm({ ...form, tipo: 'reclamo' })} />
            Reclamo <span className="text-white/50">(el producto o servicio)</span></label>
          <label className="flex items-center gap-2"><input type="radio" checked={form.tipo === 'queja'} onChange={() => setForm({ ...form, tipo: 'queja' })} />
            Queja <span className="text-white/50">(la atención)</span></label>
        </div>
        <textarea placeholder="¿Qué pasó?" value={form.detalle} onChange={cambiar('detalle')} className={campo} rows={4} required minLength={10} />
        <textarea placeholder="¿Qué solicitas? (cambio, devolución, reparación…)" value={form.pedido_cliente} onChange={cambiar('pedido_cliente')} className={campo} rows={2} />
      </fieldset>

      {error && <p className="text-sm text-red-300">{error}</p>}
      <button className="w-full rounded-lg bg-rosa py-2 font-semibold text-white">Enviar</button>
    </form>
  )
}