// HU-07: el cliente ve en qué paso está su reparación, sin llamar ni escribir por WhatsApp.
import { useState } from 'react'
import { api } from '../api.js'

const PASOS = [['recibido', 'Recibido'], ['diagnosticado', 'Diagnosticado'], ['en_reparacion', 'En reparación'],
  ['listo_para_recoger', 'Listo para recoger'], ['entregado', 'Entregado']]

const fechaHora = (iso) => new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Rastreo() {
  const [codigo, setCodigo] = useState('')
  const [celular, setCelular] = useState('')
  const [rep, setRep] = useState(null)
  const [error, setError] = useState('')

  const buscar = async (e) => {
    e.preventDefault()
    setError(''); setRep(null)
    try {
      setRep(await api(`/rastreo/${encodeURIComponent(codigo.trim())}?celular=${celular}`))
    } catch (err) {
      setError(err.message)
    }
  }

  // Cuándo pasó por cada estado (si ya pasó)
  const cuando = Object.fromEntries((rep?.historial || []).map((h) => [h.estado, h.fecha]))
  const actual = rep ? PASOS.findIndex(([k]) => k === rep.estado) : -1
  const campo = 'w-full rounded-lg border border-tinta/15 bg-superficie px-3 py-2'

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <form onSubmit={buscar} className="space-y-3 rounded-xl border border-tinta/10 bg-superficie/50 p-6">
        <h1 className="text-xl font-bold">Rastrea tu reparación</h1>
        <p className="text-sm text-tinta/60">Usa el código que te dimos al dejar tu equipo (ej. R-2062).</p>
        <input placeholder="Código de reparación" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={campo} required />
        <input placeholder="4 últimos dígitos de tu celular" value={celular} onChange={(e) => setCelular(e.target.value)}
          className={campo} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} title="Solo los 4 últimos dígitos" required />
        {error && <p className="text-sm text-error">{error}</p>}
        <button className="w-full rounded-lg bg-rosa py-2 font-semibold text-white">Ver estado</button>
      </form>

      {rep && (
        <div className="space-y-4 rounded-xl border border-tinta/10 bg-superficie p-6">
          <div>
            <p className="font-mono text-rosa">{rep.codigo}</p>
            <h2 className="text-lg font-semibold">Hola, {rep.cliente}: tu {rep.equipo}</h2>
            <p className="text-sm text-tinta/60">{rep.falla}{rep.servicio ? ' · ' + rep.servicio : ''}</p>
          </div>

          <ol className="space-y-3">
            {PASOS.map(([k, nombre], i) => (
              <li key={k} className="flex items-center gap-3">
                <span className={'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ' +
                  (i <= actual ? 'bg-rosa text-white' : 'border border-tinta/20 text-tinta/60')}>{i < actual ? '✓' : i + 1}</span>
                <span className={i === actual ? 'font-semibold' : i < actual ? 'text-tinta/80' : 'text-tinta/60'}>{nombre}</span>
                {cuando[k] && <span className="ml-auto text-xs text-tinta/60">{fechaHora(cuando[k])}</span>}
              </li>
            ))}
          </ol>

          <p className="text-sm">
            Costo: <b>S/ {Number(rep.costo)}</b> {rep.precio_acordado ? '(aceptado)' : '(por confirmar contigo)'}
            {rep.duracion_estimada && <> · Tiempo estimado: {rep.duracion_estimada}</>}
          </p>
          {rep.estado === 'listo_para_recoger' && (
            <p className="rounded-lg bg-green-500/15 p-3 text-sm text-ok">¡Ya puedes recogerlo en Av. Revolución 1420, Villa El Salvador!</p>
          )}
        </div>
      )}
    </section>
  )
}