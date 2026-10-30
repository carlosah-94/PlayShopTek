// HU-18: el equipo ve los reclamos con su plazo; solo Ángel (dueño) puede responderlos.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

const fecha = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })

export default function Reclamos() {
  const sesion = leerSesion()
  const [lista, setLista] = useState([])
  const [textos, setTextos] = useState({}) // respuesta que se está escribiendo para cada reclamo: { id: 'texto' }
  const [error, setError] = useState('')

  const cargar = () => api('/reclamos').then(setLista).catch((e) => setError(e.message))
  useEffect(() => { if (sesion && sesion.usuario.rol !== 'cliente') cargar() }, [])

  if (!sesion || sesion.usuario.rol === 'cliente') return <Navigate to="/login" />
  const esDueno = sesion.usuario.rol === 'dueno'

  const responder = async (id) => {
    setError('')
    try {
      await api(`/reclamos/${id}/respuesta`, { metodo: 'PATCH', cuerpo: { respuesta: textos[id] || '' } })
      setTextos({ ...textos, [id]: '' })
      cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Libro de Reclamaciones</h1>
        <p className="text-sm text-tinta/60">Plazo legal: 15 días hábiles para responder.</p>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      {lista.length === 0 && <p className="text-tinta/60">No hay reclamos registrados.</p>}

      {lista.map((r) => (
        <article key={r.id} className="space-y-2 rounded-xl border border-tinta/10 bg-superficie p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-rosa">{r.codigo}</span>
            <span className="rounded bg-tinta/10 px-2 py-0.5 text-xs capitalize">{r.tipo}</span>
            <span className={'rounded px-2 py-0.5 text-xs ' + (r.estado === 'pendiente' ? 'bg-amber-400/20 text-aviso' : 'bg-green-400/20 text-ok')}>
              {r.estado === 'pendiente' ? 'Pendiente · responder hasta el ' + fecha(r.fecha_limite) : 'Respondido'}</span>
            <span className="ml-auto text-xs text-tinta/60">Recibido el {fecha(r.fecha)}</span>
          </div>
          <p className="text-sm"><b>{r.nombre}</b> · {r.correo}{r.telefono ? ' · ' + r.telefono : ''}</p>
          {r.bien_contratado && <p className="text-sm text-tinta/70">{r.bien_contratado}{r.monto_reclamado ? ' · S/ ' + r.monto_reclamado : ''}</p>}
          <p className="text-sm">{r.detalle}</p>
          {r.pedido_cliente && <p className="text-sm text-tinta/70">Solicita: {r.pedido_cliente}</p>}

          {r.respuesta && <p className="rounded-lg bg-fondo p-3 text-sm"><b>Respuesta:</b> {r.respuesta}</p>}
          {!r.respuesta && esDueno && (
            <div className="flex gap-2">
              <input placeholder="Escribe la respuesta al cliente" value={textos[r.id] || ''}
                onChange={(e) => setTextos({ ...textos, [r.id]: e.target.value })}
                className="flex-1 rounded-lg border border-tinta/15 bg-fondo px-3 py-2 text-sm" />
              <button onClick={() => responder(r.id)} className="rounded-lg bg-rosa px-3 py-2 text-sm font-semibold text-white">Responder</button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}