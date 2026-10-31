// HU-07: el cliente ve en qué paso está su reparación, sin llamar ni escribir por WhatsApp.
// HU-26: con el diseño del prototipo: buscador grande y el código de ejemplo debajo.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import { BotonWhatsApp } from '../components/Asesores.jsx'
import Icono from '../components/Iconos.jsx'
import { botonRosa } from '../components/PiezasPanel.jsx'

const PASOS = [['recibido', 'Recibido'], ['diagnosticado', 'Diagnosticado'], ['en_reparacion', 'En reparación'],
  ['listo_para_recoger', 'Listo para recoger'], ['entregado', 'Entregado']]

const fechaHora = (iso) => new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Rastreo() {
  const [parametros] = useSearchParams()
  const [codigo, setCodigo] = useState(parametros.get('codigo') || '') // llega desde "Mis reparaciones"
  const [celular, setCelular] = useState('')
  // Si el cliente inició sesión, se completan solos los 4 últimos dígitos de su celular
  useEffect(() => {
    if (leerSesion()?.usuario.rol === 'cliente') api('/mi/perfil').then((p) => p.telefono && setCelular(p.telefono.slice(-4))).catch(() => {})
  }, [])
  // Desde "Mis reparaciones" (botón Seguir) llegan el código y el celular: se busca solo
  useEffect(() => { if (parametros.get('codigo') && celular.length === 4 && !rep) buscar() }, [celular])
  const [rep, setRep] = useState(null)
  const [error, setError] = useState('')

  const buscar = async (e) => {
    e?.preventDefault()
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
  const campo = 'w-full rounded-lg border border-tinta/15 bg-fondo px-3 py-2.5'
  const probar = () => { setCodigo('R-2062'); setCelular('2445') }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-morado">Servicio técnico</p>
        <h1 className="text-3xl font-semibold">Rastrea tu reparación</h1>
        <p className="mt-1 max-w-xl text-tinta/80">Escribe el código de seguimiento que te enviamos por WhatsApp al dejar tu equipo y los 4 últimos dígitos de tu celular. No necesitas cuenta.</p>
      </div>
      <form onSubmit={buscar} className="space-y-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="block"><span className="mb-1 block text-xs text-tinta/70">Código de seguimiento</span>
            <input id="rastreo-codigo" placeholder="Ej. R-2062" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={campo} required /></label>
          <label className="block"><span className="mb-1 block text-xs text-tinta/70">4 últimos dígitos de tu celular</span>
            <input id="rastreo-celular" placeholder="Ej. 2445" value={celular} onChange={(e) => setCelular(e.target.value)}
              className={campo} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} title="Solo los 4 últimos dígitos" required /></label>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-5 py-2.5 font-semibold text-white shadow-md">
            <Icono nombre="buscar" tam={16} /> Rastrear
          </button>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-xs text-tinta/70">
          <Icono nombre="reloj" tam={14} /> En esta demo puedes probar con el código
          <button type="button" onClick={probar} className="rounded-md border border-rosa/40 bg-rosa/10 px-2 py-0.5 font-mono text-rosa">R-2062 · 2445</button>
        </p>
        {error && <p className="text-sm text-error">{error}</p>}
      </form>

      {rep && (
        <div className="space-y-4 rounded-2xl border border-tinta/10 bg-superficie p-6 shadow-sm">
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
            <p className="rounded-lg border border-ok/40 p-3 text-sm text-ok">¡Ya puedes recogerlo en Av. Revolución 1420, Villa El Salvador!</p>
          )}
          {/* HU-26: como el prototipo: consultar por WhatsApp con los asesores */}
          <p className="rounded-lg border border-morado/30 bg-morado/10 px-3 py-2.5 text-sm text-tinta/80">El precio y el pago se coordinan por WhatsApp. Cada vez que la tienda actualiza el estado, te avisamos por WhatsApp.</p>
          <BotonWhatsApp mensaje={`Hola Play Shop Tek, quiero consultar por mi reparación ${rep.codigo}.`} lugar="arriba" flecha className={botonRosa}>
            <Icono nombre="whatsapp" tam={17} /> Consultar por WhatsApp
          </BotonWhatsApp>
        </div>
      )}
    </section>
  )
}